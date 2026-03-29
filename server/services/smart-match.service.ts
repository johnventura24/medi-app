/**
 * Smart Match Service
 *
 * One-click plan matching based on beneficiary profiles.
 * Instead of 15 sliders, pick a profile and get the best plans.
 */

import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { resolveZipToAllCounties } from "./zip-resolver.service";
import { generateEnrollmentLink } from "./enrollment-links.service";

export type MatchProfile =
  | "cheapest"
  | "best_dental"
  | "best_drugs"
  | "best_overall"
  | "doctor_friendly"
  | "chronic_care"
  | "extra_benefits";

export interface SmartMatchPlan {
  id: number;
  name: string;
  carrier: string;
  planType: string;
  state: string;
  county: string;
  premium: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  dental: number;
  vision: number;
  otcPerQuarter: number;
  starRating: number | null;
  drugDeductible: number | null;
  transportation: boolean;
  mealBenefit: boolean;
  fitness: boolean;
  telehealth: boolean;
  inHomeSupport: boolean;
  partBGiveback: number | null;
  snpType: string | null;
  whyItMatches: string;
  switchScore: number;
  highlights: string[];
  enrollmentUrl: string | null;
  enrollmentPhone: string | null;
  enrollmentType: string;
}

export interface SmartMatchResult {
  profile: MatchProfile;
  profileName: string;
  profileDescription: string;
  plans: SmartMatchPlan[];
  totalMatching: number;
  location: { county: string; state: string } | null;
}

const PROFILE_META: Record<
  MatchProfile,
  { name: string; description: string }
> = {
  cheapest: {
    name: "Lowest Cost",
    description: "Plans with $0 or lowest premiums and minimal out-of-pocket costs",
  },
  best_dental: {
    name: "Best Dental",
    description: "Plans with the highest dental coverage limits and comprehensive dental benefits",
  },
  best_drugs: {
    name: "Best Drug Coverage",
    description: "Plans with $0 drug deductible and the lowest prescription copays",
  },
  best_overall: {
    name: "Best Overall Value",
    description: "Plans that pack the most total value — dental, vision, OTC, giveback, and more",
  },
  doctor_friendly: {
    name: "Doctor Freedom",
    description: "PPO plans with broad networks so you can see any doctor without referrals",
  },
  chronic_care: {
    name: "Chronic Care",
    description: "D-SNP and plans with extra support for managing ongoing health conditions",
  },
  extra_benefits: {
    name: "Most Extra Benefits",
    description: "Plans loaded with supplemental benefits — OTC, meals, transportation, flex cards",
  },
};

function parseDollar(val: string | null): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

