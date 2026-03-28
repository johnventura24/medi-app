/**
 * Import MA Penetration Rate by County
 * Source: Derived from Medicare Geographic Variation data (medicare_spending table)
 * This script creates a dedicated ma_penetration table with the latest year's data
 * for quick lookups and enriched with addressable market insights.
 */
const { Pool } = require('pg');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('Creating ma_penetration table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ma_penetration (
        id SERIAL PRIMARY KEY,
        state TEXT NOT NULL,
        county TEXT,
        fips TEXT,
        year INTEGER,
        total_beneficiaries INTEGER,
        ma_beneficiaries INTEGER,
        ffs_beneficiaries INTEGER,
        ma_penetration_rate REAL,
        ffs_addressable_pct REAL,
        per_capita_spending REAL,
        spending_tier TEXT,
        penetration_tier TEXT,
        opportunity_score REAL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_map_state ON ma_penetration(state);
      CREATE INDEX IF NOT EXISTS idx_map_county ON ma_penetration(county, state);
      CREATE INDEX IF NOT EXISTS idx_map_fips ON ma_penetration(fips);
      CREATE INDEX IF NOT EXISTS idx_map_opportunity ON ma_penetration(opportunity_score DESC);
      CREATE INDEX IF NOT EXISTS idx_map_penetration ON ma_penetration(ma_penetration_rate);
    `);
    console.log('Table created.');

    // Check if medicare_spending has data
    const check = await pool.query('SELECT COUNT(*) as cnt, MAX(year) as max_year FROM medicare_spending');
    if (parseInt(check.rows[0].cnt) === 0) {
      console.error('medicare_spending table is empty. Run import-medicare-spending.cjs first.');
      process.exit(1);
    }

    const maxYear = check.rows[0].max_year;
    console.log(`Using data from medicare_spending table (latest year: ${maxYear})`);

    // Clear existing data
    await pool.query('DELETE FROM ma_penetration');

    // Calculate spending percentiles for tier assignment
    const percentilesRes = await pool.query(`
      SELECT
        PERCENTILE_CONT(0.33) WITHIN GROUP (ORDER BY per_capita_total_spending) as spend_p33,
        PERCENTILE_CONT(0.67) WITHIN GROUP (ORDER BY per_capita_total_spending) as spend_p67,
        PERCENTILE_CONT(0.33) WITHIN GROUP (ORDER BY ma_penetration_rate) as pen_p33,
        PERCENTILE_CONT(0.67) WITHIN GROUP (ORDER BY ma_penetration_rate) as pen_p67
      FROM medicare_spending
      WHERE year = $1 AND ma_penetration_rate IS NOT NULL AND per_capita_total_spending IS NOT NULL
    `, [maxYear]);

    const { spend_p33, spend_p67, pen_p33, pen_p67 } = percentilesRes.rows[0];
    console.log(`Spending tiers: Low < $${Math.round(spend_p33)}, Med < $${Math.round(spend_p67)}, High >= $${Math.round(spend_p67)}`);
    console.log(`Penetration tiers: Low < ${(pen_p33 * 100).toFixed(1)}%, Med < ${(pen_p67 * 100).toFixed(1)}%, High >= ${(pen_p67 * 100).toFixed(1)}%`);

    // Insert enriched penetration data — use all years for trend, but focus on latest
    const insertRes = await pool.query(`
      INSERT INTO ma_penetration (state, county, fips, year, total_beneficiaries, ma_beneficiaries, ffs_beneficiaries, ma_penetration_rate, ffs_addressable_pct, per_capita_spending, spending_tier, penetration_tier, opportunity_score)
      SELECT
        state,
        county,
        fips,
        year,
        total_beneficiaries,
        ma_beneficiaries,
        CASE WHEN total_beneficiaries IS NOT NULL AND ma_beneficiaries IS NOT NULL
          THEN total_beneficiaries - ma_beneficiaries
          ELSE NULL
        END as ffs_beneficiaries,
        ma_penetration_rate,
        CASE WHEN ma_penetration_rate IS NOT NULL
          THEN ROUND((1.0 - ma_penetration_rate)::numeric, 4)
          ELSE NULL
        END as ffs_addressable_pct,
        per_capita_total_spending,
        CASE
          WHEN per_capita_total_spending < ${spend_p33} THEN 'Low'
          WHEN per_capita_total_spending < ${spend_p67} THEN 'Medium'
          ELSE 'High'
        END as spending_tier,
        CASE
          WHEN ma_penetration_rate < ${pen_p33} THEN 'Low'
          WHEN ma_penetration_rate < ${pen_p67} THEN 'Medium'
          ELSE 'High'
        END as penetration_tier,
        -- Opportunity score: higher when low penetration + high spending + large population
        CASE WHEN ma_penetration_rate IS NOT NULL AND per_capita_total_spending IS NOT NULL AND total_beneficiaries IS NOT NULL THEN
          ROUND((
            (1.0 - COALESCE(ma_penetration_rate, 0.5)) * 40 +
            LEAST(per_capita_total_spending / ${spend_p67}, 2.0) * 30 +
            LEAST(total_beneficiaries::float / 50000, 1.0) * 30
          )::numeric, 2)
        ELSE NULL END as opportunity_score
      FROM medicare_spending
      WHERE total_beneficiaries IS NOT NULL
      RETURNING id
    `);

    console.log(`\nInserted ${insertRes.rowCount} rows into ma_penetration.`);

    // Stats for latest year
    const stats = await pool.query(`
      SELECT
        COUNT(*) as counties,
        COUNT(DISTINCT state) as states,
        ROUND(AVG(ma_penetration_rate)::numeric, 4) as avg_penetration,
        ROUND(AVG(ffs_addressable_pct)::numeric, 4) as avg_addressable,
        ROUND(AVG(per_capita_spending)::numeric, 2) as avg_spending,
        ROUND(AVG(opportunity_score)::numeric, 2) as avg_opportunity,
        SUM(ffs_beneficiaries) as total_ffs_benes
      FROM ma_penetration
      WHERE year = $1
    `, [maxYear]);
    console.log(`\nLatest year (${maxYear}) stats:`, stats.rows[0]);

    // Top opportunity counties
    const top = await pool.query(`
      SELECT state, county, fips, total_beneficiaries, ma_penetration_rate, ffs_addressable_pct, per_capita_spending, opportunity_score
      FROM ma_penetration
      WHERE year = $1 AND opportunity_score IS NOT NULL
      ORDER BY opportunity_score DESC
      LIMIT 10
    `, [maxYear]);
    console.log('\nTop 10 opportunity counties:');
    top.rows.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.county}, ${r.state} (FIPS: ${r.fips}) — ${r.total_beneficiaries} benes, ${(r.ma_penetration_rate * 100).toFixed(1)}% MA, $${Math.round(r.per_capita_spending)}/capita, score: ${r.opportunity_score}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
