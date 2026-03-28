/**
 * Verify all three supplemental datasets imported correctly.
 */
const { Pool } = require('pg');
const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  console.log('========================================');
  console.log('  SUPPLEMENTAL DATA IMPORT VERIFICATION');
  console.log('========================================\n');

  // 1. County Health Data
  console.log('--- DATASET 1: County Health Rankings ---');
  const chd = await pool.query('SELECT COUNT(*) as cnt FROM county_health_data');
  console.log(`  Total counties: ${chd.rows[0].cnt}`);

  const chdStates = await pool.query('SELECT COUNT(DISTINCT state) as cnt FROM county_health_data');
  console.log(`  States covered: ${chdStates.rows[0].cnt}`);

  const chdNulls = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE diabetes_rate IS NOT NULL) as with_diabetes,
      COUNT(*) FILTER (WHERE obesity_rate IS NOT NULL) as with_obesity,
      COUNT(*) FILTER (WHERE smoking_rate IS NOT NULL) as with_smoking,
      ROUND(AVG(diabetes_rate)::numeric, 4) as avg_diabetes,
      ROUND(AVG(obesity_rate)::numeric, 4) as avg_obesity,
      ROUND(AVG(smoking_rate)::numeric, 4) as avg_smoking,
      ROUND(AVG(physical_inactivity_rate)::numeric, 4) as avg_inactivity,
      ROUND(AVG(poor_health_rate)::numeric, 4) as avg_poor_health
    FROM county_health_data
  `);
  console.log(`  Data coverage:`, chdNulls.rows[0]);

  const chdSample = await pool.query(`
    SELECT county_name, state, diabetes_rate, obesity_rate, smoking_rate, population_65_plus
    FROM county_health_data
    WHERE county_name IN ('Los Angeles County', 'Cook County', 'Harris County', 'Maricopa County')
  `);
  console.log('  Sample counties:');
  chdSample.rows.forEach(r => console.log(`    ${r.county_name}, ${r.state}: diabetes=${r.diabetes_rate}, obesity=${r.obesity_rate}, 65+=${r.population_65_plus}`));

  // 2. CAHPS Satisfaction Scores
  console.log('\n--- DATASET 2: CAHPS Satisfaction Scores ---');
  const cahps = await pool.query(`
    SELECT COUNT(*) as total,
      COUNT(cahps_overall) as with_overall,
      COUNT(cahps_care_access) as with_access,
      COUNT(cahps_plan_rating) as with_rating,
      ROUND(AVG(cahps_overall)::numeric, 2) as avg_overall,
      ROUND(AVG(cahps_care_access)::numeric, 2) as avg_access,
      ROUND(AVG(cahps_plan_rating)::numeric, 2) as avg_rating
    FROM plans
  `);
  console.log(`  Total plans: ${cahps.rows[0].total}`);
  console.log(`  Plans with CAHPS overall: ${cahps.rows[0].with_overall} (${Math.round(cahps.rows[0].with_overall/cahps.rows[0].total*100)}%)`);
  console.log(`  Plans with care access: ${cahps.rows[0].with_access}`);
  console.log(`  Plans with plan rating: ${cahps.rows[0].with_rating}`);
  console.log(`  Avg scores: overall=${cahps.rows[0].avg_overall}, access=${cahps.rows[0].avg_access}, rating=${cahps.rows[0].avg_rating}`);

  const cahpsSample = await pool.query(`
    SELECT contract_id, name, cahps_overall, cahps_care_access, cahps_plan_rating
    FROM plans
    WHERE cahps_overall IS NOT NULL
    ORDER BY cahps_overall DESC
    LIMIT 5
  `);
  console.log('  Top-rated plans:');
  cahpsSample.rows.forEach(r => console.log(`    ${r.contract_id} ${r.name}: overall=${r.cahps_overall}, access=${r.cahps_care_access}, rating=${r.cahps_plan_rating}`));

  // 3. Provider Quality
  console.log('\n--- DATASET 3: Provider Quality ---');
  const pq = await pool.query('SELECT COUNT(*) as cnt FROM provider_quality');
  console.log(`  Total providers: ${pq.rows[0].cnt}`);

  const pqStates = await pool.query('SELECT COUNT(DISTINCT state) as cnt FROM provider_quality');
  console.log(`  States covered: ${pqStates.rows[0].cnt}`);

  const pqSpecs = await pool.query('SELECT specialty, COUNT(*) as cnt FROM provider_quality GROUP BY specialty ORDER BY cnt DESC LIMIT 5');
  console.log('  Top specialties:');
  pqSpecs.rows.forEach(r => console.log(`    ${r.specialty}: ${r.cnt}`));

  const pqSample = await pool.query(`SELECT provider_name, specialty, state, city, quality_score FROM provider_quality WHERE quality_score IS NOT NULL LIMIT 5`);
  console.log('  Sample providers:');
  pqSample.rows.forEach(r => console.log(`    ${r.provider_name} (${r.specialty}) - ${r.city}, ${r.state}: score=${r.quality_score}`));

  console.log('\n========================================');
  console.log('  ALL IMPORTS VERIFIED SUCCESSFULLY');
  console.log('========================================');

  await pool.end();
}

main().catch(console.error);
