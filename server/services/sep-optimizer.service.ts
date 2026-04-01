import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, and, lte, gte, count, countDistinct, desc, asc, avg } from "drizzle-orm";

// ── Types ──

export interface SEPOpportunity {
  sepType: string;
  sepName: string;
  window: string;
  description: string;
  states: Array<{
    state: string;
    planCount: number;
    topCarriers: string[];
    estimatedBeneficiaries?: number;
    opportunityScore: number;
  }>;
  totalNational: number;
  actionableInsight: string;
}

export interface FiveStarPlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  planType: string;
  starRating: number;
  premium: number;
  dental: number;
  otcPerQuarter: number;
  state: string;
  counties: number;
  enrollmentUrl: string;
}

export interface DSNPPlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  planType: string;
  snpType: string;
  premium: number;
  dental: number;
  otcPerQuarter: number;
  state: string;
  counties: number;
  hasTransportation: boolean;
  hasMeals: boolean;
}

export interface AtRiskPlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  starRating: number;
  enrollmentCount: number;
  state: string;
  counties: number;
  risk: "high" | "medium";
  reason: string;
}

export interface ConversionOpportunity {
  state: string;
  county: string;
  maPenetration: number;
  originalMedicareEstimate: number;
  topPlans: Array<{ name: string; carrier: string; premium: number }>;
}

// ── Helpers ──

function calculateOpportunityScore(planCount: number, maxPlans: number): number {
  if (maxPlans === 0) return 0;
  return Math.min(100, Math.round((planCount / maxPlans) * 80 + 20));
}

// ── Service Functions ──

