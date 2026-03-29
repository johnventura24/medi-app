import { db } from "../db";
import { acaPlans, plans } from "@shared/schema";
import { sql, eq, and, count, avg, countDistinct, desc, ilike, min, asc } from "drizzle-orm";

// ── Types ──

export interface ACAPlanResult {
  id: number;
  planId: string;
  planName: string;
  issuerName: string;
  metalLevel: string | null;
  planType: string | null;
  state: string;
  county: string | null;
  premiumAge27: number | null;
  premiumAge40: number | null;
  premiumAge60: number | null;
  deductibleIndividual: number | null;
  deductibleFamily: number | null;
  moopIndividual: number | null;
  moopFamily: number | null;
  ehbPct: number | null;
  hsaEligible: boolean | null;
  planYear: number | null;
}

// ── 2026 Federal Poverty Level (estimated) ──

const FPL_2026: Record<number, number> = {
  1: 15650,
  2: 21150,
  3: 26650,
  4: 32150,
  5: 37650,
  6: 43150,
  7: 48650,
  8: 54150,
};

// Premium contribution percentages by income level (ACA sliding scale)
function getExpectedContribution(fplPercent: number): number {
  if (fplPercent <= 150) return 0.00;
  if (fplPercent <= 200) return 0.02;
  if (fplPercent <= 250) return 0.04;
  if (fplPercent <= 300) return 0.06;
  if (fplPercent <= 350) return 0.075;
  if (fplPercent <= 400) return 0.085;
  return 0.085; // IRA extended subsidies above 400% FPL — capped at 8.5%
}

// Age rating curve factor (ACA 3:1 ratio, age 21 = 1.000)
function getAgeRatingFactor(age: number): number {
  if (age <= 20) return 0.635;
  if (age === 21) return 1.000;
  if (age <= 24) return 1.000 + (age - 21) * 0.017;
  if (age <= 29) return 1.051 + (age - 25) * 0.017;
  if (age <= 34) return 1.135 + (age - 30) * 0.017;
  if (age <= 39) return 1.220 + (age - 35) * 0.020;
  if (age === 40) return 1.278;
  if (age <= 44) return 1.278 + (age - 40) * 0.032;
  if (age <= 49) return 1.406 + (age - 45) * 0.037;
  if (age <= 54) return 1.591 + (age - 50) * 0.044;
  if (age <= 59) return 1.811 + (age - 55) * 0.051;
  if (age <= 63) return 2.066 + (age - 60) * 0.052;
  return 2.714; // 64+
}

export interface SubsidyCalculation {
  income: number;
  householdSize: number;
  fplPercent: number;
  state: string;
  county: string | null;
  benchmarkPremium: number;
  benchmarkPlanName: string | null;
  expectedContribution: number;
  monthlyContribution: number;
  monthlySubsidy: number;
  annualSubsidy: number;
  effectivePremiums: Array<{
    planId: string;
    planName: string;
    issuer: string;
    metalLevel: string;
    planType: string | null;
    fullPremium: number;
    afterSubsidy: number;
    monthlySavings: number;
    deductible: number | null;
    moop: number | null;
  }>;
  csrEligible: boolean;
  csrLevel: string | null;
  zeroPremiuPlansCount: number;
  under50Count: number;
}

export interface CarrierCoverageAnalysis {
  carrier: string;
  states: number;
  totalPlans: number;
  metalBreakdown: Record<string, number>;
  avgPremiums: { bronze: number; silver: number; gold: number; platinum: number };
  avgDeductible: number;
  avgMoop: number;
  valueScore: number;
  bestState: { state: string; avgPremium: number };
  worstState: { state: string; avgPremium: number };
}

export interface SubsidyMapEntry {
  state: string;
  benchmarkSilverPremium: number;
  avgBronzePremium: number;
  subsidyAt30K: number;
  subsidyAt50K: number;
  bronzeAfterSubsidyAt30K: number;
  zeroPremiumPlansAt30K: number;
  freeOrCheapCount: number;
}

export interface ACAMarketSummary {
  totalPlans: number;
  issuers: number;
  avgPremiums: { bronze: number; silver: number; gold: number; platinum: number };
  metalDistribution: Record<string, number>;
  topIssuers: Array<{ name: string; planCount: number }>;
  avgDeductible: number;
  avgMoop: number;
  planTypeDistribution: Record<string, number>;
}

