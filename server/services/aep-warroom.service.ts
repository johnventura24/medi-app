import { db } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, desc, and, countDistinct } from "drizzle-orm";

// ── Types ──

export interface CountdownInfo {
  daysUntilAEP: number;
  daysUntilOEP: number;
  currentPeriod: "Pre-AEP" | "AEP" | "OEP" | "Off-Season";
  aepStart: string;
  aepEnd: string;
  oepStart: string;
  oepEnd: string;
}

export interface MarketSnapshot {
  totalPlans: number;
  avgPremium: number;
  avgDental: number;
  plansWithZeroPremium: number;
  plansWithOtc: number;
  plansWithTransportation: number;
  plansWithMeals: number;
  avgStarRating: number;
  carrierCount: number;
  countyCount: number;
}

export interface HotPlan {
  id: number;
  name: string;
  carrier: string;
  state: string;
  county: string;
  premium: number;
  dental: number;
  starRating: number;
  reason: string;
}

export interface CountyAlert {
  county: string;
  state: string;
  alert: string;
  severity: "critical" | "warning" | "info";
  planCount: number;
  detail: string;
}

export interface TopOpportunity {
  location: string;
  state: string;
  opportunity: string;
  score: number;
  category: string;
}

export interface WarRoomData {
  countdown: CountdownInfo;
  marketSnapshot: MarketSnapshot;
  hotPlans: HotPlan[];
  countyAlerts: CountyAlert[];
  topOpportunities: TopOpportunity[];
}

// ── Helpers ──

function getCountdown(): CountdownInfo {
  const now = new Date();
  const year = now.getFullYear();

  // AEP: Oct 15 - Dec 7
  const aepStart = new Date(year, 9, 15); // Oct 15
  const aepEnd = new Date(year, 11, 7);   // Dec 7
  // OEP: Jan 1 - Mar 31
  const oepStart = new Date(year, 0, 1);  // Jan 1
  const oepEnd = new Date(year, 2, 31);   // Mar 31

  const msPerDay = 1000 * 60 * 60 * 24;

  let currentPeriod: CountdownInfo["currentPeriod"];
  if (now >= aepStart && now <= aepEnd) {
    currentPeriod = "AEP";
  } else if (now >= oepStart && now <= oepEnd) {
    currentPeriod = "OEP";
  } else if (now > oepEnd && now < aepStart) {
    currentPeriod = "Pre-AEP";
  } else {
    currentPeriod = "Off-Season";
  }

  const daysUntilAEP = now < aepStart
    ? Math.ceil((aepStart.getTime() - now.getTime()) / msPerDay)
    : now > aepEnd
      ? Math.ceil((new Date(year + 1, 9, 15).getTime() - now.getTime()) / msPerDay)
      : 0;

  const daysUntilOEP = now < oepStart
    ? Math.ceil((oepStart.getTime() - now.getTime()) / msPerDay)
    : now > oepEnd
      ? Math.ceil((new Date(year + 1, 0, 1).getTime() - now.getTime()) / msPerDay)
      : 0;

  return {
    daysUntilAEP,
    daysUntilOEP,
    currentPeriod,
    aepStart: aepStart.toISOString().split("T")[0],
    aepEnd: aepEnd.toISOString().split("T")[0],
    oepStart: oepStart.toISOString().split("T")[0],
    oepEnd: oepEnd.toISOString().split("T")[0],
  };
}

// ── Service Functions ──