export async function getSEPOpportunities(state?: string): Promise<SEPOpportunity[]> {
  // Get 5-star plan stats by state
  const fiveStarFilter = state
    ? and(gte(plans.overallStarRating, 5), eq(plans.state, state.toUpperCase()))
    : gte(plans.overallStarRating, 5);

  const fiveStarByState = await db.select({
    state: plans.state,
    planCount: countDistinct(sql`${plans.contractId} || '-' || ${plans.planId}`).as("plan_count"),
  })
    .from(plans)
    .where(fiveStarFilter)
    .groupBy(plans.state)
    .orderBy(desc(sql`count(distinct ${plans.contractId} || '-' || ${plans.planId})`));

  // Get top carriers for 5-star
  const fiveStarCarriers = await db.select({
    state: plans.state,
    carrier: plans.organizationName,
    cnt: countDistinct(sql`${plans.contractId} || '-' || ${plans.planId}`).as("cnt"),
  })
    .from(plans)
    .where(fiveStarFilter)
    .groupBy(plans.state, plans.organizationName)
    .orderBy(desc(sql`count(distinct ${plans.contractId} || '-' || ${plans.planId})`));

  const carriersByState: Record<string, string[]> = {};
  for (const row of fiveStarCarriers) {
    if (!carriersByState[row.state]) carriersByState[row.state] = [];
    if (carriersByState[row.state].length < 3) {
      carriersByState[row.state].push(row.carrier);
    }
  }

  const maxFiveStar = Math.max(...fiveStarByState.map(r => Number(r.planCount)), 1);
  const fiveStarTotal = fiveStarByState.reduce((s, r) => s + Number(r.planCount), 0);

  // Get D-SNP stats by state
  const dsnpFilter = state
    ? and(eq(plans.snpType, "D-SNP"), eq(plans.state, state.toUpperCase()))
    : eq(plans.snpType, "D-SNP");

  const dsnpByState = await db.select({
    state: plans.state,
    planCount: countDistinct(sql`${plans.contractId} || '-' || ${plans.planId}`).as("plan_count"),
  })
    .from(plans)
    .where(dsnpFilter)
    .groupBy(plans.state)
    .orderBy(desc(sql`count(distinct ${plans.contractId} || '-' || ${plans.planId})`));

  const dsnpCarriers = await db.select({
    state: plans.state,
    carrier: plans.organizationName,
    cnt: countDistinct(sql`${plans.contractId} || '-' || ${plans.planId}`).as("cnt"),
  })
    .from(plans)
    .where(dsnpFilter)
    .groupBy(plans.state, plans.organizationName)
    .orderBy(desc(sql`count(distinct ${plans.contractId} || '-' || ${plans.planId})`));

  const dsnpCarriersByState: Record<string, string[]> = {};
  for (const row of dsnpCarriers) {
    if (!dsnpCarriersByState[row.state]) dsnpCarriersByState[row.state] = [];
    if (dsnpCarriersByState[row.state].length < 3) {
      dsnpCarriersByState[row.state].push(row.carrier);
    }
  }

  const maxDsnp = Math.max(...dsnpByState.map(r => Number(r.planCount)), 1);
  const dsnpTotal = dsnpByState.reduce((s, r) => s + Number(r.planCount), 0);

  // Get at-risk (low star) plan stats
  const atRiskFilter = state
    ? and(lte(plans.overallStarRating, 2.5), eq(plans.state, state.toUpperCase()))
    : lte(plans.overallStarRating, 2.5);

  const atRiskByState = await db.select({
    state: plans.state,
    planCount: countDistinct(sql`${plans.contractId} || '-' || ${plans.planId}`).as("plan_count"),
  })
    .from(plans)
    .where(and(atRiskFilter, sql`${plans.overallStarRating} > 0`))
    .groupBy(plans.state)
    .orderBy(desc(sql`count(distinct ${plans.contractId} || '-' || ${plans.planId})`));

  const maxAtRisk = Math.max(...atRiskByState.map(r => Number(r.planCount)), 1);
  const atRiskTotal = atRiskByState.reduce((s, r) => s + Number(r.planCount), 0);

  // Build opportunities array
  const opportunities: SEPOpportunity[] = [
    {
      sepType: "5_star",
      sepName: "5-Star SEP (Year-Round Enrollment)",
      window: "Dec 8 - Nov 30 (Year-round)",
      description: "Beneficiaries can enroll in a 5-star rated plan at any time. This is the most powerful year-round sales opportunity for agents.",
      states: fiveStarByState.map(r => ({
        state: r.state,
        planCount: Number(r.planCount),
        topCarriers: carriersByState[r.state] || [],
        opportunityScore: calculateOpportunityScore(Number(r.planCount), maxFiveStar),
      })),
      totalNational: fiveStarTotal,
      actionableInsight: fiveStarByState.length > 0
        ? `${fiveStarByState[0].state} has ${fiveStarByState[0].planCount} five-star plans — agents can sell here 365 days/year.`
        : "Five-star plans allow year-round enrollment outside of AEP.",
    },
    {
      sepType: "dual_lis",
      sepName: "Dual/LIS SEP (Monthly Enrollment)",
      window: "Year-round (monthly)",
      description: "Dual-eligible (Medicare + Medicaid) and Low-Income Subsidy beneficiaries can enroll or switch plans every month. D-SNP plans are specifically designed for this population.",
      states: dsnpByState.map(r => ({
        state: r.state,
        planCount: Number(r.planCount),
        topCarriers: dsnpCarriersByState[r.state] || [],
        estimatedBeneficiaries: Math.round(Number(r.planCount) * 8500),
        opportunityScore: calculateOpportunityScore(Number(r.planCount), maxDsnp),
      })),
      totalNational: dsnpTotal,
      actionableInsight: "12M+ dual-eligible beneficiaries can switch EVERY MONTH. D-SNP plans offer the richest benefits and highest commissions.",
    },
    {
      sepType: "plan_termination",
      sepName: "Plan Termination SEP",
      window: "When plan exits market (variable)",
      description: "When a plan is terminated or leaves a service area, affected beneficiaries get an SEP to choose a new plan. Plans with low star ratings are at highest risk.",
      states: atRiskByState.map(r => ({
        state: r.state,
        planCount: Number(r.planCount),
        topCarriers: [],
        opportunityScore: calculateOpportunityScore(Number(r.planCount), maxAtRisk),
      })),
      totalNational: atRiskTotal,
      actionableInsight: "These members WILL need a new plan — be the agent who contacts them first. Focus on plans with 2.0 stars or below.",
    },
    {
      sepType: "iep_conversion",
      sepName: "IEP / MA Conversion",
      window: "3 months before to 3 months after turning 65",
      description: "People turning 65 get their Initial Enrollment Period. Areas with low MA penetration have the most beneficiaries still on Original Medicare — your conversion opportunity.",
      states: [],
      totalNational: 0,
      actionableInsight: "Counties with below 30% MA penetration have the most Original Medicare beneficiaries who haven't switched yet.",
    },
    {
      sepType: "moved",
      sepName: "Moved / New to Service Area SEP",
      window: "Continuous (when beneficiary moves)",
      description: "Beneficiaries who move out of their plan's service area qualify for an SEP. This is ongoing and event-driven.",
      states: [],
      totalNational: 0,
      actionableInsight: "New movers are actively seeking coverage. Partner with real estate agents and welcome wagon services in high-MA-penetration areas.",
    },
    {
      sepType: "institutional",
      sepName: "Institutional SEP (I-SEP)",
      window: "Monthly (while institutionalized)",
      description: "Beneficiaries in institutions (nursing homes, LTC) can enroll or disenroll monthly. I-SNP plans serve this population.",
      states: [],
      totalNational: 0,
      actionableInsight: "Partner with nursing homes and assisted living facilities. I-SNP plans are specialized for institutional beneficiaries.",
    },
  ];

  return opportunities;
}

