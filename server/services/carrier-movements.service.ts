import { db, pool } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, count, avg, countDistinct, desc, and } from "drizzle-orm";

// ── Types ──

export interface CarrierFootprint {
  carrier: string;
  states: number;
  counties: number;
  totalPlans: number;
  totalEnrollment: number;
  avgStarRating: number;
  topCounties: Array<{ county: string; state: string; plans: number; enrollment: number }>;
  stateBreakdown: Array<{ state: string; plans: number; counties: number }>;
  concentrationNote: string;
}

export interface CountyEntry {
  county: string;
  state: string;
  fips: string;
  plans: number;
  avgPremium: number;
  avgDental: number;
  enrollment: number;
  starRating: number;
}

export interface CarrierMovement {
  carrier: string;
  expansions: CountyEntry[];
  exits: CountyEntry[];
  stable: number;
  netChange: number;
  trend: "expanding" | "contracting" | "stable";
}

export interface StateCarrierDynamic {
  carrier: string;
  countiesPresent: number;
  planCount: number;
  enrollment: number;
  isExpanding: boolean;
  strength: "strong" | "moderate" | "weak";
}

export interface MarketForecast {
  county: string;
  state: string;
  currentPlans: number;
  currentCarriers: number;
  maPercentage: number;
  perCapitaSpending: number;
  hpsaScore: number;
  opportunityScore: number;
  predictedGrowth: "high" | "medium" | "low";
  reasoning: string[];
  likelyEntrants: string[];
}

export interface ExpansionOpportunity {
  county: string;
  state: string;
  fips: string;
  currentCarriers: number;
  currentPlans: number;
  forecastScore: number;
  reasoning: string;
}

// ── Get carrier footprint ──

export async function getCarrierFootprint(carrier: string): Promise<CarrierFootprint> {
  // Get aggregate stats
  const statsRes = await pool.query(
    `SELECT
       COUNT(*) as total_plans,
       COUNT(DISTINCT state) as states,
       COUNT(DISTINCT county || '|' || state) as counties,
       COALESCE(SUM(enrollment_count), 0) as total_enrollment,
       ROUND(AVG(overall_star_rating)::numeric, 2) as avg_star
     FROM plans
     WHERE organization_name = $1`,
    [carrier]
  );
  const stats = statsRes.rows[0] || {};

  // Get state breakdown
  const stateRes = await pool.query(
    `SELECT state, COUNT(*) as plans, COUNT(DISTINCT county) as counties
     FROM plans WHERE organization_name = $1
     GROUP BY state ORDER BY COUNT(*) DESC`,
    [carrier]
  );

  // Get top 20 counties
  const countyRes = await pool.query(
    `SELECT county, state, COUNT(*) as plans, COALESCE(SUM(enrollment_count), 0) as enrollment
     FROM plans WHERE organization_name = $1
     GROUP BY county, state ORDER BY COUNT(*) DESC LIMIT 20`,
    [carrier]
  );

  const totalPlans = Number(stats.total_plans) || 0;
  const stateBreakdown = stateRes.rows.map((r: any) => ({
    state: r.state,
    plans: Number(r.plans),
    counties: Number(r.counties),
  }));

  // Concentration note
  const top5Plans = stateBreakdown.slice(0, 5).reduce((s: number, r: any) => s + r.plans, 0);
  const concentrationPct = totalPlans > 0 ? Math.round((top5Plans / totalPlans) * 100) : 0;
  const concentrationNote = totalPlans > 0
    ? `${concentrationPct}% of plans concentrated in top ${Math.min(5, stateBreakdown.length)} states`
    : "No plans found for this carrier";

  return {
    carrier,
    states: Number(stats.states) || 0,
    counties: Number(stats.counties) || 0,
    totalPlans,
    totalEnrollment: Number(stats.total_enrollment) || 0,
    avgStarRating: Number(stats.avg_star) || 0,
    topCounties: countyRes.rows.map((r: any) => ({
      county: r.county,
      state: r.state,
      plans: Number(r.plans),
      enrollment: Number(r.enrollment),
    })),
    stateBreakdown,
    concentrationNote,
  };
}

