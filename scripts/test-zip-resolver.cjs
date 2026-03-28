/**
 * Test ZIP resolution end-to-end: does a ZIP that previously had no plans now resolve?
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  // Pick some ZIPs that are NOT in the plans.zipcode column (the original 202)
  const testZips = ['94103', '30301', '98101', '85001', '37201', '80202', '55401', '97201', '27601', '43201'];

  for (const zip of testZips) {
    // Check if ZIP exists in plans table directly
    const directMatch = await pool.query('SELECT DISTINCT county, state FROM plans WHERE zipcode = $1', [zip]);

    // Check zip_county_map
    const mapMatch = await pool.query(
      'SELECT county_name, state, county_fips FROM zip_county_map WHERE zipcode = $1 ORDER BY residential_ratio DESC LIMIT 3',
      [zip]
    );

    // If we have a county from the map, can we find plans for that county?
    let planCount = 0;
    if (mapMatch.rows.length > 0) {
      const county = mapMatch.rows[0].county_name;
      const state = mapMatch.rows[0].state;
      const plans = await pool.query(
        'SELECT COUNT(*) as cnt FROM plans WHERE upper(county) = upper($1) AND state = $2',
        [county, state]
      );
      planCount = parseInt(plans.rows[0].cnt);
    }

    const directStr = directMatch.rows.length > 0 ? `DIRECT: ${directMatch.rows[0].county}, ${directMatch.rows[0].state}` : 'DIRECT: none';
    const mapStr = mapMatch.rows.length > 0 ? `MAP: ${mapMatch.rows[0].county_name}, ${mapMatch.rows[0].state}` : 'MAP: none';

    console.log(`ZIP ${zip}: ${directStr} | ${mapStr} | Plans: ${planCount}`);
  }

  // Summary stats
  const stats = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT zipcode) FROM plans) as plan_zips,
      (SELECT COUNT(DISTINCT zipcode) FROM zip_county_map) as map_zips,
      (SELECT COUNT(DISTINCT z.zipcode)
       FROM zip_county_map z
       JOIN (SELECT DISTINCT county, state FROM plans) p
         ON upper(z.county_name) = upper(p.county) AND z.state = p.state
      ) as resolvable_zips
  `);
  console.log('\n=== Coverage ===');
  console.log('ZIPs in plans table:', stats.rows[0].plan_zips);
  console.log('ZIPs in zip_county_map:', stats.rows[0].map_zips);
  console.log('ZIPs that resolve to counties with plans:', stats.rows[0].resolvable_zips);

  await pool.end();
}
main();
