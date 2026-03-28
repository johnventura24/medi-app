/**
 * Generate representative ACA Marketplace (QHP) plan data.
 *
 * CMS provides ACA plan data through QHP landscape files, but the download
 * URLs change each year. This script generates realistic data modeled on
 * the structure of real ACA marketplace offerings — covering all 50 states + DC,
 * with realistic issuers, premium bands, metal levels, and network types.
 *
 * Run: node scripts/generate-aca-data.cjs
 */

const { Pool } = require('pg');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// Real ACA issuers (national + regional)
const NATIONAL_ISSUERS = [
  'Blue Cross Blue Shield', 'UnitedHealthcare', 'Aetna', 'Cigna',
  'Molina Healthcare', 'Centene / Ambetter', 'Oscar Health',
  'Kaiser Permanente', 'Anthem', 'Humana',
];

const REGIONAL_ISSUERS = {
  CA: ['Health Net', 'Sharp Health Plan', 'LA Care', 'Chinese Community Health Plan', 'Valley Health Plan', 'Western Health Advantage'],
  TX: ['Community Health Choice', 'Scott & White Health Plan', 'FirstCare Health Plans', 'Sendero Health Plans'],
  FL: ['Florida Blue', 'AvMed', 'Capital Health Plan', 'Bright Health'],
  NY: ['Healthfirst', 'MetroPlus Health', 'Fidelis Care', 'MVP Health Care', 'EmblemHealth'],
  PA: ['Independence Blue Cross', 'Geisinger Health Plan', 'UPMC Health Plan', 'Capital BlueCross'],
  IL: ['Land of Lincoln Health', 'Celtic Insurance Company', 'Health Alliance'],
  OH: ['Medical Mutual', 'CareSource', 'SummaCare', 'Paramount Insurance'],
  GA: ['Alliant Health Plans', 'Peach State Health Plan', 'WellCare of Georgia'],
  NC: ['Blue Cross NC', 'FirstCarolinaCare', 'Bright Health'],
  MI: ['Priority Health', 'McLaren Health Plan', 'HAP (Health Alliance Plan)', 'Meridian Health Plan'],
  VA: ['CareFirst BlueCross', 'Piedmont Community Health Plan', 'Innovation Health'],
  WA: ['Premera Blue Cross', 'Regence BlueShield', 'Coordinated Care', 'Community Health Plan of Washington'],
  CO: ['Colorado Access', 'Denver Health Medical Plan', 'Friday Health Plans', 'Bright Health'],
  AZ: ['Banner Health', 'Alignment Health Plan', 'Arizona Complete Health'],
  MA: ['Harvard Pilgrim Health Care', 'Tufts Health Plan', 'ConnectiCare', 'Minuteman Health'],
  NJ: ['Horizon Blue Cross Blue Shield', 'AmeriHealth NJ', 'Oxford Health Plans'],
  MN: ['HealthPartners', 'Medica', 'Quartz', 'Sanford Health Plan'],
  OR: ['Providence Health Plan', 'PacificSource Health Plans', 'Moda Health'],
  WI: ['Quartz', 'Group Health Cooperative', 'Common Ground Healthcare', 'Dean Health Plan'],
  MD: ['CareFirst BlueCross', 'Evergreen Health', 'Kaiser Permanente Mid-Atlantic'],
};

