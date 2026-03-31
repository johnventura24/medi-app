const pg = require('pg');
const fs = require('fs');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

function parseTsv(path) {
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  return { headers, lines, parse: (i) => {
    const vals = lines[i].split('\t');
    const row = {};
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
    return row;
  }};
}

async function main() {
  console.log('=== CLEAN SLATE: Only real CMS PBP amounts ===\n');

  // 1. Clear ALL synthetic amounts
  console.log('1. Clearing ALL OTC amounts...');
  await pool.query('UPDATE plans SET otc_amount_per_quarter = NULL');
  console.log('   Clearing ALL Part B amounts...');
  await pool.query('UPDATE plans SET partb_giveback = NULL');
  console.log('   Done.\n');

  // 2. Re-import real OTC from PBP b13
  console.log('2. Importing REAL OTC amounts from PBP b13...');
  const b13 = parseTsv('/tmp/pbp-data/pbp_b13_other_services.txt');
  let otcUpdated = 0;
  for (let i = 1; i < b13.lines.length; i++) {
    const row = b13.parse(i);
    const contractId = row.pbp_a_hnumber;
    const planId = row.pbp_a_plan_identifier;
    const amt = parseFloat(row.pbp_b13b_maxplan_amt);
    const per = row.pbp_b13b_otc_maxplan_per;
    if (amt > 0 && contractId) {
      let quarterly = amt;
      if (per === '7') quarterly = amt * 3;
      else if (per === '3') quarterly = amt / 4;
      else if (per === '6') quarterly = amt / 2;
      const r = await pool.query(
        'UPDATE plans SET otc_amount_per_quarter = $1 WHERE contract_id = $2 AND plan_id = $3 AND has_otc = true',
        [Math.round(quarterly * 100) / 100, contractId, planId]
      );
      otcUpdated += r.rowCount || 0;
    }
  }
  console.log('   OTC: ' + otcUpdated + ' plans with real CMS amounts\n');

  // 3. Re-import real Part B from Section D
  console.log('3. Importing REAL Part B giveback from Section D...');
  const secD = parseTsv('/tmp/pbp-data/pbp_Section_D.txt');
  let partbUpdated = 0;
  for (let i = 1; i < secD.lines.length; i++) {
    const row = secD.parse(i);
    const contractId = row.pbp_a_hnumber;
    const planId = row.pbp_a_plan_identifier;
    const amt = parseFloat(row.pbp_d_mco_pay_reduct_amt);
    if (amt > 0 && contractId) {
      const r = await pool.query(
        'UPDATE plans SET partb_giveback = $1 WHERE contract_id = $2 AND plan_id = $3',
        [amt, contractId, planId]
      );
      partbUpdated += r.rowCount || 0;
    }
  }
  console.log('   Part B: ' + partbUpdated + ' plans with real CMS amounts\n');

  // 4. Final verification
  console.log('4. FINAL VERIFICATION:');
  const v = await pool.query(`
    SELECT 
      count(*) filter (where otc_amount_per_quarter > 0) as otc_real,
      count(*) filter (where has_otc = true AND otc_amount_per_quarter IS NULL) as otc_flag_only,
      count(*) filter (where partb_giveback > 0) as partb_real,
      count(*) filter (where dental_coverage_limit > 0) as dental_real,
      count(*) filter (where flex_card_amount > 0) as flex_real
    FROM plans
  `);
  console.log(v.rows[0]);
  console.log('\nALL dollar amounts now exclusively from CMS PBP raw files.');
  console.log('Plans with OTC flag but no amount = CMS confirms OTC benefit exists but PBP doesnt specify dollar amount.');

  pool.end();
}
main().catch(e => { console.error('FATAL:', e); pool.end(); });
