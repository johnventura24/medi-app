/**
 * Fast enrollment import using temp table + batch UPDATE.
 * Much faster than individual UPDATE queries over the network.
 */
const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('[Enrollment-Fast] Adding enrollment_count column if needed...');
    await pool.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS enrollment_count INTEGER');

    console.log('[Enrollment-Fast] Reading and aggregating enrollment data...');
    const filePath = '/tmp/enrollment/CPSC_Enrollment_2026_01/CPSC_Enrollment_Info_2026_01.csv';
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const planEnrollment = new Map();
    let lineNum = 0;

    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 7) continue;

      const contractId = cols[0].replace(/"/g, '').trim();
      const planId = cols[1].replace(/"/g, '').trim();
      const enrollment = cols[6].replace(/"/g, '').trim();

      if (!contractId || !planId) continue;

      const key = `${contractId}|${planId}`;
      if (enrollment === '*') {
        planEnrollment.set(key, (planEnrollment.get(key) || 0) + 5);
      } else {
        const num = parseInt(enrollment);
        if (isFinite(num) && num > 0) {
          planEnrollment.set(key, (planEnrollment.get(key) || 0) + num);
        }
      }
    }

    console.log(`[Enrollment-Fast] Parsed ${lineNum} lines, ${planEnrollment.size} unique plans`);

    // Create temp table and load enrollment data
    console.log('[Enrollment-Fast] Creating temp table...');
    await pool.query(`
      CREATE TEMP TABLE IF NOT EXISTS enrollment_staging (
        contract_id TEXT,
        plan_id TEXT,
        enrollment INTEGER
      )
    `);
    await pool.query('TRUNCATE enrollment_staging');

    // Batch insert into staging table
    const BATCH = 500;
    const entries = [...planEnrollment.entries()];
    let inserted = 0;

    for (let b = 0; b < entries.length; b += BATCH) {
      const batch = entries.slice(b, b + BATCH);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const [key, enrollment] of batch) {
        const [contractId, planId] = key.split('|');
        values.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2})`);
        params.push(contractId, planId, enrollment);
        paramIdx += 3;
      }

      await pool.query(
        `INSERT INTO enrollment_staging (contract_id, plan_id, enrollment) VALUES ${values.join(',')}`,
        params
      );
      inserted += batch.length;

      if (inserted % 2000 === 0) {
        console.log(`[Enrollment-Fast]   Staged ${inserted}/${entries.length}`);
      }
    }

    console.log(`[Enrollment-Fast] Staged ${inserted} enrollment records`);

    // Single bulk UPDATE from staging
    console.log('[Enrollment-Fast] Running bulk UPDATE...');
    const result = await pool.query(`
      UPDATE plans p
      SET enrollment_count = e.enrollment
      FROM enrollment_staging e
      WHERE p.contract_id = e.contract_id AND p.plan_id = e.plan_id
    `);
    console.log(`[Enrollment-Fast] Updated ${result.rowCount} plan rows`);

    // Verify
    const verify = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE enrollment_count IS NOT NULL) as with_enrollment,
        COUNT(*) FILTER (WHERE enrollment_count IS NULL) as without_enrollment,
        SUM(enrollment_count) as total_enrollment,
        ROUND(AVG(enrollment_count)) as avg_enrollment,
        MAX(enrollment_count) as max_enrollment
      FROM plans
    `);
    console.log('[Enrollment-Fast] Verification:', verify.rows[0]);

    const topCarriers = await pool.query(`
      SELECT organization_name,
        SUM(enrollment_count) as total_enrollment,
        COUNT(*) as plan_count
      FROM plans
      WHERE enrollment_count IS NOT NULL
      GROUP BY organization_name
      ORDER BY total_enrollment DESC
      LIMIT 10
    `);
    console.log('[Enrollment-Fast] Top carriers by enrollment:');
    topCarriers.rows.forEach(r => {
      console.log(`  ${r.organization_name}: ${parseInt(r.total_enrollment).toLocaleString()} members (${r.plan_count} plans)`);
    });

    console.log('[Enrollment-Fast] DONE');
  } catch (err) {
    console.error('[Enrollment-Fast] ERROR:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
