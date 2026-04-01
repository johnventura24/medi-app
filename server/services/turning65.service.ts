import { db, pool } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, desc, and, countDistinct } from "drizzle-orm";

export interface Turning65County {
  county: string;
  state: string;
  stateName: string;
  estimated65PlusRate: number;
  estimatedNewPerMonth: number;
  totalBeneficiaries: number;
  maPenetration: number;
  topPlans: Array<{ name: string; carrier: string; premium: number; dental: number }>;
  opportunityScore: number;
  agentTip: string;
}

export async function getTurning65Pipeline(
  state?: string,
  limit: number = 20
): Promise<Turning65County[]> {
  // 1. Get county health data (population_65_plus as a percentage)
  const healthQuery = state
    ? `SELECT county_name, state, population_65_plus, median_income
       FROM county_health_data WHERE UPPER(state) = $1`
    : `SELECT county_name, state, population_65_plus, median_income
       FROM county_health_data`;

  const healthParams = state ? [state.toUpperCase()] : [];
  let healthRows: any[] = [];
  try {
    const result = await pool.query(healthQuery, healthParams);
    healthRows = result.rows;
  } catch {
    // Table may not exist — return empty
    return [];
  }

  // 2. Get medicare_spending for total_beneficiaries
  const spendingQuery = state
    ? `SELECT county, state, total_beneficiaries, per_capita_total_spending
       FROM medicare_spending WHERE UPPER(state) = $1 AND total_beneficiaries IS NOT NULL`
    : `SELECT county, state, total_beneficiaries, per_capita_total_spending
       FROM medicare_spending WHERE total_beneficiaries IS NOT NULL`;

  const spendingParams = state ? [state.toUpperCase()] : [];
  let spendingRows: any[] = [];
  try {
    const result = await pool.query(spendingQuery, spendingParams);
    spendingRows = result.rows;
  } catch {
    // Table may not exist
  }

  // 3. Get MA penetration data
  const maQuery = state
    ? `SELECT county, state, ma_penetration_rate, total_beneficiaries, ffs_beneficiaries
       FROM ma_penetration WHERE UPPER(state) = $1`
    : `SELECT county, state, ma_penetration_rate, total_beneficiaries, ffs_beneficiaries
       FROM ma_penetration`;

  const maParams = state ? [state.toUpperCase()] : [];
  let maRows: any[] = [];
  try {
    const result = await pool.query(maQuery, maParams);
    maRows = result.rows;
  } catch {
    // Table may not exist
  }

  // Build lookup maps
  const spendingMap = new Map<string, any>();
  for (const row of spendingRows) {
    const key = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    spendingMap.set(key, row);
  }

  const maMap = new Map<string, any>();
  for (const row of maRows) {
    const key = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    maMap.set(key, row);
  }

  // 4. Get top plans per county-state (grouped)
  const stateFilter = state ? state.toUpperCase() : undefined;
  const planQuery = stateFilter
    ? `SELECT county, state, name, organization_name, calculated_monthly_premium, dental_coverage_limit
       FROM plans WHERE UPPER(state) = $1
       ORDER BY county, state, calculated_monthly_premium ASC`
    : `SELECT county, state, name, organization_name, calculated_monthly_premium, dental_coverage_limit
       FROM plans ORDER BY county, state, calculated_monthly_premium ASC`;

  const planParams = stateFilter ? [stateFilter] : [];
  let planRows: any[] = [];
  try {
    const result = await pool.query(planQuery, planParams);
    planRows = result.rows;
  } catch {
    // Plans table should exist
  }

  // Group top plans per county
  const plansByCounty = new Map<string, Array<{ name: string; carrier: string; premium: number; dental: number }>>();
  for (const row of planRows) {
    const key = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    if (!plansByCounty.has(key)) {
      plansByCounty.set(key, []);
    }
    const arr = plansByCounty.get(key)!;
    if (arr.length < 3) {
      // Only add unique plan names
      const name = row.name || "Unknown Plan";
      if (!arr.some(p => p.name === name)) {
        arr.push({
          name,
          carrier: row.organization_name || "Unknown",
          premium: Number(row.calculated_monthly_premium) || 0,
          dental: Number(row.dental_coverage_limit) || 0,
        });
      }
    }
  }

  // 5. Build results
  const results: Turning65County[] = [];

  for (const health of healthRows) {
    const countyName = health.county_name || "";
    const st = (health.state || "").toUpperCase();
    const key = `${countyName.toUpperCase()}|${st}`;

    const pop65Plus = Number(health.population_65_plus) || 0;
    const spending = spendingMap.get(key);
    const ma = maMap.get(key);

    // Try fuzzy matching if exact key not found
    let spendingData = spending;
    let maData = ma;
    if (!spendingData) {
      for (const [k, v] of spendingMap) {
        if (k.includes(countyName.toUpperCase()) && k.endsWith(`|${st}`)) {
          spendingData = v;
          break;
        }
      }
    }
    if (!maData) {
      for (const [k, v] of maMap) {
        if (k.includes(countyName.toUpperCase()) && k.endsWith(`|${st}`)) {
          maData = v;
          break;
        }
      }
    }

    const totalBeneficiaries = spendingData
      ? Number(spendingData.total_beneficiaries) || 0
      : (maData ? Number(maData.total_beneficiaries) || 0 : 0);

    if (totalBeneficiaries === 0 && pop65Plus === 0) continue;

    // Estimate: ~3% of total beneficiaries turn 65 each year
    const estimatedNewPerMonth = Math.round((totalBeneficiaries * 0.03) / 12);
    const maPenetration = maData ? Number(maData.ma_penetration_rate) || 0 : 0;

    // Opportunity score: volume * (1 - ma_penetration) — higher if more new eligibles and lower penetration
    const volumeScore = Math.min(estimatedNewPerMonth / 50, 1); // normalize to 0-1, cap at 50/month
    const penetrationGap = 1 - Math.min(maPenetration, 1);
    const opportunityScore = Math.round((volumeScore * 0.6 + penetrationGap * 0.4) * 100);

    // Get top plans for this county
    let topPlans = plansByCounty.get(key) || [];
    if (topPlans.length === 0) {
      // Try fuzzy match
      for (const [k, v] of plansByCounty) {
        if (k.includes(countyName.toUpperCase()) && k.endsWith(`|${st}`)) {
          topPlans = v;
          break;
        }
      }
    }

    // Generate agent tip
    const ffsPct = maPenetration > 0 ? Math.round((1 - maPenetration) * 100) : 50;
    const has0Premium = topPlans.some(p => p.premium === 0);
    let agentTip = "";
    if (has0Premium && estimatedNewPerMonth > 10) {
      agentTip = `Focus on $0 premium plans — new enrollees are price-sensitive. ~${estimatedNewPerMonth} new eligibles/month with ${ffsPct}% still on Original Medicare.`;
    } else if (maPenetration < 0.3) {
      agentTip = `Low MA penetration (${Math.round(maPenetration * 100)}%) — educate new eligibles about MA vs Original Medicare. Most here haven't switched yet.`;
    } else if (estimatedNewPerMonth > 20) {
      agentTip = `High volume market — ${estimatedNewPerMonth} new eligibles/month. Host local seminars and partner with turning-65 birthday mailing lists.`;
    } else {
      agentTip = `~${estimatedNewPerMonth} new eligibles/month. Personalize outreach — smaller markets respond better to one-on-one consultations.`;
    }

    results.push({
      county: countyName,
      state: st,
      stateName: stateNames[st] || st,
      estimated65PlusRate: pop65Plus,
      estimatedNewPerMonth,
      totalBeneficiaries,
      maPenetration: Math.round(maPenetration * 100),
      topPlans,
      opportunityScore,
      agentTip,
    });
  }

  // Sort by estimatedNewPerMonth DESC
  results.sort((a, b) => b.estimatedNewPerMonth - a.estimatedNewPerMonth);

  return results.slice(0, limit);
}
