import { db } from "../db";
import { plans, planHistory } from "@shared/schema";
import { sql, eq, count, avg, countDistinct, desc, and, asc } from "drizzle-orm";

// ── Types ──

export interface CarrierTrendDataPoint {
  period: string;
  planCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
  enrollment: number;
  marketShare: number;
  counties: number;
}

export interface CarrierTrend {
  carrier: string;
  dataPoints: CarrierTrendDataPoint[];
  trend: "growing" | "stable" | "declining";
}

export interface BenefitTrendDataPoint {
  period: string;
  avgAmount: number;
  coverageRate: number;
  planCount: number;
}

export interface BenefitTrend {
  benefit: string;
  dataPoints: BenefitTrendDataPoint[];
  direction: "up" | "flat" | "down";
  changePercent: number;
}

export interface MarketTrendDataPoint {
  period: string;
  totalPlans: number;
  carriers: number;
  avgPremium: number;
  zeroPremiumPct: number;
  avgDental: number;
  avgStarRating: number;
}

export interface MarketTrend {
  state: string;
  dataPoints: MarketTrendDataPoint[];
}

export interface TopMover {
  carrier: string;
  metric: string;
  change: number;
  direction: "up" | "down";
}

export interface PlanHistoryEntry {
  year: string;
  changes: Record<string, { old: any; new: any }>;
}

// ── Helper: get available contract years ──

async function getAvailableYears(state?: string): Promise<string[]> {
  const conditions = state ? [eq(plans.state, state)] : [];
  const rows = await db
    .selectDistinct({ year: plans.contractYear })
    .from(plans)
    .where(conditions.length ? conditions[0] : undefined)
    .orderBy(asc(plans.contractYear));
  return rows.map((r) => r.year).filter(Boolean) as string[];
}

// ── Helper: total plans per year for market share calc ──

async function getTotalPlansByYear(state?: string): Promise<Record<string, number>> {
  const conditions = state ? [eq(plans.state, state)] : [];
  const rows = await db
    .select({
      year: plans.contractYear,
      total: count().as("total"),
    })
    .from(plans)
    .where(conditions.length ? conditions[0] : undefined)
    .groupBy(plans.contractYear);
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.year) map[r.year] = Number(r.total);
  }
  return map;
}

// ── 1. Carrier Trends ──

