/**
 * ACA Smart Match Service
 *
 * One-click plan matching for ACA marketplace plans
 * based on beneficiary profiles and subsidy calculations.
 */

import { db } from "../db";
import { acaPlans } from "@shared/schema";
import { sql, eq, and, asc, desc, ilike } from "drizzle-orm";
import { getACAEnrollmentUrl } from "./aca-enrollment-links.service";

// ── 2026 Federal Poverty Level ──

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

function getExpectedContributionRate(fplPercent: number): number {
  if (fplPercent <= 150) return 0.00;
  if (fplPercent <= 200) return 0.02;
  if (fplPercent <= 250) return 0.04;
  if (fplPercent <= 300) return 0.06;
  if (fplPercent <= 350) return 0.075;
  if (fplPercent <= 400) return 0.085;
  return 0.085;
}

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
  return 2.714;
}

function adjustPremiumForAge(premAge40: number, targetAge: number): number {
  const factor40 = getAgeRatingFactor(40);
  const factorTarget = getAgeRatingFactor(targetAge);
  return Math.round((premAge40 / factor40) * factorTarget * 100) / 100;
}

// ── Types ──

export type ACAMatchProfile =
  | "cheapest_after_subsidy"
  | "lowest_deductible"
  | "best_value_silver"
  | "hsa_eligible"
  | "family_friendly"
  | "comprehensive";

export interface ACASmartMatchPlan {
  id: number;
  planId: string;
  planName: string;
  issuer: string;
  metalLevel: string;
  planType: string | null;
  state: string;
  county: string | null;
  premiumFull: number;
  premiumAfterSubsidy: number;
  monthlySubsidy: number;
  deductibleIndividual: number | null;
  deductibleFamily: number | null;
  moopIndividual: number | null;
  moopFamily: number | null;
  hsaEligible: boolean;
  ehbPct: number | null;
  whyItMatches: string;
  highlights: string[];
  enrollmentUrl: string;
}

export interface ACASmartMatchResult {
  profile: ACAMatchProfile;
  profileName: string;
  profileDescription: string;
  plans: ACASmartMatchPlan[];
  totalMatching: number;
  location: { state: string; county: string | null } | null;
  subsidyApplied: boolean;
  monthlySubsidy: number;
  fplPercent: number | null;
}

const PROFILE_META: Record<ACAMatchProfile, { name: string; description: string }> = {
  cheapest_after_subsidy: {
    name: "Cheapest After Subsidy",
    description: "Plans with the lowest monthly premium after your Premium Tax Credit is applied",
  },
  lowest_deductible: {
    name: "Lowest Deductible",
    description: "Gold and Platinum plans with the lowest deductibles for frequent healthcare users",
  },
  best_value_silver: {
    name: "Best Silver Plan",
    description: "Silver plans that offer the best value, especially with Cost Sharing Reductions",
  },
  hsa_eligible: {
    name: "HSA-Eligible",
    description: "Bronze plans compatible with Health Savings Accounts for tax-advantaged healthcare savings",
  },
  family_friendly: {
    name: "Best for Families",
    description: "Plans with the best family deductibles and out-of-pocket maximums",
  },
  comprehensive: {
    name: "Most Comprehensive",
    description: "Platinum and Gold plans with the lowest out-of-pocket costs and richest benefits",
  },
};

