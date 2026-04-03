const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

function extractCarrier(planName) {
  if (!planName) return null;
  const n = planName.toLowerCase();
  if (n.includes('humana')) return 'Humana';
  if (n.includes('aarp') || n.includes('uhc') || n.includes('unitedhealthcare')) return 'UnitedHealthcare';
  if (n.includes('aetna')) return 'Aetna';
  if (n.includes('cigna') || n.includes('healthspring')) return 'Cigna';
  if (n.includes('anthem') || n.includes('mediblue')) return 'Anthem';
  if (n.includes('blue cross') || n.includes('bcbs') || n.includes('blue advantage') || n.includes('blue choice') || n.includes('blue medicare')) return 'Blue Cross Blue Shield';
  if (n.includes('wellcare')) return 'Wellcare';
  if (n.includes('centene') || n.includes('ambetter')) return 'Centene';
  if (n.includes('molina')) return 'Molina';
  if (n.includes('kaiser')) return 'Kaiser';
  if (n.includes('devoted')) return 'Devoted Health';
  if (n.includes('silverscript')) return 'CVS/SilverScript';
  if (n.includes('ucare')) return 'UCare';
  if (n.includes('true blue')) return 'BCBS';
  if (n.includes('priority health')) return 'Priority Health';
  if (n.includes('simpra')) return 'Simpra';
  return null;
}

async function main() {
  const rows = await pool.query('SELECT id, previous_plan_name, current_plan_name FROM plan_crosswalk');
  let updated = 0;
  for (const r of rows.rows) {
    const pc = extractCarrier(r.previous_plan_name);
    const cc = extractCarrier(r.current_plan_name);
    if (pc || cc) {
      await pool.query(
        'UPDATE plan_crosswalk SET previous_carrier = COALESCE($1, previous_carrier), current_carrier = COALESCE($2, current_carrier) WHERE id = $3',
        [pc, cc, r.id]
      );
      updated++;
    }
  }
  console.log('Carriers extracted:', updated, '/', rows.rows.length);
  
  const v = await pool.query(`
    SELECT previous_carrier, count(*) as cnt, sum(previous_enrollment) as enrollment
    FROM plan_crosswalk WHERE previous_carrier IS NOT NULL AND status = 'Terminated/Non-renewed Contract'
    GROUP BY previous_carrier ORDER BY enrollment DESC NULLS LAST
  `);
  console.log('\nTerminated plans by carrier:');
  v.rows.forEach(r => console.log('  ' + r.previous_carrier + ': ' + r.cnt + ' plans, ' + (parseInt(r.enrollment || 0).toLocaleString()) + ' members'));
  
  pool.end();
}
main().catch(e => { console.error(e); pool.end(); });