// ── Get carrier movements (compare vs state averages since we have single-year data) ──

export async function getCarrierMovements(carrier: string): Promise<CarrierMovement> {
  // Get this carrier's county-level presence
  const carrierCounties = await pool.query(
    `SELECT county, state, COALESCE(fips, '') as fips,
       COUNT(*) as plans,
       ROUND(AVG(calculated_monthly_premium)::numeric, 2) as avg_premium,
       ROUND(AVG(dental_coverage_limit)::numeric, 2) as avg_dental,
       COALESCE(SUM(enrollment_count), 0) as enrollment,
       ROUND(AVG(overall_star_rating)::numeric, 2) as star_rating
     FROM plans WHERE organization_name = $1
     GROUP BY county, state, fips`,
    [carrier]
  );

  // Get state-level averages for plan density (plans per county per carrier)
  const stateAvgs = await pool.query(
    `SELECT state,
       ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT organization_name), 0), 1) as avg_plans_per_carrier,
       ROUND(AVG(calculated_monthly_premium)::numeric, 2) as avg_premium
     FROM plans GROUP BY state`
  );
  const stateAvgMap = new Map<string, { avgPlans: number; avgPremium: number }>();
  for (const r of stateAvgs.rows) {
    stateAvgMap.set(r.state, {
      avgPlans: Number(r.avg_plans_per_carrier) || 1,
      avgPremium: Number(r.avg_premium) || 0,
    });
  }

  const expansions: CountyEntry[] = [];
  const exits: CountyEntry[] = [];
  let stable = 0;

  for (const r of carrierCounties.rows) {
    const entry: CountyEntry = {
      county: r.county,
      state: r.state,
      fips: r.fips,
      plans: Number(r.plans),
      avgPremium: Number(r.avg_premium) || 0,
      avgDental: Number(r.avg_dental) || 0,
      enrollment: Number(r.enrollment) || 0,
      starRating: Number(r.star_rating) || 0,
    };

    const stateAvg = stateAvgMap.get(r.state);
    if (!stateAvg) {
      stable++;
      continue;
    }

    // Counties where carrier has more plans than avg = "expanding"
    // Counties where carrier has fewer plans than avg = "contracting"
    const ratio = entry.plans / stateAvg.avgPlans;
    if (ratio > 1.3) {
      expansions.push(entry);
    } else if (ratio < 0.7) {
      exits.push(entry);
    } else {
      stable++;
    }
  }

  const netChange = expansions.length - exits.length;
  const trend: CarrierMovement["trend"] =
    netChange > 5 ? "expanding" : netChange < -5 ? "contracting" : "stable";

  return {
    carrier,
    expansions: expansions.sort((a, b) => b.plans - a.plans).slice(0, 50),
    exits: exits.sort((a, b) => a.plans - b.plans).slice(0, 50),
    stable,
    netChange,
    trend,
  };
}

// ── Get state carrier dynamics ──

