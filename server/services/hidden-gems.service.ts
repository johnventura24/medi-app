import { db } from "../db";
import { plans, type Plan } from "@shared/schema";
import { sql, eq, and, count, avg, desc, countDistinct } from "drizzle-orm";

export interface HiddenGem {
  plan: {
    id: number;
    name: string;
    carrier: string;
    planType: string;
    state: string;
    county: string;
    zip: string;
    premium: number;
    dental: number;
    otcAnnual: number;
    vision: number;
    starRating: number;
    hasTransportation: boolean;
    hasMeals: boolean;
    partbGiveback: number;
  };
  gemScore: number;
  whyItsAGem: string[];
  carrierMarketShare: number;
  benefitRank: {
    dental: number;
    otc: number;
    premium: number;
    overall: number;
    totalInCounty: number;
  };
  countyAvg: {
    dental: number;
    otc: number;
    premium: number;
    vision: number;
  };
}

export interface GemSummary {
  gems: HiddenGem[];
  totalGems: number;
  countiesSearched: number;
  stateName: string;
}

export async function findHiddenGems(options: {
  state?: string;
  county?: string;
  limit?: number;
}): Promise<GemSummary> {
  const { state, county, limit = 20 } = options;

  // 1. Get county-level aggregates to determine market share and averages
  const conditions: any[] = [];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));
  if (county) conditions.push(eq(plans.county, county.toUpperCase()));

  const whereClause = conditions.length > 0
    ? sql`${sql.join(conditions, sql` and `)}`
    : undefined;

  // Get carrier market share per county
  const carrierCounty = await db.select({
    county: plans.county,
    state: plans.state,
    carrier: plans.organizationName,
    planCount: count().as("plan_count"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state, plans.organizationName);

  // Build county totals and carrier shares
  const countyTotals = new Map<string, number>();
  const carrierShares = new Map<string, Map<string, number>>();

  for (const row of carrierCounty) {
    const key = `${row.county}|${row.state}`;
    const cnt = Number(row.planCount);
    countyTotals.set(key, (countyTotals.get(key) || 0) + cnt);

    if (!carrierShares.has(key)) carrierShares.set(key, new Map());
    carrierShares.get(key)!.set(row.carrier, cnt);
  }

  // Get county averages
  const countyAvgs = await db.select({
    county: plans.county,
    state: plans.state,
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    avgOtc: avg(plans.otcAmountPerQuarter).as("avg_otc"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgVision: avg(plans.visionAllowance).as("avg_vision"),
    planCount: count().as("plan_count"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  const countyAvgMap = new Map<string, { dental: number; otc: number; premium: number; vision: number }>();
  for (const row of countyAvgs) {
    const key = `${row.county}|${row.state}`;
    countyAvgMap.set(key, {
      dental: Math.round(Number(row.avgDental) || 0),
      otc: Math.round((Number(row.avgOtc) || 0) * 4),
      premium: Math.round(Number(row.avgPremium) || 0),
      vision: Math.round(Number(row.avgVision) || 0),
    });
  }

  // 2. Get all plans for scoring
  const allPlans = await db
    .select()
    .from(plans)
    .where(whereClause)
    .limit(5000);

  // 3. Score and rank each plan within its county
  const countyPlans = new Map<string, Plan[]>();
  for (const p of allPlans) {
    const key = `${p.county}|${p.state}`;
    if (!countyPlans.has(key)) countyPlans.set(key, []);
    countyPlans.get(key)!.push(p);
  }

  const gems: HiddenGem[] = [];

  for (const [countyKey, cPlans] of Array.from(countyPlans.entries())) {
    const total = countyTotals.get(countyKey) || cPlans.length;
    const avgs = countyAvgMap.get(countyKey) || { dental: 0, otc: 0, premium: 0, vision: 0 };

    // Calculate benefit scores for all plans in this county
    const scored = cPlans.map((p) => {
      const dental = p.dentalCoverageLimit || 0;
      const otcAnnual = (p.otcAmountPerQuarter || 0) * 4;
      const vision = p.visionAllowance || 0;
      const transport = p.transportationAmountPerYear || 0;
      const premium = p.calculatedMonthlyPremium || 0;
      const giveback = (p.partbGiveback || 0) * 12;

      const benefitScore = dental + otcAnnual + vision + transport + giveback - (premium * 12);

      return { plan: p, benefitScore, dental, otcAnnual, vision, premium };
    });

    // Sort by benefit score
    scored.sort((a, b) => b.benefitScore - a.benefitScore);

    // Rank within county
    const dentalSorted = [...scored].sort((a, b) => b.dental - a.dental);
    const otcSorted = [...scored].sort((a, b) => b.otcAnnual - a.otcAnnual);
    const premiumSorted = [...scored].sort((a, b) => a.premium - b.premium);

    const top10Pct = Math.max(1, Math.ceil(scored.length * 0.1));

    for (let i = 0; i < Math.min(top10Pct, scored.length); i++) {
      const { plan: p, benefitScore, dental, otcAnnual, vision, premium } = scored[i];
      const carrier = p.organizationName;
      const carrierShareMap = carrierShares.get(countyKey);
      const carrierCount = carrierShareMap?.get(carrier) || 0;
      const marketShare = total > 0 ? carrierCount / total : 0;

      // Hidden gem criteria: top 10% benefits BUT carrier has <10% market share
      if (marketShare >= 0.10) continue;

      const dentalRank = dentalSorted.findIndex((s) => s.plan.id === p.id) + 1;
      const otcRank = otcSorted.findIndex((s) => s.plan.id === p.id) + 1;
      const premiumRank = premiumSorted.findIndex((s) => s.plan.id === p.id) + 1;

      // Generate gem score: benefit percentile * (1 - market share)
      const benefitPercentile = 1 - (i / scored.length);
      const gemScore = Math.round(benefitPercentile * (1 - marketShare) * 100);

      // Generate reasons
      const reasons: string[] = [];
      if (premium === 0) reasons.push(`$0 premium with $${dental.toLocaleString()} dental coverage`);
      else if (premium < avgs.premium) reasons.push(`$${premium}/mo premium — $${Math.round(avgs.premium - premium)} below county average`);

      if (dental > avgs.dental * 1.5) reasons.push(`$${dental.toLocaleString()} dental — ${Math.round((dental / Math.max(avgs.dental, 1)) * 100 - 100)}% above county average`);
      if (otcAnnual > 0 && otcAnnual > avgs.otc) reasons.push(`$${otcAnnual}/year OTC — highest tier in county`);
      if (vision > avgs.vision * 1.3) reasons.push(`$${vision} vision allowance — above average`);
      if (p.partbGiveback && p.partbGiveback > 0) reasons.push(`$${(p.partbGiveback * 12).toFixed(0)}/year Part B giveback`);
      if (p.hasTransportation) reasons.push("Includes transportation benefit");
      if (p.hasMealBenefit) reasons.push("Includes meal benefit");
      if (p.overallStarRating && p.overallStarRating >= 4) reasons.push(`${p.overallStarRating}-star rated plan`);

      if (reasons.length === 0) reasons.push(`Top ${Math.round((i + 1) / scored.length * 100)}% benefit score in ${p.county}`);

      gems.push({
        plan: {
          id: p.id,
          name: p.name,
          carrier,
          planType: (p.category || "").replace("PLAN_CATEGORY_", ""),
          state: p.state,
          county: p.county,
          zip: p.zipcode || "",
          premium,
          dental,
          otcAnnual,
          vision,
          starRating: p.overallStarRating || 0,
          hasTransportation: p.hasTransportation || false,
          hasMeals: p.hasMealBenefit || false,
          partbGiveback: p.partbGiveback || 0,
        },
        gemScore,
        whyItsAGem: reasons,
        carrierMarketShare: Math.round(marketShare * 1000) / 10,
        benefitRank: {
          dental: dentalRank,
          otc: otcRank,
          premium: premiumRank,
          overall: i + 1,
          totalInCounty: scored.length,
        },
        countyAvg: avgs,
      });
    }
  }

  // Sort by gem score and limit
  gems.sort((a, b) => b.gemScore - a.gemScore);

  return {
    gems: gems.slice(0, limit),
    totalGems: gems.length,
    countiesSearched: countyPlans.size,
    stateName: state || "All States",
  };
}