export async function smartMatch(
  zip: string,
  profile: MatchProfile
): Promise<SmartMatchResult> {
  const meta = PROFILE_META[profile];

  // Resolve ZIP to counties
  const counties = await resolveZipToAllCounties(zip);
  if (!counties || counties.length === 0) {
    return {
      profile,
      profileName: meta.name,
      profileDescription: meta.description,
      plans: [],
      totalMatching: 0,
      location: null,
    };
  }

  const location = { county: counties[0].county, state: counties[0].state };

  // Build county conditions
  const countyConditions = counties.map(
    (c) =>
      sql`(UPPER(${plans.county}) = ${c.county.toUpperCase()} AND ${plans.state} = ${c.state})`
  );
  const countyWhere =
    countyConditions.length === 1
      ? countyConditions[0]
      : sql`(${sql.join(countyConditions, sql` OR `)})`;

  // Profile-specific WHERE and ORDER BY
  let extraWhere = sql`TRUE`;
  let orderByClause: any;

  switch (profile) {
    case "cheapest":
      extraWhere = sql`${plans.calculatedMonthlyPremium} = 0 OR ${plans.calculatedMonthlyPremium} IS NOT NULL`;
      orderByClause = [
        asc(plans.calculatedMonthlyPremium),
        asc(sql`CAST(REPLACE(REPLACE(COALESCE(${plans.maximumOopc}, '99999'), '$', ''), ',', '') AS REAL)`),
      ];
      break;
    case "best_dental":
      orderByClause = [
        desc(plans.dentalCoverageLimit),
        desc(sql`CASE WHEN ${plans.dentalComprehensiveCovered} = true THEN 1 ELSE 0 END`),
      ];
      break;
    case "best_drugs":
      orderByClause = [
        asc(sql`COALESCE(${plans.drugDeductible}, 9999)`),
        asc(sql`COALESCE(${plans.tier1CopayPreferred}, 999)`),
        asc(sql`COALESCE(${plans.tier2CopayPreferred}, 999)`),
      ];
      break;
    case "best_overall":
      // Composite: dental + otc*4 + vision + giveback*12 - premium*12
      orderByClause = [
        desc(
          sql`COALESCE(${plans.dentalCoverageLimit}, 0) + COALESCE(${plans.otcAmountPerQuarter}, 0) * 4 + COALESCE(${plans.visionAllowance}, 0) + COALESCE(${plans.partbGiveback}, 0) * 12 - COALESCE(${plans.calculatedMonthlyPremium}, 0) * 12`
        ),
        desc(plans.overallStarRating),
      ];
      break;
    case "doctor_friendly":
      extraWhere = sql`${plans.planType} = 'PPO' OR ${plans.category} ILIKE '%PPO%'`;
      orderByClause = [
        desc(sql`COALESCE(${plans.overallStarRating}, 0)`),
        asc(plans.calculatedMonthlyPremium),
      ];
      break;
    case "chronic_care":
      extraWhere = sql`(${plans.snpType} IS NOT NULL AND ${plans.snpType} != '') OR ${plans.hasTransportation} = true OR ${plans.hasMealBenefit} = true`;
      orderByClause = [
        desc(
          sql`CASE WHEN ${plans.snpType} IS NOT NULL AND ${plans.snpType} != '' THEN 2 ELSE 0 END + CASE WHEN ${plans.hasTransportation} = true THEN 1 ELSE 0 END + CASE WHEN ${plans.hasMealBenefit} = true THEN 1 ELSE 0 END + CASE WHEN ${plans.hasOtc} = true THEN 1 ELSE 0 END`
        ),
        desc(sql`COALESCE(${plans.otcAmountPerQuarter}, 0)`),
      ];
      break;
    case "extra_benefits":
      orderByClause = [
        desc(
          sql`(CASE WHEN ${plans.hasOtc} = true THEN 1 ELSE 0 END) + (CASE WHEN ${plans.hasTransportation} = true THEN 1 ELSE 0 END) + (CASE WHEN ${plans.hasMealBenefit} = true THEN 1 ELSE 0 END) + (CASE WHEN ${plans.hasFitnessBenefit} = true THEN 1 ELSE 0 END) + (CASE WHEN ${plans.hasTelehealth} = true THEN 1 ELSE 0 END) + (CASE WHEN ${plans.hasInHomeSupport} = true THEN 1 ELSE 0 END) + (CASE WHEN ${plans.flexCardAmount} IS NOT NULL AND ${plans.flexCardAmount} > 0 THEN 1 ELSE 0 END) + (CASE WHEN ${plans.groceryAllowanceAmount} IS NOT NULL AND ${plans.groceryAllowanceAmount} > 0 THEN 1 ELSE 0 END)`
        ),
        desc(sql`COALESCE(${plans.otcAmountPerQuarter}, 0) + COALESCE(${plans.flexCardAmount}, 0) + COALESCE(${plans.groceryAllowanceAmount}, 0)`),
      ];
      break;
  }

  // Run query
  const rows = await db
    .select()
    .from(plans)
    .where(sql`${countyWhere} AND ${extraWhere}`)
    .orderBy(...orderByClause)
    .limit(50);

  // Map rows to SmartMatchPlan
  const matchedPlans: SmartMatchPlan[] = rows.map((row) => {
    const premium = row.calculatedMonthlyPremium ?? 0;
    const moop = parseDollar(row.maximumOopc ?? "0");
    const dental = row.dentalCoverageLimit ?? 0;
    const vision = row.visionAllowance ?? 0;
    const otc = row.otcAmountPerQuarter ?? 0;
    const giveback = row.partbGiveback ?? 0;

    // Calculate switch score (annual value vs average MA plan)
    // Average MA plan: $30/mo premium, $1000 dental, $100 vision, $50 OTC/qtr
    const avgAnnualCost = 30 * 12;
    const avgAnnualBenefits = 1000 + 100 + 50 * 4;
    const planAnnualCost = premium * 12;
    const planAnnualBenefits = dental + vision + otc * 4 + giveback * 12;
    const switchScore = Math.round(
      (planAnnualBenefits - planAnnualCost) - (avgAnnualBenefits - avgAnnualCost)
    );

    // Generate highlights
    const highlights: string[] = [];
    if (premium === 0) highlights.push("$0 monthly premium");
    if (dental >= 2000) highlights.push(`$${dental.toLocaleString()} dental coverage`);
    if (otc >= 50) highlights.push(`$${otc}/quarter OTC allowance`);
    if (giveback > 0) highlights.push(`$${giveback}/month Part B giveback`);
    if (row.overallStarRating && row.overallStarRating >= 4) highlights.push(`${row.overallStarRating}-star rated`);
    if (row.hasTransportation) highlights.push("Transportation included");
    if (row.hasMealBenefit) highlights.push("Meal benefit included");
    if (row.hasFitnessBenefit || row.hasSilverSneakers) highlights.push("Fitness benefit");
    if (row.hasTelehealth) highlights.push("Telehealth covered");
    if (row.flexCardAmount && row.flexCardAmount > 0) highlights.push(`$${row.flexCardAmount} flex card`);
    if (row.drugDeductible === 0) highlights.push("$0 drug deductible");
    if (row.snpType) highlights.push(`${row.snpType} Special Needs Plan`);

    // Generate whyItMatches
    const whyItMatches = generateWhyItMatches(profile, row, premium, dental, otc, vision, giveback, moop);

    // Enrollment link
    const enrollment = generateEnrollmentLink(row.organizationName);

    return {
      id: row.id,
      name: row.name,
      carrier: row.organizationName,
      planType: row.planType ?? row.category ?? "MA",
      state: row.state,
      county: row.county,
      premium,
      moop,
      pcpCopay: row.pcpCopayMin ?? 0,
      specialistCopay: row.specialistCopayMin ?? 0,
      dental,
      vision,
      otcPerQuarter: otc,
      starRating: row.overallStarRating,
      drugDeductible: row.drugDeductible,
      transportation: row.hasTransportation ?? false,
      mealBenefit: row.hasMealBenefit ?? false,
      fitness: row.hasFitnessBenefit ?? row.hasSilverSneakers ?? false,
      telehealth: row.hasTelehealth ?? false,
      inHomeSupport: row.hasInHomeSupport ?? false,
      partBGiveback: row.partbGiveback,
      snpType: row.snpType,
      whyItMatches,
      switchScore,
      highlights: highlights.slice(0, 5),
      enrollmentUrl: enrollment.url,
      enrollmentPhone: enrollment.phone,
      enrollmentType: enrollment.type,
    };
  });

  return {
    profile,
    profileName: meta.name,
    profileDescription: meta.description,
    plans: matchedPlans.slice(0, 10),
    totalMatching: rows.length,
    location,
  };
}

