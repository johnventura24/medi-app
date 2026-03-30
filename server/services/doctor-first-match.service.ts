/**
 * Doctor-First Match Service
 *
 * Puts the doctor search FIRST in the plan matching process.
 * Given a list of doctors and a ZIP code, finds plans where those
 * doctors are most likely in-network and ranks them accordingly.
 */

import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, or, lte } from "drizzle-orm";
import { resolveZipToAllCounties } from "./zip-resolver.service";
import {
  calculateProviderConfidence,
  type PlanConfidenceInput,
} from "./provider-confidence.service";
import { generateEnrollmentLink } from "./enrollment-links.service";

// ── Types ──

export interface DoctorFirstInput {
  doctors: Array<{ npi: string; name: string; specialty?: string }>;
  zip: string;
  additionalPreferences?: {
    maxPremium?: number;
    wantsDental?: boolean;
    wantsOtc?: boolean;
  };
}

export interface DoctorConfidenceResult {
  npi: string;
  name: string;
  confidence: number;
  level: string;
}

export interface DoctorFirstPlan {
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
  doctorConfidence: DoctorConfidenceResult[];
  avgDoctorConfidence: number;
  allDoctorsLikely: boolean;
  highlights: string[];
  enrollmentUrl: string | null;
  enrollmentPhone: string | null;
  enrollmentType: string;
  verificationUrl: string;
}

export interface DoctorFirstResult {
  doctors: Array<{ npi: string; name: string; specialty: string }>;
  location: { county: string; state: string };
  plans: DoctorFirstPlan[];
  totalPlans: number;
  plansWithAllDoctors: number;
  insight: string;
}

// ── Helpers ──

function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// ── Main Function ──

