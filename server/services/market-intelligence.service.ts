import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, count, avg, countDistinct, desc, and } from "drizzle-orm";

// ── Types ──

export interface MarketOpportunity {
  county: string;
  state: string;
  planCount: number;
  carrierCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  gapScore: number;
  suggestedAngle: string;
}

export interface CompetitiveGap {
  county: string;
  state: string;
  carrierDental: number;
  avgDental: number;
  carrierOtc: number;
  avgOtc: number;
  carrierPremium: number;
  avgPremium: number;
  carrierPlanCount: number;
  opportunity: string;
}

export interface MarketingAngle {
  angle: string;
  reasoning: string;
  pctLacking: number;
  impactScore: number;
  suggestedMessaging: string;
  targetDemographic: string;
}

export interface ProspectArea {
  county: string;
  state: string;
  prospectScore: number;
  topOpportunity: string;
  competitorCount: number;
  planCount: number;
  suggestedApproach: string;
}

export interface CarrierMarketShare {
  carrier: string;
  planCount: number;
  marketShare: number;
  counties: number;
  states: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
}

export interface BenefitDistribution {
  dental: { range: string; count: number }[];
  premium: { range: string; count: number }[];
  starRating: { range: string; count: number }[];
  otc: { label: string; value: number }[];
  transportation: { label: string; value: number }[];
  meals: { label: string; value: number }[];
  copayPcp: { range: string; count: number }[];
  copaySpecialist: { range: string; count: number }[];
  copayEr: { range: string; count: number }[];
}

// ── Service Functions ──

