const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// Drug classification for realistic tier assignment
const DRUG_TIERS = {
  // Tier 1: Preferred Generic (cheapest)
  generic_t1: [
    'metformin', 'lisinopril', 'amlodipine', 'atorvastatin', 'omeprazole',
    'levothyroxine', 'metoprolol', 'losartan', 'hydrochlorothiazide',
    'simvastatin', 'sertraline', 'furosemide', 'prednisone', 'warfarin',
    'ibuprofen', 'acetaminophen', 'amoxicillin', 'cetirizine', 'loratadine',
    'aspirin', 'naproxen', 'atenolol', 'enalapril', 'ramipril',
    'chlorthalidone', 'triamterene', 'digoxin', 'propranolol',
    'potassium chloride', 'spironolactone'
  ],
  // Tier 2: Generic
  generic_t2: [
    'gabapentin', 'pantoprazole', 'montelukast', 'trazodone',
    'escitalopram', 'tamsulosin', 'clopidogrel', 'carvedilol', 'meloxicam',
    'tramadol', 'pravastatin', 'fluoxetine', 'citalopram', 'bupropion',
    'alprazolam', 'clonazepam', 'diazepam', 'cyclobenzaprine',
    'doxycycline', 'amitriptyline', 'venlafaxine', 'celecoxib',
    'glipizide', 'pioglitazone', 'valsartan', 'diltiazem', 'nifedipine',
    'bisoprolol', 'benazepril', 'irbesartan', 'olmesartan', 'telmisartan',
    'bumetanide', 'torsemide', 'isosorbide', 'nitroglycerin',
    'amiodarone', 'flecainide', 'ezetimibe', 'fenofibrate',
    'duloxetine', 'rosuvastatin', 'albuterol', 'fluticasone',
    'methylphenidate', 'amphetamine', 'niacin', 'omega-3'
  ],
  // Tier 3: Preferred Brand
  preferred_brand: [
    'eliquis', 'xarelto', 'jardiance', 'farxiga',
    'pregabalin', 'sitagliptin', 'ticagrelor'
  ],
  // Tier 4: Non-Preferred Brand
  nonpreferred_brand: [
    'canagliflozin', 'dabigatran', 'prasugrel',
    'azithromycin', 'liraglutide'
  ],
  // Tier 5: Specialty
  specialty: [
    'ozempic', 'trulicity', 'entresto', 'insulin glargine', 'insulin lispro',
    'semaglutide', 'dulaglutide', 'sacubitril', 'apixaban', 'rivaroxaban',
    'empagliflozin', 'dapagliflozin'
  ]
};

function getDrugTier(drugName) {
  const lower = drugName.toLowerCase();
  if (DRUG_TIERS.generic_t1.includes(lower)) return 1;
  if (DRUG_TIERS.generic_t2.includes(lower)) return 2;
  if (DRUG_TIERS.preferred_brand.includes(lower)) return 3;
  if (DRUG_TIERS.nonpreferred_brand.includes(lower)) return 4;
  if (DRUG_TIERS.specialty.includes(lower)) return 5;
  return 2; // default generic
}

// Seeded random for reproducibility per contract+drug pair
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function hashStr(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash;
}

function getFlags(tier, seed) {
  const r1 = seededRandom(seed);
  const r2 = seededRandom(seed + 1);
  const r3 = seededRandom(seed + 2);

  let pa = false, st = false, ql = false;
  let qlAmount = null, qlDays = null;

  switch (tier) {
    case 1: // generic tier 1
      ql = r3 < 0.05;
      break;
    case 2: // generic tier 2
      pa = r1 < 0.05;
      ql = r3 < 0.10;
      break;
    case 3: // preferred brand
      pa = r1 < 0.30;
      st = r2 < 0.20;
      ql = r3 < 0.25;
      break;
    case 4: // non-preferred brand
      pa = r1 < 0.50;
      st = r2 < 0.30;
      ql = r3 < 0.30;
      break;
    case 5: // specialty
      pa = r1 < 0.80;
      st = r2 < 0.40;
      ql = r3 < 0.60;
      break;
  }

  if (ql) {
    qlAmount = Math.floor(seededRandom(seed + 3) * 60) + 30; // 30-90
    qlDays = [30, 30, 30, 90][Math.floor(seededRandom(seed + 4) * 4)];
  }

  return { pa, st, ql, qlAmount, qlDays };
}

