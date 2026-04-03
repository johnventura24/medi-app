const pg = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== ENRICHING CROSSWALK WITH CY2025 ENROLLMENT DATA ===\n');

  // 1. Parse CY2025 enrollment
  console.log('1. Parsing CY2025 enrollment data (176MB)...');
  const csv = fs.readFileSync('/tmp/cy2025/CPSC_Enrollment_2025_01/CPSC_Enrollment_Info_2025_01.csv', 'utf-8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
  console.log('   Rows:', rows.length);

  // Build enrollment lookup: contractId-planId → total enrollment
  const enrollMap = {};
  const carrierMap = {};
  for (const r of rows) {
    const contractId = (r['Contract Number'] || '').trim();
    const planId = (r['Plan ID'] || '').trim().padStart(3, '0');
    const enrollment = parseInt((r['Enrollment'] || '0').replace(/[^0-9]/g, '')) || 0;
    const state = (r['State'] || '').trim();
    const key = contractId + '-' + planId;
    
    if (!enrollMap[key]) enrollMap[key] = { total: 0, states: new Set(), counties: 0 };
    enrollMap[key].total += enrollment;
    if (state) enrollMap[key].states.add(state);
    enrollMap[key].counties++;
  }
  console.log('   Unique plans:', Object.keys(enrollMap).length);

  // 2. Also parse contract info for carrier names
  const contractCsv = fs.readFileSync('/tmp/cy2025/CPSC_Enrollment_2025_01/CPSC_Contract_Info_2025_01.csv', 'utf-8');
  const contracts = parse(contractCsv, { columns: true, skip_empty_lines: true, bom: true });
  for (const c of contracts) {
    const contractId = (c['Contract Number'] || '').trim();
    const orgName = (c['Organization Name'] || c['Plan Name'] || '').trim();
    if (contractId && orgName) carrierMap[contractId] = orgName;
  }
  console.log('   Carriers:', Object.keys(carrierMap).length);

  // 3. Add columns to crosswalk table
  await pool.query(`
    ALTER TABLE plan_crosswalk ADD COLUMN IF NOT EXISTS previous_enrollment INTEGER;
    ALTER TABLE plan_crosswalk ADD COLUMN IF NOT EXISTS previous_carrier TEXT;
    ALTER TABLE plan_crosswalk ADD COLUMN IF NOT EXISTS previous_states TEXT;
    ALTER TABLE plan_crosswalk ADD COLUMN IF NOT EXISTS previous_counties INTEGER;
    ALTER TABLE plan_crosswalk ADD COLUMN IF NOT EXISTS current_carrier TEXT;
  `);
  console.log('   Columns added.\n');

  // 4. Update crosswalk with enrollment + carrier data
  console.log('2. Updating crosswalk records...');
  const cwRows = await pool.query('SELECT id, previous_contract_id, previous_plan_id, current_contract_id FROM plan_crosswalk');
  
  let updated = 0;
  for (const cw of cwRows.rows) {
    const prevKey = cw.previous_contract_id + '-' + cw.previous_plan_id;
    const prevData = enrollMap[prevKey];
    const prevCarrier = carrierMap[cw.previous_contract_id];
    const currCarrier = carrierMap[cw.current_contract_id];

    if (prevData || prevCarrier || currCarrier) {
      await pool.query(
        `UPDATE plan_crosswalk SET 
          previous_enrollment = $1, 
          previous_carrier = $2, 
          previous_states = $3, 
          previous_counties = $4,
          current_carrier = $5
        WHERE id = $6`,
        [
          prevData?.total || null,
          prevCarrier || null,
          prevData ? Array.from(prevData.states).join(',') : null,
          prevData?.counties || null,
          currCarrier || null,
          cw.id
        ]
      );
      updated++;
    }
  }
  console.log('   Updated:', updated, 'of', cwRows.rows.length, 'records\n');

  // 5. Verify
  console.log('3. VERIFICATION:');
  const terminated = await pool.query(`
    SELECT previous_contract_id, previous_plan_id, previous_plan_name, 
           previous_carrier, previous_enrollment, previous_states, previous_counties
    FROM plan_crosswalk 
    WHERE status = 'Terminated/Non-renewed Contract' AND previous_enrollment > 0
    ORDER BY previous_enrollment DESC
    LIMIT 10
  `);
  console.log('   Top 10 terminated plans by enrollment:');
  terminated.rows.forEach(r => {
    console.log('   ' + r.previous_contract_id + '-' + r.previous_plan_id + 
      ' | ' + (r.previous_carrier || 'Unknown') +
      ' | ' + r.previous_plan_name?.substring(0, 40) + 
      ' | ' + r.previous_enrollment?.toLocaleString() + ' members' +
      ' | ' + (r.previous_states || '') +
      ' | ' + (r.previous_counties || 0) + ' counties');
  });

  const stats = await pool.query(`
    SELECT status,
      count(*) as plans,
      sum(previous_enrollment) as total_enrollment,
      count(*) filter (where previous_enrollment > 0) as with_enrollment,
      count(*) filter (where previous_carrier is not null) as with_carrier
    FROM plan_crosswalk
    GROUP BY status
    ORDER BY total_enrollment DESC NULLS LAST
  `);
  console.log('\n   Summary by status:');
  stats.rows.forEach(r => {
    console.log('   ' + r.status + ': ' + r.plans + ' plans, ' + 
      (r.total_enrollment ? parseInt(r.total_enrollment).toLocaleString() : '0') + ' members, ' +
      r.with_enrollment + ' with enrollment, ' + r.with_carrier + ' with carrier');
  });

  pool.end();
}
main().catch(e => { console.error('FATAL:', e); pool.end(); });
