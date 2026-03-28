import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, and, count, avg, desc } from "drizzle-orm";

// ── Types ──

export interface PlanSummary {
  id: number;
  name: string;
  carrier: string;
  planType: string;
  state: string;
  county: string;
  zip: string;
}

export interface PlanBenefits {
  premium: number;
  dental: number;
  otcQuarterly: number;
  vision: number;
  moop: number;
  drugDeductible: number;
  tier1Copay: number;
  tier2Copay: number;
  starRating: number;
  hasTransportation: boolean;
  transportationAnnual: number;
  hasMeals: boolean;
  partbGiveback: number;
}

export interface SavingsBreakdown {
  premiumSavings: number;
  dentalGain: number;
  otcGain: number;
  visionGain: number;
  drugSavings: number;
  moopSavings: number;
  givebackGain: number;
  totalValue: number;
}

export interface AlternativePlan {
  plan: PlanSummary;
  benefits: PlanBenefits;
  totalValue: number;
  breakdown: SavingsBreakdown;
}

export interface MoneyCalculation {
  currentPlan: PlanSummary & { benefits: PlanBenefits };
  bestAlternative: AlternativePlan | null;
  savings: SavingsBreakdown;
  topAlternatives: AlternativePlan[];
  countyStats: {
    avgPremium: number;
    avgDental: number;
    avgOtc: number;
    avgVision: number;
    totalPlans: number;
  };
}

function extractBenefits(r: any): PlanBenefits {
  const premium = r.calculatedMonthlyPremium || 0;
  const dental = r.dentalCoverageLimit || 0;
  const otcQuarterly = r.otcAmountPerQuarter || 0;
  const vision = r.visionAllowance || 0;
  const moopStr = r.maximumOopc || "0";
  const moopMatch = moopStr.toString().replace(/,/g, "").match(/\$?([\d.]+)/);
  const moop = moopMatch ? parseFloat(moopMatch[1]) : 0;
  const drugDeductible = r.drugDeductible || 0;
  const tier1Copay = r.tier1CopayPreferred || r.tier1CopayStandard || 0;
  const tier2Copay = r.tier2CopayPreferred || r.tier2CopayStandard || 0;
  const starRating = r.overallStarRating || 0;
  const hasTransportation = r.hasTransportation || false;
  const transportationAnnual = r.transportationAmountPerYear || 0;
  const hasMeals = r.hasMealBenefit || false;
  const partbGiveback = r.partbGiveback || 0;

  return {
    premium,
    dental,
    otcQuarterly,
    vision,
    moop,
    drugDeductible,
    tier1Copay,
    tier2Copay,
    starRating,
    hasTransportation,
    transportationAnnual,
    hasMeals,
    partbGiveback,
  };
}

function extractSummary(r: any): PlanSummary {
  return {
    id: r.id,
    name: r.name,
    carrier: r.organizationName,
    planType: (r.category || "").replace("PLAN_CATEGORY_", ""),
    state: r.state,
    county: r.county,
    zip: r.zipcode || "",
  };
}

function calculateSavings(current: PlanBenefits, alt: PlanBenefits): SavingsBreakdown {
  const premiumSavings = Math.max(0, (current.premium - alt.premium) * 12);
  const dentalGain = Math.max(0, alt.dental - current.dental);
  const otcGain = Math.max(0, (alt.otcQuarterly - current.otcQuarterly) * 4);
  const visionGain = Math.max(0, alt.vision - current.vision);

  // Drug savings estimate based on tier copay differences (12 months of generic/preferred generics)
  const tier1Diff = Math.max(0, current.tier1Copay - alt.tier1Copay) * 12;
  const tier2Diff = Math.max(0, current.tier2Copay - alt.tier2Copay) * 12;
  const deductibleDiff = Math.max(0, current.drugDeductible - alt.drugDeductible);
  const drugSavings = Math.round(tier1Diff + tier2Diff + deductibleDiff);

  const moopSavings = Math.max(0, current.moop - alt.moop);
  const givebackGain = Math.max(0, (alt.partbGiveback - current.partbGiveback) * 12);

  const totalValue = Math.round(
    premiumSavings + dentalGain + otcGain + visionGain + drugSavings + givebackGain
  );

  return {
    premiumSavings: Math.round(premiumSavings),
    dentalGain: Math.round(dentalGain),
    otcGain: Math.round(otcGain),
    visionGain: Math.round(visionGain),
    drugSavings,
    moopSavings: Math.round(moopSavings),
    givebackGain: Math.round(givebackGain),
    totalValue,
  };
}

