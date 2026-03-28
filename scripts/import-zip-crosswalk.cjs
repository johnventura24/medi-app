/**
 * Import Census ZCTA-to-County crosswalk into zip_county_map table.
 * Source: Census Bureau ZCTA5 to County relationship file (2020).
 *
 * This maps ~33,000 ZCTAs (ZIP code tabulation areas) to counties,
 * enabling ZIP-based plan lookups for any US ZIP code.
 */
const { Pool } = require('pg');
const fs = require('fs');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// State FIPS to abbreviation mapping
const STATE_FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY','60':'AS','66':'GU','69':'MP','72':'PR','78':'VI'
};

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('[ZIP Crosswalk] Reading Census ZCTA-County file...');
    const data = fs.readFileSync('/tmp/zcta_county.txt', 'utf8');
    const lines = data.split('\n');
    console.log(`[ZIP Crosswalk] Total lines: ${lines.length}`);

    // Parse header
    // Columns: OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|...|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|...|AREALAND_PART|AREAWATER_PART
    // Index 1 = ZCTA (ZIP), Index 9 = County FIPS, Index 10 = County Name, Index 16 = AREALAND_PART (for ratio)

    const rows = [];
    const zipAreaTotals = {}; // zipcode -> total land area

    // First pass: collect all rows and compute total area per ZIP
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('|');
      const zcta = (cols[1] || '').trim();
      if (!zcta || zcta.length < 5) continue;

      const countyFips = (cols[9] || '').trim();
      const countyNameRaw = (cols[10] || '').trim();
      const areaLand = parseInt(cols[16]) || 0;

      if (!countyFips || countyFips.length < 4) continue;

      const stateFips = countyFips.substring(0, 2);
      const state = STATE_FIPS[stateFips];
      if (!state) continue;

      // Clean county name: remove " County", " Parish", " Borough", etc.
      let countyName = countyNameRaw
        .replace(/ County$/, '')
        .replace(/ Parish$/, '')
        .replace(/ Borough$/, '')
        .replace(/ Census Area$/, '')
        .replace(/ Municipality$/, '')
        .replace(/ Municipio$/, '')
        .replace(/ city$/, ' City')
        .replace(/ City and Borough$/, '')
        .trim();

      // Uppercase to match plans table convention
      countyName = countyName.toUpperCase();

      rows.push({
        zipcode: zcta,
        countyFips,
        countyName,
        state,
        stateFips,
        areaLand
      });

      zipAreaTotals[zcta] = (zipAreaTotals[zcta] || 0) + areaLand;
    }

    console.log(`[ZIP Crosswalk] Parsed ${rows.length} ZCTA-County mappings`);
    console.log(`[ZIP Crosswalk] Distinct ZCTAs: ${Object.keys(zipAreaTotals).length}`);

    // Create table
    console.log('[ZIP Crosswalk] Creating zip_county_map table...');
    await pool.query(`
      DROP TABLE IF EXISTS zip_county_map CASCADE;
      CREATE TABLE zip_county_map (
        id SERIAL PRIMARY KEY,
        zipcode TEXT NOT NULL,
        county_fips TEXT NOT NULL,
        county_name TEXT,
        state TEXT NOT NULL,
        state_fips TEXT,
        residential_ratio REAL DEFAULT 1.0
      );
    `);

    // Batch insert
    console.log('[ZIP Crosswalk] Inserting rows in batches...');
    const BATCH = 500;
    let inserted = 0;

    for (let b = 0; b < rows.length; b += BATCH) {
      const batch = rows.slice(b, b + BATCH);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const r of batch) {
        const totalArea = zipAreaTotals[r.zipcode] || 1;
        const ratio = totalArea > 0 ? Math.round((r.areaLand / totalArea) * 1000) / 1000 : 1.0;

        values.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5})`);
        params.push(r.zipcode, r.countyFips, r.countyName, r.state, r.stateFips, ratio);
        paramIdx += 6;
      }

      await pool.query(
        `INSERT INTO zip_county_map (zipcode, county_fips, county_name, state, state_fips, residential_ratio) VALUES ${values.join(',')}`,
        params
      );
      inserted += batch.length;

      if (inserted % 5000 === 0) {
        console.log(`[ZIP Crosswalk]   Inserted ${inserted}/${rows.length}`);
      }
    }

    console.log(`[ZIP Crosswalk] Inserted ${inserted} total rows`);

    // Create indexes
    console.log('[ZIP Crosswalk] Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_zcm_zip ON zip_county_map(zipcode)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_zcm_county ON zip_county_map(county_name, state)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_zcm_fips ON zip_county_map(county_fips)');

    // Verify
    const countResult = await pool.query('SELECT COUNT(*) as cnt, COUNT(DISTINCT zipcode) as zips, COUNT(DISTINCT county_fips) as counties FROM zip_county_map');
    console.log('[ZIP Crosswalk] Final stats:', countResult.rows[0]);

    // Sample data
    const sample = await pool.query("SELECT * FROM zip_county_map WHERE zipcode IN ('90210', '10001', '33139', '60601', '78701') ORDER BY zipcode");
    console.log('[ZIP Crosswalk] Sample lookups:');
    sample.rows.forEach(r => console.log(`  ZIP ${r.zipcode} -> ${r.county_name}, ${r.state} (FIPS: ${r.county_fips}, ratio: ${r.residential_ratio})`));

    console.log('[ZIP Crosswalk] DONE');
  } catch (err) {
    console.error('[ZIP Crosswalk] ERROR:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
