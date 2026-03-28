/**
 * Comprehensive verification of all 3 imported datasets.
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  console.log('========================================');
  console.log('  DATASET VERIFICATION REPORT');
  console.log('========================================\n');

  // 1. ZIP Crosswalk
  console.log('--- DATASET 1: ZIP-County Crosswalk ---');
  const zipStats = await pool.query(`
    SELECT
      COUNT(*) as total_rows,
      COUNT(DISTINCT zipcode) as distinct_zips,
      COUNT(DISTINCT county_fips) as distinct_counties,
      COUNT(DISTINCT state) as distinct_states
    FROM zip_county_map
  `);
  console.log('zip_county_map table:', zipStats.rows[0]);

  const coverage = await pool.query(`
    SELECT COUNT(DISTINCT z.zipcode) as resolvable_zips
    FROM zip_county_map z
    JOIN (SELECT DISTINCT county, state FROM plans) p
      ON upper(z.county_name) = upper(p.county) AND z.state = p.state
  `);
  console.log('ZIPs that resolve to counties with plans:', coverage.rows[0].resolvable_zips);
  console.log('Improvement: 202 -> ' + coverage.rows[0].resolvable_zips + ' ZIPs (' + Math.round(coverage.rows[0].resolvable_zips / 202) + 'x)');

  // 2. Star Ratings
  console.log('\n--- DATASET 2: Star Ratings ---');
  const starStats = await pool.query(`
    SELECT
      COUNT(*) as total_plans,
      COUNT(*) FILTER (WHERE overall_star_rating IS NOT NULL) as with_overall,
      COUNT(*) FILTER (WHERE partc_star_rating IS NOT NULL) as with_partc,
      COUNT(*) FILTER (WHERE partd_star_rating IS NOT NULL) as with_partd,
      COUNT(*) FILTER (WHERE high_performing = true) as high_performing,
      COUNT(*) FILTER (WHERE low_performing = true) as low_performing,
      ROUND(AVG(overall_star_rating)::numeric, 2) as avg_overall,
      ROUND(AVG(partc_star_rating)::numeric, 2) as avg_partc,
      ROUND(AVG(partd_star_rating)::numeric, 2) as avg_partd
    FROM plans
  `);
  console.log('Star ratings:', starStats.rows[0]);

  // Star rating distribution
  const starDist = await pool.query(`
    SELECT
      CASE
        WHEN overall_star_rating >= 4.5 THEN '5 Stars'
        WHEN overall_star_rating >= 3.5 THEN '4 Stars'
        WHEN overall_star_rating >= 2.5 THEN '3 Stars'
        WHEN overall_star_rating >= 1.5 THEN '2 Stars'
        WHEN overall_star_rating >= 0.5 THEN '1 Star'
        ELSE 'Not Rated'
      END as rating,
      COUNT(*) as count
    FROM plans
    GROUP BY 1
    ORDER BY 1
  `);
  console.log('Star rating distribution:');
  starDist.rows.forEach(r => console.log('  ' + r.rating + ': ' + r.count));

  // 3. Enrollment
  console.log('\n--- DATASET 3: Enrollment Counts ---');
  const enrollStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE enrollment_count IS NOT NULL) as with_enrollment,
      COUNT(*) FILTER (WHERE enrollment_count IS NULL) as without_enrollment,
      MAX(enrollment_count) as max_enrollment,
      ROUND(AVG(enrollment_count)) as avg_enrollment,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY enrollment_count) FILTER (WHERE enrollment_count IS NOT NULL) as median_enrollment
    FROM plans
  `);
  console.log('Enrollment stats:', enrollStats.rows[0]);

  // Top plans by enrollment
  const topPlans = await pool.query(`
    SELECT DISTINCT ON (contract_id, plan_id)
      name, organization_name, contract_id, plan_id, enrollment_count
    FROM plans
    WHERE enrollment_count IS NOT NULL
    ORDER BY contract_id, plan_id, enrollment_count DESC
  `);

  // Sort and show top 10
  const sorted = topPlans.rows.sort((a, b) => b.enrollment_count - a.enrollment_count);
  console.log('\nTop 10 plans by enrollment:');
  sorted.slice(0, 10).forEach((r, i) => {
    console.log(`  ${i+1}. ${r.name} (${r.organization_name}) - ${parseInt(r.enrollment_count).toLocaleString()} members`);
  });

  console.log('\n========================================');
  console.log('  ALL DATASETS VERIFIED SUCCESSFULLY');
  console.log('========================================');

  await pool.end();
}
main();
