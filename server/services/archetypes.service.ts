import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, and, count, avg, desc, lte, gte } from "drizzle-orm";

// ── Archetype Definitions ──

export interface Archetype {
  id: string;
  name: string;
  emoji: string;
  description: string;
  criteria: ArchetypeCriteria;
}

interface ArchetypeCriteria {
  maxPremium?: number;
  minStarRating?: number;
  planTypes?: string[];
  wantsGiveback?: boolean;
  wantsOtc?: boolean;
  wantsMeals?: boolean;
  wantsDental?: number;
  minDental?: number;
  maxDrugDeductible?: number;
  wantsComprehensiveDental?: boolean;
  wantsTelehealth?: boolean;
  wantsTransportation?: boolean;
  wantsInHomeSupport?: boolean;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "healthy-retiree",
    name: "The Healthy Retiree",
    emoji: "\ud83c\udfc3",
    description: "Age 65-72, few health conditions, wants flexibility and low cost",
    criteria: { maxPremium: 0, minStarRating: 4, planTypes: ["PPO"] },
  },
  {
    id: "chronic-manager",
    name: "The Chronic Care Manager",
    emoji: "\ud83d\udc8a",
    description: "Diabetes, heart disease, or COPD. Needs low drug costs and supplemental benefits",
    criteria: { wantsOtc: true, wantsMeals: true, wantsDental: 2000, maxDrugDeductible: 0 },
  },
  {
    id: "budget-first",
    name: "The Budget Conscious",
    emoji: "\ud83d\udcb0",
    description: "Fixed income, every dollar counts. $0 everything is the priority",
    criteria: { maxPremium: 0, wantsGiveback: true },
  },
  {
    id: "dental-seeker",
    name: "The Dental Seeker",
    emoji: "\ud83e\uddb7",
    description: "Needs major dental work -- implants, dentures, crowns. Will pay premium for coverage",
    criteria: { minDental: 2500, wantsComprehensiveDental: true },
  },
  {
    id: "snowbird",
    name: "The Snowbird",
    emoji: "\ud83c\udf34",
    description: "Splits time between states. Needs out-of-area coverage and national network",
    criteria: { planTypes: ["PPO", "PFFS"], wantsTelehealth: true },
  },
  {
    id: "caregiver-dependent",
    name: "The Care-Dependent",
    emoji: "\ud83c\udfe0",
    description: "Limited mobility, needs in-home support, transportation to appointments, meal delivery",
    criteria: { wantsTransportation: true, wantsMeals: true, wantsInHomeSupport: true },
  },
];

// ── Plan matching for each archetype ──

interface ArchetypeMatch {
  id: number;
  name: string;
  carrier: string;
  planType: string;
  premium: number;
  dental: number;
  otcAnnual: number;
  vision: number;
  starRating: number;
  matchScore: number;
  hasTransportation: boolean;
  hasMeals: boolean;
  hasInHomeSupport: boolean;
  partbGiveback: number;
  drugDeductible: number;
}

export interface ArchetypeResult {
  archetype: Archetype;
  matchCount: number;
  topMatches: ArchetypeMatch[];
  pctOfPlans: number;
}

export interface ArchetypeResponse {
  archetypes: ArchetypeResult[];
  countyProfile: {
    county: string;
    state: string;
    totalPlans: number;
    distribution: Array<{ id: string; name: string; emoji: string; pct: number; count: number }>;
    recommendation: string;
  };
}

