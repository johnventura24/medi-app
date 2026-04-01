import { db, pool } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, avg, count, desc, and } from "drizzle-orm";

export interface BelowAveragePlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  state: string;
  counties: number;
  enrollmentCount: number;
  premiumVsAvg: number;
  dentalVsAvg: number;
  otcVsAvg: number;
  starRating: number;
  starVsAvg: number;
  underperformanceScore: number;
  betterAlternatives: Array<{ name: string; carrier: string; premium: number; dental: number; whyBetter: string }>;
  estimatedSwitchableMembers: number;
  agentPitch: string;
}

export async function getOEPRemorseTargets(
  state?: string,
  limit: number = 20
): Promise<BelowAveragePlan[]> {
  const stateFilter = state ? state.toUpperCase() : undefined;

  // 1. Get county averages: premium, dental, OTC amount, star rating
  const countyAvgQuery = stateFilter
    ? `SELECT county, state,
         AVG(calculated_monthly_premium) as avg_premium,
         AVG(dental_coverage_limit) as avg_dental,
         AVG(CASE WHEN has_otc THEN otc_amount_per_quarter ELSE 0 END) as avg_otc,
         AVG(overall_star_rating) FILTER (WHERE overall_star_rating IS NOT NULL AND overall_star_rating > 0) as avg_star
       FROM plans WHERE UPPER(state) = $1
       GROUP BY county, state`
    : `SELECT county, state,
         AVG(calculated_monthly_premium) as avg_premium,
         AVG(dental_coverage_limit) as avg_dental,
         AVG(CASE WHEN has_otc THEN otc_amount_per_quarter ELSE 0 END) as avg_otc,
         AVG(overall_star_rating) FILTER (WHERE overall_star_rating IS NOT NULL AND overall_star_rating > 0) as avg_star
       FROM plans GROUP BY county, state`;

  const avgParams = stateFilter ? [stateFilter] : [];
  let countyAvgs: any[] = [];
  try {
    const result = await pool.query(countyAvgQuery, avgParams);
    countyAvgs = result.rows;
  } catch {
    return [];
  }

  // Build county average map
  const avgMap = new Map<string, { avgPremium: number; avgDental: number; avgOtc: number; avgStar: number }>();
  for (const row of countyAvgs) {
    const key = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    avgMap.set(key, {
      avgPremium: Number(row.avg_premium) || 0,
      avgDental: Number(row.avg_dental) || 0,
      avgOtc: Number(row.avg_otc) || 0,
      avgStar: Number(row.avg_star) || 0,
    });
  }

  // 2. Get all plans grouped by contract_id + plan_id
  const planQuery = stateFilter
    ? `SELECT contract_id, plan_id, name, organization_name, state, county,
         calculated_monthly_premium, dental_coverage_limit,
         CASE WHEN has_otc THEN otc_amount_per_quarter ELSE 0 END as otc_amount,
         overall_star_rating, enrollment_status, snp_type, category
       FROM plans WHERE UPPER(state) = $1 AND category != 'PDP'
       ORDER BY contract_id, plan_id`
    : `SELECT contract_id, plan_id, name, organization_name, state, county,
         calculated_monthly_premium, dental_coverage_limit,
         CASE WHEN has_otc THEN otc_amount_per_quarter ELSE 0 END as otc_amount,
         overall_star_rating, enrollment_status, snp_type, category
       FROM plans WHERE category != 'PDP'
       ORDER BY contract_id, plan_id`;

  const planParams = stateFilter ? [stateFilter] : [];
  let planRows: any[] = [];
  try {
    const result = await pool.query(planQuery, planParams);
    planRows = result.rows;
  } catch {
    return [];
  }

  // 3. Group plans by contract_id + plan_id and compute aggregate underperformance
  interface PlanGroup {
    contractId: string;
    planId: string;
    planName: string;
    carrier: string;
    state: string;
    counties: Set<string>;
    premiumDiffs: number[];
    dentalDiffs: number[];
    otcDiffs: number[];
    starDiffs: number[];
    starRatings: number[];
    premiums: number[];
    dentals: number[];
    countyKeys: string[];
  }

  const planGroups = new Map<string, PlanGroup>();

  for (const row of planRows) {
    const groupKey = `${row.contract_id || ""}|${row.plan_id || ""}`;
    const countyKey = `${(row.county || "").toUpperCase()}|${(row.state || "").toUpperCase()}`;
    const countyAvg = avgMap.get(countyKey);

    if (!countyAvg) continue;

    if (!planGroups.has(groupKey)) {
      planGroups.set(groupKey, {
        contractId: row.contract_id || "",
        planId: row.plan_id || "",
        planName: row.name || "Unknown Plan",
        carrier: row.organization_name || "Unknown",
        state: (row.state || "").toUpperCase(),
        counties: new Set(),
        premiumDiffs: [],
        dentalDiffs: [],
        otcDiffs: [],
        starDiffs: [],
        starRatings: [],
        premiums: [],
        dentals: [],
        countyKeys: [],
      });
    }

    const group = planGroups.get(groupKey)!;
    group.counties.add(row.county || "");
    group.countyKeys.push(countyKey);

    const premium = Number(row.calculated_monthly_premium) || 0;
    const dental = Number(row.dental_coverage_limit) || 0;
    const otc = Number(row.otc_amount) || 0;
    const star = Number(row.overall_star_rating) || 0;

    // Positive premiumDiff = plan is more expensive than average
    group.premiumDiffs.push(premium - countyAvg.avgPremium);
    // Negative dentalDiff = plan has less dental than average
    group.dentalDiffs.push(dental - countyAvg.avgDental);
    // Negative otcDiff = plan has less OTC than average
    group.otcDiffs.push(otc - countyAvg.avgOtc);
    // Negative starDiff = plan has lower stars than average
    if (star > 0 && countyAvg.avgStar > 0) {
      group.starDiffs.push(star - countyAvg.avgStar);
    }
    if (star > 0) group.starRatings.push(star);
    group.premiums.push(premium);
    group.dentals.push(dental);
  }

  // 4. Score each plan group
  const scoredPlans: BelowAveragePlan[] = [];

  for (const [, group] of planGroups) {
    if (group.counties.size === 0) continue;

    const avgPremiumDiff = group.premiumDiffs.reduce((a, b) => a + b, 0) / group.premiumDiffs.length;
    const avgDentalDiff = group.dentalDiffs.reduce((a, b) => a + b, 0) / group.dentalDiffs.length;
    const avgOtcDiff = group.otcDiffs.reduce((a, b) => a + b, 0) / group.otcDiffs.length;
    const avgStarDiff = group.starDiffs.length > 0
      ? group.starDiffs.reduce((a, b) => a + b, 0) / group.starDiffs.length
      : 0;
    const avgStar = group.starRatings.length > 0
      ? group.starRatings.reduce((a, b) => a + b, 0) / group.starRatings.length
      : 0;

    // Underperformance: higher premium (+), less dental (-), less OTC (-), lower stars (-)
    // Normalize each dimension and combine
    const premiumPenalty = Math.max(0, avgPremiumDiff) / 30; // $30 over avg = 1.0
    const dentalPenalty = Math.max(0, -avgDentalDiff) / 500; // $500 less dental = 1.0
    const otcPenalty = Math.max(0, -avgOtcDiff) / 50; // $50 less OTC/quarter = 1.0
    const starPenalty = Math.max(0, -avgStarDiff) / 1.5; // 1.5 stars below avg = 1.0

    const underperformanceScore = Math.round(
      (premiumPenalty * 25 + dentalPenalty * 30 + otcPenalty * 20 + starPenalty * 25)
    );

    // Only include plans that are actually below average (score > 10)
    if (underperformanceScore <= 10) continue;

    // Estimate switchable members based on county count — rough proxy
    const estimatedSwitchableMembers = group.counties.size * Math.round(50 + underperformanceScore * 3);

    // Generate agent pitch
    const pitchParts: string[] = [];
    if (avgPremiumDiff > 5) {
      pitchParts.push(`paying $${Math.round(avgPremiumDiff)} more/month`);
    }
    if (avgDentalDiff < -100) {
      pitchParts.push(`getting $${Math.round(Math.abs(avgDentalDiff))} less in dental`);
    }
    if (avgOtcDiff < -10) {
      pitchParts.push(`missing $${Math.round(Math.abs(avgOtcDiff))}/quarter in OTC`);
    }
    if (avgStarDiff < -0.5) {
      pitchParts.push(`on a ${Math.abs(avgStarDiff).toFixed(1)}-star-lower-rated plan`);
    }

    const agentPitch = pitchParts.length > 0
      ? `Members on ${group.planName} are ${pitchParts.join(" and ")} than average in their county. During OEP (Jan-Mar), they can switch to a better plan.`
      : `${group.planName} underperforms county averages across multiple metrics. OEP is the time to offer better alternatives.`;

    scoredPlans.push({
      contractId: group.contractId,
      planId: group.planId,
      planName: group.planName,
      carrier: group.carrier,
      state: group.state,
      counties: group.counties.size,
      enrollmentCount: estimatedSwitchableMembers,
      premiumVsAvg: Math.round(avgPremiumDiff * 100) / 100,
      dentalVsAvg: Math.round(avgDentalDiff),
      otcVsAvg: Math.round(avgOtcDiff),
      starRating: Math.round(avgStar * 10) / 10,
      starVsAvg: Math.round(avgStarDiff * 10) / 10,
      underperformanceScore,
      betterAlternatives: [], // filled below
      estimatedSwitchableMembers,
      agentPitch,
    });
  }

  // Sort by estimated switchable members DESC
  scoredPlans.sort((a, b) => b.estimatedSwitchableMembers - a.estimatedSwitchableMembers);
  const topPlans = scoredPlans.slice(0, limit);

  // 5. Find better alternatives for each plan
  for (const plan of topPlans) {
    // Get counties this plan serves
    const group = planGroups.get(`${plan.contractId}|${plan.planId}`);
    if (!group || group.countyKeys.length === 0) continue;

    // Pick first county to find alternatives
    const sampleCountyKey = group.countyKeys[0];
    const [sampleCounty, sampleState] = sampleCountyKey.split("|");

    try {
      const altQuery = `SELECT DISTINCT ON (name) name, organization_name, calculated_monthly_premium, dental_coverage_limit, overall_star_rating,
          CASE WHEN has_otc THEN otc_amount_per_quarter ELSE 0 END as otc_amount
        FROM plans
        WHERE UPPER(county) = $1 AND UPPER(state) = $2
          AND (contract_id != $3 OR plan_id != $4)
          AND category != 'PDP'
        ORDER BY name, overall_star_rating DESC NULLS LAST, calculated_monthly_premium ASC
        LIMIT 20`;

      const altResult = await pool.query(altQuery, [sampleCounty, sampleState, plan.contractId, plan.planId]);

      // Score alternatives against this plan and pick top 3
      const alternatives = altResult.rows
        .map((alt: any) => {
          const altPremium = Number(alt.calculated_monthly_premium) || 0;
          const altDental = Number(alt.dental_coverage_limit) || 0;
          const altOtc = Number(alt.otc_amount) || 0;
          const altStar = Number(alt.overall_star_rating) || 0;

          const avgPlanPremium = group.premiums.reduce((a, b) => a + b, 0) / group.premiums.length;
          const avgPlanDental = group.dentals.reduce((a, b) => a + b, 0) / group.dentals.length;

          const whyParts: string[] = [];
          if (altPremium < avgPlanPremium - 5) whyParts.push(`$${Math.round(avgPlanPremium - altPremium)} less/month`);
          if (altDental > avgPlanDental + 100) whyParts.push(`$${Math.round(altDental - avgPlanDental)} more dental`);
          if (altStar > plan.starRating + 0.3) whyParts.push(`${(altStar - plan.starRating).toFixed(1)} higher stars`);
          if (altOtc > 0 && plan.otcVsAvg < 0) whyParts.push(`includes $${Math.round(altOtc)}/quarter OTC`);

          return {
            name: alt.name || "Unknown",
            carrier: alt.organization_name || "Unknown",
            premium: altPremium,
            dental: altDental,
            whyBetter: whyParts.length > 0 ? whyParts.join(", ") : "Better overall value",
            score: whyParts.length,
          };
        })
        .filter((a: any) => a.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3)
        .map(({ score, ...rest }: any) => rest);

      plan.betterAlternatives = alternatives;
    } catch {
      // Skip alternatives on error
    }
  }

  return topPlans;
}
