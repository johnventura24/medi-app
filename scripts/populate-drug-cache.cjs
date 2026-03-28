const https = require('https');
const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const TOP_DRUGS = [
  'Metformin', 'Lisinopril', 'Amlodipine', 'Atorvastatin', 'Omeprazole',
  'Levothyroxine', 'Metoprolol', 'Losartan', 'Gabapentin', 'Hydrochlorothiazide',
  'Simvastatin', 'Sertraline', 'Pantoprazole', 'Furosemide', 'Montelukast',
  'Trazodone', 'Duloxetine', 'Escitalopram', 'Tamsulosin', 'Clopidogrel',
  'Prednisone', 'Rosuvastatin', 'Albuterol', 'Carvedilol', 'Meloxicam',
  'Tramadol', 'Pravastatin', 'Fluoxetine', 'Citalopram', 'Warfarin',
  'Bupropion', 'Insulin Glargine', 'Insulin Lispro', 'Eliquis', 'Xarelto',
  'Jardiance', 'Ozempic', 'Trulicity', 'Entresto', 'Farxiga',
  'Acetaminophen', 'Ibuprofen', 'Amoxicillin', 'Azithromycin', 'Cetirizine',
  'Loratadine', 'Fluticasone', 'Alprazolam', 'Clonazepam', 'Diazepam',
  'Cyclobenzaprine', 'Naproxen', 'Methylphenidate', 'Amphetamine',
  'Spironolactone', 'Potassium Chloride', 'Doxycycline', 'Amitriptyline',
  'Venlafaxine', 'Pregabalin', 'Celecoxib', 'Glipizide', 'Pioglitazone',
  'Sitagliptin', 'Empagliflozin', 'Dapagliflozin', 'Canagliflozin',
  'Liraglutide', 'Semaglutide', 'Dulaglutide', 'Apixaban', 'Rivaroxaban',
  'Dabigatran', 'Sacubitril', 'Valsartan', 'Diltiazem', 'Nifedipine',
  'Propranolol', 'Atenolol', 'Bisoprolol', 'Ramipril', 'Enalapril',
  'Benazepril', 'Irbesartan', 'Olmesartan', 'Telmisartan', 'Chlorthalidone',
  'Triamterene', 'Bumetanide', 'Torsemide', 'Digoxin', 'Isosorbide',
  'Nitroglycerin', 'Amiodarone', 'Flecainide', 'Ticagrelor', 'Prasugrel',
  'Ezetimibe', 'Fenofibrate', 'Niacin', 'Omega-3', 'Aspirin'
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error for ${url}: ${data.substring(0, 200)}`)); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function resolveRxNorm(drugName) {
  try {
    // Try drugs endpoint first
    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(drugName)}`;
    const data = await httpsGet(url);

    if (data.drugGroup && data.drugGroup.conceptGroup) {
      for (const group of data.drugGroup.conceptGroup) {
        if (group.conceptProperties && group.conceptProperties.length > 0) {
          const concept = group.conceptProperties[0];
          return { rxcui: concept.rxcui, name: concept.name, tty: group.tty };
        }
      }
    }

    // Fallback: try approximate match
    const url2 = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(drugName)}&maxEntries=1`;
    const data2 = await httpsGet(url2);
    if (data2.approximateGroup && data2.approximateGroup.candidate && data2.approximateGroup.candidate.length > 0) {
      const c = data2.approximateGroup.candidate[0];
      return { rxcui: c.rxcui, name: drugName, tty: 'APPROX' };
    }

    return null;
  } catch (e) {
    console.error(`  Error resolving ${drugName}: ${e.message}`);
    return null;
  }
}

async function getProperties(rxcui) {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
    const data = await httpsGet(url);
    if (data.properties) {
      return data.properties;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function parseStrengthAndForm(name) {
  // Try to extract strength (e.g., "500 MG", "10 MG/5 ML")
  const strengthMatch = name.match(/(\d+(?:\.\d+)?\s*(?:MG|MCG|MG\/ML|UNIT|UNITS|%|ML|MG\/5\s*ML)[^\/]*)/i);
  const strength = strengthMatch ? strengthMatch[1].trim() : null;

  // Try to extract dosage form
  const forms = ['Oral Tablet', 'Oral Capsule', 'Injectable Solution', 'Oral Solution',
    'Topical Cream', 'Nasal Spray', 'Inhalation Solution', 'Metered Dose Inhaler',
    'Injection', 'Pen Injector', 'Extended Release', 'Delayed Release',
    'Sublingual Tablet', 'Transdermal Patch', 'Ophthalmic Solution', 'Oral Suspension',
    'Prefilled Syringe', 'Auto-Injector'];
  let dosageForm = null;
  for (const form of forms) {
    if (name.toLowerCase().includes(form.toLowerCase())) {
      dosageForm = form;
      break;
    }
  }

  return { strength, dosageForm };
}

async function main() {
  const client = new Client(DB_URL);
  await client.connect();
  console.log('Connected to database');

  // Get existing cached drugs to skip
  const existing = await client.query('SELECT input_name FROM drug_cache');
  const existingNames = new Set(existing.rows.map(r => r.input_name.toLowerCase()));
  console.log(`Found ${existingNames.size} existing cached drugs`);

  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < TOP_DRUGS.length; i++) {
    const drugName = TOP_DRUGS[i];

    if (existingNames.has(drugName.toLowerCase())) {
      console.log(`[${i+1}/${TOP_DRUGS.length}] ${drugName} - already cached, skipping`);
      continue;
    }

    console.log(`[${i+1}/${TOP_DRUGS.length}] Resolving ${drugName}...`);

    const result = await resolveRxNorm(drugName);
    await sleep(120); // rate limit

    if (!result) {
      console.log(`  FAILED - no RxNorm match`);
      failed++;
      continue;
    }

    // Get properties for more detail
    const props = await getProperties(result.rxcui);
    await sleep(120);

    const resolvedName = props ? props.name : result.name;
    const { strength, dosageForm } = parseStrengthAndForm(resolvedName);

    try {
      await client.query(
        `INSERT INTO drug_cache (input_name, rxcui, resolved_name, strength, dosage_form, resolved_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT DO NOTHING`,
        [drugName.toLowerCase(), result.rxcui, resolvedName, strength, dosageForm]
      );
      inserted++;
      console.log(`  OK: ${result.rxcui} - ${resolvedName} [${strength || 'N/A'}] [${dosageForm || 'N/A'}]`);
    } catch (e) {
      console.error(`  DB error: ${e.message}`);
      failed++;
    }
  }

  const total = await client.query('SELECT count(*) FROM drug_cache');
  console.log(`\nDone! Inserted: ${inserted}, Failed: ${failed}, Total in cache: ${total.rows[0].count}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
