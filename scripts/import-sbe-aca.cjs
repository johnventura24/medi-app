const pg = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }, max: 5
});

const SBE_DIR = '/tmp/sbe-data';

const STATE_MAP = {
  california:'CA', colorado:'CO', connecticut:'CT', districtofcolumbia:'DC',
  idaho:'ID', kentucky:'KY', maine:'ME', maryland:'MD', massachusetts:'MA',
  minnesota:'MN', nevada:'NV', newjersey:'NJ', newmexico:'NM', newyork:'NY',
  oregon:'OR', pennsylvania:'PA', rhodeisland:'RI', vermont:'VT', virginia:'VA', washington:'WA'
};

function parseDollar(v) {
  if (!v || v === 'Not Applicable') return null;
  return parseFloat(String(v).replace(/[$,"]/g, '')) || null;
}

async function importState(stateName) {
  const stateCode = STATE_MAP[stateName];
  const stateDir = path.join(SBE_DIR, stateName);
  
  // Find plans and rates files
  const files = fs.readdirSync(stateDir);
  const plansFile = files.find(f => f.includes('Plans') && f.endsWith('.csv'));
  const ratesFile = files.find(f => f.includes('Rates') && f.endsWith('.csv'));
  
  if (!plansFile) { console.log(`  ⚠ No plans file for ${stateName}`); return 0; }
  
  // Parse plans
  const plansCsv = fs.readFileSync(path.join(stateDir, plansFile), 'utf-8');
  const plans = parse(plansCsv, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
  
  // Filter medical individual market only
  const medical = plans.filter(p => 
    p['DENTAL ONLY PLAN'] !== 'Yes' && 
    (p['MARKET COVERAGE'] === 'Individual' || !p['MARKET COVERAGE'])
  );
  
  // Build plan lookup
  const planMap = {};
  for (const p of medical) {
    const id = p['STANDARD COMPONENT ID'] || p['PLAN ID'];
    if (!id) continue;
    planMap[id] = {
      planId: id,
      planName: p['PLAN MARKETING NAME'] || '',
      issuerName: p['ISSUER NAME'] || '',
      metalLevel: p['METAL LEVEL'] || p['METAL LEVEL TYPE'] || '',
      planType: p['PLAN TYPE'] || '',
      state: stateCode,
    };
  }
  
  // Parse rates if available
  const rateMap = {};
  if (ratesFile) {
    const ratesCsv = fs.readFileSync(path.join(stateDir, ratesFile), 'utf-8');
    const rates = parse(ratesCsv, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
    for (const r of rates) {
      const planId = (r['PLAN ID'] || '').substring(0, 14);
      if (!planMap[planId]) continue;
      const age = r['AGE'] || r.AGE;
      const rate = parseFloat(r['INDIVIDUAL RATE']) || 0;
      if (!rateMap[planId]) rateMap[planId] = {};
      if (age === '27') rateMap[planId].age27 = rate;
      if (age === '40') rateMap[planId].age40 = rate;
      if (age === '60') rateMap[planId].age60 = rate;
    }
  }
  
  // Insert
  let inserted = 0;
  const batch = [];
  for (const [planId, plan] of Object.entries(planMap)) {
    const rates = rateMap[planId] || {};
    if (!rates.age40 && !rates.age27 && !plan.planName) continue;
    
    batch.push([
      plan.planId, plan.planName, plan.issuerName, plan.metalLevel,
      plan.planType, plan.state, null, null,
      rates.age27 || null, rates.age40 || null, rates.age60 || null,
      null, null, null, null, null, false, false, 2025
    ]);
    
    if (batch.length >= 200) {
      await insertBatch(batch);
      inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    await insertBatch(batch);
    inserted += batch.length;
  }
  
  return inserted;
}

async function insertBatch(batch) {
  const values = batch.map((_, i) => {
    const o = i * 19;
    return `(${Array.from({length:19}, (_, j) => '$' + (o+j+1)).join(',')})`;
  }).join(',');
  await pool.query(`INSERT INTO aca_plans 
    (plan_id, plan_name, issuer_name, metal_level, plan_type, state, county, fips,
     premium_age_27, premium_age_40, premium_age_60, deductible_individual, deductible_family,
     moop_individual, moop_family, ehb_pct, hsa_eligible, child_only, plan_year)
    VALUES ${values}`, batch.flat());
}

async function main() {
  console.log('=== IMPORTING SBE STATE ACA DATA ===\n');
  
  const dirs = fs.readdirSync(SBE_DIR).filter(d => 
    fs.statSync(path.join(SBE_DIR, d)).isDirectory() && STATE_MAP[d]
  );
  
  let total = 0;
  for (const dir of dirs.sort()) {
    const count = await importState(dir);
    console.log(`  ${STATE_MAP[dir]}: ${count} plans imported`);
    total += count;
  }
  
  console.log(`\n✅ Total SBE plans imported: ${total}`);
  
  // Verify
  const v = await pool.query('SELECT count(*) as total, count(distinct state) as states FROM aca_plans');
  console.log('Database now has:', v.rows[0]);
  
  await pool.end();
}

main().catch(e => { console.error('FATAL:', e); pool.end(); });