function matchPlanToArchetype(p: any, criteria: ArchetypeCriteria): { matches: boolean; score: number } {
  let score = 0;
  let requiredMet = 0;
  let requiredTotal = 0;

  const premium = p.calculatedMonthlyPremium || 0;
  const dental = p.dentalCoverageLimit || 0;
  const otcQ = p.otcAmountPerQuarter || 0;
  const starRating = p.overallStarRating || 0;
  const planType = (p.category || "").replace("PLAN_CATEGORY_", "").toUpperCase();
  const drugDeductible = p.drugDeductible || 0;

  if (criteria.maxPremium !== undefined) {
    requiredTotal++;
    if (premium <= criteria.maxPremium) { requiredMet++; score += 20; }
  }

  if (criteria.minStarRating !== undefined) {
    requiredTotal++;
    if (starRating >= criteria.minStarRating) { requiredMet++; score += 15; }
    else if (starRating >= criteria.minStarRating - 0.5) { score += 5; }
  }

  if (criteria.planTypes && criteria.planTypes.length > 0) {
    requiredTotal++;
    if (criteria.planTypes.some((t) => planType.includes(t.toUpperCase()))) {
      requiredMet++;
      score += 10;
    }
  }

  if (criteria.wantsGiveback) {
    score += (p.partbGiveback && p.partbGiveback > 0) ? 20 : 0;
  }

  if (criteria.wantsOtc) {
    requiredTotal++;
    if (p.hasOtc || otcQ > 0) { requiredMet++; score += 15; }
  }

  if (criteria.wantsMeals) {
    score += p.hasMealBenefit ? 15 : 0;
  }

  if (criteria.wantsDental !== undefined) {
    requiredTotal++;
    if (dental >= criteria.wantsDental) { requiredMet++; score += 20; }
    else if (dental >= criteria.wantsDental * 0.5) { score += 5; }
  }

  if (criteria.minDental !== undefined) {
    requiredTotal++;
    if (dental >= criteria.minDental) { requiredMet++; score += 25; }
  }

  if (criteria.maxDrugDeductible !== undefined) {
    requiredTotal++;
    if (drugDeductible <= criteria.maxDrugDeductible) { requiredMet++; score += 15; }
  }

  if (criteria.wantsComprehensiveDental) {
    score += p.dentalComprehensiveCovered ? 20 : 0;
  }

  if (criteria.wantsTelehealth) {
    score += p.hasTelehealth ? 10 : 0;
  }

  if (criteria.wantsTransportation) {
    requiredTotal++;
    if (p.hasTransportation) { requiredMet++; score += 20; }
  }

  if (criteria.wantsInHomeSupport) {
    requiredTotal++;
    if (p.hasInHomeSupport) { requiredMet++; score += 20; }
  }

  // A plan "matches" if it meets at least 60% of required criteria
  const threshold = requiredTotal > 0 ? requiredMet / requiredTotal : 1;
  const matches = threshold >= 0.6;

  return { matches, score };
}

// State name to abbreviation lookup
const STATE_ABBR: Record<string, string> = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","district of columbia":"DC",
  "florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL",
  "indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA",
  "maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN",
  "mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV",
  "new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY",
  "north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR",
  "pennsylvania":"PA","puerto rico":"PR","rhode island":"RI","south carolina":"SC",
  "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
  "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};

function resolveState(input: string): string {
  const upper = input.toUpperCase().trim();
  if (upper.length === 2) return upper; // Already abbreviation
  return STATE_ABBR[input.toLowerCase().trim()] || upper;
}

