/**
 * Import CMS Monthly Enrollment Data (CPSC) into the plans table.
 * Source: CPSC_Enrollment_Info_2026_01.csv
 *
 * Columns: Contract Number, Plan ID, SSA State County Code, FIPS State County Code, State, County, Enrollment
 * Enrollment may be "*" (suppressed for privacy, <11 members) or a number.
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
    // Add enrollment_count column
    console.log('[Enrollment] Adding enrollment_count column...');
    await pool.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS enrollment_count INTEGER');

    console.log('[Enrollment] Reading enrollment CSV (streaming)...');
    const filePath = '/tmp/enrollment/CPSC_Enrollment_2026_01/CPSC_Enrollment_Info_2026_01.csv';

    // Aggregate enrollment by contract_id + plan_id
    // (the file has per-county rows, we want total per plan)
    const planEnrollment = new Map(); // "contractId|planId" -> total enrollment

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineNum = 0;
    let suppressedCount = 0;
    let parsedCount = 0;

    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) {
        console.log('[Enrollment] Header:', line);
        continue;
      }

      const cols = parseCSVLine(line);
      if (cols.length < 7) continue;

      const contractId = cols[0].replace(/"/g, '').trim();
      const planId = cols[1].replace(/"/g, '').trim();
      const enrollment = cols[6].replace(/"/g, '').trim();

      if (!contractId || !planId) continue;

      if (enrollment === '*') {
        // Suppressed - count as 5 (midpoint of 1-10)
        suppressedCount++;
        const key = `${contractId}|${planId}`;
        planEnrollment.set(key, (planEnrollment.get(key) || 0) + 5);
      } else {
        const num = parseInt(enrollment);
        if (isFinite(num) && num > 0) {
          const key = `${contractId}|${planId}`;
          planEnrollment.set(key, (planEnrollment.get(key) || 0) + num);
          parsedCount++;
        }
      }

      if (lineNum % 100000 === 0) {
        console.log(`[Enrollment]   Processed ${lineNum} lines...`);
      }
    }

    console.log(`[Enrollment] Processed ${lineNum} total lines`);
    console.log(`[Enrollment] Parsed enrollment: ${parsedCount} rows, Suppressed(*): ${suppressedCount} rows`);
    console.log(`[Enrollment] Unique contract+plan combos: ${planEnrollment.size}`);

    // Show top enrollment plans
    const sorted = [...planEnrollment.entries()].sort((a, b) => b[1] - a[1]);
    console.log('[Enrollment] Top 10 plans by enrollment:');
    sorted.slice(0, 10).forEach(([key, count]) => {
      console.log(`  ${key}: ${count.toLocaleString()}`);
    });

    // Get distinct contract+plan combos from plans table
    const planKeys = await pool.query('SELECT DISTINCT contract_id, plan_id FROM plans WHERE contract_id IS NOT NULL AND plan_id IS NOT NULL');
    const planKeySet = new Set(planKeys.rows.map(r => `${r.contract_id}|${r.plan_id}`));
    console.log(`[Enrollment] Plans table has ${planKeySet.size} distinct contract+plan combos`);

    // Match and update
    let matched = 0;
    let totalUpdated = 0;
    const BATCH_SIZE = 50;
    let batchParams = [];
    let batchValues = [];
    let paramIdx = 1;

    for (const [key, enrollment] of planEnrollment) {
      if (!planKeySet.has(key)) continue;
      matched++;

      const [contractId, planId] = key.split('|');

      // Use direct update per contract+plan combo
      const result = await pool.query(
        'UPDATE plans SET enrollment_count = $1 WHERE contract_id = $2 AND plan_id = $3',
        [enrollment, contractId, planId]
      );
      totalUpdated += result.rowCount;

      if (matched % 500 === 0) {
        console.log(`[Enrollment]   Updated ${matched} plan combos (${totalUpdated} rows)...`);
      }
    }

    console.log(`[Enrollment] Matched ${matched} plan combos, updated ${totalUpdated} plan rows`);

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
    console.log('[Enrollment] Verification:', verify.rows[0]);

    // Top carriers by enrollment
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
    console.log('[Enrollment] Top carriers by enrollment:');
    topCarriers.rows.forEach(r => {
      console.log(`  ${r.organization_name}: ${parseInt(r.total_enrollment).toLocaleString()} members (${r.plan_count} plans)`);
    });

    console.log('[Enrollment] DONE');
  } catch (err) {
    console.error('[Enrollment] ERROR:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
