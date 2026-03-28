import { db, pool } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, desc, and } from "drizzle-orm";

// ── National chronic condition rates (CDC estimates) — used as FALLBACK only ──

const NATIONAL_HEALTH_DATA: Record<string, {
  rate: number;
  label: string;
  countyField: string; // column name in county_health_data table
  relevantBenefits: string[];
}> = {
  diabetes: {
    rate: 0.115,
    label: "Diabetes",
    countyField: "diabetes_rate",
    relevantBenefits: ["meals", "otc", "transportation"],
  },
  copd: {
    rate: 0.064,
    label: "COPD",
    countyField: "smoking_rate", // proxy: smoking is the leading cause of COPD
    relevantBenefits: ["transportation", "telehealth", "inHomeSupport"],
  },
  heartDisease: {
    rate: 0.118,
    label: "Heart Disease",
    countyField: "physical_inactivity_rate", // proxy: physical inactivity correlates with heart disease
    relevantBenefits: ["fitness", "meals", "otc"],
  },
  depression: {
    rate: 0.082,
    label: "Depression",
    countyField: "mental_health_days", // poor mental health days (will be converted)
    relevantBenefits: ["telehealth", "transportation"],
  },
  arthritis: {
    rate: 0.236,
    label: "Arthritis",
    countyField: "poor_health_rate", // proxy: poor/fair health correlates with arthritis
    relevantBenefits: ["otc", "fitness", "transportation"],
  },
  obesity: {
    rate: 0.419,
    label: "Obesity",
    countyField: "obesity_rate",
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

interface CountyHealthRecord {
  diabetes_rate: number | null;
  obesity_rate: number | null;
  smoking_rate: number | null;
  physical_inactivity_rate: number | null;
  poor_health_rate: number | null;
  mental_health_days: number | null;
  uninsured_rate: number | null;
  median_income: number | null;
  population_65_plus: number | null;
}

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
  dataSource?: "county" | "national"; // indicates if real county data was used
}

// ── County Health Data Lookup ──

async function getCountyHealthRecord(county: string, stateAbbr: string): Promise<CountyHealthRecord | null> {
  try {
    // Try matching by county name and state abbreviation
    const result = await pool.query(
      `SELECT diabetes_rate, obesity_rate, smoking_rate, physical_inactivity_rate,
              poor_health_rate, mental_health_days, uninsured_rate, median_income, population_65_plus
       FROM county_health_data
       WHERE UPPER(county_name) LIKE $1 AND UPPER(state) = $2
       LIMIT 1`,
      [`%${county.toUpperCase()}%`, stateAbbr.toUpperCase()]
    );
    if (result.rows.length > 0) return result.rows[0];
    return null;
  } catch {
    // Table might not exist yet — fall back silently
    return null;
  }
}

function getConditionRate(condition: string, data: typeof NATIONAL_HEALTH_DATA[string], countyHealth: CountyHealthRecord | null): number {
  if (!countyHealth) return data.rate;

  const fieldValue = (countyHealth as any)[data.countyField] as number | null;
  if (fieldValue === null || fieldValue === undefined) return data.rate;

  // mental_health_days is average days per month (0-30), convert to a rate proxy
  if (data.countyField === "mental_health_days") {
    // National avg is ~4.1 days; depression rate ~8.2%. Scale proportionally.
    return Math.min(0.5, (fieldValue / 30) * 0.6);
  }

  // All other fields are already rates (0-1 range)
  return fieldValue;
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

  // Fetch real county health data (falls back to national averages if unavailable)
  const countyHealth = await getCountyHealthRecord(county, st);

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
    const conditionRate = getConditionRate(condition, data, countyHealth);

    for (const benefit of data.relevantBenefits) {
      const coverageRate = coverageRates[benefit] || 0;
      const conditionRatePct = Math.round(conditionRate * 100);

      // Determine gap severity
      let gapSeverity: "critical" | "moderate" | "low";
      if (coverageRate < 50 && conditionRate > 0.10) {
        gapSeverity = "critical";
      } else if (coverageRate < 70 && conditionRate > 0.05) {
        gapSeverity = "moderate";
      } else {
        gapSeverity = "low";
      }

      const benefitLabel = BENEFIT_LABELS[benefit] || benefit;
      const recommendation = `Add ${benefitLabel.toLowerCase()} — ${conditionRatePct}% estimated ${data.label.toLowerCase()} rate but only ${coverageRate}% of plans offer ${benefitLabel.toLowerCase()}`;

      gaps.push({
        condition,
        conditionLabel: data.label,
        estimatedRate: conditionRate,
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
    dataSource: countyHealth ? "county" : "national",
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

  // Batch-fetch county health data for the relevant state(s)
  let countyHealthMap = new Map<string, CountyHealthRecord>();
  try {
    const healthQuery = st
      ? `SELECT county_name, state, diabetes_rate, obesity_rate, smoking_rate, physical_inactivity_rate, poor_health_rate, mental_health_days, uninsured_rate, median_income, population_65_plus FROM county_health_data WHERE UPPER(state) = $1`
      : `SELECT county_name, state, diabetes_rate, obesity_rate, smoking_rate, physical_inactivity_rate, poor_health_rate, mental_health_days, uninsured_rate, median_income, population_65_plus FROM county_health_data`;
    const healthResult = await pool.query(healthQuery, st ? [st] : []);
    for (const row of healthResult.rows) {
      const key = `${row.county_name.toUpperCase()}|${row.state.toUpperCase()}`;
      countyHealthMap.set(key, row);
    }
  } catch {
    // Table might not exist — proceed with national averages
  }

  const results: HealthGapAnalysis[] = [];

  for (const stats of countyStats) {
    const pc = Number(stats.planCount);
    if (pc < 3) continue; // Skip tiny counties

    // Look up county health data
    // The plans table stores county names in UPPER CASE, county_health_data stores them with proper case
    // We need to try matching
    let countyHealth: CountyHealthRecord | null = null;
    // Try direct match by county name + state
    const directKey = `${stats.county.toUpperCase()}|${stats.state.toUpperCase()}`;
    if (countyHealthMap.has(directKey)) {
      countyHealth = countyHealthMap.get(directKey) || null;
    } else {
      // Fuzzy match: check if any key contains the county name for this state
      countyHealthMap.forEach((val, key) => {
        if (!countyHealth && key.includes(stats.county.toUpperCase()) && key.endsWith(`|${stats.state.toUpperCase()}`)) {
          countyHealth = val;
        }
      });
    }

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
      const conditionRate = getConditionRate(condition, data, countyHealth);

      for (const benefit of data.relevantBenefits) {
        const coverageRate = coverageRates[benefit] || 0;
        const conditionRatePct = Math.round(conditionRate * 100);

        let gapSeverity: "critical" | "moderate" | "low";
        if (coverageRate < 50 && conditionRate > 0.10) {
          gapSeverity = "critical";
        } else if (coverageRate < 70 && conditionRate > 0.05) {
          gapSeverity = "moderate";
        } else {
          gapSeverity = "low";
        }

        gaps.push({
          condition,
          conditionLabel: data.label,
          estimatedRate: conditionRate,
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
      dataSource: countyHealth ? "county" : "national",
    });
  }

  // Sort by gap score descending
  results.sort((a, b) => b.overallGapScore - a.overallGapScore);
  return results.slice(0, limit);
}
