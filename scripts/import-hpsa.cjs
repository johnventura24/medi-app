/**
 * Import HRSA Health Professional Shortage Areas (HPSA) data
 * Sources: Primary Care, Dental Health, Mental Health HPSA CSVs from data.hrsa.gov
 */
const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const FILES = [
  { path: '/tmp/hpsa_pc.csv', designation: 'Primary Care' },
  { path: '/tmp/hpsa_dh.csv', designation: 'Dental Health' },
  { path: '/tmp/hpsa_mh.csv', designation: 'Mental Health' },
];

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
    console.log('Creating hpsa_shortage_areas table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hpsa_shortage_areas (
        id SERIAL PRIMARY KEY,
        hpsa_id TEXT,
        hpsa_name TEXT,
        hpsa_type TEXT,
        hpsa_score INTEGER,
        designation_type TEXT,
        state TEXT NOT NULL,
        county TEXT,
        fips TEXT,
        status TEXT,
        designated_date TEXT,
        population INTEGER,
        poverty_pct REAL,
        rural_status TEXT,
        degree_of_shortage REAL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hpsa_state ON hpsa_shortage_areas(state);
      CREATE INDEX IF NOT EXISTS idx_hpsa_county ON hpsa_shortage_areas(county, state);
      CREATE INDEX IF NOT EXISTS idx_hpsa_type ON hpsa_shortage_areas(designation_type);
      CREATE INDEX IF NOT EXISTS idx_hpsa_fips ON hpsa_shortage_areas(fips);
      CREATE INDEX IF NOT EXISTS idx_hpsa_score ON hpsa_shortage_areas(hpsa_score);
    `);
    console.log('Table created.');

    // Clear existing data
    await pool.query('DELETE FROM hpsa_shortage_areas');
    console.log('Cleared existing data.');

    let totalInserted = 0;

    for (const file of FILES) {
      if (!fs.existsSync(file.path)) {
        console.log(`Skipping ${file.designation} — file not found: ${file.path}`);
        continue;
      }

      console.log(`\nProcessing ${file.designation} from ${file.path}...`);

      const rl = readline.createInterface({ input: fs.createReadStream(file.path) });
      let headers = [];
      let headerMap = {};
      let lineNum = 0;
      let batch = [];
      let inserted = 0;
      const BATCH_SIZE = 500;

      const flush = async () => {
        if (batch.length === 0) return;
        const values = [];
        const placeholders = [];
        let paramIdx = 1;

        for (const row of batch) {
          placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
          values.push(
            row.hpsa_id, row.hpsa_name, row.hpsa_type, row.hpsa_score,
            row.designation_type, row.state, row.county, row.fips,
            row.status, row.designated_date, row.population,
            row.poverty_pct, row.rural_status, row.degree_of_shortage
          );
        }

        await pool.query(`
          INSERT INTO hpsa_shortage_areas (hpsa_id, hpsa_name, hpsa_type, hpsa_score, designation_type, state, county, fips, status, designated_date, population, poverty_pct, rural_status, degree_of_shortage)
          VALUES ${placeholders.join(', ')}
        `, values);

        inserted += batch.length;
        batch = [];
      };

      const parseNum = (val) => {
        if (!val || val === '' || val === 'NA' || val === 'N/A') return null;
        const n = parseFloat(val);
        return isNaN(n) ? null : n;
      };

      const parseInt2 = (val) => {
        if (!val || val === '' || val === 'NA' || val === 'N/A') return null;
        const n = parseInt(val.replace(/[^0-9.-]/g, ''), 10);
        return isNaN(n) ? null : n;
      };

      for await (const line of rl) {
        lineNum++;
        if (lineNum === 1) {
          headers = parseCSVLine(line);
          headers.forEach((h, i) => { headerMap[h.trim()] = i; });
          continue;
        }

        const vals = parseCSVLine(line);
        if (vals.length < 5) continue;

        const row = {
          hpsa_id: vals[headerMap['HPSA ID']] || null,
          hpsa_name: vals[headerMap['HPSA Name']] || null,
          hpsa_type: vals[headerMap['Designation Type']] || null,
          hpsa_score: parseInt2(vals[headerMap['HPSA Score']]),
          designation_type: file.designation,
          state: vals[headerMap['Primary State Abbreviation']] || vals[headerMap['Common State Abbreviation']] || '',
          county: vals[headerMap['Common County Name']] || vals[headerMap['County Equivalent Name']] || null,
          fips: vals[headerMap['Common State County FIPS Code']] || vals[headerMap['County or County Equivalent Federal Information Processing Standard Code']] || null,
          status: vals[headerMap['HPSA Status']] || null,
          designated_date: vals[headerMap['HPSA Designation Date']] || null,
          population: parseInt2(vals[headerMap['HPSA Designation Population']]),
          poverty_pct: parseNum(vals[headerMap['% of Population Below 100% Poverty']]),
          rural_status: vals[headerMap['Rural Status']] || null,
          degree_of_shortage: parseNum(vals[headerMap['HPSA Degree of Shortage']]),
        };

        if (!row.state) continue;

        batch.push(row);
        if (batch.length >= BATCH_SIZE) {
          await flush();
          if (inserted % 5000 === 0 && inserted > 0) {
            console.log(`  Inserted ${inserted} rows...`);
          }
        }
      }

      await flush();
      totalInserted += inserted;
      console.log(`  ${file.designation}: ${inserted} rows imported.`);
    }

    console.log(`\nDone! Total HPSA rows inserted: ${totalInserted}`);

    // Quick stats
    const stats = await pool.query(`
      SELECT
        designation_type,
        COUNT(*) as total,
        COUNT(DISTINCT state) as states,
        ROUND(AVG(hpsa_score)::numeric, 1) as avg_score,
        COUNT(*) FILTER (WHERE status = 'Designated') as active
      FROM hpsa_shortage_areas
      GROUP BY designation_type
      ORDER BY designation_type
    `);
    console.log('\nTable stats by type:');
    stats.rows.forEach(r => console.log(`  ${r.designation_type}: ${r.total} areas, ${r.states} states, avg score ${r.avg_score}, ${r.active} active`));

  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