export async function getCarrierTrends(
  carrier: string,
  state?: string
): Promise<CarrierTrend> {
  const years = await getAvailableYears(state);
  const totals = await getTotalPlansByYear(state);

  const conditions: any[] = [
    sql`lower(${plans.organizationName}) like lower(${`%${carrier}%`})`,
  ];
  if (state) conditions.push(eq(plans.state, state));

  const rows = await db
    .select({
      year: plans.contractYear,
      planCount: count().as("plan_count"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgStarRating: avg(plans.overallStarRating).as("avg_star"),
      counties: countDistinct(plans.county).as("county_count"),
    })
    .from(plans)
    .where(and(...conditions))
    .groupBy(plans.contractYear)
    .orderBy(asc(plans.contractYear));

  const dataPoints: CarrierTrendDataPoint[] = rows.map((r) => {
    const pc = Number(r.planCount);
    const yearTotal = totals[r.year || ""] || 1;
    return {
      period: r.year || "Unknown",
      planCount: pc,
      avgDental: Math.round(Number(r.avgDental) || 0),
      avgOtc: Math.round(Number(r.avgOtc) || 0),
      avgPremium: Math.round((Number(r.avgPremium) || 0) * 100) / 100,
      avgStarRating: Math.round((Number(r.avgStarRating) || 0) * 10) / 10,
      enrollment: 0, // populated if enrollment data exists
      marketShare: Math.round((pc / yearTotal) * 10000) / 100,
      counties: Number(r.counties),
    };
  });

  // Determine trend direction
  let trend: "growing" | "stable" | "declining" = "stable";
  if (dataPoints.length >= 2) {
    const first = dataPoints[0].planCount;
    const last = dataPoints[dataPoints.length - 1].planCount;
    const pctChange = first > 0 ? ((last - first) / first) * 100 : 0;
    if (pctChange > 5) trend = "growing";
    else if (pctChange < -5) trend = "declining";
  }

  return { carrier, dataPoints, trend };
}

// ── 2. Benefit Trends ──

export async function getBenefitTrends(
  state?: string
): Promise<BenefitTrend[]> {
  const conditions = state ? [eq(plans.state, state)] : [];
  const where = conditions.length ? conditions[0] : undefined;

  // Query benefit stats grouped by year
  const rows = await db
    .select({
      year: plans.contractYear,
      totalPlans: count().as("total"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
      avgVision: avg(plans.visionAllowance).as("avg_vision"),
      avgTransportation: avg(plans.transportationAmountPerYear).as("avg_transport"),
      avgFlexCard: avg(plans.flexCardAmount).as("avg_flex"),
      avgGrocery: avg(plans.groceryAllowanceAmount).as("avg_grocery"),
      avgMeal: avg(plans.mealBenefitAmount).as("avg_meal"),
      dentalCount: sql<number>`count(*) filter (where ${plans.dentalCoverageLimit} > 0)`.as("dental_count"),
      otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      visionCount: sql<number>`count(*) filter (where ${plans.visionAllowance} > 0)`.as("vision_count"),
      transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
      flexCount: sql<number>`count(*) filter (where ${plans.flexCardAmount} > 0)`.as("flex_count"),
      groceryCount: sql<number>`count(*) filter (where ${plans.groceryAllowanceAmount} > 0)`.as("grocery_count"),
      mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    })
    .from(plans)
    .where(where)
    .groupBy(plans.contractYear)
    .orderBy(asc(plans.contractYear));

  const benefitConfigs = [
    { key: "dental", label: "Dental", avgField: "avgDental", countField: "dentalCount" },
    { key: "otc", label: "OTC Allowance", avgField: "avgOtc", countField: "otcCount" },
    { key: "vision", label: "Vision", avgField: "avgVision", countField: "visionCount" },
    { key: "transportation", label: "Transportation", avgField: "avgTransportation", countField: "transportCount" },
    { key: "flexCard", label: "Flex Card", avgField: "avgFlexCard", countField: "flexCount" },
    { key: "grocery", label: "Grocery Allowance", avgField: "avgGrocery", countField: "groceryCount" },
    { key: "meal", label: "Meal Benefit", avgField: "avgMeal", countField: "mealCount" },
  ];

  return benefitConfigs.map((cfg) => {
    const dataPoints: BenefitTrendDataPoint[] = rows.map((r) => {
      const total = Number(r.totalPlans) || 1;
      const avgVal = Number((r as any)[cfg.avgField]) || 0;
      const countVal = Number((r as any)[cfg.countField]) || 0;
      return {
        period: r.year || "Unknown",
        avgAmount: Math.round(avgVal * 100) / 100,
        coverageRate: Math.round((countVal / total) * 10000) / 100,
        planCount: countVal,
      };
    });

    // Determine direction
    let direction: "up" | "flat" | "down" = "flat";
    let changePercent = 0;
    if (dataPoints.length >= 2) {
      const first = dataPoints[0].avgAmount;
      const last = dataPoints[dataPoints.length - 1].avgAmount;
      changePercent = first > 0 ? Math.round(((last - first) / first) * 10000) / 100 : 0;
      if (changePercent > 2) direction = "up";
      else if (changePercent < -2) direction = "down";
    }

    return {
      benefit: cfg.label,
      dataPoints,
      direction,
      changePercent,
    };
  });
}

// ── 3. Market Trends ──

export async function getMarketTrends(state: string): Promise<MarketTrend> {
  const rows = await db
    .select({
      year: plans.contractYear,
      totalPlans: count().as("total_plans"),
      carriers: countDistinct(plans.organizationName).as("carriers"),
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      zeroPremiumCount: sql<number>`count(*) filter (where ${plans.calculatedMonthlyPremium} = 0 or ${plans.calculatedMonthlyPremium} is null)`.as("zero_premium"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgStarRating: avg(plans.overallStarRating).as("avg_star"),
    })
    .from(plans)
    .where(eq(plans.state, state))
    .groupBy(plans.contractYear)
    .orderBy(asc(plans.contractYear));

  const dataPoints: MarketTrendDataPoint[] = rows.map((r) => {
    const total = Number(r.totalPlans) || 1;
    const zeroPrem = Number(r.zeroPremiumCount) || 0;
    return {
      period: r.year || "Unknown",
      totalPlans: Number(r.totalPlans),
      carriers: Number(r.carriers),
      avgPremium: Math.round((Number(r.avgPremium) || 0) * 100) / 100,
      zeroPremiumPct: Math.round((zeroPrem / total) * 10000) / 100,
      avgDental: Math.round(Number(r.avgDental) || 0),
      avgStarRating: Math.round((Number(r.avgStarRating) || 0) * 10) / 10,
    };
  });

  return { state, dataPoints };
}

// ── 4. Top Movers ──
// Compares carriers by state to find those with the most variation (proxy for movement)

export async function getTopMovers(
  state?: string,
  limit: number = 10
): Promise<TopMover[]> {
  const years = await getAvailableYears(state);
  const hasMultiYear = years.length >= 2;

  const conditions = state ? [eq(plans.state, state)] : [];
  const where = conditions.length ? conditions[0] : undefined;

  if (hasMultiYear) {
    // Compare first vs last year
    const firstYear = years[0];
    const lastYear = years[years.length - 1];

    const getData = async (year: string) => {
      const conds: any[] = [eq(plans.contractYear, year)];
      if (state) conds.push(eq(plans.state, state));
      return db
        .select({
          carrier: plans.organizationName,
          planCount: count().as("plan_count"),
          avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
          avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
        })
        .from(plans)
        .where(and(...conds))
        .groupBy(plans.organizationName);
    };

    const [firstData, lastData] = await Promise.all([
      getData(firstYear),
      getData(lastYear),
    ]);

    const firstMap = new Map(firstData.map((d) => [d.carrier, d]));
    const movers: TopMover[] = [];

    for (const curr of lastData) {
      const prev = firstMap.get(curr.carrier);
      if (!prev) {
        movers.push({
          carrier: curr.carrier,
          metric: "Plans (new entrant)",
          change: Number(curr.planCount),
          direction: "up",
        });
        continue;
      }
      const planChange = Number(curr.planCount) - Number(prev.planCount);
      if (planChange !== 0) {
        movers.push({
          carrier: curr.carrier,
          metric: "Plan count",
          change: Math.abs(planChange),
          direction: planChange > 0 ? "up" : "down",
        });
      }
    }

    movers.sort((a, b) => b.change - a.change);
    return movers.slice(0, limit);
  }

  // Single year: compare carriers by how their metrics deviate from state/national averages
  const carrierData = await db
    .select({
      carrier: plans.organizationName,
      planCount: count().as("plan_count"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgStarRating: avg(plans.overallStarRating).as("avg_star"),
      counties: countDistinct(plans.county).as("county_count"),
    })
    .from(plans)
    .where(where)
    .groupBy(plans.organizationName)
    .orderBy(desc(sql`count(*)`))
    .limit(50);

  if (carrierData.length === 0) return [];

  // Calculate averages across all carriers
  const avgPlanCount =
    carrierData.reduce((s, r) => s + Number(r.planCount), 0) / carrierData.length;
  const avgDental =
    carrierData.reduce((s, r) => s + (Number(r.avgDental) || 0), 0) / carrierData.length;

  // Score carriers by how much they stand out
  const movers: TopMover[] = [];
  for (const c of carrierData) {
    const planDelta = Number(c.planCount) - avgPlanCount;
    const dentalDelta = (Number(c.avgDental) || 0) - avgDental;

    if (Math.abs(planDelta) > avgPlanCount * 0.5) {
      movers.push({
        carrier: c.carrier,
        metric: "Plan count vs avg",
        change: Math.round(Math.abs(planDelta)),
        direction: planDelta > 0 ? "up" : "down",
      });
    }
    if (Math.abs(dentalDelta) > 200) {
      movers.push({
        carrier: c.carrier,
        metric: "Dental coverage vs avg",
        change: Math.round(Math.abs(dentalDelta)),
        direction: dentalDelta > 0 ? "up" : "down",
      });
    }
  }

  movers.sort((a, b) => b.change - a.change);
  return movers.slice(0, limit);
}

// ── 5. Plan History ──

export async function getPlanHistory(
  contractId: string,
  planIdParam: string
): Promise<PlanHistoryEntry[]> {
  // First try plan_history table
  try {
    const historyRows = await db
      .select()
      .from(planHistory)
      .where(
        and(
          eq(planHistory.contractId, contractId),
          eq(planHistory.planId, planIdParam)
        )
      )
      .orderBy(asc(planHistory.contractYear));

    if (historyRows.length > 0) {
      const entries: PlanHistoryEntry[] = [];
      for (let i = 0; i < historyRows.length; i++) {
        const curr = historyRows[i].snapshotData as Record<string, any>;
        const changes: Record<string, { old: any; new: any }> = {};
        if (i > 0) {
          const prev = historyRows[i - 1].snapshotData as Record<string, any>;
          for (const key of Object.keys(curr)) {
            if (JSON.stringify(curr[key]) !== JSON.stringify(prev[key])) {
              changes[key] = { old: prev[key], new: curr[key] };
            }
          }
        }
        entries.push({
          year: String(historyRows[i].contractYear),
          changes: i === 0 ? { _baseline: { old: null, new: "Initial snapshot" } } : changes,
        });
      }
      return entries;
    }
  } catch {
    // plan_history table might not exist or be empty
  }

  // Fallback: query plans table for all years
  const planRows = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.contractId, contractId),
        eq(plans.planId, planIdParam)
      )
    )
    .orderBy(asc(plans.contractYear))
    .limit(100);

  if (planRows.length === 0) return [];

  // Deduplicate by year (pick first row per year)
  const byYear = new Map<string, typeof planRows[0]>();
  for (const row of planRows) {
    const year = row.contractYear || "Unknown";
    if (!byYear.has(year)) byYear.set(year, row);
  }

  const yearEntries = Array.from(byYear.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  );

  const keyFields = [
    "calculatedMonthlyPremium",
    "dentalCoverageLimit",
    "visionAllowance",
    "otcAmountPerQuarter",
    "flexCardAmount",
    "overallStarRating",
    "hasOtc",
    "hasTransportation",
    "hasMealBenefit",
    "hasTelehealth",
    "pcpCopayMin",
    "specialistCopayMin",
  ] as const;

  const entries: PlanHistoryEntry[] = [];
  for (let i = 0; i < yearEntries.length; i++) {
    const [year, curr] = yearEntries[i];
    const changes: Record<string, { old: any; new: any }> = {};
    if (i === 0) {
      for (const key of keyFields) {
        changes[key] = { old: null, new: (curr as any)[key] };
      }
    } else {
      const prev = yearEntries[i - 1][1];
      for (const key of keyFields) {
        const oldVal = (prev as any)[key];
        const newVal = (curr as any)[key];
        if (oldVal !== newVal) {
          changes[key] = { old: oldVal, new: newVal };
        }
      }
    }
    entries.push({ year, changes });
  }

  return entries;
}

// ── 6. State comparison (for single-year fallback) ──

export async function getStateComparison(): Promise<
  Array<{
    state: string;
    planCount: number;
    carriers: number;
    avgPremium: number;
    avgDental: number;
    avgOtc: number;
    avgStarRating: number;
    zeroPremiumPct: number;
  }>
> {
  const rows = await db
    .select({
      state: plans.state,
      planCount: count().as("plan_count"),
      carriers: countDistinct(plans.organizationName).as("carriers"),
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
      avgStarRating: avg(plans.overallStarRating).as("avg_star"),
      zeroPremium: sql<number>`count(*) filter (where ${plans.calculatedMonthlyPremium} = 0 or ${plans.calculatedMonthlyPremium} is null)`.as("zero_prem"),
    })
    .from(plans)
    .groupBy(plans.state)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => {
    const total = Number(r.planCount) || 1;
    return {
      state: r.state,
      planCount: Number(r.planCount),
      carriers: Number(r.carriers),
      avgPremium: Math.round((Number(r.avgPremium) || 0) * 100) / 100,
      avgDental: Math.round(Number(r.avgDental) || 0),
      avgOtc: Math.round(Number(r.avgOtc) || 0),
      avgStarRating: Math.round((Number(r.avgStarRating) || 0) * 10) / 10,
      zeroPremiumPct: Math.round((Number(r.zeroPremium) / total) * 10000) / 100,
    };
  });
}