export async function calculateMoneyOnTable(currentPlanId: number): Promise<MoneyCalculation> {
  // 1. Get the current plan
  const currentRows = await db.select().from(plans).where(eq(plans.id, currentPlanId)).limit(1);
  if (currentRows.length === 0) {
    throw new Error("Plan not found");
  }

  const current = currentRows[0];
  const currentBenefits = extractBenefits(current);
  const currentSummary = extractSummary(current);

  // 2. Find all plans in the same county + state
  const alternatives = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.county, current.county),
        eq(plans.state, current.state),
        sql`${plans.id} != ${currentPlanId}`
      )
    )
    .limit(500);

  // 3. County stats
  const statsRows = await db.select({
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
    avgVision: avg(plans.visionAllowance).as("avg_vision"),
    totalPlans: count().as("total_plans"),
  })
    .from(plans)
    .where(and(eq(plans.county, current.county), eq(plans.state, current.state)));

  const stats = statsRows[0];

  // 4. Calculate savings for each alternative
  const ranked: AlternativePlan[] = alternatives.map((alt) => {
    const altBenefits = extractBenefits(alt);
    const altSummary = extractSummary(alt);
    const breakdown = calculateSavings(currentBenefits, altBenefits);
    return {
      plan: altSummary,
      benefits: altBenefits,
      totalValue: breakdown.totalValue,
      breakdown,
    };
  });

  // 5. Sort by total value and take top 5
  ranked.sort((a, b) => b.totalValue - a.totalValue);
  const topAlternatives = ranked.slice(0, 5);

  const bestAlt = topAlternatives[0] || null;
  const bestSavings = bestAlt?.breakdown || {
    premiumSavings: 0,
    dentalGain: 0,
    otcGain: 0,
    visionGain: 0,
    drugSavings: 0,
    moopSavings: 0,
    givebackGain: 0,
    totalValue: 0,
  };

  return {
    currentPlan: { ...currentSummary, benefits: currentBenefits },
    bestAlternative: bestAlt,
    savings: bestSavings,
    topAlternatives,
    countyStats: {
      avgPremium: Math.round(Number(stats.avgPremium) || 0),
      avgDental: Math.round(Number(stats.avgDental) || 0),
      avgOtc: Math.round((Number(stats.avgOtc) || 0) * 4),
      avgVision: Math.round(Number(stats.avgVision) || 0),
      totalPlans: Number(stats.totalPlans),
    },
  };
}

