import "dotenv/config";
import { readdirSync, statSync } from "fs";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import path from "path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { plans, type InsertPlan } from "../shared/schema";
import { sql } from "drizzle-orm";

const NDJSON_DIR = process.argv[2] || "C:/Users/Alan Leiva/Downloads/ndjson-data";
const BATCH_SIZE = 500;

function findNdjsonFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findNdjsonFiles(fullPath));
    } else if (entry.endsWith(".ndjson")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Create a .env file first.");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  const db = drizzle(pool);

  console.log("Connected to database.");
  console.log(`Reading NDJSON files from: ${NDJSON_DIR} (recursive)`);

  const files = findNdjsonFiles(NDJSON_DIR);
  console.log(`Found ${files.length} NDJSON files.`);

  // Clear existing data
  console.log("Clearing existing plan data...");
  await db.delete(plans);
  console.log("Done.");

  let totalInserted = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const filePath = files[fileIdx];
    const file = path.basename(filePath);

    const rl = createInterface({
      input: createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    let batch: InsertPlan[] = [];
    let lineNum = 0;

    for await (const line of rl) {
      lineNum++;
      try {
        const obj = JSON.parse(line);
        const record = parseNdjsonRecord(obj);
        if (record) {
          batch.push(record);
        } else {
          totalSkipped++;
        }

        if (batch.length >= BATCH_SIZE) {
          await db.insert(plans).values(batch);
          totalInserted += batch.length;
          batch = [];
        }
      } catch (err: any) {
        console.error(`  Error parsing line ${lineNum} in ${file}: ${err.message}`);
        totalSkipped++;
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      await db.insert(plans).values(batch);
      totalInserted += batch.length;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = Math.round(((fileIdx + 1) / files.length) * 100);
    console.log(
      `[${pct}%] File ${fileIdx + 1}/${files.length}: ${file} — ` +
      `${lineNum} lines, ${totalInserted} total inserted (${elapsed}s)`
    );
  }

  console.log("\n=== Import Complete ===");
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Reset the sequence so IDs are correct
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('plans', 'id'), (SELECT MAX(id) FROM plans))`);

  await pool.end();
  console.log("Done!");
}

function parseNdjsonRecord(obj: any): InsertPlan | null {
  if (!obj.state || !obj.county) return null;

  const pc = obj.plan_card || {};
  const ma = pc.ma_benefits || [];
  const asb = pc.additional_supplemental_benefits || {};
  const otherBenefits = asb.other_benefits || [];

  // Extract dental coverage limit from ma_benefits
  let dentalLimit: number | null = null;
  for (const b of ma) {
    if (b.category === "BENEFIT_PREVENTIVE_DENTAL") {
      for (const lim of b.plan_limits_details || []) {
        if (lim.limit_type === "BENEFIT_LIMIT_TYPE_COVERAGE" && lim.limit_value) {
          const val = Number(lim.limit_value);
          if (!dentalLimit || val > dentalLimit) dentalLimit = val;
        }
      }
    }
  }

  // Extract vision allowance
  let visionAllowance: number | null = null;
  for (const b of ma) {
    if (b.category === "BENEFIT_VISION") {
      for (const lim of b.plan_limits_details || []) {
        if (
          (lim.limit_type === "BENEFIT_LIMIT_TYPE_COMBINED_COVERAGE" ||
           lim.limit_type === "BENEFIT_LIMIT_TYPE_COVERAGE") &&
          lim.limit_value
        ) {
          const val = Number(lim.limit_value);
          if (!visionAllowance || val > visionAllowance) visionAllowance = val;
        }
      }
    }
  }

  // Extract hearing copay
  let hearingMin: number | null = null;
  let hearingMax: number | null = null;
  for (const b of ma) {
    if (b.category === "HEARING_AIDS") {
      for (const cs of b.cost_sharing || []) {
        if (cs.network_status === "IN_NETWORK" || cs.network_status === "NO_NETWORK") {
          if (cs.min_copay != null) hearingMin = cs.min_copay;
          if (cs.max_copay != null) hearingMax = cs.max_copay;
        }
      }
    }
  }

  // Extract emergency copay
  let emergencyCopay: number | null = null;
  let urgentCareCopay: number | null = null;
  for (const b of ma) {
    if (b.category === "BENEFIT_EMERGENCY_CARE") {
      const service = b.service || "";
      for (const cs of b.cost_sharing || []) {
        if (cs.min_copay != null) {
          if (service === "SERVICE_EMERGENCY") emergencyCopay = cs.min_copay;
          if (service === "SERVICE_URGENT_CARE") urgentCareCopay = cs.min_copay;
        }
      }
    }
  }

  // Extract inpatient copay
  let inpatientCopay: number | null = null;
  for (const b of ma) {
    if (b.category === "BENEFIT_INPATIENT_HOSPITAL") {
      const tiered = b.tiered_cost_sharing || {};
      const tiers = tiered.no_network || tiered.in_network || [];
      if (tiers.length > 0) {
        inpatientCopay = tiers[0].copay ?? null;
      }
      for (const cs of b.cost_sharing || []) {
        if (cs.min_copay != null) inpatientCopay = cs.min_copay;
      }
    }
  }

  // Extract outpatient copay
  let outpatientMin: number | null = null;
  let outpatientMax: number | null = null;
  for (const b of ma) {
    if (b.category === "BENEFIT_OUTPATIENT_HOSPITAL") {
      for (const cs of b.cost_sharing || []) {
        if (cs.network_status === "IN_NETWORK") {
          outpatientMin = cs.min_copay ?? null;
          outpatientMax = cs.max_copay ?? null;
        }
      }
    }
  }

  // Check supplemental benefits
  let hasMeal = false;
  let hasFitness = false;
  for (const group of otherBenefits) {
    const cat = group.category || "";
    for (const b of group.benefits || []) {
      if (b.coverage === "SB_COVERAGE_SOME_COVERAGE") {
        if (cat === "SB_CAT_MEAL_BENEFIT") hasMeal = true;
        if (cat === "SB_CAT_DEFINED_SUPPLEMENTAL_BENEFITS" && b.benefit === "SB_FITNESS_BENEFIT") hasFitness = true;
      }
    }
  }

  // Star rating
  let starRating: number | null = null;
  const osr = pc.overall_star_rating;
  if (osr && typeof osr === "object" && osr.rating && osr.rating > 0) {
    starRating = osr.rating;
  }

  const pcpCs = obj.primary_doctor_cost_sharing || {};
  const specCs = obj.specialist_doctor_cost_sharing || {};

  return {
    externalId: obj.id || null,
    name: obj.name || "Unknown",
    contractYear: obj.contract_year || null,
    contractId: obj.contract_id || null,
    planId: obj.plan_id || null,
    segmentId: obj.segment_id || null,
    planType: obj.plan_type || null,
    category: obj.category || null,
    organizationName: obj.organization_name || "Unknown",
    state: obj.state,
    county: obj.county,
    fips: obj.fips || null,
    city: pc.city || null,
    zipcode: pc.zipcode || null,
    annualDeductible: obj.annual_deductible || null,
    maximumOopc: obj.maximum_oopc || null,
    calculatedMonthlyPremium: obj.calculated_monthly_premium ?? 0,
    partcPremium: obj.partc_premium ?? 0,
    partdPremium: obj.partd_premium ?? 0,
    pcpCopayMin: pcpCs.min_copay ?? null,
    pcpCopayMax: pcpCs.max_copay ?? null,
    specialistCopayMin: specCs.min_copay ?? null,
    specialistCopayMax: specCs.max_copay ?? null,
    emergencyCopay,
    urgentCareCopay,
    inpatientCopay,
    outpatientCopayMin: outpatientMin,
    outpatientCopayMax: outpatientMax,
    dentalCoverageLimit: dentalLimit,
    visionAllowance,
    hearingCopayMin: hearingMin,
    hearingCopayMax: hearingMax,
    hasOtc: obj.otc_drugs === true,
    hasTransportation: obj.transportation === true,
    hasMealBenefit: hasMeal,
    hasTelehealth: obj.telehealth === true,
    hasSilverSneakers: obj.silver_sneakers === true,
    hasFitnessBenefit: hasFitness,
    hasInHomeSupport: obj.in_home_support === true,
    snpType: obj.snp_type || null,
    enrollmentStatus: obj.enrollment_status || null,
    overallStarRating: starRating,
    lowPerforming: obj.low_performing === true,
    highPerforming: obj.high_performing === true,
  };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