// ── 7. Carrier leaderboard (top carriers by plan count) ──

export async function getCarrierLeaderboard(
  state?: string,
  limit: number = 15
): Promise<
  Array<{
    carrier: string;
    planCount: number;
    avgDental: number;
    avgOtc: number;
    avgPremium: number;
    avgStarRating: number;
    counties: number;
    marketShare: number;
    trend: "growing" | "stable" | "declining";
  }>
> {
  const conditions = state ? [eq(plans.state, state)] : [];
  const where = conditions.length ? conditions[0] : undefined;

  const rows = await db
    .select({
      carrier: plans.organizationName,
      planCount: count().as("plan_count"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgStarRating: avg(plans.overallStarRating).as("avg_star"),
      counties: countDistinct(plans.county).as("county_count"),
    })
    .from(plans)
    .where(where)
    .groupBy(plans.organizationName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  const totalPlans = rows.reduce((s, r) => s + Number(r.planCount), 0);

  return rows.map((r) => ({
    carrier: r.carrier,
    planCount: Number(r.planCount),
    avgDental: Math.round(Number(r.avgDental) || 0),
    avgOtc: Math.round(Number(r.avgOtc) || 0),
    avgPremium: Math.round((Number(r.avgPremium) || 0) * 100) / 100,
    avgStarRating: Math.round((Number(r.avgStarRating) || 0) * 10) / 10,
    counties: Number(r.counties),
    marketShare: Math.round((Number(r.planCount) / (totalPlans || 1)) * 10000) / 100,
    trend: "stable" as const, // single year = stable baseline
  }));
}