export async function getArchetypes(options: {
  zipCode?: string;
  county?: string;
  state?: string;
}): Promise<ArchetypeResponse> {
  const { zipCode, county } = options;
  let { state } = options;

  // Resolve state name to abbreviation (handles "texas" → "TX")
  if (state) state = resolveState(state);

  const conditions: any[] = [];
  if (zipCode) {
    // Try zip_county_map first for better coverage
    try {
      const { resolveZipToCounty } = await import("../services/zip-resolver.service");
      const resolved = await resolveZipToCounty(zipCode);
      if (resolved) {
        conditions.push(eq(plans.county, resolved.county));
        conditions.push(eq(plans.state, resolved.state));
      } else {
        conditions.push(eq(plans.zipcode, zipCode));
      }
    } catch {
      conditions.push(eq(plans.zipcode, zipCode));
    }
  } else if (county && state) {
    conditions.push(eq(plans.county, county.toUpperCase()));
    conditions.push(eq(plans.state, state));
  } else if (state) {
    conditions.push(eq(plans.state, state));
  }

  if (conditions.length === 0) {
    throw new Error("Please provide a ZIP code, or county + state");
  }

  const whereClause = sql`${sql.join(conditions, sql` and `)}`;

  const allPlans = await db.select().from(plans).where(whereClause).limit(2000);

  if (allPlans.length === 0) {
    // Return empty results
    return {
      archetypes: ARCHETYPES.map((a) => ({
        archetype: a,
        matchCount: 0,
        topMatches: [],
        pctOfPlans: 0,
      })),
      countyProfile: {
        county: county || "",
        state: state || "",
        totalPlans: 0,
        distribution: ARCHETYPES.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, pct: 0, count: 0 })),
        recommendation: "No plans found for this area.",
      },
    };
  }

  const resolvedCounty = allPlans[0].county;
  const resolvedState = allPlans[0].state;

  const results: ArchetypeResult[] = [];
  const matchCounts: Array<{ id: string; name: string; emoji: string; count: number }> = [];

  for (const archetype of ARCHETYPES) {
    const matches: ArchetypeMatch[] = [];

    for (const p of allPlans) {
      const { matches: isMatch, score } = matchPlanToArchetype(p, archetype.criteria);
      if (isMatch) {
        matches.push({
          id: p.id,
          name: p.name,
          carrier: p.organizationName,
          planType: (p.category || "").replace("PLAN_CATEGORY_", ""),
          premium: p.calculatedMonthlyPremium || 0,
          dental: p.dentalCoverageLimit || 0,
          otcAnnual: (p.otcAmountPerQuarter || 0) * 4,
          vision: p.visionAllowance || 0,
          starRating: p.overallStarRating || 0,
          matchScore: score,
          hasTransportation: p.hasTransportation || false,
          hasMeals: p.hasMealBenefit || false,
          hasInHomeSupport: p.hasInHomeSupport || false,
          partbGiveback: p.partbGiveback || 0,
          drugDeductible: p.drugDeductible || 0,
        });
      }
    }

    // Sort by score desc, take top 3
    matches.sort((a, b) => b.matchScore - a.matchScore);
    const topMatches = matches.slice(0, 3);

    results.push({
      archetype,
      matchCount: matches.length,
      topMatches,
      pctOfPlans: allPlans.length > 0 ? Math.round((matches.length / allPlans.length) * 100) : 0,
    });

    matchCounts.push({
      id: archetype.id,
      name: archetype.name,
      emoji: archetype.emoji,
      count: matches.length,
    });
  }

  // Distribution for pie chart
  const totalMatches = matchCounts.reduce((s, m) => s + m.count, 0);
  const distribution = matchCounts.map((m) => ({
    ...m,
    pct: totalMatches > 0 ? Math.round((m.count / totalMatches) * 100) : 0,
  }));

  // Sort descending
  distribution.sort((a, b) => b.pct - a.pct);

  // Generate recommendation
  const topArchetype = distribution[0];
  const secondArchetype = distribution[1];
  let recommendation = "";
  if (topArchetype && topArchetype.pct > 30) {
    const name = topArchetype.name.replace("The ", "");
    recommendation = `This area skews toward ${name} (${topArchetype.pct}%)`;
    if (secondArchetype && secondArchetype.pct > 15) {
      const name2 = secondArchetype.name.replace("The ", "");
      recommendation += ` and ${name2} (${secondArchetype.pct}%)`;
    }
    recommendation += ". ";

    // Marketing advice
    if (topArchetype.id === "budget-first") {
      recommendation += "Lead with $0 premium messaging in this market.";
    } else if (topArchetype.id === "dental-seeker") {
      recommendation += "Emphasize dental coverage limits and comprehensive dental in marketing.";
    } else if (topArchetype.id === "chronic-manager") {
      recommendation += "Focus on OTC benefits and supplemental coverage in your outreach.";
    } else if (topArchetype.id === "healthy-retiree") {
      recommendation += "Highlight PPO flexibility and star ratings in this area.";
    } else if (topArchetype.id === "snowbird") {
      recommendation += "Market out-of-area coverage and telehealth access.";
    } else if (topArchetype.id === "caregiver-dependent") {
      recommendation += "Feature transportation, meal benefits, and in-home support services.";
    }
  } else {
    recommendation = "This area has a diverse mix of beneficiary needs. A multi-angle approach works best.";
  }

  return {
    archetypes: results,
    countyProfile: {
      county: resolvedCounty,
      state: resolvedState,
      totalPlans: allPlans.length,
      distribution,
      recommendation,
    },
  };
}
