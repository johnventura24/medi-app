/**
 * Fast import of QHP PY2026 data using xlsx raw+dense mode.
 * Source: https://data.healthcare.gov/dataset/6fe7fb77-7291-4104-952f-7c7e2c5d0c45
 */

const XLSX = require("xlsx");
const { Pool } = require("pg");

const DATABASE_URL = "postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres";
const XLSX_PATH = "/tmp/qhp_2026/individual_market_medical.xlsx";

function parseDollar(val) {
  if (val === null || val === undefined || val === "" || val === "N/A" || val === "Not Applicable") return null;
  const s = String(val).replace(/[$,\s"]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parsePercent(val) {
  if (!val) return null;
  const s = String(val).replace(/[%"]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n / 100;
}

async function main() {
  console.time("total");
  console.log("Reading QHP PY2026 XLSX (raw+dense mode)...");
  console.time("read");
  const wb = XLSX.readFile(XLSX_PATH, {
    raw: true,
    dense: true,
    cellStyles: false,
    cellHTML: false,
    cellFormula: false,
    cellDates: false,
    cellNF: false,
    sheetStubs: false,
  });
  console.timeEnd("read");

  const ws = wb.Sheets[wb.SheetNames[0]];
  console.log("Converting to array...");
  console.time("convert");
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.timeEnd("convert");
  console.log(`Got ${rawData.length} rows`);

  // Row 0 = metadata, Row 1 = headers
  const headers = rawData[1];

  // Build column map
  const colMap = {};
  headers.forEach((h, i) => {
    if (h) colMap[String(h).trim()] = i;
  });

  const COL = {
    state: colMap["State Code"],
    fips: colMap["FIPS County Code"],
    county: colMap["County Name"],
    metal: colMap["Metal Level"],
    issuer: colMap["Issuer Name"],
    planId: colMap["Plan ID (Standard Component)"],
    planName: colMap["Plan Marketing Name"],
    planType: colMap["Plan Type"],
    childOnly: colMap["Child Only Offering"],
    ehbPct: colMap["EHB Percent of Total Premium"],
  };

  // Find premium/cost columns
  for (const [key, idx] of Object.entries(colMap)) {
    if (key.includes("Premium Adult Individual Age 27") && !key.includes("Couple") && !key.includes("child")) COL.premAge27 = idx;
    if (key.includes("Premium Adult Individual Age 40") && !key.includes("Couple") && !key.includes("child")) COL.premAge40 = idx;
    if (key.includes("Premium Adult Individual Age 60") && !key.includes("Couple")) COL.premAge60 = idx;
    if (key === "Medical Deductible - Individual - Standard") COL.dedIndStd = idx;
    if (key === "Medical Deductible - Family - Standard") COL.dedFamStd = idx;
    if (key === "Medical Maximum Out Of Pocket - Individual - Standard") COL.moopIndStd = idx;
    if (key === "Medical Maximum Out Of Pocket - Family - Standard") COL.moopFamStd = idx;
  }

  console.log("Columns:", JSON.stringify(COL));

  // Parse rows
  console.time("parse");
  const plans = [];
  for (let i = 2; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !row[COL.state]) continue;

    const state = String(row[COL.state]).trim();
    if (state.length !== 2) continue;

    const metal = String(row[COL.metal] || "").trim();
    if (!metal) continue;

    const planId = String(row[COL.planId] || "").trim();
    if (!planId) continue;

    const childOnlyRaw = String(row[COL.childOnly] || "");
    const isChildOnly = childOnlyRaw.toLowerCase().includes("child only");

    plans.push([
      planId,
      String(row[COL.planName] || "").trim(),
      String(row[COL.issuer] || "").trim(),
      metal,
      String(row[COL.planType] || "").trim() || null,
      state,
      String(row[COL.county] || "").trim() || null,
      String(row[COL.fips] || "").trim() || null,
      parseDollar(row[COL.premAge27]),
      parseDollar(row[COL.premAge40]),
      parseDollar(row[COL.premAge60]),
      parseDollar(row[COL.dedIndStd]),
      parseDollar(row[COL.dedFamStd]),
      parseDollar(row[COL.moopIndStd]),
      parseDollar(row[COL.moopFamStd]),
      parsePercent(row[COL.ehbPct]),
      false,
      isChildOnly,
      2026,
    ]);
  }
  console.timeEnd("parse");
  console.log(`Parsed ${plans.length} plans`);

  // Stats
  const metalCounts = {};
  const stateCounts = {};
  for (const p of plans) {
    metalCounts[p[3]] = (metalCounts[p[3]] || 0) + 1;
    stateCounts[p[5]] = (stateCounts[p[5]] || 0) + 1;
  }
  console.log("States:", Object.keys(stateCounts).length);
  console.log("Metal:", JSON.stringify(metalCounts));

  // Database insert
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Clearing existing aca_plans...");
    await pool.query("DELETE FROM aca_plans");

    const BATCH = 500;
    let inserted = 0;
    console.time("insert");

    for (let b = 0; b < plans.length; b += BATCH) {
      const batch = plans.slice(b, b + BATCH);
      const values = [];
      const params = [];
      let pi = 1;

      for (const row of batch) {
        const ph = [];
        for (const val of row) {
          ph.push(`$${pi++}`);
          params.push(val);
        }
        values.push(`(${ph.join(",")})`);
      }

      await pool.query(`INSERT INTO aca_plans (
        plan_id, plan_name, issuer_name, metal_level, plan_type,
        state, county, fips,
        premium_age_27, premium_age_40, premium_age_60,
        deductible_individual, deductible_family,
        moop_individual, moop_family,
        ehb_pct, hsa_eligible, child_only, plan_year
      ) VALUES ${values.join(",")}`, params);

      inserted += batch.length;
      if (inserted % 10000 === 0 || inserted === plans.length) {
        console.log(`Inserted ${inserted} / ${plans.length}...`);
      }
    }
    console.timeEnd("insert");
    console.log(`\nImported ${inserted} real QHP PY2026 plans.`);

    const res = await pool.query("SELECT COUNT(*) as cnt, COUNT(DISTINCT state) as states, COUNT(DISTINCT issuer_name) as issuers FROM aca_plans");
    console.log(`DB: ${res.rows[0].cnt} plans, ${res.rows[0].states} states, ${res.rows[0].issuers} issuers`);
  } finally {
    await pool.end();
  }
  console.timeEnd("total");
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