const STATES_WITH_COUNTIES = {
  AL: ['Jefferson', 'Mobile', 'Madison', 'Montgomery', 'Tuscaloosa', 'Baldwin', 'Shelby'],
  AK: ['Anchorage', 'Fairbanks North Star', 'Matanuska-Susitna', 'Kenai Peninsula'],
  AZ: ['Maricopa', 'Pima', 'Pinal', 'Yavapai', 'Coconino', 'Mohave'],
  AR: ['Pulaski', 'Benton', 'Washington', 'Sebastian', 'Faulkner', 'Garland'],
  CA: ['Los Angeles', 'San Diego', 'Orange', 'Riverside', 'San Bernardino', 'Santa Clara', 'Alameda', 'Sacramento', 'San Francisco', 'Fresno'],
  CO: ['Denver', 'El Paso', 'Arapahoe', 'Jefferson', 'Adams', 'Boulder', 'Larimer', 'Douglas'],
  CT: ['Fairfield', 'Hartford', 'New Haven', 'New London', 'Litchfield'],
  DE: ['New Castle', 'Sussex', 'Kent'],
  DC: ['District of Columbia'],
  FL: ['Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough', 'Orange', 'Pinellas', 'Duval', 'Lee', 'Polk'],
  GA: ['Fulton', 'Gwinnett', 'Cobb', 'DeKalb', 'Chatham', 'Richmond', 'Cherokee', 'Clayton'],
  HI: ['Honolulu', 'Hawaii', 'Maui', 'Kauai'],
  ID: ['Ada', 'Canyon', 'Kootenai', 'Bonneville', 'Twin Falls'],
  IL: ['Cook', 'DuPage', 'Lake', 'Will', 'Kane', 'McHenry', 'Winnebago', 'Madison', 'Sangamon'],
  IN: ['Marion', 'Lake', 'Allen', 'Hamilton', 'St. Joseph', 'Elkhart', 'Tippecanoe'],
  IA: ['Polk', 'Linn', 'Scott', 'Johnson', 'Black Hawk', 'Woodbury', 'Story'],
  KS: ['Johnson', 'Sedgwick', 'Shawnee', 'Wyandotte', 'Douglas', 'Leavenworth'],
  KY: ['Jefferson', 'Fayette', 'Kenton', 'Boone', 'Warren', 'Hardin'],
  LA: ['East Baton Rouge', 'Jefferson', 'Orleans', 'St. Tammany', 'Caddo', 'Calcasieu'],
  ME: ['Cumberland', 'York', 'Penobscot', 'Kennebec', 'Androscoggin'],
  MD: ['Montgomery', 'Prince George\'s', 'Baltimore', 'Anne Arundel', 'Howard', 'Frederick'],
  MA: ['Middlesex', 'Worcester', 'Suffolk', 'Essex', 'Norfolk', 'Bristol', 'Plymouth'],
  MI: ['Wayne', 'Oakland', 'Macomb', 'Kent', 'Genesee', 'Washtenaw', 'Ingham', 'Ottawa'],
  MN: ['Hennepin', 'Ramsey', 'Dakota', 'Anoka', 'Washington', 'Stearns', 'Olmsted'],
  MS: ['Hinds', 'Harrison', 'DeSoto', 'Rankin', 'Jackson', 'Lee'],
  MO: ['St. Louis', 'Jackson', 'St. Charles', 'Greene', 'Clay', 'Boone'],
  MT: ['Yellowstone', 'Missoula', 'Gallatin', 'Flathead', 'Cascade'],
  NE: ['Douglas', 'Lancaster', 'Sarpy', 'Hall', 'Buffalo'],
  NV: ['Clark', 'Washoe', 'Carson City', 'Douglas', 'Elko'],
  NH: ['Hillsborough', 'Rockingham', 'Merrimack', 'Strafford', 'Grafton'],
  NJ: ['Bergen', 'Middlesex', 'Essex', 'Hudson', 'Monmouth', 'Ocean', 'Union', 'Camden', 'Passaic'],
  NM: ['Bernalillo', 'Dona Ana', 'Santa Fe', 'Sandoval', 'San Juan'],
  NY: ['Kings', 'Queens', 'New York', 'Suffolk', 'Bronx', 'Nassau', 'Westchester', 'Erie', 'Monroe', 'Onondaga'],
  NC: ['Mecklenburg', 'Wake', 'Guilford', 'Forsyth', 'Cumberland', 'Durham', 'Buncombe'],
  ND: ['Cass', 'Burleigh', 'Grand Forks', 'Ward', 'Williams'],
  OH: ['Franklin', 'Cuyahoga', 'Hamilton', 'Summit', 'Montgomery', 'Lucas', 'Butler', 'Stark'],
  OK: ['Oklahoma', 'Tulsa', 'Cleveland', 'Canadian', 'Comanche', 'Rogers'],
  OR: ['Multnomah', 'Washington', 'Clackamas', 'Lane', 'Marion', 'Jackson', 'Deschutes'],
  PA: ['Philadelphia', 'Allegheny', 'Montgomery', 'Bucks', 'Delaware', 'Lancaster', 'Chester', 'York'],
  RI: ['Providence', 'Kent', 'Washington', 'Newport', 'Bristol'],
  SC: ['Greenville', 'Richland', 'Charleston', 'Horry', 'Spartanburg', 'Lexington'],
  SD: ['Minnehaha', 'Pennington', 'Lincoln', 'Brown', 'Brookings'],
  TN: ['Shelby', 'Davidson', 'Knox', 'Hamilton', 'Rutherford', 'Williamson', 'Sullivan'],
  TX: ['Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis', 'Collin', 'Hidalgo', 'El Paso', 'Denton', 'Fort Bend'],
  UT: ['Salt Lake', 'Utah', 'Davis', 'Weber', 'Washington', 'Cache'],
  VT: ['Chittenden', 'Rutland', 'Washington', 'Windsor', 'Windham'],
  VA: ['Fairfax', 'Virginia Beach city', 'Prince William', 'Loudoun', 'Chesterfield', 'Henrico', 'Arlington'],
  WA: ['King', 'Pierce', 'Snohomish', 'Spokane', 'Clark', 'Thurston', 'Kitsap'],
  WV: ['Kanawha', 'Berkeley', 'Cabell', 'Monongalia', 'Wood', 'Raleigh'],
  WI: ['Milwaukee', 'Dane', 'Waukesha', 'Brown', 'Racine', 'Outagamie', 'Winnebago'],
  WY: ['Laramie', 'Natrona', 'Campbell', 'Sweetwater', 'Fremont'],
};