export async function getWarRoomData(stateFilter?: string): Promise<WarRoomData> {
  const countdown = getCountdown();

  const whereClause = stateFilter
    ? eq(plans.state, stateFilter.toUpperCase())
    : undefined;

  // Market snapshot
  const [snapshot] = await db.select({
    totalPlans: count().as("total"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    zeroPremium: sql<number>`count(*) filter (where ${plans.calculatedMonthlyPremium} = 0 or ${plans.calculatedMonthlyPremium} is null)`.as("zero_premium"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    avgStar: avg(plans.overallStarRating).as("avg_star"),
    carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
    countyCount: countDistinct(sql`${plans.county} || '-' || ${plans.state}`).as("county_count"),
  })
    .from(plans)
    .where(whereClause);

  const marketSnapshot: MarketSnapshot = {
    totalPlans: Number(snapshot.totalPlans),
    avgPremium: Math.round(Number(snapshot.avgPremium) || 0),
    avgDental: Math.round(Number(snapshot.avgDental) || 0),
    plansWithZeroPremium: Number(snapshot.zeroPremium),
    plansWithOtc: Number(snapshot.otcCount),
    plansWithTransportation: Number(snapshot.transportCount),
    plansWithMeals: Number(snapshot.mealCount),
    avgStarRating: Number(Number(snapshot.avgStar || 0).toFixed(1)),
    carrierCount: Number(snapshot.carrierCount),
    countyCount: Number(snapshot.countyCount),
  };

  // Hot plans: best overall value
  const hotPlans = await getHotPlans(stateFilter);
  const countyAlerts = await getCountyAlerts(stateFilter);
  const topOpportunities = await getTopOpportunities(stateFilter);

  return { countdown, marketSnapshot, hotPlans, countyAlerts, topOpportunities };
}

export async function getHotPlans(stateFilter?: string, limit = 10): Promise<HotPlan[]> {
  const whereClause = stateFilter
    ? eq(plans.state, stateFilter.toUpperCase())
    : undefined;

  // Best dental plans
  const bestDental = await db.select({
    id: plans.id,
    name: plans.name,
    carrier: plans.organizationName,
    state: plans.state,
    county: plans.county,
    premium: plans.calculatedMonthlyPremium,
    dental: plans.dentalCoverageLimit,
    star: plans.overallStarRating,
  })
    .from(plans)
    .where(whereClause)
    .orderBy(desc(plans.dentalCoverageLimit))
    .limit(3);

  // Best $0 premium plans with high star rating
  const bestZeroPremium = await db.select({
    id: plans.id,
    name: plans.name,
    carrier: plans.organizationName,
    state: plans.state,
    county: plans.county,
    premium: plans.calculatedMonthlyPremium,
    dental: plans.dentalCoverageLimit,
    star: plans.overallStarRating,
  })
    .from(plans)
    .where(
      stateFilter
        ? and(
            eq(plans.state, stateFilter.toUpperCase()),
            sql`${plans.calculatedMonthlyPremium} = 0 or ${plans.calculatedMonthlyPremium} is null`
          )
        : sql`${plans.calculatedMonthlyPremium} = 0 or ${plans.calculatedMonthlyPremium} is null`
    )
    .orderBy(desc(plans.overallStarRating), desc(plans.dentalCoverageLimit))
    .limit(3);

  // Highest star rated plans
  const bestStar = await db.select({
    id: plans.id,
    name: plans.name,
    carrier: plans.organizationName,
    state: plans.state,
    county: plans.county,
    premium: plans.calculatedMonthlyPremium,
    dental: plans.dentalCoverageLimit,
    star: plans.overallStarRating,
  })
    .from(plans)
    .where(whereClause)
    .orderBy(desc(plans.overallStarRating), desc(plans.dentalCoverageLimit))
    .limit(4);

  const result: HotPlan[] = [];
  const seenIds = new Set<number>();

  for (const p of bestDental) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      result.push({
        id: p.id,
        name: p.name,
        carrier: p.carrier,
        state: p.state,
        county: p.county,
        premium: p.premium || 0,
        dental: p.dental || 0,
        starRating: p.star || 0,
        reason: `Highest dental $${Math.round(p.dental || 0).toLocaleString()} in ${p.state}`,
      });
    }
  }

  for (const p of bestZeroPremium) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      result.push({
        id: p.id,
        name: p.name,
        carrier: p.carrier,
        state: p.state,
        county: p.county,
        premium: 0,
        dental: p.dental || 0,
        starRating: p.star || 0,
        reason: `$0 premium with ${p.star || 0}-star rating`,
      });
    }
  }

  for (const p of bestStar) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      result.push({
        id: p.id,
        name: p.name,
        carrier: p.carrier,
        state: p.state,
        county: p.county,
        premium: p.premium || 0,
        dental: p.dental || 0,
        starRating: p.star || 0,
        reason: `${p.star}-star rated with $${Math.round(p.dental || 0).toLocaleString()} dental`,
      });
    }
  }

  return result.slice(0, limit);
}

