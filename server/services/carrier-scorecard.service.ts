/**
 * Carrier Scorecard Service — Financial and market health scoring for carriers.
 * Uses existing enrollment data + plan count data to compute composite scores.
 */
import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, count, avg, countDistinct, desc, and } from "drizzle-orm";

export interface CarrierScorecard {
  carrier: string;
  overallScore: number; // 0-100 composite
  metrics: {
    marketPresence: number; // 0-100, states + counties
    planDiversity: number; // 0-100, plan types offered
    benefitGenerosity: number; // 0-100, avg benefits vs market
    qualityScore: number; // 0-100, avg star rating
    enrollmentStrength: number; // 0-100, enrollment vs plan count
    growthIndicator: number; // 0-100, plan count trend
  };
  grade: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";
  strengths: string[];
  weaknesses: string[];
  stats: {
    totalPlans: number;
    statesServed: number;
    countiesServed: number;
    avgPremium: number;
    avgDental: number;
    avgStarRating: number;
    avgMoop: number;
    planTypes: string[];
    pctWithOtc: number;
    pctWithTransportation: number;
    pctWithMeals: number;
    pctWithFitness: number;
  };
}

function scoreToGrade(score: number): CarrierScorecard["grade"] {
  if (score >= 93) return "A+";
  if (score >= 85) return "A";
  if (score >= 78) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C+";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

export async function getCarrierScorecards(options?: {
  state?: string;
}): Promise<CarrierScorecard[]> {
  // Get national/state-level averages for benchmarking
  const conditions = options?.state
    ? [eq(plans.state, options.state.toUpperCase())]
    : [];

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const nationalAvgs = await db
    .select({
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgStar: avg(plans.overallStarRating).as("avg_star"),
      totalPlans: count().as("total_plans"),
      totalCarriers: sql<number>`count(distinct ${plans.organizationName})`.as("total_carriers"),
      totalStates: sql<number>`count(distinct ${plans.state})`.as("total_states"),
      totalCounties: sql<number>`count(distinct ${plans.county} || '-' || ${plans.state})`.as("total_counties"),
    })
    .from(plans)
    .where(whereClause);

  const natl = nationalAvgs[0];
  const natlAvgPremium = Number(natl.avgPremium) || 30;
  const natlAvgDental = Number(natl.avgDental) || 500;
  const natlAvgStar = Number(natl.avgStar) || 3.5;
  const totalStates = Number(natl.totalStates) || 1;
  const totalCounties = Number(natl.totalCounties) || 1;

  // Get per-carrier stats
  const carrierStats = await db
    .select({
      carrier: plans.organizationName,
      planCount: count().as("plan_count"),
      stateCount: countDistinct(plans.state).as("state_count"),
      countyCount: sql<number>`count(distinct ${plans.county} || '-' || ${plans.state})`.as("county_count"),
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgStar: avg(plans.overallStarRating).as("avg_star"),
      avgPcp: avg(plans.pcpCopayMin).as("avg_pcp"),
      avgSpecialist: avg(plans.specialistCopayMin).as("avg_specialist"),
      otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
      mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
      fitnessCount: sql<number>`count(*) filter (where ${plans.hasFitnessBenefit} = true)`.as("fitness_count"),
      highPerformCount: sql<number>`count(*) filter (where ${plans.highPerforming} = true)`.as("high_perform_count"),
      planTypes: sql<string>`string_agg(distinct coalesce(${plans.category}, ${plans.planType}, 'Unknown'), ',')`.as("plan_types"),
    })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.organizationName)
    .orderBy(desc(sql`count(*)`));

  const scorecards: CarrierScorecard[] = carrierStats.map((c) => {
    const pc = Number(c.planCount);
    const stateCount = Number(c.stateCount);
    const countyCount = Number(c.countyCount);
    const avgPrem = Number(c.avgPremium) || 0;
    const avgDent = Number(c.avgDental) || 0;
    const avgStarR = Number(c.avgStar) || 0;
    const otcPct = pc > 0 ? (Number(c.otcCount) / pc) * 100 : 0;
    const transportPct = pc > 0 ? (Number(c.transportCount) / pc) * 100 : 0;
    const mealPct = pc > 0 ? (Number(c.mealCount) / pc) * 100 : 0;
    const fitnessPct = pc > 0 ? (Number(c.fitnessCount) / pc) * 100 : 0;
    const highPerfPct = pc > 0 ? (Number(c.highPerformCount) / pc) * 100 : 0;

    const planTypeList = (c.planTypes || "")
      .split(",")
      .map((t: string) => t.replace(/^PLAN_CATEGORY_/i, "").trim())
      .filter(Boolean);

    // Compute 6 metric scores (0-100)
    const marketPresence = clamp(
      (stateCount / totalStates) * 50 + (countyCount / totalCounties) * 50
    );

    // Plan diversity: more plan types = higher score
    const planDiversity = clamp(
      Math.min(planTypeList.length, 5) * 20
    );

    // Benefit generosity: dental, OTC, transport, meals, fitness
    const dentalScore = natlAvgDental > 0 ? (avgDent / natlAvgDental) * 25 : 0;
    const suppScore = (otcPct + transportPct + mealPct + fitnessPct) / 4;
    const benefitGenerosity = clamp(dentalScore + suppScore * 0.75);

    // Quality: star rating relative to market
    const qualityScore = clamp(
      avgStarR > 0 ? ((avgStarR / 5) * 70 + highPerfPct * 0.3) : 0
    );

    // Enrollment strength: plan count as proxy (more plans = stronger presence)
    const enrollmentStrength = clamp(
      Math.min(pc / 50, 1) * 60 + Math.min(countyCount / 100, 1) * 40
    );

    // Growth indicator: plan count relative to market
    const totalPlanCount = Number(natl.totalPlans) || 1;
    const marketSharePct = (pc / totalPlanCount) * 100;
    const growthIndicator = clamp(
      Math.min(marketSharePct * 10, 70) + (planTypeList.length > 3 ? 30 : planTypeList.length * 10)
    );

    const metrics = {
      marketPresence,
      planDiversity,
      benefitGenerosity,
      qualityScore,
      enrollmentStrength,
      growthIndicator,
    };

    // Weighted composite
    const overallScore = clamp(
      metrics.marketPresence * 0.15 +
      metrics.planDiversity * 0.10 +
      metrics.benefitGenerosity * 0.25 +
      metrics.qualityScore * 0.25 +
      metrics.enrollmentStrength * 0.15 +
      metrics.growthIndicator * 0.10
    );

    // Derive strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (metrics.qualityScore >= 70) strengths.push("High star ratings across plans");
    if (metrics.benefitGenerosity >= 70) strengths.push("Generous supplemental benefits");
    if (metrics.marketPresence >= 60) strengths.push("Strong geographic coverage");
    if (metrics.planDiversity >= 60) strengths.push("Diverse plan type offerings");
    if (otcPct >= 70) strengths.push("OTC benefits on most plans");
    if (avgPrem < natlAvgPremium * 0.8) strengths.push("Below-market premiums");
    if (fitnessPct >= 50) strengths.push("Fitness benefits widely available");

    if (metrics.qualityScore < 40) weaknesses.push("Below-average star ratings");
    if (metrics.benefitGenerosity < 40) weaknesses.push("Limited supplemental benefits");
    if (metrics.marketPresence < 30) weaknesses.push("Limited geographic reach");
    if (metrics.planDiversity < 40) weaknesses.push("Few plan type options");
    if (otcPct < 30) weaknesses.push("OTC benefits on few plans");
    if (avgPrem > natlAvgPremium * 1.3) weaknesses.push("Above-market premiums");
    if (avgDent < natlAvgDental * 0.5) weaknesses.push("Below-average dental coverage");

    // Ensure at least one strength and weakness
    if (strengths.length === 0) strengths.push(`${pc} plans in market`);
    if (weaknesses.length === 0) weaknesses.push("No significant weaknesses identified");

    return {
      carrier: c.carrier,
      overallScore,
      metrics,
      grade: scoreToGrade(overallScore),
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 4),
      stats: {
        totalPlans: pc,
        statesServed: stateCount,
        countiesServed: countyCount,
        avgPremium: Math.round(avgPrem * 100) / 100,
        avgDental: Math.round(avgDent),
        avgStarRating: Math.round(avgStarR * 10) / 10,
        avgMoop: 0,
        planTypes: planTypeList,
        pctWithOtc: Math.round(otcPct),
        pctWithTransportation: Math.round(transportPct),
        pctWithMeals: Math.round(mealPct),
        pctWithFitness: Math.round(fitnessPct),
      },
    };
  });

  // Sort by overallScore descending
  scorecards.sort((a, b) => b.overallScore - a.overallScore);

  return scorecards;
}