export async function acaSmartMatch(options: {
  state: string;
  county?: string;
  profile: ACAMatchProfile;
  income?: number;
  householdSize?: number;
  age?: number;
}): Promise<ACASmartMatchResult> {
  const { state, county, profile, income, householdSize, age } = options;
  const meta = PROFILE_META[profile];
  const stateUpper = state.toUpperCase();
  const targetAge = age || 40;

  // Calculate subsidy if income info provided
  let monthlySubsidy = 0;
  let fplPercent: number | null = null;
  let subsidyApplied = false;

  if (income && householdSize && income > 0) {
    const fplBase = FPL_2026[householdSize] || FPL_2026[1];
    fplPercent = Math.round((income / fplBase) * 100);

    if (fplPercent >= 100) {
      subsidyApplied = true;
      // We'll calculate per-plan subsidy using the 2nd lowest Silver (SLCSP)
    }
  }

  // Build query conditions
  const conditions = [eq(acaPlans.state, stateUpper)];
  if (county) {
    conditions.push(ilike(acaPlans.county, `%${county}%`));
  }

  // Profile-specific metal level filters
  let metalFilter: any = null;
  let orderByClause: any;

  switch (profile) {
    case "cheapest_after_subsidy":
      // All metals, sort by premium (subsidy applied afterward)
      orderByClause = [asc(acaPlans.premiumAge40)];
      break;
    case "lowest_deductible":
      // Gold and Platinum
      metalFilter = sql`(${acaPlans.metalLevel} = 'Gold' OR ${acaPlans.metalLevel} = 'Platinum')`;
      orderByClause = [
        asc(sql`COALESCE(${acaPlans.deductibleIndividual}, 99999)`),
        asc(acaPlans.premiumAge40),
      ];
      break;
    case "best_value_silver":
      metalFilter = sql`${acaPlans.metalLevel} = 'Silver'`;
      orderByClause = [asc(acaPlans.premiumAge40)];
      break;
    case "hsa_eligible":
      metalFilter = sql`(${acaPlans.metalLevel} = 'Bronze' OR ${acaPlans.metalLevel} = 'Expanded Bronze') AND ${acaPlans.hsaEligible} = true`;
      orderByClause = [asc(acaPlans.premiumAge40)];
      break;
    case "family_friendly":
      orderByClause = [
        asc(sql`COALESCE(${acaPlans.deductibleFamily}, 99999)`),
        asc(sql`COALESCE(${acaPlans.moopFamily}, 99999)`),
        asc(acaPlans.premiumAge40),
      ];
      break;
    case "comprehensive":
      metalFilter = sql`(${acaPlans.metalLevel} = 'Platinum' OR ${acaPlans.metalLevel} = 'Gold')`;
      orderByClause = [
        asc(sql`COALESCE(${acaPlans.moopIndividual}, 99999)`),
        asc(sql`COALESCE(${acaPlans.deductibleIndividual}, 99999)`),
        asc(acaPlans.premiumAge40),
      ];
      break;
  }

  // Build WHERE clause
  let whereClause;
  if (metalFilter) {
    whereClause = sql`${and(...conditions)} AND ${metalFilter} AND ${acaPlans.premiumAge40} IS NOT NULL`;
  } else {
    whereClause = sql`${and(...conditions)} AND ${acaPlans.premiumAge40} IS NOT NULL`;
  }

  // Fetch plans
  const rows = await db
    .select()
    .from(acaPlans)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(100);

  if (rows.length === 0) {
    return {
      profile,
      profileName: meta.name,
      profileDescription: meta.description,
      plans: [],
      totalMatching: 0,
      location: null,
      subsidyApplied: false,
      monthlySubsidy: 0,
      fplPercent: null,
    };
  }

  // Calculate SLCSP benchmark for subsidy
  if (subsidyApplied && fplPercent !== null && income) {
    const silverPlans = rows
      .filter((p) => p.metalLevel === "Silver" && p.premiumAge40)
      .map((p) => adjustPremiumForAge(p.premiumAge40!, targetAge))
      .sort((a, b) => a - b);

    // If we don't have Silver plans in our result set, query for them
    let benchmarkPremium: number;
    if (silverPlans.length >= 2) {
      benchmarkPremium = silverPlans[1];
    } else if (silverPlans.length === 1) {
      benchmarkPremium = silverPlans[0];
    } else {
      // Fetch Silver plans separately for benchmark
      const silverRows = await db
        .select({ premiumAge40: acaPlans.premiumAge40 })
        .from(acaPlans)
        .where(
          sql`${acaPlans.state} = ${stateUpper} AND ${acaPlans.metalLevel} = 'Silver' AND ${acaPlans.premiumAge40} IS NOT NULL ${county ? sql`AND ${acaPlans.county} ILIKE ${"%" + county + "%"}` : sql``}`
        )
        .orderBy(asc(acaPlans.premiumAge40))
        .limit(10);

      const silverPremiums = silverRows
        .filter((r) => r.premiumAge40)
        .map((r) => adjustPremiumForAge(r.premiumAge40!, targetAge));

      benchmarkPremium = silverPremiums.length >= 2 ? silverPremiums[1] : silverPremiums[0] || 0;
    }

    const contributionRate = getExpectedContributionRate(fplPercent);
    const monthlyContrib = Math.round((contributionRate * income / 12) * 100) / 100;
    monthlySubsidy = Math.max(0, Math.round((benchmarkPremium - monthlyContrib) * 100) / 100);
  }

  const enrollmentUrl = getACAEnrollmentUrl(stateUpper);

  // Map to result plans
  const matchedPlans: ACASmartMatchPlan[] = rows.map((row) => {
    const fullPremium = adjustPremiumForAge(row.premiumAge40 || 0, targetAge);
    const afterSubsidy = subsidyApplied
      ? Math.max(0, Math.round((fullPremium - monthlySubsidy) * 100) / 100)
      : fullPremium;

    // Generate highlights
    const highlights: string[] = [];
    if (afterSubsidy === 0 && subsidyApplied) highlights.push("$0 premium after subsidy");
    else if (afterSubsidy < 50 && subsidyApplied) highlights.push(`Only $${afterSubsidy}/mo after subsidy`);
    if (row.hsaEligible) highlights.push("HSA-eligible");
    if (row.metalLevel === "Platinum") highlights.push("Richest benefits");
    if (row.deductibleIndividual === 0) highlights.push("$0 deductible");
    if (row.deductibleIndividual && row.deductibleIndividual <= 500) highlights.push(`Low $${row.deductibleIndividual} deductible`);
    if (row.moopIndividual && row.moopIndividual <= 3000) highlights.push(`Low $${row.moopIndividual.toLocaleString()} MOOP`);
    if (row.ehbPct && row.ehbPct >= 0.9) highlights.push("90%+ EHB coverage");

    // Generate whyItMatches
    const whyItMatches = generateWhyItMatches(profile, row, fullPremium, afterSubsidy, subsidyApplied);

    return {
      id: row.id,
      planId: row.planId,
      planName: row.planName,
      issuer: row.issuerName,
      metalLevel: row.metalLevel || "Unknown",
      planType: row.planType,
      state: row.state,
      county: row.county,
      premiumFull: Math.round(fullPremium * 100) / 100,
      premiumAfterSubsidy: afterSubsidy,
      monthlySubsidy: subsidyApplied ? monthlySubsidy : 0,
      deductibleIndividual: row.deductibleIndividual,
      deductibleFamily: row.deductibleFamily,
      moopIndividual: row.moopIndividual,
      moopFamily: row.moopFamily,
      hsaEligible: row.hsaEligible ?? false,
      ehbPct: row.ehbPct,
      whyItMatches,
      highlights: highlights.slice(0, 5),
      enrollmentUrl,
    };
  });

  // Re-sort for cheapest_after_subsidy profile if subsidy was applied
  if (profile === "cheapest_after_subsidy" && subsidyApplied) {
    matchedPlans.sort((a, b) => a.premiumAfterSubsidy - b.premiumAfterSubsidy);
  }

  const location = rows[0] ? { state: rows[0].state, county: rows[0].county } : null;

  return {
    profile,
    profileName: meta.name,
    profileDescription: meta.description,
    plans: matchedPlans.slice(0, 15),
    totalMatching: rows.length,
    location,
    subsidyApplied,
    monthlySubsidy,
    fplPercent,
  };
}