const METAL_LEVELS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Catastrophic'];
const PLAN_TYPES = ['HMO', 'PPO', 'EPO', 'POS'];

// Premium ranges by metal level (age 40 baseline)
const PREMIUM_RANGES = {
  Catastrophic: { min: 180, max: 280 },
  Bronze: { min: 300, max: 450 },
  Silver: { min: 400, max: 550 },
  Gold: { min: 500, max: 700 },
  Platinum: { min: 600, max: 900 },
};

// Deductible ranges by metal level
const DEDUCTIBLE_RANGES = {
  Catastrophic: { indMin: 8500, indMax: 9450, famMin: 17000, famMax: 18900 },
  Bronze: { indMin: 5000, indMax: 8700, famMin: 10000, famMax: 17400 },
  Silver: { indMin: 2000, indMax: 5500, famMin: 4000, famMax: 11000 },
  Gold: { indMin: 500, indMax: 2000, famMin: 1000, famMax: 4000 },
  Platinum: { indMin: 0, indMax: 500, famMin: 0, famMax: 1000 },
};

// MOOP ranges by metal level
const MOOP_RANGES = {
  Catastrophic: { indMin: 8500, indMax: 9450, famMin: 17000, famMax: 18900 },
  Bronze: { indMin: 7000, indMax: 9450, famMin: 14000, famMax: 18900 },
  Silver: { indMin: 5000, indMax: 8500, famMin: 10000, famMax: 17000 },
  Gold: { indMin: 3000, indMax: 6500, famMin: 6000, famMax: 13000 },
  Platinum: { indMin: 1500, indMax: 4000, famMin: 3000, famMax: 8000 },
};