export async function getStateCarrierDynamics(state: string): Promise<StateCarrierDynamic[]> {
  // Get per-carrier stats in this state
  const res = await pool.query(
    `SELECT organization_name as carrier,
       COUNT(DISTINCT county) as counties_present,
       COUNT(*) as plan_count,
       COALESCE(SUM(enrollment_count), 0) as enrollment
     FROM plans WHERE state = $1
     GROUP BY organization_name
     ORDER BY COUNT(*) DESC`,
    [state]
  );

  // Get state-wide average plans per county per carrier
  const totalCounties = await pool.query(
    `SELECT COUNT(DISTINCT county) as cnt FROM plans WHERE state = $1`,
    [state]
  );
  const stateCountyCount = Number(totalCounties.rows[0]?.cnt) || 1;
  const carrierCount = res.rows.length || 1;

  // Average county coverage per carrier
  const avgCountyCoverage = stateCountyCount / Math.max(carrierCount, 1);

  return res.rows.map((r: any) => {
    const countiesPresent = Number(r.counties_present);
    const planCount = Number(r.plan_count);
    const enrollment = Number(r.enrollment);

    // Determine strength based on county coverage
    const coverageRatio = countiesPresent / stateCountyCount;
    const strength: "strong" | "moderate" | "weak" =
      coverageRatio > 0.5 ? "strong" :
      coverageRatio > 0.2 ? "moderate" : "weak";

    // Expanding if above-average county presence
    const isExpanding = countiesPresent > avgCountyCoverage * 1.2;

    return {
      carrier: r.carrier,
      countiesPresent,
      planCount,
      enrollment,
      isExpanding,
      strength,
    };
  });
}

// ── Forecast market growth ──

