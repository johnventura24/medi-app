const pg = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }, max: 5
});

async function main() {
  console.log('=== IMPORTING REAL CMS PY2026 QHP DATA ===\n');

  // Clear generated data
  await pool.query('DELETE FROM aca_plans');
  console.log('Cleared old generated data');

  // 1. Parse plan attributes (medical only)
  console.log('\n1. Parsing plan attributes...');
  const planCsv = fs.readFileSync('/tmp/aca-data/plan-attributes-puf.csv', 'utf-8');
  const allPlans = parse(planCsv, { columns: true, skip_empty_lines: true, bom: true });
  const medicalPlans = allPlans.filter(r => r.DentalOnlyPlan !== 'Yes' && r.MarketCoverage === 'Individual');
  console.log(`  ${medicalPlans.length} medical individual market plans`);

  // Build plan lookup
  const planMap = {};
  for (const p of medicalPlans) {
    const key = p.StandardComponentId || p.PlanId;
    planMap[key] = {
      planId: key,
      planName: p.PlanMarketingName || '',
      issuerName: p.IssuerMarketPlaceMarketingName || '',
      metalLevel: p.MetalLevel || '',
      planType: p.PlanType || '',
      state: p.StateCode || '',
      ehbPct: parseFloat(p.EHBPercentTotalPremium) || null,
      deductibleIndividual: parseDollar(p.MEHBDedInnTier1Individual || p.TEHBDedInnTier1Individual),
      deductibleFamily: parseDollar(p.MEHBDedInnTier1FamilyPerGroup || p.TEHBDedInnTier1FamilyPerGroup),
      moopIndividual: parseDollar(p.MEHBInnTier1IndividualMOOP || p.TEHBInnTier1IndividualMOOP),
      moopFamily: parseDollar(p.MEHBInnTier1FamilyPerGroupMOOP || p.TEHBInnTier1FamilyPerGroupMOOP),
      hsaEligible: p.IsHSAEligible === 'Yes',
      childOnly: p.ChildOnlyOffering === 'Allows Child-Only',
    };
  }
  console.log(`  Built lookup for ${Object.keys(planMap).length} plans`);

  // 2. Parse rates (get age 27, 40, 60 premiums)
  console.log('\n2. Parsing rate file (2.2M rows — this takes a minute)...');
  const rateCsv = fs.readFileSync('/tmp/aca-data/rate-puf.csv', 'utf-8');
  const rates = parse(rateCsv, { columns: true, skip_empty_lines: true, bom: true });
  console.log(`  ${rates.length} rate rows parsed`);

  // Build rate lookup: planId → { age27, age40, age60 }
  const rateMap = {};
  for (const r of rates) {
    const planId = (r.PlanId || '').substring(0, 14); // Standard component ID
    if (!planMap[planId]) continue;
    const age = r.Age;
    const rate = parseFloat(r.IndividualRate) || 0;
    if (!rateMap[planId]) rateMap[planId] = {};
    if (age === '27') rateMap[planId].age27 = rate;
    if (age === '40') rateMap[planId].age40 = rate;
    if (age === '60') rateMap[planId].age60 = rate;
  }
  console.log(`  Rates found for ${Object.keys(rateMap).length} plans`);

  // 3. Insert into database
  console.log('\n3. Inserting into aca_plans...');
  let inserted = 0;
  const batch = [];

  for (const [planId, plan] of Object.entries(planMap)) {
    const rates = rateMap[planId] || {};
    if (!rates.age40 && !rates.age27) continue; // Skip plans without rate data

    batch.push([
      plan.planId, plan.planName, plan.issuerName, plan.metalLevel,
      plan.planType, plan.state, null, null, // county/fips filled later
      rates.age27 || null, rates.age40 || null, rates.age60 || null,
      plan.deductibleIndividual, plan.deductibleFamily,
      plan.moopIndividual, plan.moopFamily,
      plan.ehbPct, plan.hsaEligible, plan.childOnly, 2026
    ]);

    if (batch.length >= 200) {
      await insertBatch(batch);
      inserted += batch.length;
      batch.length = 0;
      if (inserted % 2000 === 0) process.stdout.write(`\r  ${inserted} plans inserted`);
    }
  }
  if (batch.length > 0) {
    await insertBatch(batch);
    inserted += batch.length;
  }

  console.log(`\n  ✅ ${inserted} real QHP plans inserted`);

  // 4. Verify
  const verify = await pool.query(`
    SELECT count(*) as total, count(distinct state) as states, count(distinct issuer_name) as issuers,
    count(distinct metal_level) as metals, round(avg(premium_age_40)::numeric,2) as avg_prem
    FROM aca_plans
  `);
  console.log('\nVerification:', verify.rows[0]);

  await pool.end();
}

async function insertBatch(batch) {
  const values = batch.map((_, i) => {
    const offset = i * 19;
    return `(${Array.from({length:19}, (_, j) => '$' + (offset + j + 1)).join(',')})`;
  }).join(',');

  const flat = batch.flat();
  await pool.query(`INSERT INTO aca_plans 
    (plan_id, plan_name, issuer_name, metal_level, plan_type, state, county, fips,
     premium_age_27, premium_age_40, premium_age_60, deductible_individual, deductible_family,
     moop_individual, moop_family, ehb_pct, hsa_eligible, child_only, plan_year)
    VALUES ${values}`, flat);
}

function parseDollar(v) {
  if (!v || v === 'Not Applicable' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

main().catch(e => { console.error('FATAL:', e); pool.end(); });
