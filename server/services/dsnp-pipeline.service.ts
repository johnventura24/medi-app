import { db, pool } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, desc, and } from "drizzle-orm";

export interface DSNPOpportunity {
  county: string;
  state: string;
  stateName: string;
  estimatedDualEligible: number;
  dsnpPlansAvailable: number;
  topDSNPs: Array<{
    name: string;
    carrier: string;
    premium: number;
    dental: number;
    otc: number;
    hasMeals: boolean;
    hasTransport: boolean;
  }>;
  competitionLevel: "low" | "medium" | "high";
  monthlyOpportunity: string;
  opportunityScore: number;
}

export async function getDSNPPipeline(
  state?: string,
  limit: number = 20
): Promise<DSNPOpportunity[]> {
  const stateFilter = state ? state.toUpperCase() : undefined;

  // 1. Get county health data — use uninsured_rate and median_income as Medicaid proxies
  const healthQuery = stateFilter
    ? `SELECT county_name, state, population_65_plus, uninsured_rate, median_income
       FROM county_health_data WHERE UPPER(state) = $1`
    : `SELECT county_name, state, population_65_plus, uninsured_rate, median_income
       FROM county_health_data`;

  const healthParams = stateFilter ? [stateFilter] : [];
  let healthRows: any[] = [];
  try {
    const result = await pool.query(healthQuery, healthParams);
    healthRows = result.rows;
  } catch {
    return [];
  }

  // 2. Get MA penetration data for total_beneficiaries
  const maQuery = stateFilter
    ? `SELECT county, state, ma_penetration_rate, total_beneficiaries, ffs_beneficiaries
       FROM ma_penetration WHERE UPPER(state) = $1`
    : `SELECT county, state, ma_penetration_rate, total_beneficiaries, ffs_beneficiaries
       FROM ma_penetration`;

  const maParams = stateFilter ? [stateFilter] : [];
  let maRows: any[] = [];
  try {
    const result = await pool.query(maQuery, maParams);
    maRows = result.rows;
  } catch {
    // table may not exist
  }

  const maMap = new Map<string, any>();
  for (const row of maRows) {
    const key = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    maMap.set(key, row);
  }

  // 3. Get D-SNP plans per county
  const dsnpQuery = stateFilter
    ? `SELECT county, state, name, organization_name, calculated_monthly_premium,
         dental_coverage_limit, otc_amount_per_quarter, has_meal_benefit, has_transportation
       FROM plans WHERE snp_type = 'D-SNP' AND UPPER(state) = $1
       ORDER BY county, state, calculated_monthly_premium ASC`
    : `SELECT county, state, name, organization_name, calculated_monthly_premium,
         dental_coverage_limit, otc_amount_per_quarter, has_meal_benefit, has_transportation
       FROM plans WHERE snp_type = 'D-SNP'
       ORDER BY county, state, calculated_monthly_premium ASC`;

  const dsnpParams = stateFilter ? [stateFilter] : [];
  let dsnpRows: any[] = [];
  try {
    const result = await pool.query(dsnpQuery, dsnpParams);
    dsnpRows = result.rows;
  } catch {
    return [];
  }

  // Group D-SNP plans by county
  const dsnpByCounty = new Map<string, Array<{
    name: string;
    carrier: string;
    premium: number;
    dental: number;
    otc: number;
    hasMeals: boolean;
    hasTransport: boolean;
  }>>();

  const dsnpCountMap = new Map<string, number>();

  for (const row of dsnpRows) {
    const key = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    if (!dsnpByCounty.has(key)) {
      dsnpByCounty.set(key, []);
      dsnpCountMap.set(key, 0);
    }

    dsnpCountMap.set(key, (dsnpCountMap.get(key) || 0) + 1);

    const arr = dsnpByCounty.get(key)!;
    const name = row.name || "Unknown";
    if (arr.length < 5 && !arr.some(p => p.name === name)) {
      arr.push({
        name,
        carrier: row.organization_name || "Unknown",
        premium: Number(row.calculated_monthly_premium) || 0,
        dental: Number(row.dental_coverage_limit) || 0,
        otc: Number(row.otc_amount_per_quarter) || 0,
        hasMeals: !!row.has_meal_benefit,
        hasTransport: !!row.has_transportation,
      });
    }
  }

  // 4. Build results
  const results: DSNPOpportunity[] = [];

  // National median income for comparison (approx $37K for 65+ households)
  const NATIONAL_MEDIAN_65 = 37000;

  for (const health of healthRows) {
    const countyName = health.county_name || "";
    const st = (health.state || "").toUpperCase();
    const key = `${countyName.toUpperCase()}|${st}`;

    const pop65Plus = Number(health.population_65_plus) || 0;
    const uninsuredRate = Number(health.uninsured_rate) || 0;
    const medianIncome = Number(health.median_income) || NATIONAL_MEDIAN_65;

    // Get MA data
    let maData = maMap.get(key);
    if (!maData) {
      for (const [k, v] of maMap) {
        if (k.includes(countyName.toUpperCase()) && k.endsWith(`|${st}`)) {
          maData = v;
          break;
        }
      }
    }

    const totalBeneficiaries = maData ? Number(maData.total_beneficiaries) || 0 : 0;

    // Estimate dual-eligible:
    // Higher uninsured rate + lower income = more Medicaid eligible
    // ~12M dual-eligible nationally out of ~65M Medicare beneficiaries ≈ ~18%
    // Adjust based on local poverty indicators
    const povertyFactor = medianIncome > 0
      ? Math.max(0.5, Math.min(2.0, NATIONAL_MEDIAN_65 / medianIncome))
      : 1.0;
    const uninsuredFactor = 1 + (uninsuredRate * 2); // Higher uninsured = more likely Medicaid territory
    const baseDualRate = 0.18; // National average
    const localDualRate = baseDualRate * povertyFactor * uninsuredFactor;
    const estimatedDualEligible = totalBeneficiaries > 0
      ? Math.round(totalBeneficiaries * Math.min(localDualRate, 0.45))
      : Math.round((pop65Plus / 100) * 1000 * localDualRate); // rough fallback

    if (estimatedDualEligible < 5) continue;

    // Get D-SNP plans
    let dsnpPlans = dsnpByCounty.get(key) || [];
    let dsnpCount = dsnpCountMap.get(key) || 0;
    if (dsnpPlans.length === 0) {
      for (const [k, v] of dsnpByCounty) {
        if (k.includes(countyName.toUpperCase()) && k.endsWith(`|${st}`)) {
          dsnpPlans = v;
          dsnpCount = dsnpCountMap.get(k) || 0;
          break;
        }
      }
    }

    // Competition level
    let competitionLevel: "low" | "medium" | "high" = "low";
    if (dsnpCount >= 8) competitionLevel = "high";
    else if (dsnpCount >= 4) competitionLevel = "medium";

    // Opportunity score: high duals + low competition = best
    const dualScore = Math.min(estimatedDualEligible / 500, 1); // 500+ duals = max
    const competitionPenalty = dsnpCount > 0 ? Math.min(dsnpCount / 15, 0.8) : 0;
    const opportunityScore = Math.round((dualScore * 0.7 + (1 - competitionPenalty) * 0.3) * 100);

    const monthlyOpportunity = `~${estimatedDualEligible.toLocaleString()} estimated dual-eligibles, ${dsnpCount} D-SNP plan${dsnpCount !== 1 ? "s" : ""} available — enroll any month`;

    results.push({
      county: countyName,
      state: st,
      stateName: stateNames[st] || st,
      estimatedDualEligible,
      dsnpPlansAvailable: dsnpCount,
      topDSNPs: dsnpPlans,
      competitionLevel,
      monthlyOpportunity,
      opportunityScore,
    });
  }

  // Sort by opportunity score DESC
  results.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return results.slice(0, limit);
}
