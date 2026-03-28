/**
 * Import Medicare Geographic Variation (per-capita spending by county)
 * Source: CMS FFS Geographic Variation Public Use File (2014-2023)
 * Downloaded from: data.cms.gov
 */
const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
const CSV_PATH = '/tmp/cms_geo_variation.csv';

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`File not found: ${CSV_PATH}`);
    console.error('Download from: https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-geographic-comparisons/medicare-geographic-variation-by-national-state-county');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('Creating medicare_spending table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicare_spending (
        id SERIAL PRIMARY KEY,
        state TEXT NOT NULL,
        county TEXT,
        fips TEXT,
        year INTEGER,
        total_beneficiaries INTEGER,
        ma_beneficiaries INTEGER,
        ma_penetration_rate REAL,
        per_capita_total_spending REAL,
        per_capita_ip_spending REAL,
        per_capita_op_spending REAL,
        per_capita_rx_spending REAL,
        standardized_per_capita REAL,
        avg_age REAL,
        avg_risk_score REAL,
        dual_eligible_pct REAL,
        er_visits_per_1000 REAL,
        readmission_pct REAL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ms_state ON medicare_spending(state);
      CREATE INDEX IF NOT EXISTS idx_ms_county ON medicare_spending(county, state);
      CREATE INDEX IF NOT EXISTS idx_ms_fips ON medicare_spending(fips);
      CREATE INDEX IF NOT EXISTS idx_ms_year ON medicare_spending(year);
    `);
    console.log('Table created.');

    // Clear existing data
    await pool.query('DELETE FROM medicare_spending');
    console.log('Cleared existing data.');

    // Read CSV headers
    const rl = readline.createInterface({ input: fs.createReadStream(CSV_PATH) });
    let headers = [];
    let headerMap = {};
    let lineNum = 0;
    let batch = [];
    let inserted = 0;
    let skipped = 0;
    const BATCH_SIZE = 500;

    const flush = async () => {
      if (batch.length === 0) return;
      const values = [];
      const placeholders = [];
      let paramIdx = 1;

      for (const row of batch) {
        placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        values.push(
          row.state, row.county, row.fips, row.year,
          row.total_beneficiaries, row.ma_beneficiaries, row.ma_penetration_rate,
          row.per_capita_total_spending, row.per_capita_ip_spending,
          row.per_capita_op_spending, row.standardized_per_capita,
          row.avg_age, row.avg_risk_score, row.dual_eligible_pct,
          row.er_visits_per_1000, row.readmission_pct
        );
      }

      await pool.query(`
        INSERT INTO medicare_spending (state, county, fips, year, total_beneficiaries, ma_beneficiaries, ma_penetration_rate, per_capita_total_spending, per_capita_ip_spending, per_capita_op_spending, standardized_per_capita, avg_age, avg_risk_score, dual_eligible_pct, er_visits_per_1000, readmission_pct)
        VALUES ${placeholders.join(', ')}
      `, values);

      inserted += batch.length;
      batch = [];
    };

    const parseNum = (val) => {
      if (!val || val === '*' || val === '' || val === 'N/A') return null;
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    };

    const parseInt2 = (val) => {
      if (!val || val === '*' || val === '' || val === 'N/A') return null;
      const n = parseInt(val, 10);
      return isNaN(n) ? null : n;
    };

    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) {
        headers = line.split(',');
        headers.forEach((h, i) => { headerMap[h.trim()] = i; });
        continue;
      }

      // Parse CSV (handle quoted fields)
      const vals = line.split(',');

      const geoLvl = vals[headerMap['BENE_GEO_LVL']];
      const ageLvl = vals[headerMap['BENE_AGE_LVL']];

      // Only county-level rows, "All" age level
      if (geoLvl !== 'County' || ageLvl !== 'All') {
        skipped++;
        continue;
      }

      const geoDesc = vals[headerMap['BENE_GEO_DESC']] || '';
      const parts = geoDesc.split('-');
      const stateAbbr = parts[0] || '';
      const countyName = parts.slice(1).join('-') || '';

      const row = {
        state: stateAbbr.trim(),
        county: countyName.trim(),
        fips: (vals[headerMap['BENE_GEO_CD']] || '').trim(),
        year: parseInt2(vals[headerMap['YEAR']]),
        total_beneficiaries: parseInt2(vals[headerMap['BENES_TOTAL_CNT']]),
        ma_beneficiaries: parseInt2(vals[headerMap['BENES_MA_CNT']]),
        ma_penetration_rate: parseNum(vals[headerMap['MA_PRTCPTN_RATE']]),
        per_capita_total_spending: parseNum(vals[headerMap['TOT_MDCR_PYMT_PC']]),
        per_capita_ip_spending: parseNum(vals[headerMap['IP_MDCR_PYMT_PC']]),
        per_capita_op_spending: parseNum(vals[headerMap['OP_MDCR_PYMT_PC']]),
        standardized_per_capita: parseNum(vals[headerMap['TOT_MDCR_STDZD_PYMT_PC']]),
        avg_age: parseNum(vals[headerMap['BENE_AVG_AGE']]),
        avg_risk_score: parseNum(vals[headerMap['BENE_AVG_RISK_SCRE']]),
        dual_eligible_pct: parseNum(vals[headerMap['BENE_DUAL_PCT']]),
        er_visits_per_1000: parseNum(vals[headerMap['ER_VISITS_PER_1000_BENES']]),
        readmission_pct: parseNum(vals[headerMap['ACUTE_HOSP_READMSN_PCT']]),
      };

      if (!row.state) {
        skipped++;
        continue;
      }

      batch.push(row);
      if (batch.length >= BATCH_SIZE) {
        await flush();
        if (inserted % 5000 === 0) {
          console.log(`  Inserted ${inserted} rows...`);
        }
      }
    }

    await flush();

    console.log(`\nDone! Inserted ${inserted} county rows, skipped ${skipped} non-county/age rows.`);

    // Quick stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_rows,
        COUNT(DISTINCT state) as states,
        COUNT(DISTINCT fips) as counties,
        MIN(year) as min_year,
        MAX(year) as max_year,
        ROUND(AVG(per_capita_total_spending)::numeric, 2) as avg_spending,
        ROUND(AVG(ma_penetration_rate)::numeric, 4) as avg_ma_penetration
      FROM medicare_spending
    `);
    console.log('\nTable stats:', stats.rows[0]);

  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