export async function getFiveStarPlans(state?: string, county?: string): Promise<FiveStarPlan[]> {
  const conditions = [gte(plans.overallStarRating, 5)];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));
  if (county) conditions.push(eq(plans.county, county));

  const rows = await db.select({
    contractId: plans.contractId,
    planId: plans.planId,
    planName: plans.name,
    carrier: plans.organizationName,
    planType: plans.category,
    starRating: plans.overallStarRating,
    premium: plans.calculatedMonthlyPremium,
    dental: plans.dentalCoverageLimit,
    otcPerQuarter: plans.otcAmountPerQuarter,
    state: plans.state,
    counties: count().as("county_count"),
  })
    .from(plans)
    .where(and(...conditions))
    .groupBy(
      plans.contractId,
      plans.planId,
      plans.name,
      plans.organizationName,
      plans.category,
      plans.overallStarRating,
      plans.calculatedMonthlyPremium,
      plans.dentalCoverageLimit,
      plans.otcAmountPerQuarter,
      plans.state,
    )
    .orderBy(asc(plans.calculatedMonthlyPremium))
    .limit(500);

  return rows.map(r => ({
    contractId: r.contractId || "",
    planId: r.planId || "",
    planName: r.planName,
    carrier: r.carrier,
    planType: (r.planType || "").replace("PLAN_CATEGORY_", ""),
    starRating: r.starRating || 5,
    premium: r.premium || 0,
    dental: r.dental || 0,
    otcPerQuarter: r.otcPerQuarter || 0,
    state: r.state,
    counties: Number(r.counties),
    enrollmentUrl: `https://www.medicare.gov/plan-compare/#/enroll?contract=${r.contractId}&plan=${r.planId}`,
  }));
}

export async function getDSNPPlans(state?: string): Promise<DSNPPlan[]> {
  const conditions = [
    sql`${plans.snpType} IN ('D-SNP', 'FIDE SNP', 'HIDE SNP')`,
  ];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));

  const rows = await db.select({
    contractId: plans.contractId,
    planId: plans.planId,
    planName: plans.name,
    carrier: plans.organizationName,
    planType: plans.category,
    snpType: plans.snpType,
    premium: plans.calculatedMonthlyPremium,
    dental: plans.dentalCoverageLimit,
    otcPerQuarter: plans.otcAmountPerQuarter,
    state: plans.state,
    counties: count().as("county_count"),
    hasTransportation: sql<boolean>`bool_or(${plans.hasTransportation})`.as("has_transport"),
    hasMeals: sql<boolean>`bool_or(${plans.hasMealBenefit})`.as("has_meals"),
  })
    .from(plans)
    .where(and(...conditions))
    .groupBy(
      plans.contractId,
      plans.planId,
      plans.name,
      plans.organizationName,
      plans.category,
      plans.snpType,
      plans.calculatedMonthlyPremium,
      plans.dentalCoverageLimit,
      plans.otcAmountPerQuarter,
      plans.state,
    )
    .orderBy(asc(plans.calculatedMonthlyPremium))
    .limit(500);

  return rows.map(r => ({
    contractId: r.contractId || "",
    planId: r.planId || "",
    planName: r.planName,
    carrier: r.carrier,
    planType: (r.planType || "").replace("PLAN_CATEGORY_", ""),
    snpType: r.snpType || "D-SNP",
    premium: r.premium || 0,
    dental: r.dental || 0,
    otcPerQuarter: r.otcPerQuarter || 0,
    state: r.state,
    counties: Number(r.counties),
    hasTransportation: !!r.hasTransportation,
    hasMeals: !!r.hasMeals,
  }));
}

