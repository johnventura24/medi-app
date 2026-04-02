/**
 * Import CMS Plan Crosswalk 2026 data from tab-delimited file into PostgreSQL
 *
 * Usage: DATABASE_URL=<url> node scripts/import-crosswalk.cjs
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

const FILE_PATH =
  process.argv[2] || "/tmp/crosswalk/PlanCrosswalk2026_10012025.txt";

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Creating plan_crosswalk table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_crosswalk (
      id SERIAL PRIMARY KEY,
      previous_contract_id TEXT,
      previous_plan_id TEXT,
      previous_plan_name TEXT,
      previous_snp_type TEXT,
      current_contract_id TEXT,
      current_plan_id TEXT,
      current_plan_name TEXT,
      current_snp_type TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cw_status ON plan_crosswalk(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cw_prev ON plan_crosswalk(previous_contract_id, previous_plan_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cw_curr ON plan_crosswalk(current_contract_id, current_plan_id);`);

  // Clear existing data
  const existing = await pool.query("SELECT count(*) FROM plan_crosswalk");
  if (Number(existing.rows[0].count) > 0) {
    console.log(`Clearing ${existing.rows[0].count} existing rows...`);
    await pool.query("TRUNCATE plan_crosswalk RESTART IDENTITY");
  }

  console.log(`Reading file: ${FILE_PATH}`);
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  // Skip header
  const header = lines[0].split("\t");
  console.log(`Header columns: ${header.join(", ")}`);
  const dataLines = lines.slice(1);
  console.log(`Data rows: ${dataLines.length}`);

  // Batch insert
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    const batch = dataLines.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const line of batch) {
      const cols = line.split("\t");
      // Columns: PREVIOUS_CONTRACT_ID, PREVIOUS_PLAN_ID, PREVIOUS_PLAN_NAME, PREVIOUS_SNP_TYPE, PREVIOUS_SNP_INSTITUTIONAL,
      //          CURRENT_CONTRACT_ID, CURRENT_PLAN_ID, CURRENT_PLAN_NAME, CURRENT_SNP_TYPE, CURRENT_SNP_INSTITUTIONAL, STATUS
      const prevContractId = (cols[0] || "").trim();
      const prevPlanId = (cols[1] || "").trim();
      const prevPlanName = (cols[2] || "").trim();
      const prevSnpType = (cols[3] || "").trim();
      // Skip PREVIOUS_SNP_INSTITUTIONAL (cols[4])
      const currContractId = (cols[5] || "").trim();
      const currPlanId = (cols[6] || "").trim();
      const currPlanName = (cols[7] || "").trim();
      const currSnpType = (cols[8] || "").trim();
      // Skip CURRENT_SNP_INSTITUTIONAL (cols[9])
      const status = (cols[10] || "").trim();

      if (!status) continue;

      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8})`
      );
      params.push(
        prevContractId || null,
        prevPlanId || null,
        prevPlanName || null,
        prevSnpType || null,
        currContractId || null,
        currPlanId || null,
        currPlanName || null,
        currSnpType || null,
        status
      );
      paramIdx += 9;
    }

    if (values.length === 0) continue;

    const sql = `
      INSERT INTO plan_crosswalk
        (previous_contract_id, previous_plan_id, previous_plan_name, previous_snp_type,
         current_contract_id, current_plan_id, current_plan_name, current_snp_type, status)
      VALUES ${values.join(", ")}
    `;

    await pool.query(sql, params);
    inserted += values.length;
    process.stdout.write(`\rInserted: ${inserted}/${dataLines.length}`);
  }

  console.log(`\nDone! Inserted ${inserted} rows.`);

  // Verify counts by status
  const counts = await pool.query(
    "SELECT status, count(*) as cnt FROM plan_crosswalk GROUP BY status ORDER BY cnt DESC"
  );
  console.log("\nStatus counts:");
  for (const row of counts.rows) {
    console.log(`  ${row.status}: ${row.cnt}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