export async function findUnderservedMarkets(options?: { state?: string; limit?: number }): Promise<MarketOpportunity[]> {
  const limit = options?.limit || 50;

  // Get national averages
  const [natAvg] = await db.select({
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    avgOtcRate: sql<number>`count(*) filter (where ${plans.hasOtc} = true)::float / nullif(count(*), 0)`.as("avg_otc_rate"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
  }).from(plans);

  const nationalAvgDental = Number(natAvg.avgDental) || 0;
  const nationalOtcRate = Number(natAvg.avgOtcRate) || 0;
  const nationalAvgPremium = Number(natAvg.avgPremium) || 0;

  // Get county-level stats
  const conditions: any[] = [];
  if (options?.state) conditions.push(eq(plans.state, options.state.toUpperCase()));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    county: plans.county,
    state: plans.state,
    planCount: count().as("plan_count"),
    carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  // Calculate area average plan count
  const avgPlanCount = rows.length > 0
    ? rows.reduce((sum, r) => sum + Number(r.planCount), 0) / rows.length
    : 0;

  const results: MarketOpportunity[] = rows.map((r) => {
    const pc = Number(r.planCount);
    const ad = Number(r.avgDental) || 0;
    const otcRate = pc > 0 ? Number(r.otcCount) / pc : 0;
    const ap = Number(r.avgPremium) || 0;
    const avgOtcDollar = Math.round(otcRate * 100);

    // Gap score: higher = more underserved
    let gapScore = 0;
    // Low plan count relative to average
    if (pc < avgPlanCount) gapScore += Math.min(30, Math.round((1 - pc / avgPlanCount) * 30));
    // Below national average dental
    if (ad < nationalAvgDental) gapScore += Math.min(25, Math.round((1 - ad / Math.max(nationalAvgDental, 1)) * 25));
    // Below national OTC rate
    if (otcRate < nationalOtcRate) gapScore += Math.min(25, Math.round((1 - otcRate / Math.max(nationalOtcRate, 0.01)) * 25));
    // Few carriers = less competition
    const cc = Number(r.carrierCount);
    if (cc <= 3) gapScore += 20;
    else if (cc <= 5) gapScore += 10;

    gapScore = Math.min(100, gapScore);

    // Suggested angle
    let suggestedAngle = "General Outreach";
    if (ad < nationalAvgDental * 0.7) suggestedAngle = "Dental Coverage Gap";
    else if (otcRate < nationalOtcRate * 0.7) suggestedAngle = "OTC Benefits";
    else if (pc < avgPlanCount * 0.5) suggestedAngle = "Limited Plan Options";
    else if (cc <= 3) suggestedAngle = "Low Competition Market";
    else if (ap > nationalAvgPremium * 1.2) suggestedAngle = "Premium Savings";

    return {
      county: r.county,
      state: r.state,
      planCount: pc,
      carrierCount: cc,
      avgDental: Math.round(ad),
      avgOtc: avgOtcDollar,
      avgPremium: Math.round(ap * 100) / 100,
      gapScore,
      suggestedAngle,
    };
  });

  results.sort((a, b) => b.gapScore - a.gapScore);
  return results.slice(0, limit);
}

export async function findCompetitiveGaps(carrier: string, state?: string): Promise<CompetitiveGap[]> {
  const conditions: any[] = [];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get county-level averages
  const countyAvgs = await db.select({
    county: plans.county,
    state: plans.state,
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    totalCount: count().as("total_count"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  const countyMap = new Map(countyAvgs.map((r) => [
    `${r.county}|${r.state}`,
    {
      avgDental: Number(r.avgDental) || 0,
      otcRate: Number(r.totalCount) > 0 ? Number(r.otcCount) / Number(r.totalCount) : 0,
      avgPremium: Number(r.avgPremium) || 0,
    },
  ]));

  // Get carrier stats per county
  const carrierConditions: any[] = [sql`lower(${plans.organizationName}) like lower(${'%' + carrier + '%'})`];
  if (state) carrierConditions.push(eq(plans.state, state.toUpperCase()));

  const carrierRows = await db.select({
    county: plans.county,
    state: plans.state,
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    totalCount: count().as("total_count"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
  })
    .from(plans)
    .where(and(...carrierConditions))
    .groupBy(plans.county, plans.state);

  const results: CompetitiveGap[] = carrierRows.map((r) => {
    const key = `${r.county}|${r.state}`;
    const countyAvg = countyMap.get(key);
    if (!countyAvg) return null;

    const carrierDental = Number(r.avgDental) || 0;
    const carrierOtcRate = Number(r.totalCount) > 0 ? Number(r.otcCount) / Number(r.totalCount) : 0;
    const carrierPremium = Number(r.avgPremium) || 0;

    // Determine opportunity
    let opportunity = "On Par";
    const dentalGap = countyAvg.avgDental - carrierDental;
    const otcGap = countyAvg.otcRate - carrierOtcRate;
    const premiumGap = carrierPremium - countyAvg.avgPremium;

    if (dentalGap > 200) opportunity = "Dental Below Average";
    else if (otcGap > 0.2) opportunity = "OTC Coverage Gap";
    else if (premiumGap > 10) opportunity = "Premium Too High";
    else if (dentalGap < -200) opportunity = "Dental Advantage";
    else if (otcGap < -0.2) opportunity = "OTC Advantage";
    else if (premiumGap < -10) opportunity = "Premium Advantage";

    return {
      county: r.county,
      state: r.state,
      carrierDental: Math.round(carrierDental),
      avgDental: Math.round(countyAvg.avgDental),
      carrierOtc: Math.round(carrierOtcRate * 100),
      avgOtc: Math.round(countyAvg.otcRate * 100),
      carrierPremium: Math.round(carrierPremium * 100) / 100,
      avgPremium: Math.round(countyAvg.avgPremium * 100) / 100,
      carrierPlanCount: Number(r.totalCount),
      opportunity,
    };
  }).filter(Boolean) as CompetitiveGap[];

  // Sort: vulnerabilities first
  results.sort((a, b) => {
    const aIsVuln = a.opportunity.includes("Below") || a.opportunity.includes("Gap") || a.opportunity.includes("Too High");
    const bIsVuln = b.opportunity.includes("Below") || b.opportunity.includes("Gap") || b.opportunity.includes("Too High");
    if (aIsVuln && !bIsVuln) return -1;
    if (!aIsVuln && bIsVuln) return 1;
    return 0;
  });

  return results;
}

export async function generateMarketingAngles(county: string, state: string): Promise<MarketingAngle[]> {
  const rows = await db.select({
    dentalCoverageLimit: plans.dentalCoverageLimit,
    hasOtc: plans.hasOtc,
    hasTransportation: plans.hasTransportation,
    hasMealBenefit: plans.hasMealBenefit,
    hasTelehealth: plans.hasTelehealth,
    hasFitnessBenefit: plans.hasFitnessBenefit,
    hasInHomeSupport: plans.hasInHomeSupport,
    calculatedMonthlyPremium: plans.calculatedMonthlyPremium,
    visionAllowance: plans.visionAllowance,
    overallStarRating: plans.overallStarRating,
    otcAmountPerQuarter: plans.otcAmountPerQuarter,
  })
    .from(plans)
    .where(and(
      sql`upper(${plans.county}) = upper(${county})`,
      eq(plans.state, state.toUpperCase()),
    ));

  if (rows.length === 0) return [];

  const total = rows.length;
  const angles: MarketingAngle[] = [];

  // Dental gap analysis
  const lowDental = rows.filter((r) => !r.dentalCoverageLimit || r.dentalCoverageLimit < 2000).length;
  const pctLowDental = Math.round((lowDental / total) * 100);
  if (pctLowDental > 40) {
    angles.push({
      angle: "Dental Coverage Gap",
      reasoning: `${pctLowDental}% of plans in ${county} County offer less than $2,000 in dental coverage, creating a significant differentiation opportunity.`,
      pctLacking: pctLowDental,
      impactScore: Math.min(95, Math.round(pctLowDental * 1.1)),
      suggestedMessaging: `Highlight dental benefits of $2,000+ in ${county} County. Emphasize comprehensive preventive and restorative dental coverage.`,
      targetDemographic: "Seniors concerned about dental costs, denture wearers, those with ongoing dental needs",
    });
  }

  // OTC gap
  const noOtc = rows.filter((r) => !r.hasOtc).length;
  const pctNoOtc = Math.round((noOtc / total) * 100);
  if (pctNoOtc > 30) {
    angles.push({
      angle: "OTC Benefits",
      reasoning: `${pctNoOtc}% of plans lack OTC benefits. This is a strong selling point for beneficiaries who regularly purchase over-the-counter items.`,
      pctLacking: pctNoOtc,
      impactScore: Math.min(90, Math.round(pctNoOtc * 1.05)),
      suggestedMessaging: `Promote quarterly OTC allowance in ${county} County. Many competing plans do not include this benefit.`,
      targetDemographic: "Cost-conscious seniors, chronic condition managers needing regular OTC supplies",
    });
  }

  // Transportation gap
  const noTransport = rows.filter((r) => !r.hasTransportation).length;
  const pctNoTransport = Math.round((noTransport / total) * 100);
  if (pctNoTransport > 50) {
    angles.push({
      angle: "Transportation Benefits",
      reasoning: `${pctNoTransport}% of plans lack transportation benefits. This is critical for rural beneficiaries and those without reliable transportation.`,
      pctLacking: pctNoTransport,
      impactScore: Math.min(85, Math.round(pctNoTransport * 0.9)),
      suggestedMessaging: `Highlight non-emergency medical transportation coverage in ${county} County. Emphasize rides to doctor appointments and pharmacies.`,
      targetDemographic: "Rural beneficiaries, non-drivers, those without reliable transportation",
    });
  }

  // Meal benefit gap
  const noMeals = rows.filter((r) => !r.hasMealBenefit).length;
  const pctNoMeals = Math.round((noMeals / total) * 100);
  if (pctNoMeals > 60) {
    angles.push({
      angle: "Meal & Grocery Benefits",
      reasoning: `${pctNoMeals}% of plans lack meal/grocery benefits. Post-hospitalization meal delivery and grocery allowances are increasingly valued.`,
      pctLacking: pctNoMeals,
      impactScore: Math.min(80, Math.round(pctNoMeals * 0.8)),
      suggestedMessaging: `Promote meal delivery and grocery allowance benefits in ${county} County. Emphasize nutritional support for recovery.`,
      targetDemographic: "Recently hospitalized, those with dietary restrictions, food-insecure seniors",
    });
  }

  // Telehealth gap
  const noTelehealth = rows.filter((r) => !r.hasTelehealth).length;
  const pctNoTelehealth = Math.round((noTelehealth / total) * 100);
  if (pctNoTelehealth > 30) {
    angles.push({
      angle: "Telehealth Access",
      reasoning: `${pctNoTelehealth}% of plans lack telehealth coverage. Virtual care access is increasingly important for convenience and rural areas.`,
      pctLacking: pctNoTelehealth,
      impactScore: Math.min(75, Math.round(pctNoTelehealth * 0.75)),
      suggestedMessaging: `Emphasize $0 or low-cost telehealth visits in ${county} County. Convenient virtual care from home.`,
      targetDemographic: "Tech-savvy seniors, rural residents, those with mobility challenges",
    });
  }

  // Premium positioning
  const premiums = rows.map((r) => r.calculatedMonthlyPremium || 0).filter((p) => p > 0);
  if (premiums.length > 0) {
    const avgPremium = premiums.reduce((a, b) => a + b, 0) / premiums.length;
    const zeroPremium = rows.filter((r) => (r.calculatedMonthlyPremium || 0) === 0).length;
    const pctNonZero = Math.round(((total - zeroPremium) / total) * 100);
    if (pctNonZero > 50) {
      angles.push({
        angle: "Zero Premium Plans",
        reasoning: `${pctNonZero}% of plans have monthly premiums. Average premium is $${avgPremium.toFixed(0)}/mo. Zero-premium plans are a strong draw.`,
        pctLacking: pctNonZero,
        impactScore: Math.min(90, Math.round(pctNonZero * 0.95)),
        suggestedMessaging: `Highlight $0 premium plan options in ${county} County. Save compared to average $${avgPremium.toFixed(0)}/month.`,
        targetDemographic: "Budget-conscious seniors, dual-eligible beneficiaries, those on fixed income",
      });
    }
  }

  // Fitness gap
  const noFitness = rows.filter((r) => !r.hasFitnessBenefit).length;
  const pctNoFitness = Math.round((noFitness / total) * 100);
  if (pctNoFitness > 40) {
    angles.push({
      angle: "Fitness & Wellness",
      reasoning: `${pctNoFitness}% of plans lack fitness benefits like SilverSneakers. Wellness programs are a growing differentiator.`,
      pctLacking: pctNoFitness,
      impactScore: Math.min(70, Math.round(pctNoFitness * 0.7)),
      suggestedMessaging: `Promote gym membership and fitness programs in ${county} County. Active lifestyle support for healthier aging.`,
      targetDemographic: "Active seniors, those looking to maintain mobility, social seniors",
    });
  }

  angles.sort((a, b) => b.impactScore - a.impactScore);
  return angles;
}

export async function findAgentProspects(options: {
  carrier?: string;
  state?: string;
  limit?: number;
}): Promise<ProspectArea[]> {
  const limit = options.limit || 50;
  const conditions: any[] = [];
  if (options.state) conditions.push(eq(plans.state, options.state.toUpperCase()));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countyRows = await db.select({
    county: plans.county,
    state: plans.state,
    planCount: count().as("plan_count"),
    carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgStar: avg(plans.overallStarRating).as("avg_star"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.county, plans.state);

  // If carrier specified, find where they are/aren't
  let carrierCounties = new Set<string>();
  if (options.carrier) {
    const carrierRows = await db.select({
      county: plans.county,
      state: plans.state,
    })
      .from(plans)
      .where(sql`lower(${plans.organizationName}) like lower(${'%' + options.carrier + '%'})`)
      .groupBy(plans.county, plans.state);
    carrierCounties = new Set(carrierRows.map((r) => `${r.county}|${r.state}`));
  }

  // National averages for scoring
  const totalRows = countyRows.length;
  const avgPlanCount = totalRows > 0 ? countyRows.reduce((s, r) => s + Number(r.planCount), 0) / totalRows : 0;

  const results: ProspectArea[] = countyRows.map((r) => {
    const pc = Number(r.planCount);
    const cc = Number(r.carrierCount);
    const ad = Number(r.avgDental) || 0;
    const otcRate = pc > 0 ? Number(r.otcCount) / pc : 0;
    const transportRate = pc > 0 ? Number(r.transportCount) / pc : 0;

    // Prospect score factors
    let score = 50;

    // More plans = more beneficiaries (opportunity)
    if (pc > avgPlanCount) score += Math.min(15, Math.round((pc / avgPlanCount - 1) * 10));

    // Benefit gaps = differentiation opportunity
    if (ad < 1000) score += 10;
    if (otcRate < 0.5) score += 10;
    if (transportRate < 0.3) score += 5;

    // Low competition is good for agents
    if (cc <= 3) score += 15;
    else if (cc <= 5) score += 10;
    else if (cc <= 8) score += 5;

    // Carrier presence bonus/penalty
    if (options.carrier) {
      const key = `${r.county}|${r.state}`;
      if (carrierCounties.has(key)) score += 5; // already present
      else score -= 5; // not present
    }

    score = Math.min(100, Math.max(0, score));

    // Top opportunity
    let topOpp = "Market Expansion";
    if (ad < 1000) topOpp = "Dental Coverage Gap";
    else if (otcRate < 0.3) topOpp = "OTC Benefits Opportunity";
    else if (transportRate < 0.2) topOpp = "Transportation Gap";
    else if (cc <= 3) topOpp = "Low Competition Market";

    // Suggested approach
    let approach = "General enrollment event";
    if (cc <= 3) approach = "Host educational seminars - limited carrier presence means high receptivity";
    else if (ad < 1000) approach = "Lead with dental benefits comparison - strong differentiation opportunity";
    else if (otcRate < 0.3) approach = "Emphasize OTC and supplemental benefits in community outreach";
    else if (pc > avgPlanCount * 1.5) approach = "Focus on plan comparison assistance - beneficiaries overwhelmed by choices";

    return {
      county: r.county,
      state: r.state,
      prospectScore: score,
      topOpportunity: topOpp,
      competitorCount: cc,
      planCount: pc,
      suggestedApproach: approach,
    };
  });

  results.sort((a, b) => b.prospectScore - a.prospectScore);
  return results.slice(0, limit);
}

export async function getCarrierMarketShare(state?: string): Promise<CarrierMarketShare[]> {
  const conditions: any[] = [];
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Use enrollment_count for real market share when available, fall back to plan count
  const totalResult = await db.select({
    total: count(),
    totalEnrollment: sql<number>`coalesce(sum(enrollment_count), 0)`.as("total_enrollment"),
  }).from(plans).where(whereClause);
  const totalPlans = Number(totalResult[0]?.total || 1);
  const totalEnrollment = Number(totalResult[0]?.totalEnrollment || 0);
  const useEnrollment = totalEnrollment > 0;

  const rows = await db.select({
    org: plans.organizationName,
    planCount: count().as("plan_count"),
    countyCount: countDistinct(plans.county).as("county_count"),
    stateCount: countDistinct(plans.state).as("state_count"),
    avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
    otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
    avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
    avgStar: avg(plans.overallStarRating).as("avg_star"),
    totalEnrollment: sql<number>`coalesce(sum(enrollment_count), 0)`.as("total_enrollment"),
  })
    .from(plans)
    .where(whereClause)
    .groupBy(plans.organizationName)
    .orderBy(useEnrollment ? desc(sql`coalesce(sum(enrollment_count), 0)`) : desc(sql`count(*)`))
    .limit(30);

  return rows.map((r) => {
    const pc = Number(r.planCount);
    const enrollment = Number(r.totalEnrollment) || 0;
    // Use real enrollment for market share when available, otherwise fall back to plan count
    const marketShare = useEnrollment && enrollment > 0
      ? Math.round((enrollment / totalEnrollment) * 10000) / 100
      : Math.round((pc / totalPlans) * 10000) / 100;

    return {
      carrier: r.org,
      planCount: pc,
      marketShare,
      counties: Number(r.countyCount),
      states: Number(r.stateCount),
      avgDental: Math.round(Number(r.avgDental) || 0),
      avgOtc: pc > 0 ? Math.round((Number(r.otcCount) / pc) * 100) : 0,
      avgPremium: Math.round((Number(r.avgPremium) || 0) * 100) / 100,
      avgStarRating: Math.round((Number(r.avgStar) || 0) * 10) / 10,
    };
  });
}

export async function getBenefitDistribution(county?: string, state?: string): Promise<BenefitDistribution> {
  const conditions: any[] = [];
  if (county) conditions.push(sql`upper(${plans.county}) = upper(${county})`);
  if (state) conditions.push(eq(plans.state, state.toUpperCase()));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    dentalCoverageLimit: plans.dentalCoverageLimit,
    calculatedMonthlyPremium: plans.calculatedMonthlyPremium,
    overallStarRating: plans.overallStarRating,
    hasOtc: plans.hasOtc,
    hasTransportation: plans.hasTransportation,
    hasMealBenefit: plans.hasMealBenefit,
    pcpCopayMin: plans.pcpCopayMin,
    specialistCopayMin: plans.specialistCopayMin,
    emergencyCopay: plans.emergencyCopay,
  })
    .from(plans)
    .where(whereClause)
    .limit(10000);

  // Dental distribution
  const dentalBuckets = [
    { range: "$0", min: -1, max: 0.01 },
    { range: "$1-$500", min: 0.01, max: 500 },
    { range: "$500-$1K", min: 500, max: 1000 },
    { range: "$1K-$2K", min: 1000, max: 2000 },
    { range: "$2K-$3K", min: 2000, max: 3000 },
    { range: "$3K-$5K", min: 3000, max: 5000 },
    { range: "$5K+", min: 5000, max: 999999 },
  ];
  const dental = dentalBuckets.map((b) => ({
    range: b.range,
    count: rows.filter((r) => {
      const v = r.dentalCoverageLimit ?? 0;
      return v >= b.min && v < b.max;
    }).length,
  }));

  // Premium distribution
  const premiumBuckets = [
    { range: "$0", min: -1, max: 0.01 },
    { range: "$1-$25", min: 0.01, max: 25 },
    { range: "$25-$50", min: 25, max: 50 },
    { range: "$50-$100", min: 50, max: 100 },
    { range: "$100-$150", min: 100, max: 150 },
    { range: "$150-$200", min: 150, max: 200 },
    { range: "$200+", min: 200, max: 999999 },
  ];
  const premium = premiumBuckets.map((b) => ({
    range: b.range,
    count: rows.filter((r) => {
      const v = r.calculatedMonthlyPremium ?? 0;
      return v >= b.min && v < b.max;
    }).length,
  }));

  // Star rating distribution
  const starBuckets = [
    { range: "1 Star", min: 0, max: 1.5 },
    { range: "2 Stars", min: 1.5, max: 2.5 },
    { range: "3 Stars", min: 2.5, max: 3.5 },
    { range: "4 Stars", min: 3.5, max: 4.5 },
    { range: "5 Stars", min: 4.5, max: 6 },
    { range: "Not Rated", min: -1, max: 0 },
  ];
  const starRating = starBuckets.map((b) => ({
    range: b.range,
    count: rows.filter((r) => {
      const v = r.overallStarRating ?? -0.5;
      return v >= b.min && v < b.max;
    }).length,
  }));

  // Boolean benefits
  const otcYes = rows.filter((r) => r.hasOtc).length;
  const otc = [
    { label: "Has OTC", value: otcYes },
    { label: "No OTC", value: rows.length - otcYes },
  ];

  const transYes = rows.filter((r) => r.hasTransportation).length;
  const transportation = [
    { label: "Has Transportation", value: transYes },
    { label: "No Transportation", value: rows.length - transYes },
  ];

  const mealYes = rows.filter((r) => r.hasMealBenefit).length;
  const meals = [
    { label: "Has Meals", value: mealYes },
    { label: "No Meals", value: rows.length - mealYes },
  ];

  // Copay distributions
  const copayCategorize = (values: (number | null)[], label: string) => {
    const buckets = [
      { range: "$0", min: -1, max: 0.01 },
      { range: "$1-$15", min: 0.01, max: 15 },
      { range: "$15-$30", min: 15, max: 30 },
      { range: "$30-$50", min: 30, max: 50 },
      { range: "$50-$75", min: 50, max: 75 },
      { range: "$75+", min: 75, max: 999999 },
    ];
    return buckets.map((b) => ({
      range: b.range,
      count: values.filter((v) => {
        const val = v ?? 0;
        return val >= b.min && val < b.max;
      }).length,
    }));
  };

  const copayPcp = copayCategorize(rows.map((r) => r.pcpCopayMin), "PCP");
  const copaySpecialist = copayCategorize(rows.map((r) => r.specialistCopayMin), "Specialist");

  const erBuckets = [
    { range: "$0", min: -1, max: 0.01 },
    { range: "$1-$50", min: 0.01, max: 50 },
    { range: "$50-$100", min: 50, max: 100 },
    { range: "$100-$150", min: 100, max: 150 },
    { range: "$150-$200", min: 150, max: 200 },
    { range: "$200+", min: 200, max: 999999 },
  ];
  const copayEr = erBuckets.map((b) => ({
    range: b.range,
    count: rows.filter((r) => {
      const v = r.emergencyCopay ?? 0;
      return v >= b.min && v < b.max;
    }).length,
  }));

  return { dental, premium, starRating, otc, transportation, meals, copayPcp, copaySpecialist, copayEr };
}
