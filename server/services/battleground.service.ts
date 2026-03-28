import { db } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, countDistinct, desc, and } from "drizzle-orm";

// ── Types ──

export interface CarrierStats {
  name: string;
  share: number;
  planCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
}

export interface CountyBattleground {
  county: string;
  state: string;
  fips: string;
  totalPlans: number;
  dominantCarrier: { name: string; share: number; planCount: number };
  topCarriers: CarrierStats[];
  vulnerabilities: string[];
  opportunities: string[];
}

export interface StateOverview {
  state: string;
  stateName: string;
  counties: CountyBattleground[];
  carrierTerritories: Array<{
    carrier: string;
    countiesWon: number;
    totalCounties: number;
    avgShare: number;
  }>;
}

// ── National averages (cached) ──

let nationalAvgCache: { dental: number; otc: number; premium: number; star: number } | null = null;

async function getNationalAverages() {
  if (nationalAvgCache) return nationalAvgCache;

  const [row] = await db.select({
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgStar: avg(plans.overallStarRating).as("avg_star"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    total: count().as("total"),
  }).from(plans);

  nationalAvgCache = {
    dental: Math.round(Number(row.avgDental) || 0),
    otc: Number(row.total) > 0 ? Math.round((Number(row.otcCount) / Number(row.total)) * 100) : 0,
    premium: Math.round(Number(row.avgPremium) || 0),
    star: Number(Number(row.avgStar).toFixed(1)) || 0,
  };
  return nationalAvgCache;
}

// ── Service Functions ──

export async function getStateOverview(stateAbbr: string): Promise<StateOverview> {
  const st = stateAbbr.toUpperCase();

  // Get carrier stats per county
  const rows = await db.select({
    county: plans.county,
    fips: sql<string>`min(${plans.fips})`.as("fips"),
    org: plans.organizationName,
    planCount: count().as("plan_count"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgStar: avg(plans.overallStarRating).as("avg_star"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    fitnessCount: sql<number>`count(*) filter (where ${plans.hasFitnessBenefit} = true)`.as("fitness_count"),
    telehealthCount: sql<number>`count(*) filter (where ${plans.hasTelehealth} = true)`.as("telehealth_count"),
  })
    .from(plans)
    .where(eq(plans.state, st))
    .groupBy(plans.county, plans.organizationName);

  // Get county totals
  const countyTotals = await db.select({
    county: plans.county,
    totalPlans: count().as("total_plans"),
  })
    .from(plans)
    .where(eq(plans.state, st))
    .groupBy(plans.county);

  const totalMap = new Map(countyTotals.map(c => [c.county, Number(c.totalPlans)]));
  const natAvg = await getNationalAverages();

  // Group rows by county
  const countyMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = countyMap.get(row.county) || [];
    existing.push(row);
    countyMap.set(row.county, existing);
  }

  const counties: CountyBattleground[] = [];

  for (const [county, carrierRows] of countyMap) {
    const total = totalMap.get(county) || 0;
    if (total === 0) continue;

    const topCarriers: CarrierStats[] = carrierRows
      .map(r => {
        const pc = Number(r.planCount);
        return {
          name: r.org,
          share: Math.round((pc / total) * 100),
          planCount: pc,
          avgDental: Math.round(Number(r.avgDental) || 0),
          avgOtc: pc > 0 ? Math.round((Number(r.otcCount) / pc) * 100) : 0,
          avgPremium: Math.round(Number(r.avgPremium) || 0),
          avgStarRating: Number(Number(r.avgStar || 0).toFixed(1)),
        };
      })
      .sort((a, b) => b.planCount - a.planCount)
      .slice(0, 10);

    const dominant = topCarriers[0] || { name: "Unknown", share: 0, planCount: 0 };

    // Find vulnerabilities: areas where ALL carriers in this county are below national average
    const allDental = carrierRows.map(r => Math.round(Number(r.avgDental) || 0));
    const maxDental = Math.max(...allDental, 0);
    const otcPct = total > 0
      ? Math.round((carrierRows.reduce((s, r) => s + Number(r.otcCount), 0) / total) * 100)
      : 0;
    const transportPct = total > 0
      ? Math.round((carrierRows.reduce((s, r) => s + Number(r.transportCount), 0) / total) * 100)
      : 0;
    const mealPct = total > 0
      ? Math.round((carrierRows.reduce((s, r) => s + Number(r.mealCount), 0) / total) * 100)
      : 0;
    const fitnessPct = total > 0
      ? Math.round((carrierRows.reduce((s, r) => s + Number(r.fitnessCount), 0) / total) * 100)
      : 0;

    const vulnerabilities: string[] = [];
    if (maxDental < natAvg.dental && maxDental < 2000)
      vulnerabilities.push(`No carrier offers >$${natAvg.dental.toLocaleString()} dental (max: $${maxDental.toLocaleString()})`);
    if (otcPct < 30) vulnerabilities.push(`Only ${otcPct}% of plans offer OTC benefits`);
    if (transportPct < 20) vulnerabilities.push(`Only ${transportPct}% of plans offer transportation`);
    if (mealPct < 15) vulnerabilities.push(`Only ${mealPct}% of plans offer meal benefits`);

    const opportunities: string[] = [];
    if (otcPct < 30) opportunities.push("First to offer $150+ OTC quarterly wins market share");
    if (transportPct < 30) opportunities.push("Add transportation benefit to differentiate");
    if (mealPct < 20) opportunities.push("Meal benefit gap — high demand, low supply");
    if (fitnessPct < 40) opportunities.push("Fitness benefit coverage below 40% — room to grow");
    if (topCarriers.length <= 3) opportunities.push(`Low competition — only ${topCarriers.length} carriers in county`);

    counties.push({
      county,
      state: st,
      fips: carrierRows[0]?.fips || "",
      totalPlans: total,
      dominantCarrier: { name: dominant.name, share: dominant.share, planCount: dominant.planCount },
      topCarriers,
      vulnerabilities: vulnerabilities.slice(0, 5),
      opportunities: opportunities.slice(0, 5),
    });
  }

  // Sort counties by plan count descending
  counties.sort((a, b) => b.totalPlans - a.totalPlans);

  // Calculate carrier territories
  const carrierWins = new Map<string, { countiesWon: number; totalShare: number }>();
  for (const c of counties) {
    const winner = c.dominantCarrier.name;
    const existing = carrierWins.get(winner) || { countiesWon: 0, totalShare: 0 };
    existing.countiesWon++;
    existing.totalShare += c.dominantCarrier.share;
    carrierWins.set(winner, existing);
  }

  const carrierTerritories = Array.from(carrierWins.entries())
    .map(([carrier, stats]) => ({
      carrier,
      countiesWon: stats.countiesWon,
      totalCounties: counties.length,
      avgShare: stats.countiesWon > 0 ? Math.round(stats.totalShare / stats.countiesWon) : 0,
    }))
    .sort((a, b) => b.countiesWon - a.countiesWon);

  return {
    state: st,
    stateName: stateNames[st] || st,
    counties,
    carrierTerritories,
  };
}

export async function getCountyBattleground(county: string, stateAbbr: string): Promise<CountyBattleground | null> {
  const overview = await getStateOverview(stateAbbr);
  const found = overview.counties.find(
    c => c.county.toUpperCase() === county.toUpperCase()
  );
  return found || null;
}

export async function getAllStatesOverview(): Promise<Array<{ state: string; stateName: string; counties: number; totalPlans: number; topCarrier: string }>> {
  const rows = await db.select({
    state: plans.state,
    counties: countDistinct(plans.county).as("counties"),
    totalPlans: count().as("total_plans"),
  })
    .from(plans)
    .groupBy(plans.state)
    .orderBy(desc(sql`count(*)`));

  // Get dominant carrier per state
  const carrierRows = await db.select({
    state: plans.state,
    org: plans.organizationName,
    cnt: count().as("cnt"),
  })
    .from(plans)
    .groupBy(plans.state, plans.organizationName);

  const stateTopCarrier = new Map<string, string>();
  const stateTopCount = new Map<string, number>();
  for (const r of carrierRows) {
    const existing = stateTopCount.get(r.state) || 0;
    if (Number(r.cnt) > existing) {
      stateTopCarrier.set(r.state, r.org);
      stateTopCount.set(r.state, Number(r.cnt));
    }
  }

  return rows.map(r => ({
    state: r.state,
    stateName: stateNames[r.state] || r.state,
    counties: Number(r.counties),
    totalPlans: Number(r.totalPlans),
    topCarrier: stateTopCarrier.get(r.state) || "Unknown",
  }));
}
