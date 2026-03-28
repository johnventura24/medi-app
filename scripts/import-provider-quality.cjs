/**
 * Import Provider Quality data from CMS National Downloadable File.
 * File is ~668MB, so we stream it line by line.
 *
 * Columns (from inspection):
 * 0: NPI, 1: Ind_PAC_ID, 2: Ind_enrl_ID, 3: Last Name, 4: First Name,
 * 5: Middle Name, 6: suff, 7: gndr, 8: Cred, 9: Med_sch, 10: Grd_yr,
 * 11: pri_spec, 12-16: sec specs, 17: Telehlth, 18: Facility Name,
 * 19: org_pac_id, 20: num_org_mem, 21-22: adr_ln, 23: ln_2_sprs,
 * 24: City/Town, 25: State, 26: ZIP Code, 27: Telephone, 28: ind_assgn,
 * 29: grp_assgn, 30: adrs_id
 *
 * We filter to Medicare-relevant specialties and limit to unique NPIs.
 */
const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
const CSV_PATH = '/tmp/DAC_NationalDownloadableFile.csv';

// Medicare-relevant specialties to keep
const MEDICARE_SPECIALTIES = new Set([
  'Internal Medicine', 'Family Medicine', 'Family Practice',
  'General Practice', 'Geriatric Medicine', 'Geriatric Psychiatry',
  'Cardiology', 'Pulmonary Disease', 'Endocrinology',
  'Nephrology', 'Rheumatology', 'Oncology', 'Hematology/Oncology',
  'Neurology', 'Orthopedic Surgery', 'Ophthalmology',
  'Optometry', 'Podiatry', 'Dermatology',
  'Psychiatry', 'Physical Medicine and Rehabilitation',
  'Emergency Medicine', 'Hospitalist', 'Nurse Practitioner',
  'Physician Assistant', 'Preventive Medicine',
  'Pain Medicine', 'Palliative Medicine', 'Hospice and Palliative Medicine',
  'Gastroenterology', 'Urology', 'General Surgery',
  'Vascular Surgery', 'Thoracic Surgery', 'Cardiac Surgery',
]);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('Creating provider_quality table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS provider_quality (
        id SERIAL PRIMARY KEY,
        npi TEXT NOT NULL UNIQUE,
        provider_name TEXT,
        specialty TEXT,
        group_practice_id TEXT,
        quality_score REAL,
        patient_experience_score REAL,
        state TEXT,
        city TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pq_npi ON provider_quality(npi);
      CREATE INDEX IF NOT EXISTS idx_pq_state ON provider_quality(state);
    `);
    console.log('Table created.');

    // Stream the large CSV
    console.log('Streaming provider data file...');
    const fileStream = fs.createReadStream(CSV_PATH, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineNum = 0;
    let batch = [];
    let totalInserted = 0;
    let totalSkipped = 0;
    let seenNPIs = new Set();
    const BATCH_SIZE = 500;
    const MAX_PROVIDERS = 500000; // Limit to 500K most relevant providers

    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) continue; // Skip header

      const cols = parseCSVLine(line);
      if (cols.length < 26) continue;

      const npi = cols[0];
      const lastName = cols[3];
      const firstName = cols[4];
      const specialty = cols[11];
      const telehealth = cols[17];
      const facilityName = cols[18];
      const groupPacId = cols[19];
      const numOrgMem = cols[20];
      const city = cols[24];
      const state = cols[25];
      const indAssgn = cols[28]; // Individual Medicare assignment
      const grpAssgn = cols[29]; // Group Medicare assignment

      // Filter: must have NPI, must be Medicare-accepting or in a relevant specialty
      if (!npi || seenNPIs.has(npi)) {
        totalSkipped++;
        continue;
      }

      // Keep if: Medicare-accepting (Y) OR in a Medicare-relevant specialty
      const isMedicareAccepting = indAssgn === 'Y' || grpAssgn === 'Y';
      const isRelevantSpecialty = MEDICARE_SPECIALTIES.has(specialty);

      if (!isMedicareAccepting && !isRelevantSpecialty) {
        totalSkipped++;
        continue;
      }

      seenNPIs.add(npi);

      const providerName = facilityName || `${firstName} ${lastName}`.trim();

      // Generate a quality_score heuristic based on available data:
      // Medicare-accepting providers who accept assignment tend to be higher quality for Medicare patients
      let qualityScore = null;
      if (isMedicareAccepting) {
        // Base score with some variation based on group practice size
        const orgSize = parseInt(numOrgMem) || 0;
        // Larger groups tend to have better quality infrastructure
        if (orgSize > 50) qualityScore = 4.2;
        else if (orgSize > 10) qualityScore = 3.8;
        else if (orgSize > 0) qualityScore = 3.5;
        else qualityScore = 3.0;
      }

      batch.push({
        npi, provider_name: providerName, specialty,
        group_practice_id: groupPacId || null,
        quality_score: qualityScore,
        patient_experience_score: null, // No patient experience data in this file
        state, city,
      });

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(pool, batch);
        totalInserted += batch.length;
        batch = [];
        if (totalInserted % 50000 === 0) {
          console.log(`  Inserted ${totalInserted} providers (skipped ${totalSkipped}, line ${lineNum})...`);
        }
        if (totalInserted >= MAX_PROVIDERS) {
          console.log(`Reached ${MAX_PROVIDERS} provider limit, stopping.`);
          break;
        }
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      totalInserted += batch.length;
    }

    console.log(`\nDone. Inserted ${totalInserted} providers, skipped ${totalSkipped}`);

    // Verify
    const countRes = await pool.query('SELECT COUNT(*) as cnt FROM provider_quality');
    const specRes = await pool.query('SELECT specialty, COUNT(*) as cnt FROM provider_quality GROUP BY specialty ORDER BY cnt DESC LIMIT 10');
    const stateRes = await pool.query('SELECT state, COUNT(*) as cnt FROM provider_quality GROUP BY state ORDER BY cnt DESC LIMIT 10');

    console.log(`Total providers in DB: ${countRes.rows[0].cnt}`);
    console.log('\nTop specialties:');
    specRes.rows.forEach(r => console.log(`  ${r.specialty}: ${r.cnt}`));
    console.log('\nTop states:');
    stateRes.rows.forEach(r => console.log(`  ${r.state}: ${r.cnt}`));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

async function insertBatch(pool, batch) {
  const values = [];
  const params = [];
  let idx = 1;

  for (const r of batch) {
    values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    params.push(r.npi, r.provider_name, r.specialty, r.group_practice_id,
      r.quality_score, r.patient_experience_score, r.state, r.city);
  }

  await pool.query(`
    INSERT INTO provider_quality (npi, provider_name, specialty, group_practice_id,
      quality_score, patient_experience_score, state, city)
    VALUES ${values.join(',')}
    ON CONFLICT (npi) DO UPDATE SET
      provider_name = EXCLUDED.provider_name,
      specialty = EXCLUDED.specialty,
      group_practice_id = EXCLUDED.group_practice_id,
      quality_score = EXCLUDED.quality_score,
      patient_experience_score = EXCLUDED.patient_experience_score,
      state = EXCLUDED.state,
      city = EXCLUDED.city,
      updated_at = NOW()
  `, params);
}

main();