export async function forecastMarketGrowth(state?: string, limit?: number): Promise<MarketForecast[]> {
  const maxResults = limit || 30;

  // Get county-level plan/carrier counts
  const planCountsQuery = state
    ? `SELECT county, state, COALESCE(MIN(fips), '') as fips,
         COUNT(*) as plan_count, COUNT(DISTINCT organization_name) as carrier_count,
         ROUND(AVG(calculated_monthly_premium)::numeric, 2) as avg_premium
       FROM plans WHERE state = $1
       GROUP BY county, state`
    : `SELECT county, state, COALESCE(MIN(fips), '') as fips,
         COUNT(*) as plan_count, COUNT(DISTINCT organization_name) as carrier_count,
         ROUND(AVG(calculated_monthly_premium)::numeric, 2) as avg_premium
       FROM plans
       GROUP BY county, state`;
  const planRes = await pool.query(planCountsQuery, state ? [state] : []);

  // Get MA penetration data
  const maQuery = state
    ? `SELECT county, state, ma_penetration_rate, opportunity_score, per_capita_spending, ffs_beneficiaries, total_beneficiaries
       FROM ma_penetration WHERE state = $1`
    : `SELECT county, state, ma_penetration_rate, opportunity_score, per_capita_spending, ffs_beneficiaries, total_beneficiaries
       FROM ma_penetration`;
  let maMap = new Map<string, any>();
  try {
    const maRes = await pool.query(maQuery, state ? [state] : []);
    for (const r of maRes.rows) {
      maMap.set(`${r.county}|${r.state}`, r);
    }
  } catch { /* table may not exist */ }

  // Get HPSA data
  let hpsaSet = new Set<string>();
  try {
    const hpsaQuery = state
      ? `SELECT DISTINCT county, state FROM hpsa_shortage_areas WHERE state = $1 AND status = 'Designated'`
      : `SELECT DISTINCT county, state FROM hpsa_shortage_areas WHERE status = 'Designated'`;
    const hpsaRes = await pool.query(hpsaQuery, state ? [state] : []);
    for (const r of hpsaRes.rows) {
      hpsaSet.add(`${r.county}|${r.state}`);
    }
  } catch { /* table may not exist */ }

  // Get county health data (population 65+)
  let healthMap = new Map<string, any>();
  try {
    const healthQuery = state
      ? `SELECT county, state, population_65_plus, median_income FROM county_health_data WHERE state = $1`
      : `SELECT county, state, population_65_plus, median_income FROM county_health_data`;
    const healthRes = await pool.query(healthQuery, state ? [state] : []);
    for (const r of healthRes.rows) {
      healthMap.set(`${r.county}|${r.state}`, r);
    }
  } catch { /* table may not exist */ }

  // Get Medicare spending data
  let spendingMap = new Map<string, number>();
  try {
    const spendingQuery = state
      ? `SELECT county, state, per_capita_total_spending FROM medicare_spending WHERE state = $1 AND per_capita_total_spending IS NOT NULL`
      : `SELECT county, state, per_capita_total_spending FROM medicare_spending WHERE per_capita_total_spending IS NOT NULL`;
    const spendingRes = await pool.query(spendingQuery, state ? [state] : []);
    for (const r of spendingRes.rows) {
      spendingMap.set(`${r.county}|${r.state}`, Number(r.per_capita_total_spending));
    }
  } catch { /* table may not exist */ }

  // Calculate forecasts
  const forecasts: MarketForecast[] = [];
  const allSpending = [...spendingMap.values()].filter(v => v > 0);
  const maxSpending = Math.max(...allSpending, 1);
  const allCarrierCounts = planRes.rows.map((r: any) => Number(r.carrier_count));
  const maxCarriers = Math.max(...allCarrierCounts, 1);

  for (const r of planRes.rows) {
    const key = `${r.county}|${r.state}`;
    const planCount = Number(r.plan_count);
    const carrierCount = Number(r.carrier_count);
    const maData = maMap.get(key);
    const spending = spendingMap.get(key) || 0;
    const health = healthMap.get(key);
    const isHpsa = hpsaSet.has(key);

    const maPenetration = maData?.ma_penetration_rate ? Number(maData.ma_penetration_rate) : 0;
    const maOpportunityScore = maData?.opportunity_score ? Number(maData.opportunity_score) : 0;
    const pop65 = health?.population_65_plus ? Number(health.population_65_plus) : 0;

    // Score components (0-1 scale)
    const spendingRank = spending > 0 ? spending / maxSpending : 0.3;
    const penetrationGap = maPenetration > 0 ? Math.max(0, 1 - maPenetration) : 0.5;
    const lowCompetition = 1 - Math.min(carrierCount / maxCarriers, 1);
    const populationScore = pop65 > 0 ? Math.min(pop65 / 50000, 1) : 0.3;
    const networkFeasibility = isHpsa ? 0.2 : 0.8;

    const forecastScore =
      (spendingRank * 0.3) +
      (penetrationGap * 0.25) +
      (lowCompetition * 0.2) +
      (populationScore * 0.15) +
      (networkFeasibility * 0.1);

    const reasoning: string[] = [];
    if (spending > 12000) reasoning.push(`High spending ($${Math.round(spending / 1000)}K)`);
    if (maPenetration > 0 && maPenetration < 0.35) reasoning.push(`Low penetration (${Math.round(maPenetration * 100)}%)`);
    if (maPenetration > 0 && maPenetration >= 0.35 && maPenetration < 0.5) reasoning.push(`Moderate penetration (${Math.round(maPenetration * 100)}%)`);
    if (carrierCount <= 5) reasoning.push(`Only ${carrierCount} carriers`);
    if (pop65 > 20000) reasoning.push(`Large 65+ population (${Math.round(pop65 / 1000)}K)`);
    if (isHpsa) reasoning.push("HPSA shortage area (network challenge)");
    if (!isHpsa) reasoning.push("No HPSA shortage (easier networks)");
    if (maOpportunityScore > 0.6) reasoning.push(`High opportunity score (${Math.round(maOpportunityScore * 100)})`);

    const predictedGrowth: "high" | "medium" | "low" =
      forecastScore > 0.6 ? "high" :
      forecastScore > 0.4 ? "medium" : "low";

    forecasts.push({
      county: r.county,
      state: r.state,
      currentPlans: planCount,
      currentCarriers: carrierCount,
      maPercentage: Math.round(maPenetration * 100),
      perCapitaSpending: Math.round(spending),
      hpsaScore: isHpsa ? 1 : 0,
      opportunityScore: Math.round(forecastScore * 100),
      predictedGrowth,
      reasoning,
      likelyEntrants: [], // populated below
    });
  }

  // Sort by forecast score descending
  forecasts.sort((a, b) => b.opportunityScore - a.opportunityScore);
  const topForecasts = forecasts.slice(0, maxResults);

  // Find likely entrants for top forecasts
  for (const f of topForecasts) {
    f.likelyEntrants = await findLikelyEntrants(f.county, f.state);
  }

  return topForecasts;
}