export async function doctorFirstMatch(
  input: DoctorFirstInput
): Promise<DoctorFirstResult> {
  const { doctors, zip, additionalPreferences } = input;

  // Step 1: Resolve ZIP to county
  const resolvedCounties = await resolveZipToAllCounties(zip);
  if (resolvedCounties.length === 0) {
    throw new Error(`Could not resolve ZIP code ${zip} to a county`);
  }

  const location = {
    county: resolvedCounties[0].county,
    state: resolvedCounties[0].state,
  };

  // Step 2: Get all plans in that county
  let locationCondition;
  if (resolvedCounties.length === 1) {
    locationCondition = and(
      eq(plans.county, resolvedCounties[0].county),
      eq(plans.state, resolvedCounties[0].state)
    );
  } else {
    locationCondition = or(
      ...resolvedCounties.map((r) =>
        and(eq(plans.county, r.county), eq(plans.state, r.state))
      )
    );
  }

  const conditions = [locationCondition!];

  // Apply additional preference filters
  if (additionalPreferences?.maxPremium !== undefined) {
    conditions.push(
      lte(plans.calculatedMonthlyPremium, additionalPreferences.maxPremium)
    );
  }

  const candidateRows = await db
    .select()
    .from(plans)
    .where(and(...conditions))
    .limit(500);

  if (candidateRows.length === 0) {
    return {
      doctors: doctors.map((d) => ({
        npi: d.npi,
        name: d.name,
        specialty: d.specialty || "Unknown",
      })),
      location,
      plans: [],
      totalPlans: 0,
      plansWithAllDoctors: 0,
      insight: `No Medicare Advantage plans found in ${location.county}, ${location.state}.`,
    };
  }

  // Apply additional boolean filters after fetch
  let filteredRows = candidateRows;
  if (additionalPreferences?.wantsDental) {
    filteredRows = filteredRows.filter(
      (r) => r.dentalCoverageLimit != null && r.dentalCoverageLimit > 0
    );
  }
  if (additionalPreferences?.wantsOtc) {
    filteredRows = filteredRows.filter(
      (r) => r.otcAmountPerQuarter != null && r.otcAmountPerQuarter > 0
    );
  }

  // Step 3: Build PlanConfidenceInput array for the provider confidence service
  const planInputs: PlanConfidenceInput[] = filteredRows.map((r) => ({
    id: r.id,
    name: r.name,
    carrier: r.organizationName,
    contractId: r.contractId || "",
    planType: r.planType || r.category || "MA",
    state: r.state,
    county: r.county,
  }));

  // Step 4: Calculate provider confidence for ALL entered doctors across all plans
  // Run all doctor confidence calculations in parallel
  const doctorResults = await Promise.all(
    doctors.map((doc) => calculateProviderConfidence(doc.npi, planInputs))
  );

  // Step 5: Build the enriched doctor info
  const enrichedDoctors = doctors.map((doc, i) => {
    const result = doctorResults[i];
    const provider = result.provider;
    const name = provider
      ? [provider.firstName, provider.lastName].filter(Boolean).join(" ") ||
        provider.organizationName ||
        doc.name
      : doc.name;
    const specialty = provider?.specialty || doc.specialty || "Unknown";
    return { npi: doc.npi, name, specialty };
  });

  // Step 6: For each plan, aggregate confidence across all doctors
  const planMap = new Map<
    number,
    {
      row: (typeof filteredRows)[number];
      doctorConfidences: DoctorConfidenceResult[];
      avgConfidence: number;
      allLikely: boolean;
      verificationUrl: string;
    }
  >();

  for (const row of filteredRows) {
    const doctorConfidences: DoctorConfidenceResult[] = [];
    let totalConfidence = 0;
    let allLikely = true;
    let verificationUrl = "";

    for (let i = 0; i < doctors.length; i++) {
      const result = doctorResults[i];
      const planConfidence = result.confidences.find(
        (c) => c.planId === row.id
      );

      if (planConfidence) {
        const confidence = planConfidence.confidence;
        doctorConfidences.push({
          npi: doctors[i].npi,
          name: enrichedDoctors[i].name,
          confidence,
          level: planConfidence.confidenceLevel,
        });
        totalConfidence += confidence;
        if (confidence < 60) allLikely = false;
        if (!verificationUrl) verificationUrl = planConfidence.verificationUrl;
      } else {
        doctorConfidences.push({
          npi: doctors[i].npi,
          name: enrichedDoctors[i].name,
          confidence: 0,
          level: "unknown",
        });
        allLikely = false;
      }
    }

    const avgConfidence =
      doctors.length > 0
        ? Math.round(totalConfidence / doctors.length)
        : 0;

    planMap.set(row.id, {
      row,
      doctorConfidences,
      avgConfidence,
      allLikely,
      verificationUrl:
        verificationUrl || "https://www.medicare.gov/plan-compare/",
    });
  }

  // Step 7: Sort plans — all doctors likely first, then by avgDoctorConfidence DESC
  const sortedPlanIds = Array.from(planMap.entries())
    .sort(([, a], [, b]) => {
      // All-doctors-likely plans first
      if (a.allLikely !== b.allLikely) return a.allLikely ? -1 : 1;
      // Then by average confidence descending
      if (b.avgConfidence !== a.avgConfidence)
        return b.avgConfidence - a.avgConfidence;
      // Then by premium ascending
      return (
        (a.row.calculatedMonthlyPremium ?? 0) -
        (b.row.calculatedMonthlyPremium ?? 0)
      );
    })
    .map(([id]) => id);

  // Step 8: Build final plan results
  const resultPlans: DoctorFirstPlan[] = sortedPlanIds.map((planId) => {
    const entry = planMap.get(planId)!;
    const row = entry.row;
    const premium = row.calculatedMonthlyPremium ?? 0;
    const dental = row.dentalCoverageLimit ?? 0;
    const vision = row.visionAllowance ?? 0;
    const otc = row.otcAmountPerQuarter ?? 0;
    const giveback = row.partbGiveback ?? 0;
    const moop = parseDollar(row.maximumOopc || "0");

    // Generate highlights
    const highlights: string[] = [];
    if (entry.allLikely)
      highlights.push("All your doctors likely in-network");
    if (premium === 0) highlights.push("$0 monthly premium");
    if (dental >= 2000)
      highlights.push(`$${dental.toLocaleString()} dental coverage`);
    if (otc >= 50) highlights.push(`$${otc}/quarter OTC allowance`);
    if (giveback > 0)
      highlights.push(`$${giveback}/month Part B giveback`);
    if (row.overallStarRating && row.overallStarRating >= 4)
      highlights.push(`${row.overallStarRating}-star rated`);
    if (row.hasTransportation) highlights.push("Transportation included");
    if (row.hasMealBenefit) highlights.push("Meal benefit");

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
      fitness: row.hasFitnessBenefit ?? false,
      telehealth: row.hasTelehealth ?? false,
      inHomeSupport: row.hasInHomeSupport ?? false,
      partBGiveback: row.partbGiveback,
      snpType: row.snpType,
      doctorConfidence: entry.doctorConfidences,
      avgDoctorConfidence: entry.avgConfidence,
      allDoctorsLikely: entry.allLikely,
      highlights: highlights.slice(0, 6),
      enrollmentUrl: enrollment.url,
      enrollmentPhone: enrollment.phone,
      enrollmentType: enrollment.type,
      verificationUrl: entry.verificationUrl,
    };
  });

  const plansWithAllDoctors = resultPlans.filter(
    (p) => p.allDoctorsLikely
  ).length;

  const insight =
    plansWithAllDoctors > 0
      ? `${plansWithAllDoctors} of ${resultPlans.length} plans in your area likely include all your doctors.`
      : `We found ${resultPlans.length} plans in your area. Some may include your doctors -- verify with the carrier before enrolling.`;

  return {
    doctors: enrichedDoctors,
    location,
    plans: resultPlans.slice(0, 30),
    totalPlans: resultPlans.length,
    plansWithAllDoctors,
    insight,
  };
}
