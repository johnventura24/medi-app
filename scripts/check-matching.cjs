const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  const planCounties = await pool.query('SELECT DISTINCT county, state FROM plans LIMIT 10');
  console.log('=== Plan counties sample ===');
  planCounties.rows.forEach(r => console.log(`  "${r.county}" | "${r.state}"`));

  const zipCounties = await pool.query('SELECT DISTINCT county_name, state FROM zip_county_map WHERE state IN (SELECT DISTINCT state FROM plans) LIMIT 10');
  console.log('\n=== Zip county map sample ===');
  zipCounties.rows.forEach(r => console.log(`  "${r.county_name}" | "${r.state}"`));

  const matchRate = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT county || '|' || state) FROM plans) as plan_counties,
      (SELECT COUNT(DISTINCT p.county || '|' || p.state)
       FROM (SELECT DISTINCT county, state FROM plans) p
       JOIN (SELECT DISTINCT county_name, state FROM zip_county_map) z
         ON upper(p.county) = upper(z.county_name) AND p.state = z.state
      ) as matched_counties
  `);
  console.log('\n=== Match Rate ===');
  console.log(matchRate.rows[0]);

  const unmatched = await pool.query(`
    SELECT DISTINCT p.county, p.state
    FROM (SELECT DISTINCT county, state FROM plans) p
    LEFT JOIN (SELECT DISTINCT county_name, state FROM zip_county_map) z
      ON upper(p.county) = upper(z.county_name) AND p.state = z.state
    WHERE z.county_name IS NULL
    LIMIT 20
  `);
  console.log('\n=== Unmatched plan counties (sample) ===');
  unmatched.rows.forEach(r => console.log(`  "${r.county}" | "${r.state}"`));

  await pool.end();
}
main();