export async function calculateFromManualInput(input: {
  zipCode: string;
  currentPremium: number;
  currentDental: number;
  currentOtc: number;
  currentVision: number;
}): Promise<MoneyCalculation> {
  const { zipCode, currentPremium, currentDental, currentOtc, currentVision } = input;

  // Synthesize a "current plan" from manual input
  const currentBenefits: PlanBenefits = {
    premium: currentPremium,
    dental: currentDental,
    otcQuarterly: currentOtc / 4,
    vision: currentVision,
    moop: 7550,
    drugDeductible: 0,
    tier1Copay: 10,
    tier2Copay: 25,
    starRating: 0,
    hasTransportation: false,
    transportationAnnual: 0,
    hasMeals: false,
    partbGiveback: 0,
  };

  const currentSummary: PlanSummary = {
    id: 0,
    name: "Your Current Plan",
    carrier: "Unknown",
    planType: "Unknown",
    state: "",
    county: "",
    zip: zipCode,
  };

  // Find plans in zip
  const alternatives = await db
    .select()
    .from(plans)
    .where(eq(plans.zipcode, zipCode))
    .limit(500);

  if (alternatives.length === 0) {
    // Try broader: find county from any plan with this zip, then search by county
    const zipPlans = await db.select().from(plans).where(
      sql`${plans.zipcode} LIKE ${zipCode.substring(0, 3) + '%'}`
    ).limit(1);

    if (zipPlans.length > 0) {
      const countyPlans = await db.select().from(plans).where(
        and(eq(plans.county, zipPlans[0].county), eq(plans.state, zipPlans[0].state))
      ).limit(500);
      alternatives.push(...countyPlans);
    }
  }

  // Get county/state from first result
  if (alternatives.length > 0) {
    currentSummary.county = alternatives[0].county;
    currentSummary.state = alternatives[0].state;
  }

  const ranked: AlternativePlan[] = alternatives.map((alt) => {
    const altBenefits = extractBenefits(alt);
    const altSummary = extractSummary(alt);
    const breakdown = calculateSavings(currentBenefits, altBenefits);
    return {
      plan: altSummary,
      benefits: altBenefits,
      totalValue: breakdown.totalValue,
      breakdown,
    };
  });

  ranked.sort((a, b) => b.totalValue - a.totalValue);
  const topAlternatives = ranked.slice(0, 5);
  const bestAlt = topAlternatives[0] || null;

  return {
    currentPlan: { ...currentSummary, benefits: currentBenefits },
    bestAlternative: bestAlt,
    savings: bestAlt?.breakdown || {
      premiumSavings: 0, dentalGain: 0, otcGain: 0,
      visionGain: 0, drugSavings: 0, moopSavings: 0,
      givebackGain: 0, totalValue: 0,
    },
    topAlternatives,
    countyStats: {
      avgPremium: 0, avgDental: 0, avgOtc: 0, avgVision: 0,
      totalPlans: alternatives.length,
    },
  };
}

export async function quickCheck(zip: string, premium: number, dental: number) {
  const altPlans = await db
    .select({
      premium: plans.calculatedMonthlyPremium,
      dental: plans.dentalCoverageLimit,
      otcQuarterly: plans.otcAmountPerQuarter,
      vision: plans.visionAllowance,
      partbGiveback: plans.partbGiveback,
    })
    .from(plans)
    .where(eq(plans.zipcode, zip))
    .limit(200);

  if (altPlans.length === 0) {
    return { maxSavings: 0, planCount: 0, bestPremiumSavings: 0, bestDentalGain: 0 };
  }

  let maxSavings = 0;
  let bestPremiumSavings = 0;
  let bestDentalGain = 0;

  for (const alt of altPlans) {
    const ps = Math.max(0, (premium - (alt.premium || 0)) * 12);
    const dg = Math.max(0, (alt.dental || 0) - dental);
    const otcGain = (alt.otcQuarterly || 0) * 4;
    const gb = (alt.partbGiveback || 0) * 12;
    const total = ps + dg + otcGain + gb;
    if (total > maxSavings) {
      maxSavings = total;
      bestPremiumSavings = ps;
      bestDentalGain = dg;
    }
  }

  return {
    maxSavings: Math.round(maxSavings),
    planCount: altPlans.length,
    bestPremiumSavings: Math.round(bestPremiumSavings),
    bestDentalGain: Math.round(bestDentalGain),
  };
}

export async function searchPlans(query: string, limit: number = 20) {
  const rows = await db
    .select({
      id: plans.id,
      name: plans.name,
      carrier: plans.organizationName,
      state: plans.state,
      county: plans.county,
      zip: plans.zipcode,
      premium: plans.calculatedMonthlyPremium,
      planType: plans.category,
    })
    .from(plans)
    .where(sql`LOWER(${plans.name}) LIKE ${'%' + query.toLowerCase() + '%'}`)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    carrier: r.carrier,
    state: r.state,
    county: r.county,
    zip: r.zip || "",
    premium: r.premium || 0,
    planType: (r.planType || "").replace("PLAN_CATEGORY_", ""),
  }));
}