function generateWhyItMatches(
  profile: MatchProfile,
  row: any,
  premium: number,
  dental: number,
  otc: number,
  vision: number,
  giveback: number,
  moop: number
): string {
  const parts: string[] = [];

  switch (profile) {
    case "cheapest":
      if (premium === 0) parts.push("$0 monthly premium");
      else parts.push(`Only $${premium}/month`);
      parts.push(`$${moop.toLocaleString()} max out-of-pocket`);
      if (dental > 0) parts.push(`plus $${dental.toLocaleString()} in dental`);
      break;
    case "best_dental":
      parts.push(`$${dental.toLocaleString()} dental coverage`);
      if (row.dentalComprehensiveCovered) parts.push("including comprehensive dental");
      if (row.dentalPreventiveCovered) parts.push("preventive dental covered");
      if (premium === 0) parts.push("at $0/month");
      break;
    case "best_drugs":
      if (row.drugDeductible === 0) parts.push("$0 drug deductible");
      else if (row.drugDeductible) parts.push(`$${row.drugDeductible} drug deductible`);
      if (row.tier1CopayPreferred !== null) parts.push(`Tier 1 copay: $${row.tier1CopayPreferred}`);
      if (row.tier2CopayPreferred !== null) parts.push(`Tier 2 copay: $${row.tier2CopayPreferred}`);
      break;
    case "best_overall":
      const totalValue = dental + otc * 4 + vision + giveback * 12;
      parts.push(`$${totalValue.toLocaleString()} total annual benefit value`);
      if (premium === 0) parts.push("$0 premium");
      if (row.overallStarRating) parts.push(`${row.overallStarRating} stars`);
      break;
    case "doctor_friendly":
      parts.push("PPO plan — see any doctor, no referrals needed");
      if (row.overallStarRating) parts.push(`${row.overallStarRating}-star rated`);
      if (premium === 0) parts.push("$0 premium");
      break;
    case "chronic_care":
      if (row.snpType) parts.push(`${row.snpType} Special Needs Plan`);
      if (row.hasTransportation) parts.push("rides to appointments");
      if (row.hasMealBenefit) parts.push("meal delivery benefit");
      if (otc > 0) parts.push(`$${otc}/quarter OTC for health supplies`);
      break;
    case "extra_benefits":
      const benefits: string[] = [];
      if (otc > 0) benefits.push(`$${otc}/qtr OTC`);
      if (row.hasMealBenefit) benefits.push("meals");
      if (row.hasTransportation) benefits.push("transportation");
      if (row.hasFitnessBenefit || row.hasSilverSneakers) benefits.push("fitness");
      if (row.flexCardAmount && row.flexCardAmount > 0) benefits.push(`$${row.flexCardAmount} flex card`);
      if (row.groceryAllowanceAmount && row.groceryAllowanceAmount > 0) benefits.push("grocery allowance");
      parts.push(`Packed with extras: ${benefits.join(", ")}`);
      break;
  }

  return parts.join(" — ");
}
