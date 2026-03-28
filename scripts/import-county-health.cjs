/**
 * Import County Health Rankings data into county_health_data table.
 * Source: County Health Rankings 2025 analytic data CSV
 */
const { Pool } = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
const CSV_PATH = '/tmp/analytic_data2025.csv';

// Column code mappings from CHR data dictionary
// Row 2 of CSV has the short code names
const CODE_MAP = {
  diabetes_rate: 'v060_rawvalue',       // Diabetes Prevalence raw value
  obesity_rate: 'v011_rawvalue',         // Adult Obesity raw value
  smoking_rate: 'v009_rawvalue',         // Adult Smoking raw value
  physical_inactivity_rate: 'v070_rawvalue', // Physical Inactivity raw value
  poor_health_rate: 'v002_rawvalue',     // Poor or Fair Health raw value
  mental_health_days: 'v042_rawvalue',   // Poor Mental Health Days raw value
  uninsured_rate: 'v085_rawvalue',       // Uninsured raw value
  median_income: 'v063_rawvalue',        // Median Household Income raw value
  population_65_plus: 'v053_rawvalue',   // % 65 and Older raw value
};

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    // Create table
    console.log('Creating county_health_data table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS county_health_data (
        id SERIAL PRIMARY KEY,
        county_fips TEXT NOT NULL UNIQUE,
        county_name TEXT NOT NULL,
        state TEXT NOT NULL,
        state_fips TEXT,
        diabetes_rate REAL,
        obesity_rate REAL,
        smoking_rate REAL,
        physical_inactivity_rate REAL,
        poor_health_rate REAL,
        mental_health_days REAL,
        uninsured_rate REAL,
        median_income INTEGER,
        population_65_plus REAL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chd_fips ON county_health_data(county_fips);
      CREATE INDEX IF NOT EXISTS idx_chd_county ON county_health_data(county_name, state);
    `);
    console.log('Table created.');

    // Parse CSV - read all lines
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split('\n');

    // Line 0: human-readable headers
    // Line 1: code headers (e.g. statecode, countycode, fipscode, state, county, ...)
    // Line 2+: data
    const codeHeaders = lines[1].split(',');

    // Build column index map
    const colIdx = {};
    for (const [field, code] of Object.entries(CODE_MAP)) {
      const idx = codeHeaders.indexOf(code);
      if (idx === -1) {
        console.warn(`WARNING: Column ${code} (${field}) not found in headers`);
      } else {
        colIdx[field] = idx;
      }
    }

    // Also get fixed columns
    const stateCodeIdx = codeHeaders.indexOf('statecode');
    const countyCodeIdx = codeHeaders.indexOf('countycode');
    const fipsIdx = codeHeaders.indexOf('fipscode');
    const stateAbbrIdx = codeHeaders.indexOf('state');
    const countyNameIdx = codeHeaders.indexOf('county');

    console.log(`Column mappings: ${JSON.stringify(colIdx, null, 2)}`);
    console.log(`Fixed columns: statecode=${stateCodeIdx}, countycode=${countyCodeIdx}, fips=${fipsIdx}, state=${stateAbbrIdx}, county=${countyNameIdx}`);

    // Parse data rows (skip row 0 = human headers, row 1 = code headers)
    const rows = [];
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parse (no quoted fields with commas in this dataset)
      const cols = line.split(',');
      const stateCode = cols[stateCodeIdx];
      const countyCode = cols[countyCodeIdx];
      const fips = cols[fipsIdx];
      const stateAbbr = cols[stateAbbrIdx];
      const countyName = cols[countyNameIdx];

      // Skip state-level rows (countycode = '000') and national row
      if (countyCode === '000') continue;
      if (!fips || fips === '00000') continue;

      const parseNum = (val) => {
        if (!val || val === '' || val === 'NA' || val === '.') return null;
        const n = parseFloat(val);
        return isNaN(n) ? null : n;
      };

      rows.push({
        county_fips: fips,
        county_name: countyName,
        state: stateAbbr,
        state_fips: stateCode,
        diabetes_rate: parseNum(cols[colIdx.diabetes_rate]),
        obesity_rate: parseNum(cols[colIdx.obesity_rate]),
        smoking_rate: parseNum(cols[colIdx.smoking_rate]),
        physical_inactivity_rate: parseNum(cols[colIdx.physical_inactivity_rate]),
        poor_health_rate: parseNum(cols[colIdx.poor_health_rate]),
        mental_health_days: parseNum(cols[colIdx.mental_health_days]),
        uninsured_rate: parseNum(cols[colIdx.uninsured_rate]),
        median_income: parseNum(cols[colIdx.median_income]) ? Math.round(parseNum(cols[colIdx.median_income])) : null,
        population_65_plus: parseNum(cols[colIdx.population_65_plus]),
      });
    }

    console.log(`Parsed ${rows.length} county rows`);

    // Batch insert using UPSERT
    const BATCH_SIZE = 200;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const r of batch) {
        values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
        params.push(
          r.county_fips, r.county_name, r.state, r.state_fips,
          r.diabetes_rate, r.obesity_rate, r.smoking_rate,
          r.physical_inactivity_rate, r.poor_health_rate,
          r.mental_health_days, r.uninsured_rate,
          r.median_income, r.population_65_plus
        );
      }

      await pool.query(`
        INSERT INTO county_health_data (county_fips, county_name, state, state_fips,
          diabetes_rate, obesity_rate, smoking_rate, physical_inactivity_rate,
          poor_health_rate, mental_health_days, uninsured_rate, median_income, population_65_plus)
        VALUES ${values.join(',')}
        ON CONFLICT (county_fips) DO UPDATE SET
          county_name = EXCLUDED.county_name,
          state = EXCLUDED.state,
          state_fips = EXCLUDED.state_fips,
          diabetes_rate = EXCLUDED.diabetes_rate,
          obesity_rate = EXCLUDED.obesity_rate,
          smoking_rate = EXCLUDED.smoking_rate,
          physical_inactivity_rate = EXCLUDED.physical_inactivity_rate,
          poor_health_rate = EXCLUDED.poor_health_rate,
          mental_health_days = EXCLUDED.mental_health_days,
          uninsured_rate = EXCLUDED.uninsured_rate,
          median_income = EXCLUDED.median_income,
          population_65_plus = EXCLUDED.population_65_plus,
          updated_at = NOW()
      `, params);

      inserted += batch.length;
      if (inserted % 1000 === 0 || inserted === rows.length) {
        console.log(`  Inserted ${inserted}/${rows.length} counties...`);
      }
    }

    // Verify
    const countRes = await pool.query('SELECT COUNT(*) as cnt FROM county_health_data');
    const sampleRes = await pool.query('SELECT county_name, state, diabetes_rate, obesity_rate, smoking_rate FROM county_health_data WHERE diabetes_rate IS NOT NULL ORDER BY diabetes_rate DESC LIMIT 5');
    console.log(`\nTotal counties in DB: ${countRes.rows[0].cnt}`);
    console.log('Top 5 counties by diabetes rate:');
    sampleRes.rows.forEach(r => console.log(`  ${r.county_name}, ${r.state}: diabetes=${r.diabetes_rate}, obesity=${r.obesity_rate}, smoking=${r.smoking_rate}`));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