// ── Find carriers in same state but not in this county ──

export async function findLikelyEntrants(county: string, state: string): Promise<string[]> {
  const res = await pool.query(
    `SELECT DISTINCT organization_name
     FROM plans
     WHERE state = $1
       AND county != $2
       AND organization_name NOT IN (
         SELECT DISTINCT organization_name FROM plans WHERE state = $1 AND county = $2
       )
     GROUP BY organization_name
     HAVING COUNT(DISTINCT county) >= 3
     ORDER BY COUNT(DISTINCT county) DESC
     LIMIT 5`,
    [state, county]
  );
  return res.rows.map((r: any) => r.organization_name);
}

// ── Get expansion map data for a carrier in a state ──

export async function getCarrierExpansionMap(carrier: string, state: string): Promise<{
  present: Array<{ county: string; fips: string; plans: number; enrollment: number }>;
  opportunities: ExpansionOpportunity[];
}> {
  // Counties where carrier is present
  const presentRes = await pool.query(
    `SELECT county, COALESCE(MIN(fips), '') as fips, COUNT(*) as plans,
       COALESCE(SUM(enrollment_count), 0) as enrollment
     FROM plans WHERE organization_name = $1 AND state = $2
     GROUP BY county`,
    [carrier, state]
  );
  const presentCounties = new Set(presentRes.rows.map((r: any) => r.county));

  // All counties in state where carrier is NOT present
  const allCounties = await pool.query(
    `SELECT county, COALESCE(MIN(fips), '') as fips,
       COUNT(*) as plan_count, COUNT(DISTINCT organization_name) as carrier_count
     FROM plans WHERE state = $1 AND county NOT IN (
       SELECT DISTINCT county FROM plans WHERE organization_name = $2 AND state = $1
     )
     GROUP BY county`,
    [state, carrier]
  );

  // Score opportunities
  const opportunities: ExpansionOpportunity[] = [];
  for (const r of allCounties.rows) {
    const carrierCount = Number(r.carrier_count);
    const planCount = Number(r.plan_count);

    // Lower competition = higher score
    const competitionScore = Math.max(0, 1 - carrierCount / 20);
    // Higher plan count = more established market
    const marketScore = Math.min(planCount / 100, 1);
    const forecastScore = Math.round((competitionScore * 0.5 + marketScore * 0.5) * 100);

    const reasons: string[] = [];
    if (carrierCount <= 5) reasons.push(`only ${carrierCount} carriers competing`);
    if (planCount > 20) reasons.push(`established market with ${planCount} plans`);
    if (planCount <= 20) reasons.push(`small market — ${planCount} plans`);

    opportunities.push({
      county: r.county,
      state,
      fips: r.fips,
      currentCarriers: carrierCount,
      currentPlans: planCount,
      forecastScore,
      reasoning: reasons.join(", "),
    });
  }

  opportunities.sort((a, b) => b.forecastScore - a.forecastScore);

  return {
    present: presentRes.rows.map((r: any) => ({
      county: r.county,
      fips: r.fips,
      plans: Number(r.plans),
      enrollment: Number(r.enrollment),
    })),
    opportunities: opportunities.slice(0, 20),
  };
}

// ── Get all carrier names ──

export async function getAllCarriers(): Promise<string[]> {
  const res = await pool.query(
    `SELECT DISTINCT organization_name FROM plans ORDER BY organization_name`
  );
  return res.rows.map((r: any) => r.organization_name);
}

// ── Get all states ──

export async function getAllStates(): Promise<string[]> {
  const res = await pool.query(
    `SELECT DISTINCT state FROM plans ORDER BY state`
  );
  return res.rows.map((r: any) => r.state);
}
