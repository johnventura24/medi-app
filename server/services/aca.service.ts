import { db } from "../db";
import { acaPlans, plans } from "@shared/schema";
import { sql, eq, and, count, avg, countDistinct, desc, ilike } from "drizzle-orm";

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
    conditions.push(eq(acaPlans.metalLevel, options.metalLevel));
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
  for (const row of premiumResult) {
    const key = row.metal?.toLowerCase();
    if (key && key in avgPremiums) {
      avgPremiums[key] = Math.round(Number(row.avgPrem) || 0);
    }
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