// State cost adjustment factors (higher cost states get higher premiums)
const STATE_COST_FACTOR = {
  AK: 1.85, HI: 1.40, CT: 1.30, MA: 1.25, NY: 1.35, NJ: 1.28, VT: 1.30,
  WY: 1.45, WV: 1.35, NE: 1.15, ND: 1.10, SD: 1.12, MT: 1.20,
  CA: 1.10, CO: 1.05, WA: 1.08, DC: 1.20, MD: 1.15, VA: 1.05,
  NH: 1.22, ME: 1.18, RI: 1.15, DE: 1.12, PA: 1.08, IL: 1.05,
  FL: 1.02, TX: 0.98, GA: 0.95, NC: 0.97, SC: 0.93, TN: 0.95,
  AL: 0.92, MS: 0.90, LA: 0.95, AR: 0.91, OK: 0.93, KS: 0.96,
  MO: 0.95, IA: 0.98, MN: 1.02, WI: 1.00, MI: 1.00, OH: 0.98,
  IN: 0.96, KY: 0.95, OR: 1.05, NV: 1.02, AZ: 0.98, NM: 1.00,
  UT: 0.95, ID: 1.00,
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roundTo(val, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

function generateHiosId(issuerNum, planNum, state) {
  // HIOS format: 5-digit issuer ID + 2-letter state + 7-digit plan variant
  const issId = String(10000 + issuerNum).padStart(5, '0');
  const planPart = String(1000000 + planNum).padStart(7, '0');
  return `${issId}${state}${planPart}`;
}

async function main() {
  console.log('Creating aca_plans table...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aca_plans (
      id SERIAL PRIMARY KEY,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      issuer_name TEXT NOT NULL,
      metal_level TEXT,
      plan_type TEXT,
      state TEXT NOT NULL,
      county TEXT,
      fips TEXT,
      premium_age_27 REAL,
      premium_age_40 REAL,
      premium_age_60 REAL,
      deductible_individual REAL,
      deductible_family REAL,
      moop_individual REAL,
      moop_family REAL,
      ehb_pct REAL,
      hsa_eligible BOOLEAN DEFAULT FALSE,
      child_only BOOLEAN DEFAULT FALSE,
      plan_year INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_aca_state ON aca_plans(state);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_aca_county ON aca_plans(county, state);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_aca_issuer ON aca_plans(issuer_name);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_aca_metal ON aca_plans(metal_level);`);

  // Clear old data
  await pool.query('DELETE FROM aca_plans');
  console.log('Table ready, generating plan data...');

  const allRows = [];
  let totalPlans = 0;
  let issuerGlobalNum = 0;
  let planGlobalNum = 0;

  const states = Object.keys(STATES_WITH_COUNTIES);

  for (const state of states) {
    const counties = STATES_WITH_COUNTIES[state];
    const costFactor = STATE_COST_FACTOR[state] || 1.0;

    // Choose issuers for this state: 2-4 nationals + 0-6 regionals
    const numNational = randInt(2, Math.min(5, NATIONAL_ISSUERS.length));
    const shuffledNational = [...NATIONAL_ISSUERS].sort(() => Math.random() - 0.5).slice(0, numNational);
    const regionals = REGIONAL_ISSUERS[state] || [];
    const numRegional = Math.min(regionals.length, randInt(0, Math.min(4, regionals.length)));
    const shuffledRegional = [...regionals].sort(() => Math.random() - 0.5).slice(0, numRegional);
    const stateIssuers = [...shuffledNational, ...shuffledRegional];

    for (const issuer of stateIssuers) {
      issuerGlobalNum++;
      // Each issuer offers 2-6 plans (different metal/type combos)
      const numPlans = randInt(2, 6);

      // Not all issuers offer all metals; larger issuers more likely to have Platinum
      const availableMetals = ['Bronze', 'Silver', 'Gold'];
      if (Math.random() > 0.4) availableMetals.push('Platinum');
      if (Math.random() > 0.7) availableMetals.push('Catastrophic');

      for (let p = 0; p < numPlans; p++) {
        planGlobalNum++;
        const metal = pick(availableMetals);
        const planType = pick(PLAN_TYPES);
        const hiosId = generateHiosId(issuerGlobalNum, planGlobalNum, state);

        // Generate base premium for age 40
        const premRange = PREMIUM_RANGES[metal];
        const basePrem40 = roundTo(rand(premRange.min, premRange.max) * costFactor, 2);
        // Age 27 is ~0.65x of age 40, age 60 is ~1.7x
        const prem27 = roundTo(basePrem40 * rand(0.62, 0.68), 2);
        const prem60 = roundTo(basePrem40 * rand(1.65, 1.78), 2);

        const dedRange = DEDUCTIBLE_RANGES[metal];
        const dedInd = roundTo(rand(dedRange.indMin, dedRange.indMax), 0);
        const dedFam = roundTo(rand(dedRange.famMin, dedRange.famMax), 0);

        const moopRange = MOOP_RANGES[metal];
        const moopInd = roundTo(rand(moopRange.indMin, moopRange.indMax), 0);
        const moopFam = roundTo(rand(moopRange.famMin, moopRange.famMax), 0);

        const ehbPct = roundTo(rand(0.92, 1.00), 4);
        const hsaEligible = metal === 'Bronze' && planType === 'PPO' && Math.random() > 0.5;

        // Determine plan name
        const tierLabel = metal === 'Catastrophic' ? 'Catastrophic' : metal;
        const variantNames = ['Pathway', 'Choice', 'Essential', 'Select', 'Access', 'Value', 'Premier', 'Core', 'Plus', 'Basic'];
        const variant = pick(variantNames);
        const planName = `${issuer} ${tierLabel} ${planType} ${variant}`;

        // Each plan available in a subset of the state's counties (most in all, some regional)
        const isRegional = !NATIONAL_ISSUERS.includes(issuer);
        const coverageCounties = isRegional
          ? counties.slice(0, Math.max(2, Math.floor(counties.length * rand(0.3, 0.7))))
          : counties;

        for (const county of coverageCounties) {
          // Slight county-level premium variation (+/- 5%)
          const countyAdj = rand(0.95, 1.05);
          allRows.push([
            hiosId,
            planName,
            issuer,
            metal,
            planType,
            state,
            county,
            null, // fips — we don't have it for generated data
            roundTo(prem27 * countyAdj, 2),
            roundTo(basePrem40 * countyAdj, 2),
            roundTo(prem60 * countyAdj, 2),
            dedInd,
            dedFam,
            moopInd,
            moopFam,
            ehbPct,
            hsaEligible,
            false, // child_only
            2025,
          ]);
          totalPlans++;
        }
      }
    }

    if (totalPlans % 5000 === 0 || state === states[states.length - 1]) {
      process.stdout.write(`\r  Generated ${totalPlans.toLocaleString()} plan-county rows (${state})...`);
    }
  }

  console.log(`\n  Total rows to insert: ${totalPlans.toLocaleString()}`);

  // Batch insert
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const row of batch) {
      const placeholders = row.map(() => `$${paramIdx++}`);
      values.push(`(${placeholders.join(',')})`);
      params.push(...row);
    }

    await pool.query(
      `INSERT INTO aca_plans (plan_id, plan_name, issuer_name, metal_level, plan_type, state, county, fips,
        premium_age_27, premium_age_40, premium_age_60, deductible_individual, deductible_family,
        moop_individual, moop_family, ehb_pct, hsa_eligible, child_only, plan_year)
       VALUES ${values.join(',')}`,
      params
    );

    inserted += batch.length;
    if (inserted % 5000 === 0 || inserted === allRows.length) {
      process.stdout.write(`\r  Inserted ${inserted.toLocaleString()} / ${allRows.length.toLocaleString()} rows...`);
    }
  }

  console.log('\n  Done! Verifying...');

  const countResult = await pool.query('SELECT count(*) FROM aca_plans');
  const stateCount = await pool.query('SELECT count(DISTINCT state) FROM aca_plans');
  const issuerCount = await pool.query('SELECT count(DISTINCT issuer_name) FROM aca_plans');
  const metalDist = await pool.query('SELECT metal_level, count(*) as cnt FROM aca_plans GROUP BY metal_level ORDER BY cnt DESC');

  console.log(`  Total ACA plan rows: ${Number(countResult.rows[0].count).toLocaleString()}`);
  console.log(`  States covered: ${stateCount.rows[0].count}`);
  console.log(`  Distinct issuers: ${issuerCount.rows[0].count}`);
  console.log('  Metal distribution:');
  for (const row of metalDist.rows) {
    console.log(`    ${row.metal_level}: ${Number(row.cnt).toLocaleString()}`);
  }

  await pool.end();
  console.log('ACA data generation complete.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
