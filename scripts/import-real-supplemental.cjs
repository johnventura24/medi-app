const pg = require('pg');
const fs = require('fs');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }, max: 5
});

function parseTsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split('\t');
    const row = {};
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

// Period codes: 1=per day, 2=per week, 3=per year/annual, 4=per 2 years, 5=per quarter, 6=per half year, 7=per month
function periodToFreq(code) {
  switch(code) {
    case '1': return 'daily';
    case '2': return 'weekly';
    case '3': return 'annually';
    case '5': return 'quarterly';
    case '6': return 'semi-annually';
    case '7': return 'monthly';
    default: return 'see_eoc';
  }
}

async function main() {
  console.log('=== IMPORTING REAL SUPPLEMENTAL BENEFIT AMOUNTS FROM CMS PBP ===\n');

  // 1. OTC amounts from b13 base file
  console.log('1. OTC DOLLAR AMOUNTS');
  const b13 = parseTsv('/tmp/pbp-data/pbp_b13_other_services.txt');
  let otcUpdated = 0;
  for (const r of b13) {
    const contractId = r.pbp_a_hnumber;
    const planId = r.pbp_a_plan_identifier;
    if (!contractId) continue;
    
    const otcAmt = num(r.pbp_b13b_maxplan_amt);
    const otcPer = r.pbp_b13b_otc_maxplan_per;
    
    if (otcAmt && otcAmt > 0) {
      const freq = periodToFreq(otcPer);
      // Normalize to quarterly
      let quarterly = otcAmt;
      if (freq === 'monthly') quarterly = otcAmt * 3;
      else if (freq === 'annually') quarterly = otcAmt / 4;
      else if (freq === 'semi-annually') quarterly = otcAmt / 2;
      
      const result = await pool.query(
        'UPDATE plans SET otc_amount_per_quarter = $1 WHERE contract_id = $2 AND plan_id = $3 AND has_otc = true',
        [Math.round(quarterly * 100) / 100, contractId, planId]
      );
      otcUpdated += result.rowCount || 0;
    }
  }
  console.log(`  ✅ OTC: ${otcUpdated} plans updated with real amounts`);

  // 2. Meal/flex amounts from b13 base file
  console.log('\n2. MEAL BENEFIT AMOUNTS');
  let mealUpdated = 0;
  for (const r of b13) {
    const contractId = r.pbp_a_hnumber;
    const planId = r.pbp_a_plan_identifier;
    if (!contractId) continue;
    
    const mealAmt = num(r.pbp_b13c_maxplan_amt);
    const mealPer = r.pbp_b13c_maxplan_per;
    
    if (mealAmt && mealAmt > 0) {
      const freq = periodToFreq(mealPer);
      const result = await pool.query(
        'UPDATE plans SET meal_benefit_amount = $1 WHERE contract_id = $2 AND plan_id = $3',
        [mealAmt, contractId, planId]
      );
      mealUpdated += result.rowCount || 0;
    }
  }
  console.log(`  ✅ Meals: ${mealUpdated} plans updated with real amounts`);

  // 3. Additional supplemental benefits (b13d, b13e, b13f — transportation, fitness, etc.)
  console.log('\n3. ADDITIONAL SUPPLEMENTAL BENEFITS');
  let suppUpdated = 0;
  for (const r of b13) {
    const contractId = r.pbp_a_hnumber;
    const planId = r.pbp_a_plan_identifier;
    if (!contractId) continue;
    
    // b13d is often transportation
    const transAmt = num(r.pbp_b13d_maxplan_amt);
    // b13e is often flex/grocery  
    const flexAmt = num(r.pbp_b13e_maxplan_amt);
    const flexPer = r.pbp_b13e_maxplan_per;
    
    if (transAmt && transAmt > 0) {
      await pool.query(
        'UPDATE plans SET transportation_amount_per_year = $1 WHERE contract_id = $2 AND plan_id = $3',
        [transAmt, contractId, planId]
      );
      suppUpdated++;
    }
    if (flexAmt && flexAmt > 0) {
      const freq = periodToFreq(flexPer);
      await pool.query(
        'UPDATE plans SET flex_card_amount = $1, flex_card_frequency = $2 WHERE contract_id = $3 AND plan_id = $4',
        [flexAmt, freq, contractId, planId]
      );
      suppUpdated++;
    }
  }
  console.log(`  ✅ Additional: ${suppUpdated} updates`);

  // 4. Part B giveback from Section D
  console.log('\n4. PART B GIVEBACK');
  const sectionD = parseTsv('/tmp/pbp-data/pbp_Section_D.txt');
  let partbUpdated = 0;
  for (const r of sectionD) {
    const contractId = r.pbp_a_hnumber;
    const planId = r.pbp_a_plan_identifier;
    if (!contractId) continue;
    
    const reductAmt = num(r.pbp_d_mco_pay_reduct_amt);
    
    if (reductAmt && reductAmt > 0) {
      const result = await pool.query(
        'UPDATE plans SET partb_giveback = $1 WHERE contract_id = $2 AND plan_id = $3',
        [reductAmt, contractId, planId]
      );
      partbUpdated += result.rowCount || 0;
    }
  }
  console.log(`  ✅ Part B Giveback: ${partbUpdated} plans updated with real amounts`);

  // 5. Also update from VBID file for plans that have enhanced benefits
  console.log('\n5. VBID ENHANCED BENEFITS');
  const vbid = parseTsv('/tmp/pbp-data/pbp_b13_b19b_other_services_vbid_uf.txt');
  let vbidUpdated = 0;
  for (const r of vbid) {
    const contractId = r.pbp_a_hnumber;
    const planId = r.pbp_a_plan_identifier;
    if (!contractId) continue;
    
    const otcAmt = num(r.pbp_b13b_maxplan_amt);
    const otcPer = r.pbp_b13b_otc_maxplan_per;
    
    if (otcAmt && otcAmt > 0) {
      let quarterly = otcAmt;
      const freq = periodToFreq(otcPer);
      if (freq === 'monthly') quarterly = otcAmt * 3;
      else if (freq === 'annually') quarterly = otcAmt / 4;
      
      await pool.query(
        'UPDATE plans SET otc_amount_per_quarter = GREATEST(otc_amount_per_quarter, $1) WHERE contract_id = $2 AND plan_id = $3',
        [Math.round(quarterly * 100) / 100, contractId, planId]
      );
      vbidUpdated++;
    }
  }
  console.log(`  ✅ VBID: ${vbidUpdated} enhanced benefit updates`);

  // Verify
  console.log('\n=== VERIFICATION ===');
  const v = await pool.query(`
    SELECT 
      count(*) filter (where otc_amount_per_quarter > 0) as real_otc,
      count(*) filter (where meal_benefit_amount > 0) as real_meals,
      count(*) filter (where flex_card_amount > 0) as real_flex,
      count(*) filter (where partb_giveback > 0) as real_partb,
      round(avg(otc_amount_per_quarter) filter (where otc_amount_per_quarter > 0)::numeric, 2) as avg_otc,
      round(avg(meal_benefit_amount) filter (where meal_benefit_amount > 0)::numeric, 2) as avg_meal,
      round(avg(partb_giveback) filter (where partb_giveback > 0)::numeric, 2) as avg_partb
    FROM plans
  `);
  console.log(v.rows[0]);

  await pool.end();
}

main().catch(e => { console.error('FATAL:', e); pool.end(); });