export async function getCountyAlerts(stateFilter?: string, limit = 20): Promise<CountyAlert[]> {
  const whereClause = stateFilter
    ? eq(plans.state, stateFilter.toUpperCase())
    : undefined;

  // Get county-level stats
  const countyStats = await db.select({
    county: plans.county,
    state: plans.state,
    planCount: count().as("plan_count"),
    carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    avgStar: avg(plans.overallStarRating).as("avg_star"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  const alerts: CountyAlert[] = [];

  for (const c of countyStats) {
    const pc = Number(c.planCount);
    const carriers = Number(c.carrierCount);
    const avgDent = Math.round(Number(c.avgDental) || 0);
    const otcPct = pc > 0 ? Math.round((Number(c.otcCount) / pc) * 100) : 0;
    const transportPct = pc > 0 ? Math.round((Number(c.transportCount) / pc) * 100) : 0;
    const mealPct = pc > 0 ? Math.round((Number(c.mealCount) / pc) * 100) : 0;
    const avgStarVal = Number(Number(c.avgStar || 0).toFixed(1));

    if (pc <= 5) {
      alerts.push({
        county: c.county,
        state: c.state,
        alert: "Very few plans available",
        severity: "critical",
        planCount: pc,
        detail: `Only ${pc} plan${pc !== 1 ? "s" : ""} from ${carriers} carrier${carriers !== 1 ? "s" : ""}`,
      });
    }

    if (carriers <= 1) {
      alerts.push({
        county: c.county,
        state: c.state,
        alert: "Monopoly market",
        severity: "critical",
        planCount: pc,
        detail: `Only ${carriers} carrier serves this county`,
      });
    }

    if (otcPct === 0 && pc >= 3) {
      alerts.push({
        county: c.county,
        state: c.state,
        alert: "No OTC benefits",
        severity: "warning",
        planCount: pc,
        detail: `None of the ${pc} plans offer OTC benefits`,
      });
    }

    if (avgDent < 500 && pc >= 3) {
      alerts.push({
        county: c.county,
        state: c.state,
        alert: "Low dental coverage",
        severity: "warning",
        planCount: pc,
        detail: `Avg dental only $${avgDent} across ${pc} plans`,
      });
    }

    if (avgStarVal > 0 && avgStarVal < 3.0) {
      alerts.push({
        county: c.county,
        state: c.state,
        alert: "Low quality ratings",
        severity: "warning",
        planCount: pc,
        detail: `Average star rating only ${avgStarVal} across ${pc} plans`,
      });
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts.slice(0, limit);
}

export async function getTopOpportunities(stateFilter?: string, limit = 15): Promise<TopOpportunity[]> {
  const whereClause = stateFilter
    ? eq(plans.state, stateFilter.toUpperCase())
    : undefined;

  const countyStats = await db.select({
    county: plans.county,
    state: plans.state,
    planCount: count().as("plan_count"),
    carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    fitnessCount: sql<number>`count(*) filter (where ${plans.hasFitnessBenefit} = true)`.as("fitness_count"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  const opportunities: TopOpportunity[] = [];

  for (const c of countyStats) {
    const pc = Number(c.planCount);
    if (pc < 3) continue;

    const carriers = Number(c.carrierCount);
    const otcPct = Math.round((Number(c.otcCount) / pc) * 100);
    const transportPct = Math.round((Number(c.transportCount) / pc) * 100);
    const mealPct = Math.round((Number(c.mealCount) / pc) * 100);
    const fitnessPct = Math.round((Number(c.fitnessCount) / pc) * 100);
    const avgDent = Math.round(Number(c.avgDental) || 0);

    let score = 0;
    let opportunity = "";
    let category = "";

    // Score based on gaps
    if (otcPct < 20) {
      score += 30;
      opportunity = `OTC gap: Only ${otcPct}% coverage, high demand expected`;
      category = "OTC Benefits";
    }
    if (transportPct < 15) {
      score += 25;
      if (!opportunity) {
        opportunity = `Transportation gap: Only ${transportPct}% offer transport`;
        category = "Transportation";
      }
    }
    if (mealPct < 10) {
      score += 20;
      if (!opportunity) {
        opportunity = `Meal benefit gap: Only ${mealPct}% offer meals`;
        category = "Meals";
      }
    }
    if (carriers <= 3) {
      score += 15;
      if (!opportunity) {
        opportunity = `Low competition: Only ${carriers} carriers`;
        category = "Market Entry";
      }
    }
    if (avgDent < 500) {
      score += 10;
      if (!opportunity) {
        opportunity = `Low dental: Avg $${avgDent}, room to differentiate`;
        category = "Dental";
      }
    }

    if (score > 0 && opportunity) {
      opportunities.push({
        location: c.county,
        state: c.state,
        opportunity,
        score: Math.min(100, score),
        category: category || "General",
      });
    }
  }

  opportunities.sort((a, b) => b.score - a.score);
  return opportunities.slice(0, limit);
}