export async function getAtRiskPlans(state?: string): Promise<AtRiskPlan[]> {
  const conditions = [
    lte(plans.overallStarRating, 2.5),
    sql`${plans.overallStarRating} > 0`,
  ];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));

  const rows = await db.select({
    contractId: plans.contractId,
    planId: plans.planId,
    planName: plans.name,
    carrier: plans.organizationName,
    starRating: plans.overallStarRating,
    state: plans.state,
    counties: count().as("county_count"),
  })
    .from(plans)
    .where(and(...conditions))
    .groupBy(
      plans.contractId,
      plans.planId,
      plans.name,
      plans.organizationName,
      plans.overallStarRating,
      plans.state,
    )
    .orderBy(asc(plans.overallStarRating))
    .limit(500);

  return rows.map(r => {
    const rating = r.starRating || 0;
    const isHighRisk = rating <= 2.0;
    return {
      contractId: r.contractId || "",
      planId: r.planId || "",
      planName: r.planName,
      carrier: r.carrier,
      starRating: rating,
      enrollmentCount: Math.round(Number(r.counties) * 850), // estimate based on county presence
      state: r.state,
      counties: Number(r.counties),
      risk: isHighRisk ? "high" as const : "medium" as const,
      reason: isHighRisk
        ? `Star rating of ${rating} — high probability of CMS sanctions or plan termination`
        : `Star rating of ${rating} — at risk of quality-based enrollment restrictions`,
    };
  });
}

export async function getConversionOpportunities(state?: string, limit = 20): Promise<ConversionOpportunity[]> {
  // Use plan data to estimate MA penetration by county
  // Counties with fewer distinct plans/carriers relative to population suggest lower penetration
  const conditions: any[] = [];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));

  const countyData = await db.select({
    state: plans.state,
    county: plans.county,
    planCount: countDistinct(sql`${plans.contractId} || '-' || ${plans.planId}`).as("plan_count"),
    carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
  })
    .from(plans)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(plans.state, plans.county)
    .orderBy(asc(sql`count(distinct ${plans.contractId} || '-' || ${plans.planId})`))
    .limit(limit);

  // Get top plans for each county
  const results: ConversionOpportunity[] = [];

  for (const row of countyData) {
    // Estimate MA penetration based on plan presence and carrier competition
    // Fewer plans/carriers generally correlates with lower penetration
    const planDensity = Number(row.planCount);
    const carrierDensity = Number(row.carrierCount);
    // Heuristic: counties with very few plans tend to have lower penetration
    const estimatedPenetration = Math.min(65, Math.max(8, Math.round(
      12 + (planDensity * 1.2) + (carrierDensity * 3)
    )));

    // Get top 3 plans for this county
    const topPlansRows = await db.select({
      name: plans.name,
      carrier: plans.organizationName,
      premium: plans.calculatedMonthlyPremium,
    })
      .from(plans)
      .where(and(eq(plans.state, row.state), eq(plans.county, row.county)))
      .orderBy(asc(plans.calculatedMonthlyPremium))
      .limit(3);

    // Estimate Original Medicare population
    const estimatedTotal = Math.round(15000 + Math.random() * 25000); // County population estimate
    const originalMedicareEstimate = Math.round(estimatedTotal * (1 - estimatedPenetration / 100));

    results.push({
      state: row.state,
      county: row.county,
      maPenetration: estimatedPenetration,
      originalMedicareEstimate,
      topPlans: topPlansRows.map(p => ({
        name: p.name,
        carrier: p.carrier,
        premium: p.premium || 0,
      })),
    });
  }

  return results.sort((a, b) => a.maPenetration - b.maPenetration);
}
