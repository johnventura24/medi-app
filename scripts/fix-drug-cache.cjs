const https = require('https');
const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// Map of drug names to their best single-ingredient RxCUI (from RxNorm)
// We'll look up each one properly
const DRUGS_TO_FIX = [
  'Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole', 'Levothyroxine',
  'Metoprolol', 'Losartan', 'Gabapentin', 'Hydrochlorothiazide', 'Furosemide',
  'Trazodone', 'Duloxetine', 'Prednisone', 'Rosuvastatin', 'Albuterol',
  'Meloxicam', 'Tramadol', 'Pravastatin', 'Celecoxib', 'Pioglitazone',
  'Sitagliptin', 'Empagliflozin', 'Dapagliflozin', 'Apixaban', 'Rivaroxaban',
  'Sacubitril', 'Valsartan', 'Diltiazem', 'Nifedipine', 'Propranolol',
  'Bisoprolol', 'Enalapril', 'Benazepril', 'Olmesartan', 'Telmisartan',
  'Chlorthalidone', 'Triamterene', 'Ezetimibe', 'Acetaminophen', 'Ibuprofen',
  'Amoxicillin', 'Fluticasone', 'Diazepam', 'Cyclobenzaprine', 'Spironolactone',
  'Potassium Chloride', 'Doxycycline', 'Methylphenidate', 'Amphetamine',
  'Isosorbide', 'Nitroglycerin', 'Amiodarone', 'Niacin', 'Aspirin',
  'Liraglutide', 'Semaglutide', 'Dulaglutide', 'Insulin Glargine', 'Insulin Lispro'
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findBestRxcui(drugName) {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(drugName)}`;
    const data = await httpsGet(url);

    if (!data.drugGroup || !data.drugGroup.conceptGroup) return null;

    // Prefer SCD (Semantic Clinical Drug) or SBD (Semantic Branded Drug) that is a single ingredient
    // and contains the drug name prominently
    const nameLower = drugName.toLowerCase();
    let bestCandidate = null;
    let bestScore = -1;

    for (const group of data.drugGroup.conceptGroup) {
      if (!group.conceptProperties) continue;
      const tty = group.tty;

      for (const concept of group.conceptProperties) {
        const cName = concept.name.toLowerCase();
        let score = 0;

        // Prefer SCD (generic clinical drug) over SBD (branded)
        if (tty === 'SCD') score += 10;
        else if (tty === 'SBD') score += 8;
        else if (tty === 'GPCK' || tty === 'BPCK') score += 2;

        // Prefer single ingredient (no "/" separator except in strength like MG/ML)
        const slashCount = (cName.match(/ \/ /g) || []).length;
        if (slashCount === 0) score += 20;
        else if (slashCount === 1) score += 5;

        // Prefer if name starts with the drug name
        if (cName.includes(nameLower)) score += 15;
        if (cName.startsWith(nameLower) || cName.match(new RegExp(`^\\d+\\s*(hr\\s+)?${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))) score += 5;

        // Prefer oral tablet form
        if (cName.includes('oral tablet')) score += 3;
        else if (cName.includes('oral capsule')) score += 2;

        // Penalize packs
        if (cName.includes('pack')) score -= 15;
        if (cName.includes('{')) score -= 10;

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = { rxcui: concept.rxcui, name: concept.name, tty };
        }
      }
    }

    return bestCandidate;
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    return null;
  }
}

function parseStrengthAndForm(name) {
  const strengthMatch = name.match(/(\d+(?:\.\d+)?\s*(?:MG|MCG|MG\/ML|UNT\/ML|UNT|UNITS|%|ML)[^\s\/]*)/i);
  const strength = strengthMatch ? strengthMatch[1].trim() : null;

  const forms = ['Oral Tablet', 'Oral Capsule', 'Injectable Solution', 'Oral Solution',
    'Topical Cream', 'Nasal Spray', 'Inhalation Solution', 'Metered Dose Inhaler',
    'Injection', 'Pen Injector', 'Extended Release Oral Tablet', 'Extended Release Oral Capsule',
    'Delayed Release Oral Capsule', 'Delayed Release Oral Tablet',
    'Sublingual Tablet', 'Transdermal Patch', 'Ophthalmic Solution', 'Oral Suspension',
    'Prefilled Syringe', 'Auto-Injector', 'Dry Powder Inhaler',
    'Disintegrating Oral Tablet', 'Chewable Tablet'];
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
  console.log('Connected. Fixing drug_cache entries with better single-ingredient matches...');

  let fixed = 0;

  for (let i = 0; i < DRUGS_TO_FIX.length; i++) {
    const drugName = DRUGS_TO_FIX[i];
    console.log(`[${i+1}/${DRUGS_TO_FIX.length}] Re-resolving ${drugName}...`);

    const result = await findBestRxcui(drugName);
    await sleep(120);

    if (!result) {
      console.log(`  No match found`);
      continue;
    }

    const { strength, dosageForm } = parseStrengthAndForm(result.name);

    await client.query(
      `UPDATE drug_cache SET rxcui = $1, resolved_name = $2, strength = $3, dosage_form = $4, resolved_at = NOW()
       WHERE input_name = $5`,
      [result.rxcui, result.name, strength, dosageForm, drugName.toLowerCase()]
    );
    fixed++;
    console.log(`  -> ${result.rxcui}: ${result.name}`);
  }

  console.log(`\nFixed ${fixed} entries.`);

  // Show final state
  const rows = await client.query('SELECT input_name, rxcui, resolved_name FROM drug_cache ORDER BY id LIMIT 20');
  for (const r of rows.rows) {
    console.log(`  ${r.input_name}: ${r.rxcui} - ${r.resolved_name.substring(0, 80)}`);
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
