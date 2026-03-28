import { db } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, desc, and } from "drizzle-orm";

// ── National chronic condition rates (from CDC estimates) ──

const NATIONAL_HEALTH_DATA: Record<string, {
  rate: number;
  label: string;
  relevantBenefits: string[];
}> = {
  diabetes: {
    rate: 0.115,
    label: "Diabetes",
    relevantBenefits: ["meals", "otc", "transportation"],
  },
  copd: {
    rate: 0.064,
    label: "COPD",
    relevantBenefits: ["transportation", "telehealth", "inHomeSupport"],
  },
  heartDisease: {
    rate: 0.118,
    label: "Heart Disease",
    relevantBenefits: ["fitness", "meals", "otc"],
  },
  depression: {
    rate: 0.082,
    label: "Depression",
    relevantBenefits: ["telehealth", "transportation"],
  },
  arthritis: {
    rate: 0.236,
    label: "Arthritis",
    relevantBenefits: ["otc", "fitness", "transportation"],
  },
  obesity: {
    rate: 0.419,
    label: "Obesity",
    relevantBenefits: ["fitness", "meals", "otc"],
  },
};

const BENEFIT_LABELS: Record<string, string> = {
  meals: "Meal Benefits",
  otc: "OTC Allowance",
  transportation: "Transportation",
  telehealth: "Telehealth",
  inHomeSupport: "In-Home Support",
  fitness: "Fitness Benefits",
};

// ── Types ──

export interface HealthGap {
  condition: string;
  conditionLabel: string;
  estimatedRate: number;
  relevantBenefit: string;
  benefitLabel: string;
  coverageRate: number;
  gapSeverity: "critical" | "moderate" | "low";
  recommendation: string;
}

export interface HealthGapAnalysis {
  county: string;
  state: string;
  stateName: string;
  planCount: number;
  gaps: HealthGap[];
  overallGapScore: number;
  topRecommendation: string;
}

// ── Service Functions ──

