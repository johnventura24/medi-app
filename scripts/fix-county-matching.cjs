/**
 * Fix county name mismatches between plans table and zip_county_map.
 * Adds alias entries for common naming differences.
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres' });

async function main() {
  // Get all unmatched plan counties
  const unmatched = await pool.query(`
    SELECT DISTINCT p.county, p.state
    FROM (SELECT DISTINCT county, state FROM plans) p
    LEFT JOIN (SELECT DISTINCT county_name, state FROM zip_county_map) z
      ON upper(p.county) = upper(z.county_name) AND p.state = z.state
    WHERE z.county_name IS NULL
  `);

  console.log(`[Fix Matching] Found ${unmatched.rows.length} unmatched plan counties`);

  // For each unmatched county, try to find a match in zip_county_map with fuzzy matching
  let fixed = 0;
  for (const row of unmatched.rows) {
    const county = row.county;
    const state = row.state;

    // Try various transformations
    const variants = [
      county.replace(/ /g, ''),               // "DE KALB" -> "DEKALB"
      county.replace(/^DE /, 'DE'),            // "DE KALB" -> "DEKALB"
      county.replace(/^LA /, 'LA'),            // "LA SALLE" -> "LASALLE"
      county.replace(/ CIT$/, ' CITY'),        // "COLONIAL HEIGHTS CIT" -> "COLONIAL HEIGHTS CITY"
      county.replace(/Ñ/g, 'N'),              // Puerto Rico accents
      county.replace(/Í/g, 'I'),
      county.replace(/É/g, 'E'),
      county.replace(/Á/g, 'A'),
      county.replace(/Ó/g, 'O'),
      county.replace(/Ú/g, 'U'),
    ];

    for (const variant of variants) {
      if (variant === county) continue;
      const match = await pool.query(
        'SELECT county_name, county_fips, state_fips FROM zip_county_map WHERE upper(county_name) = upper($1) AND state = $2 LIMIT 1',
        [variant, state]
      );
      if (match.rows.length > 0) {
        // Insert alias entries mapping the original plans county name
        const existing = match.rows[0];
        // Get all zipcode mappings for this county
        const zips = await pool.query(
          'SELECT DISTINCT zipcode, county_fips, state_fips, residential_ratio FROM zip_county_map WHERE upper(county_name) = upper($1) AND state = $2',
          [variant, state]
        );
        for (const z of zips.rows) {
          await pool.query(
            'INSERT INTO zip_county_map (zipcode, county_fips, county_name, state, state_fips, residential_ratio) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
            [z.zipcode, z.county_fips, county, state, z.state_fips, z.residential_ratio]
          );
        }
        console.log(`  Fixed: "${county}" -> "${variant}" (${state}) - ${zips.rows.length} ZIPs`);
        fixed++;
        break;
      }
    }
  }

  // Also handle Connecticut planning regions -> map to constituent counties
  // CT replaced counties with planning regions in 2022 Census. The plans table uses planning regions.
  const ctRegions = {
    'CAPITOL': ['HARTFORD'],
    'GREATER BRIDGEPORT': ['FAIRFIELD'],
    'LOWER CONNECTICUT RIVER VALLEY': ['MIDDLESEX'],
    'NAUGATUCK VALLEY': ['NEW HAVEN'],
    'NORTHEASTERN CONNECTICUT': ['WINDHAM'],
    'NORTHWESTERN CONNECTICUT': ['LITCHFIELD'],
    'SOUTH CENTRAL CONNECTICUT': ['NEW HAVEN'],
    'SOUTHEASTERN CONNECTICUT': ['NEW LONDON'],
    'WESTERN CONNECTICUT': ['FAIRFIELD'],
  };

  for (const [region, mapCounties] of Object.entries(ctRegions)) {
    for (const mapCounty of mapCounties) {
      const zips = await pool.query(
        'SELECT DISTINCT zipcode, county_fips, state_fips, residential_ratio FROM zip_county_map WHERE upper(county_name) = upper($1) AND state = $2',
        [mapCounty, 'CT']
      );
      if (zips.rows.length > 0) {
        for (const z of zips.rows) {
          await pool.query(
            'INSERT INTO zip_county_map (zipcode, county_fips, county_name, state, state_fips, residential_ratio) VALUES ($1, $2, $3, $4, $5, $6)',
            [z.zipcode, z.county_fips, region, 'CT', z.state_fips, z.residential_ratio]
          );
        }
        console.log(`  CT region: "${region}" -> "${mapCounty}" - ${zips.rows.length} ZIPs`);
        fixed++;
      }
    }
  }

  // Recheck match rate
  const matchRate = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT county || '|' || state) FROM plans) as plan_counties,
      (SELECT COUNT(DISTINCT p.county || '|' || p.state)
       FROM (SELECT DISTINCT county, state FROM plans) p
       JOIN (SELECT DISTINCT county_name, state FROM zip_county_map) z
         ON upper(p.county) = upper(z.county_name) AND p.state = z.state
      ) as matched_counties
  `);
  console.log(`\n[Fix Matching] After fixes: ${matchRate.rows[0].matched_counties}/${matchRate.rows[0].plan_counties} counties matched`);
  console.log(`[Fix Matching] Fixed ${fixed} county name mismatches`);

  await pool.end();
}
main();