function generateWhyItMatches(
  profile: ACAMatchProfile,
  row: any,
  fullPremium: number,
  afterSubsidy: number,
  subsidyApplied: boolean
): string {
  const parts: string[] = [];

  switch (profile) {
    case "cheapest_after_subsidy":
      if (subsidyApplied && afterSubsidy === 0) {
        parts.push("$0/month after your subsidy");
      } else if (subsidyApplied) {
        parts.push(`Only $${afterSubsidy}/mo after subsidy (was $${Math.round(fullPremium)})`);
      } else {
        parts.push(`$${Math.round(fullPremium)}/month premium`);
      }
      if (row.metalLevel) parts.push(`${row.metalLevel} plan`);
      break;

    case "lowest_deductible":
      if (row.deductibleIndividual !== null) {
        parts.push(`$${row.deductibleIndividual.toLocaleString()} individual deductible`);
      }
      parts.push(`${row.metalLevel} plan`);
      if (row.moopIndividual) parts.push(`$${row.moopIndividual.toLocaleString()} max out-of-pocket`);
      break;

    case "best_value_silver":
      parts.push("Silver plan with CSR benefits available");
      if (subsidyApplied && afterSubsidy < fullPremium) {
        parts.push(`$${afterSubsidy}/mo after subsidy`);
      }
      if (row.deductibleIndividual !== null) {
        parts.push(`$${row.deductibleIndividual.toLocaleString()} deductible`);
      }
      break;

    case "hsa_eligible":
      parts.push("HSA-compatible plan for tax-free healthcare savings");
      if (row.metalLevel) parts.push(`${row.metalLevel} level`);
      if (subsidyApplied && afterSubsidy < fullPremium) {
        parts.push(`$${afterSubsidy}/mo after subsidy`);
      }
      break;

    case "family_friendly":
      if (row.deductibleFamily !== null) {
        parts.push(`$${row.deductibleFamily.toLocaleString()} family deductible`);
      }
      if (row.moopFamily !== null) {
        parts.push(`$${row.moopFamily.toLocaleString()} family max out-of-pocket`);
      }
      parts.push(`${row.metalLevel} plan`);
      break;

    case "comprehensive":
      parts.push(`${row.metalLevel} plan with comprehensive coverage`);
      if (row.moopIndividual) {
        parts.push(`$${row.moopIndividual.toLocaleString()} max out-of-pocket`);
      }
      if (row.ehbPct) {
        parts.push(`${Math.round(row.ehbPct * 100)}% essential health benefits`);
      }
      break;
  }

  return parts.join(" — ");
}