export async function getCountyHealthGaps(county: string, stateAbbr: string): Promise<HealthGapAnalysis | null> {
  const st = stateAbbr.toUpperCase();

  const [stats] = await db.select({
    planCount: count().as("plan_count"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    telehealthCount: sql<number>`count(*) filter (where ${plans.hasTelehealth} = true)`.as("telehealth_count"),
    fitnessCount: sql<number>`count(*) filter (where ${plans.hasFitnessBenefit} = true)`.as("fitness_count"),
    inHomeSupportCount: sql<number>`count(*) filter (where ${plans.hasInHomeSupport} = true)`.as("in_home_support_count"),
  })
    .from(plans)
    .where(and(eq(plans.county, county.toUpperCase()), eq(plans.state, st)));

  if (!stats || Number(stats.planCount) === 0) return null;

  const pc = Number(stats.planCount);
  const coverageRates: Record<string, number> = {
    otc: Math.round((Number(stats.otcCount) / pc) * 100),
    transportation: Math.round((Number(stats.transportCount) / pc) * 100),
    meals: Math.round((Number(stats.mealCount) / pc) * 100),
    telehealth: Math.round((Number(stats.telehealthCount) / pc) * 100),
    fitness: Math.round((Number(stats.fitnessCount) / pc) * 100),
    inHomeSupport: Math.round((Number(stats.inHomeSupportCount) / pc) * 100),
  };

  const gaps: HealthGap[] = [];

  for (const [condition, data] of Object.entries(NATIONAL_HEALTH_DATA)) {
    for (const benefit of data.relevantBenefits) {
      const coverageRate = coverageRates[benefit] || 0;
      const conditionRatePct = Math.round(data.rate * 100);

      // Determine gap severity
      let gapSeverity: "critical" | "moderate" | "low";
      if (coverageRate < 50 && data.rate > 0.10) {
        gapSeverity = "critical";
      } else if (coverageRate < 70 && data.rate > 0.05) {
        gapSeverity = "moderate";
      } else {
        gapSeverity = "low";
      }

      const benefitLabel = BENEFIT_LABELS[benefit] || benefit;
      const recommendation = `Add ${benefitLabel.toLowerCase()} — ${conditionRatePct}% estimated ${data.label.toLowerCase()} rate but only ${coverageRate}% of plans offer ${benefitLabel.toLowerCase()}`;

      gaps.push({
        condition,
        conditionLabel: data.label,
        estimatedRate: data.rate,
        relevantBenefit: benefit,
        benefitLabel,
        coverageRate,
        gapSeverity,
        recommendation,
      });
    }
  }

  // Sort by severity then by gap size
  const severityOrder = { critical: 0, moderate: 1, low: 2 };
  gaps.sort((a, b) => {
    const diff = severityOrder[a.gapSeverity] - severityOrder[b.gapSeverity];
    if (diff !== 0) return diff;
    return a.coverageRate - b.coverageRate; // lower coverage = bigger gap first
  });

  // Calculate overall gap score (0-100, higher = more gaps)
  const criticalCount = gaps.filter(g => g.gapSeverity === "critical").length;
  const moderateCount = gaps.filter(g => g.gapSeverity === "moderate").length;
  const overallGapScore = Math.min(100, Math.round(
    (criticalCount * 8) + (moderateCount * 3)
  ));

  const topGap = gaps[0];
  const topRecommendation = topGap
    ? `Lead with ${topGap.benefitLabel.toLowerCase()} messaging — ${Math.round(topGap.estimatedRate * 100)}% estimated ${topGap.conditionLabel.toLowerCase()} rate but only ${topGap.coverageRate}% of plans offer it`
    : "Good coverage across all health conditions";

  return {
    county: county.toUpperCase(),
    state: st,
    stateName: stateNames[st] || st,
    planCount: pc,
    gaps,
    overallGapScore,
    topRecommendation,
  };
}

export async function getStateHealthGaps(stateAbbr?: string, limit = 20): Promise<HealthGapAnalysis[]> {
  const st = stateAbbr?.toUpperCase();

  const whereClause = st ? eq(plans.state, st) : undefined;

  const countyStats = await db.select({
    county: plans.county,
    state: plans.state,
    planCount: count().as("plan_count"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
    telehealthCount: sql<number>`count(*) filter (where ${plans.hasTelehealth} = true)`.as("telehealth_count"),
    fitnessCount: sql<number>`count(*) filter (where ${plans.hasFitnessBenefit} = true)`.as("fitness_count"),
    inHomeSupportCount: sql<number>`count(*) filter (where ${plans.hasInHomeSupport} = true)`.as("in_home_support_count"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  const results: HealthGapAnalysis[] = [];

  for (const stats of countyStats) {
    const pc = Number(stats.planCount);
    if (pc < 3) continue; // Skip tiny counties

    const coverageRates: Record<string, number> = {
      otc: Math.round((Number(stats.otcCount) / pc) * 100),
      transportation: Math.round((Number(stats.transportCount) / pc) * 100),
      meals: Math.round((Number(stats.mealCount) / pc) * 100),
      telehealth: Math.round((Number(stats.telehealthCount) / pc) * 100),
      fitness: Math.round((Number(stats.fitnessCount) / pc) * 100),
      inHomeSupport: Math.round((Number(stats.inHomeSupportCount) / pc) * 100),
    };

    const gaps: HealthGap[] = [];

    for (const [condition, data] of Object.entries(NATIONAL_HEALTH_DATA)) {
      for (const benefit of data.relevantBenefits) {
        const coverageRate = coverageRates[benefit] || 0;
        const conditionRatePct = Math.round(data.rate * 100);

        let gapSeverity: "critical" | "moderate" | "low";
        if (coverageRate < 50 && data.rate > 0.10) {
          gapSeverity = "critical";
        } else if (coverageRate < 70 && data.rate > 0.05) {
          gapSeverity = "moderate";
        } else {
          gapSeverity = "low";
        }

        gaps.push({
          condition,
          conditionLabel: data.label,
          estimatedRate: data.rate,
          relevantBenefit: benefit,
          benefitLabel: BENEFIT_LABELS[benefit] || benefit,
          coverageRate,
          gapSeverity,
          recommendation: `Add ${(BENEFIT_LABELS[benefit] || benefit).toLowerCase()} — ${conditionRatePct}% have ${data.label.toLowerCase()} but only ${coverageRate}% coverage`,
        });
      }
    }

    const severityOrder = { critical: 0, moderate: 1, low: 2 };
    gaps.sort((a, b) => {
      const diff = severityOrder[a.gapSeverity] - severityOrder[b.gapSeverity];
      if (diff !== 0) return diff;
      return a.coverageRate - b.coverageRate;
    });

    const criticalCount = gaps.filter(g => g.gapSeverity === "critical").length;
    const moderateCount = gaps.filter(g => g.gapSeverity === "moderate").length;
    const overallGapScore = Math.min(100, Math.round(
      (criticalCount * 8) + (moderateCount * 3)
    ));

    const topGap = gaps[0];

    results.push({
      county: stats.county,
      state: stats.state,
      stateName: stateNames[stats.state] || stats.state,
      planCount: pc,
      gaps,
      overallGapScore,
      topRecommendation: topGap
        ? `Lead with ${topGap.benefitLabel.toLowerCase()} — ${Math.round(topGap.estimatedRate * 100)}% ${topGap.conditionLabel.toLowerCase()} rate, ${topGap.coverageRate}% coverage`
        : "Good coverage",
    });
  }

  // Sort by gap score descending
  results.sort((a, b) => b.overallGapScore - a.overallGapScore);
  return results.slice(0, limit);
}