export interface ACAvsMAComparison {
  acaPlans: number;
  maPlans: number;
  avgAcaPremium: number;
  avgMaPremium: number;
  avgAcaDeductible: number;
  avgMaDeductible: number;
  acaIssuers: number;
  maCarriers: number;
  insight: string;
}

// ── Search ACA Plans ──

export async function searchACAPlans(options: {
  state?: string;
  county?: string;
  metalLevel?: string;
  issuer?: string;
  planType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ plans: ACAPlanResult[]; total: number }> {
  const conditions = [];

  if (options.state) {
    conditions.push(eq(acaPlans.state, options.state.toUpperCase()));
  }
  if (options.county) {
    conditions.push(ilike(acaPlans.county, `%${options.county}%`));
  }
  if (options.metalLevel) {
    // "Bronze" filter should also match "Expanded Bronze"
    if (options.metalLevel === "Bronze") {
      conditions.push(sql`(${acaPlans.metalLevel} = 'Bronze' OR ${acaPlans.metalLevel} = 'Expanded Bronze')`);
    } else {
      conditions.push(eq(acaPlans.metalLevel, options.metalLevel));
    }
  }
  if (options.issuer) {
    conditions.push(ilike(acaPlans.issuerName, `%${options.issuer}%`));
  }
  if (options.planType) {
    conditions.push(eq(acaPlans.planType, options.planType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  const [results, totalResult] = await Promise.all([
    db
      .select()
      .from(acaPlans)
      .where(whereClause)
      .orderBy(acaPlans.premiumAge40)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(acaPlans)
      .where(whereClause),
  ]);

  return {
    plans: results as ACAPlanResult[],
    total: Number(totalResult[0]?.total) || 0,
  };
}

// ── ACA Market Summary ──

export async function getACAMarketSummary(state: string): Promise<ACAMarketSummary> {
  const stateUpper = state.toUpperCase();

  const [
    totalResult,
    issuerResult,
    metalResult,
    premiumResult,
    topIssuerResult,
    avgCostResult,
    planTypeResult,
  ] = await Promise.all([
    // Total plans (distinct plan_id in state)
    db.select({ total: count() }).from(acaPlans).where(eq(acaPlans.state, stateUpper)),

    // Distinct issuers
    db.select({ issuers: countDistinct(acaPlans.issuerName) }).from(acaPlans).where(eq(acaPlans.state, stateUpper)),

    // Metal level distribution
    db.select({
      metal: acaPlans.metalLevel,
      cnt: count(),
    }).from(acaPlans).where(eq(acaPlans.state, stateUpper)).groupBy(acaPlans.metalLevel),

    // Avg premiums by metal
    db.select({
      metal: acaPlans.metalLevel,
      avgPrem: avg(acaPlans.premiumAge40),
    }).from(acaPlans).where(eq(acaPlans.state, stateUpper)).groupBy(acaPlans.metalLevel),

    // Top issuers
    db.select({
      name: acaPlans.issuerName,
      planCount: count(),
    }).from(acaPlans).where(eq(acaPlans.state, stateUpper)).groupBy(acaPlans.issuerName).orderBy(desc(count())).limit(10),

    // Avg deductible and MOOP
    db.select({
      avgDed: avg(acaPlans.deductibleIndividual),
      avgMoop: avg(acaPlans.moopIndividual),
    }).from(acaPlans).where(eq(acaPlans.state, stateUpper)),

    // Plan type distribution
    db.select({
      planType: acaPlans.planType,
      cnt: count(),
    }).from(acaPlans).where(eq(acaPlans.state, stateUpper)).groupBy(acaPlans.planType),
  ]);

  const metalDistribution: Record<string, number> = {};
  for (const row of metalResult) {
    if (row.metal) metalDistribution[row.metal] = Number(row.cnt);
  }

  const avgPremiums: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  // Combine "Expanded Bronze" with "Bronze" for premium averages
  const bronzeSums: { total: number; count: number } = { total: 0, count: 0 };
  for (const row of premiumResult) {
    const metal = row.metal || "";
    const avgPrem = Number(row.avgPrem) || 0;
    if (metal === "Bronze" || metal === "Expanded Bronze") {
      // Weight by plan count from metalResult
      const cnt = metalResult.find(m => m.metal === metal);
      const planCount = cnt ? Number(cnt.cnt) : 1;
      bronzeSums.total += avgPrem * planCount;
      bronzeSums.count += planCount;
    } else {
      const key = metal.toLowerCase();
      if (key in avgPremiums) {
        avgPremiums[key] = Math.round(avgPrem);
      }
    }
  }
  if (bronzeSums.count > 0) {
    avgPremiums.bronze = Math.round(bronzeSums.total / bronzeSums.count);
  }

  const planTypeDistribution: Record<string, number> = {};
  for (const row of planTypeResult) {
    if (row.planType) planTypeDistribution[row.planType] = Number(row.cnt);
  }

  return {
    totalPlans: Number(totalResult[0]?.total) || 0,
    issuers: Number(issuerResult[0]?.issuers) || 0,
    avgPremiums: avgPremiums as any,
    metalDistribution,
    topIssuers: topIssuerResult.map(r => ({ name: r.name, planCount: Number(r.planCount) })),
    avgDeductible: Math.round(Number(avgCostResult[0]?.avgDed) || 0),
    avgMoop: Math.round(Number(avgCostResult[0]?.avgMoop) || 0),
    planTypeDistribution,
  };
}

// ── Compare ACA vs Medicare Advantage ──

export async function compareACAvsMA(state: string, county: string): Promise<ACAvsMAComparison> {
  const stateUpper = state.toUpperCase();

  const [acaResult, maResult] = await Promise.all([
    // ACA stats for county
    db.select({
      cnt: count(),
      avgPrem: avg(acaPlans.premiumAge40),
      avgDed: avg(acaPlans.deductibleIndividual),
      issuers: countDistinct(acaPlans.issuerName),
    }).from(acaPlans).where(
      and(
        eq(acaPlans.state, stateUpper),
        ilike(acaPlans.county, `%${county}%`),
      )
    ),

    // MA stats for county
    db.select({
      cnt: count(),
      avgPrem: avg(plans.calculatedMonthlyPremium),
      carriers: countDistinct(plans.organizationName),
    }).from(plans).where(
      and(
        eq(plans.state, stateUpper),
        ilike(plans.county, `%${county}%`),
      )
    ),
  ]);

  const acaCount = Number(acaResult[0]?.cnt) || 0;
  const maCount = Number(maResult[0]?.cnt) || 0;
  const avgAcaPrem = Math.round(Number(acaResult[0]?.avgPrem) || 0);
  const avgMaPrem = Math.round(Number(maResult[0]?.avgPrem) || 0);
  const avgAcaDed = Math.round(Number(acaResult[0]?.avgDed) || 0);
  const avgMaDed = 0; // MA plans typically have $0 deductible or variable
  const acaIssuers = Number(acaResult[0]?.issuers) || 0;
  const maCarriers = Number(maResult[0]?.carriers) || 0;

  // Generate insight
  let insight = '';
  if (acaCount > 0 && maCount > 0) {
    if (avgMaPrem < avgAcaPrem) {
      const savings = avgAcaPrem - avgMaPrem;
      insight = `Medicare Advantage plans in ${county} average $${avgMaPrem}/mo, which is $${savings}/mo less than ACA marketplace plans ($${avgAcaPrem}/mo). MA plans are available for Medicare-eligible individuals (65+ or disabled) and typically include extra benefits like dental and vision. ACA plans serve the under-65 market with broader age-band pricing.`;
    } else {
      insight = `ACA marketplace plans in ${county} average $${avgAcaPrem}/mo at age 40, while MA plans average $${avgMaPrem}/mo for Medicare-eligible individuals. ACA plans serve a younger population with higher premiums but different benefit structures. There are ${acaIssuers} ACA issuers and ${maCarriers} MA carriers competing in this market.`;
    }
  } else if (acaCount === 0) {
    insight = `No ACA marketplace data available for ${county}, ${stateUpper}. There are ${maCount} Medicare Advantage plans from ${maCarriers} carriers.`;
  } else {
    insight = `${county} has ${acaCount} ACA plans from ${acaIssuers} issuers. No Medicare Advantage data available for comparison.`;
  }

  return {
    acaPlans: acaCount,
    maPlans: maCount,
    avgAcaPremium: avgAcaPrem,
    avgMaPremium: avgMaPrem,
    avgAcaDeductible: avgAcaDed,
    avgMaDeductible: avgMaDed,
    acaIssuers,
    maCarriers,
    insight,
  };
}

// ── Get distinct states with ACA data ──

export async function getACAStates(): Promise<string[]> {
  const result = await db
    .selectDistinct({ state: acaPlans.state })
    .from(acaPlans)
    .orderBy(acaPlans.state);
  return result.map(r => r.state);
}

// ── Get distinct counties for a state ──

export async function getACACounties(state: string): Promise<string[]> {
  const result = await db
    .selectDistinct({ county: acaPlans.county })
    .from(acaPlans)
    .where(eq(acaPlans.state, state.toUpperCase()))
    .orderBy(acaPlans.county);
  return result.filter(r => r.county).map(r => r.county!);
}

// ── Subsidy Calculator ──

function adjustPremiumForAge(premAge40: number, targetAge: number): number {
  const factor40 = getAgeRatingFactor(40);
  const factorTarget = getAgeRatingFactor(targetAge);
  return Math.round((premAge40 / factor40) * factorTarget * 100) / 100;
}

export async function calculateSubsidy(options: {
  income: number;
  householdSize: number;
  age: number;
  state: string;
  county?: string;
}): Promise<SubsidyCalculation> {
  const { income, householdSize, age, state } = options;
  const county = options.county;
  const stateUpper = state.toUpperCase();

  // Calculate FPL
  const fplBase = FPL_2026[householdSize] || FPL_2026[1];
  const fplPercent = Math.round((income / fplBase) * 100);

  // Get all plans for location
  const conditions = [eq(acaPlans.state, stateUpper)];
  if (county) {
    conditions.push(ilike(acaPlans.county, `%${county}%`));
  }

  const allPlans = await db
    .select()
    .from(acaPlans)
    .where(and(...conditions));

  // Find benchmark Silver plan (2nd lowest Silver by age-adjusted premium)
  const silverPlans = allPlans
    .filter(p => p.metalLevel === "Silver" && p.premiumAge40)
    .map(p => ({
      ...p,
      ageAdjustedPremium: adjustPremiumForAge(p.premiumAge40!, age),
    }))
    .sort((a, b) => a.ageAdjustedPremium - b.ageAdjustedPremium);

  // 2nd lowest cost Silver plan (SLCSP) is the benchmark
  // If multiple plans from same issuer at same price, still count them separately
  const benchmarkPlan = silverPlans.length >= 2 ? silverPlans[1] : silverPlans[0];
  const benchmarkPremium = benchmarkPlan?.ageAdjustedPremium || 0;
  const benchmarkPlanName = benchmarkPlan?.planName || null;

  // Calculate expected contribution
  const contributionRate = getExpectedContribution(fplPercent);
  const annualContribution = contributionRate * income;
  const monthlyContribution = Math.round(annualContribution / 12 * 100) / 100;

  // Calculate subsidy
  const monthlySubsidy = Math.max(0, Math.round((benchmarkPremium - monthlyContribution) * 100) / 100);
  const annualSubsidy = Math.round(monthlySubsidy * 12 * 100) / 100;

  // Apply subsidy to all plans
  const effectivePremiums = allPlans
    .filter(p => p.premiumAge40)
    .map(p => {
      const ageAdjusted = adjustPremiumForAge(p.premiumAge40!, age);
      const afterSubsidy = Math.max(0, Math.round((ageAdjusted - monthlySubsidy) * 100) / 100);
      return {
        planId: p.planId,
        planName: p.planName,
        issuer: p.issuerName,
        metalLevel: p.metalLevel || "Unknown",
        planType: p.planType,
        fullPremium: Math.round(ageAdjusted * 100) / 100,
        afterSubsidy,
        monthlySavings: Math.round((ageAdjusted - afterSubsidy) * 100) / 100,
        deductible: p.deductibleIndividual,
        moop: p.moopIndividual,
      };
    })
    .sort((a, b) => a.afterSubsidy - b.afterSubsidy);

  // CSR eligibility (100-250% FPL on Silver plans)
  const csrEligible = fplPercent >= 100 && fplPercent <= 250;
  let csrLevel: string | null = null;
  if (csrEligible) {
    if (fplPercent <= 150) csrLevel = "94%";
    else if (fplPercent <= 200) csrLevel = "87%";
    else if (fplPercent <= 250) csrLevel = "73%";
  }

  const zeroPremiuPlansCount = effectivePremiums.filter(p => p.afterSubsidy === 0).length;
  const under50Count = effectivePremiums.filter(p => p.afterSubsidy > 0 && p.afterSubsidy <= 50).length;

  return {
    income,
    householdSize,
    fplPercent,
    state: stateUpper,
    county: county || null,
    benchmarkPremium: Math.round(benchmarkPremium * 100) / 100,
    benchmarkPlanName,
    expectedContribution: annualContribution,
    monthlyContribution,
    monthlySubsidy,
    annualSubsidy,
    effectivePremiums: effectivePremiums.slice(0, 200), // cap response size
    csrEligible,
    csrLevel,
    zeroPremiuPlansCount,
    under50Count,
  };
}

// ── Carrier Coverage Analysis ──

export async function getCarrierCoverageAnalysis(filterCarrier?: string): Promise<CarrierCoverageAnalysis[]> {
  // Get aggregate stats per carrier
  const conditions = filterCarrier ? [ilike(acaPlans.issuerName, `%${filterCarrier}%`)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const carrierStats = await db
    .select({
      carrier: acaPlans.issuerName,
      state: acaPlans.state,
      metalLevel: acaPlans.metalLevel,
      planCount: count(),
      avgPrem: avg(acaPlans.premiumAge40),
      avgDed: avg(acaPlans.deductibleIndividual),
      avgMoop: avg(acaPlans.moopIndividual),
    })
    .from(acaPlans)
    .where(whereClause)
    .groupBy(acaPlans.issuerName, acaPlans.state, acaPlans.metalLevel);

  // Aggregate into carrier-level objects
  const carrierMap = new Map<string, {
    states: Set<string>;
    totalPlans: number;
    metalBreakdown: Record<string, number>;
    metalPremSums: Record<string, { sum: number; count: number }>;
    dedSum: number;
    dedCount: number;
    moopSum: number;
    moopCount: number;
    statePremiums: Map<string, { sum: number; count: number }>;
  }>();

  for (const row of carrierStats) {
    const carrier = row.carrier;
    if (!carrierMap.has(carrier)) {
      carrierMap.set(carrier, {
        states: new Set(),
        totalPlans: 0,
        metalBreakdown: {},
        metalPremSums: {},
        dedSum: 0, dedCount: 0,
        moopSum: 0, moopCount: 0,
        statePremiums: new Map(),
      });
    }
    const c = carrierMap.get(carrier)!;
    c.states.add(row.state);
    const cnt = Number(row.planCount);
    c.totalPlans += cnt;

    const metal = row.metalLevel || "Unknown";
    c.metalBreakdown[metal] = (c.metalBreakdown[metal] || 0) + cnt;

    const avgPrem = Number(row.avgPrem) || 0;
    const metalKey = metal.toLowerCase();
    if (!c.metalPremSums[metalKey]) c.metalPremSums[metalKey] = { sum: 0, count: 0 };
    c.metalPremSums[metalKey].sum += avgPrem * cnt;
    c.metalPremSums[metalKey].count += cnt;

    const avgDed = Number(row.avgDed) || 0;
    const avgMoop = Number(row.avgMoop) || 0;
    if (avgDed > 0) { c.dedSum += avgDed * cnt; c.dedCount += cnt; }
    if (avgMoop > 0) { c.moopSum += avgMoop * cnt; c.moopCount += cnt; }

    if (!c.statePremiums.has(row.state)) c.statePremiums.set(row.state, { sum: 0, count: 0 });
    const sp = c.statePremiums.get(row.state)!;
    sp.sum += avgPrem * cnt;
    sp.count += cnt;
  }

  const results: CarrierCoverageAnalysis[] = [];
  for (const [carrier, c] of carrierMap) {
    const avgPremiums: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const metal of ["bronze", "silver", "gold", "platinum"]) {
      const ms = c.metalPremSums[metal];
      if (ms && ms.count > 0) avgPremiums[metal] = Math.round(ms.sum / ms.count);
    }

    const avgDeductible = c.dedCount > 0 ? Math.round(c.dedSum / c.dedCount) : 0;
    const avgMoop = c.moopCount > 0 ? Math.round(c.moopSum / c.moopCount) : 0;

    // Value score: lower premium + lower deductible = better (inverse)
    const silverPrem = avgPremiums.silver || avgPremiums.bronze || 500;
    const valueScore = Math.round(100 - (silverPrem / 20 + avgDeductible / 500));

    // Best/worst state
    let bestState = { state: "", avgPremium: Infinity };
    let worstState = { state: "", avgPremium: 0 };
    for (const [st, sp] of c.statePremiums) {
      const avg = sp.count > 0 ? Math.round(sp.sum / sp.count) : 0;
      if (avg > 0 && avg < bestState.avgPremium) bestState = { state: st, avgPremium: avg };
      if (avg > worstState.avgPremium) worstState = { state: st, avgPremium: avg };
    }
    if (bestState.avgPremium === Infinity) bestState = { state: "N/A", avgPremium: 0 };

    results.push({
      carrier,
      states: c.states.size,
      totalPlans: c.totalPlans,
      metalBreakdown: c.metalBreakdown,
      avgPremiums: avgPremiums as any,
      avgDeductible,
      avgMoop,
      valueScore,
      bestState,
      worstState,
    });
  }

  return results.sort((a, b) => b.valueScore - a.valueScore);
}

// ── Carrier Rankings ──

export async function getCarrierRankings(options: {
  metalLevel?: string;
  state?: string;
}): Promise<Array<{
  carrier: string;
  planCount: number;
  avgPremium: number;
  avgDeductible: number;
  avgMoop: number;
  valueScore: number;
}>> {
  const conditions = [];
  if (options.state) conditions.push(eq(acaPlans.state, options.state.toUpperCase()));
  if (options.metalLevel) conditions.push(eq(acaPlans.metalLevel, options.metalLevel));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      carrier: acaPlans.issuerName,
      planCount: count(),
      avgPremium: avg(acaPlans.premiumAge40),
      avgDeductible: avg(acaPlans.deductibleIndividual),
      avgMoop: avg(acaPlans.moopIndividual),
    })
    .from(acaPlans)
    .where(whereClause)
    .groupBy(acaPlans.issuerName)
    .orderBy(avg(acaPlans.premiumAge40));

  return rows.map(r => {
    const avgPrem = Math.round(Number(r.avgPremium) || 0);
    const avgDed = Math.round(Number(r.avgDeductible) || 0);
    return {
      carrier: r.carrier,
      planCount: Number(r.planCount),
      avgPremium: avgPrem,
      avgDeductible: avgDed,
      avgMoop: Math.round(Number(r.avgMoop) || 0),
      valueScore: Math.round(100 - (avgPrem / 20 + avgDed / 500)),
    };
  });
}

// ── Subsidy Map ──

export async function getSubsidyMap(): Promise<SubsidyMapEntry[]> {
  // Get per-state stats for Silver and Bronze plans
  const stateStats = await db
    .select({
      state: acaPlans.state,
      metalLevel: acaPlans.metalLevel,
      avgPrem: avg(acaPlans.premiumAge40),
      minPrem: min(acaPlans.premiumAge40),
      planCount: count(),
    })
    .from(acaPlans)
    .where(
      sql`${acaPlans.metalLevel} IN ('Silver', 'Bronze', 'Expanded Bronze') AND ${acaPlans.premiumAge40} IS NOT NULL`
    )
    .groupBy(acaPlans.state, acaPlans.metalLevel);

  // Get 2nd lowest Silver per state for benchmark
  // We need all Silver plans per state sorted by premium
  const silverPlans = await db
    .select({
      state: acaPlans.state,
      premiumAge40: acaPlans.premiumAge40,
      planId: acaPlans.planId,
    })
    .from(acaPlans)
    .where(
      and(
        eq(acaPlans.metalLevel, "Silver"),
        sql`${acaPlans.premiumAge40} IS NOT NULL`
      )
    )
    .orderBy(acaPlans.state, asc(acaPlans.premiumAge40));

  // Find 2nd lowest Silver per state (by distinct premium amounts)
  const stateBenchmarks = new Map<string, number>();
  const stateGrouped = new Map<string, number[]>();
  for (const sp of silverPlans) {
    if (!sp.premiumAge40) continue;
    if (!stateGrouped.has(sp.state)) stateGrouped.set(sp.state, []);
    stateGrouped.get(sp.state)!.push(sp.premiumAge40);
  }
  for (const [st, prems] of stateGrouped) {
    // Get unique premiums sorted
    const uniquePrems = [...new Set(prems)].sort((a, b) => a - b);
    stateBenchmarks.set(st, uniquePrems.length >= 2 ? uniquePrems[1] : uniquePrems[0] || 0);
  }

  // Also get all Bronze premiums per state (including Expanded Bronze)
  const bronzePlans = await db
    .select({
      state: acaPlans.state,
      premiumAge40: acaPlans.premiumAge40,
    })
    .from(acaPlans)
    .where(
      sql`(${acaPlans.metalLevel} = 'Bronze' OR ${acaPlans.metalLevel} = 'Expanded Bronze') AND ${acaPlans.premiumAge40} IS NOT NULL`
    )
    .orderBy(acaPlans.state, asc(acaPlans.premiumAge40));

  // Build state map
  const stateMap = new Map<string, {
    avgBronze: number; avgSilver: number; bronzeCount: number; silverCount: number;
    bronzePremiums: number[];
    allPremiums: number[];
  }>();

  for (const row of stateStats) {
    if (!stateMap.has(row.state)) {
      stateMap.set(row.state, {
        avgBronze: 0, avgSilver: 0, bronzeCount: 0, silverCount: 0,
        bronzePremiums: [], allPremiums: [],
      });
    }
    const sm = stateMap.get(row.state)!;
    if (row.metalLevel === "Silver") {
      sm.avgSilver = Math.round(Number(row.avgPrem) || 0);
      sm.silverCount = Number(row.planCount);
    } else if (row.metalLevel === "Bronze" || row.metalLevel === "Expanded Bronze") {
      // Accumulate bronze stats (may have both Bronze and Expanded Bronze)
      const avgP = Number(row.avgPrem) || 0;
      const cnt = Number(row.planCount);
      if (sm.bronzeCount === 0) {
        sm.avgBronze = Math.round(avgP);
        sm.bronzeCount = cnt;
      } else {
        // Weighted average
        sm.avgBronze = Math.round((sm.avgBronze * sm.bronzeCount + avgP * cnt) / (sm.bronzeCount + cnt));
        sm.bronzeCount += cnt;
      }
    }
  }

  // Add bronze premiums
  for (const bp of bronzePlans) {
    if (!bp.premiumAge40 || !stateMap.has(bp.state)) continue;
    stateMap.get(bp.state)!.bronzePremiums.push(bp.premiumAge40);
  }

  // Get all premiums per state for zero-premium counting
  const allPlansForMap = await db
    .select({
      state: acaPlans.state,
      premiumAge40: acaPlans.premiumAge40,
    })
    .from(acaPlans)
    .where(sql`${acaPlans.premiumAge40} IS NOT NULL`);

  for (const p of allPlansForMap) {
    if (!p.premiumAge40 || !stateMap.has(p.state)) continue;
    stateMap.get(p.state)!.allPremiums.push(p.premiumAge40);
  }

  // Calculate subsidies at $30K and $50K income for household of 1
  const fpl1 = FPL_2026[1];
  const fplPct30K = Math.round((30000 / fpl1) * 100);
  const fplPct50K = Math.round((50000 / fpl1) * 100);
  const contrib30K = getExpectedContribution(fplPct30K) * 30000 / 12;
  const contrib50K = getExpectedContribution(fplPct50K) * 50000 / 12;

  const results: SubsidyMapEntry[] = [];
  for (const [state, sm] of stateMap) {
    const benchmark = stateBenchmarks.get(state) || sm.avgSilver;
    if (benchmark === 0) continue;

    const subsidy30K = Math.max(0, Math.round((benchmark - contrib30K) * 100) / 100);
    const subsidy50K = Math.max(0, Math.round((benchmark - contrib50K) * 100) / 100);

    // Cheapest Bronze after subsidy at $30K
    const cheapestBronze = sm.bronzePremiums.length > 0 ? sm.bronzePremiums[0] : sm.avgBronze;
    const bronzeAfterSubsidy30K = Math.max(0, Math.round((cheapestBronze - subsidy30K) * 100) / 100);

    // Count zero-premium and cheap plans at $30K
    let zeroPremCount = 0;
    let cheapCount = 0;
    for (const prem of sm.allPremiums) {
      const afterSub = Math.max(0, prem - subsidy30K);
      if (afterSub === 0) zeroPremCount++;
      else if (afterSub <= 50) cheapCount++;
    }

    results.push({
      state,
      benchmarkSilverPremium: Math.round(benchmark * 100) / 100,
      avgBronzePremium: sm.avgBronze,
      subsidyAt30K: subsidy30K,
      subsidyAt50K: subsidy50K,
      bronzeAfterSubsidyAt30K: bronzeAfterSubsidy30K,
      zeroPremiumPlansAt30K: zeroPremCount,
      freeOrCheapCount: cheapCount,
    });
  }

  return results.sort((a, b) => b.subsidyAt30K - a.subsidyAt30K);
}