// Some plans offer different tier structures - add variation
function adjustTierForPlan(baseTier, contractHash) {
  const r = seededRandom(contractHash);
  // ~20% of plans may move a drug up or down one tier
  if (r < 0.10 && baseTier > 1) return baseTier - 1;
  if (r > 0.90 && baseTier < 5) return baseTier + 1;
  return baseTier;
}

async function main() {
  const client = new Client(DB_URL);
  await client.connect();
  console.log('Connected to database');

  // Get all contract_ids
  const contractResult = await client.query('SELECT DISTINCT contract_id FROM plans ORDER BY contract_id');
  const contracts = contractResult.rows.map(r => r.contract_id);
  console.log(`Found ${contracts.length} distinct contracts`);

  // Get drugs from drug_cache
  const drugResult = await client.query('SELECT input_name, rxcui, resolved_name FROM drug_cache ORDER BY id');
  const drugs = drugResult.rows;
  console.log(`Found ${drugs.length} drugs in cache`);

  // Clear existing formulary data
  console.log('Clearing existing formulary_drugs...');
  await client.query('DELETE FROM formulary_drugs');

  const BATCH_SIZE = 500;
  const CONTRACT_YEAR = 2025;
  let totalInserted = 0;
  let batch = [];

  console.log(`Generating formulary data: ${contracts.length} contracts x ${drugs.length} drugs = ${contracts.length * drugs.length} rows`);

  for (let ci = 0; ci < contracts.length; ci++) {
    const contractId = contracts[ci];
    const contractHash = hashStr(contractId);
    // Generate a formulary_id based on contract (in real data, one contract can have multiple formulary IDs)
    const formularyId = `${contractId.replace('H', '')}001`;

    for (let di = 0; di < drugs.length; di++) {
      const drug = drugs[di];
      const baseTier = getDrugTier(drug.input_name);
      const tier = adjustTierForPlan(baseTier, contractHash + di);
      const seed = contractHash * 100 + di;
      const flags = getFlags(tier, seed);

      // ~5% chance a drug is NOT on a plan's formulary (realistic exclusion)
      const exclusionRand = seededRandom(seed + 100);
      if (exclusionRand < 0.05 && tier >= 3) continue; // only exclude brand/specialty

      batch.push([
        contractId,
        formularyId,
        drug.rxcui,
        drug.input_name,
        tier,
        flags.pa,
        flags.st,
        flags.ql,
        flags.qlAmount,
        flags.qlDays,
        CONTRACT_YEAR
      ]);

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        totalInserted += batch.length;
        batch = [];

        if (totalInserted % 5000 === 0) {
          console.log(`  Inserted ${totalInserted} rows... (contract ${ci + 1}/${contracts.length})`);
        }
      }
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await insertBatch(client, batch);
    totalInserted += batch.length;
  }

  console.log(`\nDone! Total formulary rows inserted: ${totalInserted}`);

  // Verify
  const count = await client.query('SELECT count(*) FROM formulary_drugs');
  console.log(`Verified count in DB: ${count.rows[0].count}`);

  const sample = await client.query('SELECT * FROM formulary_drugs LIMIT 5');
  console.log('Sample rows:');
  for (const r of sample.rows) {
    console.log(`  ${r.contract_id} | ${r.drug_name} | Tier ${r.tier} | PA:${r.prior_authorization} ST:${r.step_therapy} QL:${r.quantity_limit}`);
  }

  // Stats
  const tierStats = await client.query('SELECT tier, count(*) as cnt FROM formulary_drugs GROUP BY tier ORDER BY tier');
  console.log('\nTier distribution:');
  for (const r of tierStats.rows) {
    console.log(`  Tier ${r.tier}: ${r.cnt} rows`);
  }

  await client.end();
}

async function insertBatch(client, batch) {
  // Build parameterized multi-row insert
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const row of batch) {
    const placeholders = [];
    for (const val of row) {
      placeholders.push(`$${paramIdx++}`);
      params.push(val);
    }
    values.push(`(${placeholders.join(', ')})`);
  }

  const sql = `INSERT INTO formulary_drugs
    (contract_id, formulary_id, rxcui, drug_name, tier, prior_authorization, step_therapy, quantity_limit, quantity_limit_amount, quantity_limit_days, contract_year)
    VALUES ${values.join(', ')}`;

  await client.query(sql, params);
}

main().catch(e => { console.error(e); process.exit(1); });
