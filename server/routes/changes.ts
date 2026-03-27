import type { Request, Response, Express } from "express";
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Plan } from "@shared/schema";

/**
 * Parse dollar strings like "$1,234" or "$1,234.00" to a number.
 */
function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Format a number as a dollar string, e.g. 1234 -> "$1,234.00".
 */
function formatDollar(val: number): string {
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Fields to skip when comparing plans year-over-year */
const SKIP_FIELDS = new Set(["id", "externalId", "contractYear"]);

/** All plan fields worth comparing, with their human-readable labels */
const COMPARE_FIELDS: Array<{ key: string; label: string; isDollar: boolean; isBoolean: boolean }> = [
  { key: "calculatedMonthlyPremium", label: "Monthly Premium", isDollar: true, isBoolean: false },
  { key: "annualDeductible", label: "Annual Deductible", isDollar: true, isBoolean: false },
  { key: "maximumOopc", label: "Max Out-of-Pocket", isDollar: true, isBoolean: false },
  { key: "pcpCopayMin", label: "PCP Copay Min", isDollar: true, isBoolean: false },
  { key: "pcpCopayMax", label: "PCP Copay Max", isDollar: true, isBoolean: false },
  { key: "specialistCopayMin", label: "Specialist Copay Min", isDollar: true, isBoolean: false },
  { key: "specialistCopayMax", label: "Specialist Copay Max", isDollar: true, isBoolean: false },
  { key: "emergencyCopay", label: "Emergency Copay", isDollar: true, isBoolean: false },
  { key: "urgentCareCopay", label: "Urgent Care Copay", isDollar: true, isBoolean: false },
  { key: "inpatientCopay", label: "Inpatient Copay", isDollar: true, isBoolean: false },
  { key: "outpatientCopayMin", label: "Outpatient Copay Min", isDollar: true, isBoolean: false },
  { key: "outpatientCopayMax", label: "Outpatient Copay Max", isDollar: true, isBoolean: false },
  { key: "diagnosticCopay", label: "Diagnostic Copay", isDollar: true, isBoolean: false },
  { key: "labCopay", label: "Lab Copay", isDollar: true, isBoolean: false },
  { key: "imagingCopayMin", label: "Imaging Copay Min", isDollar: true, isBoolean: false },
  { key: "imagingCopayMax", label: "Imaging Copay Max", isDollar: true, isBoolean: false },
  { key: "mentalHealthInpatientCopay", label: "Mental Health Inpatient Copay", isDollar: true, isBoolean: false },
  { key: "mentalHealthOutpatientCopay", label: "Mental Health Outpatient Copay", isDollar: true, isBoolean: false },
  { key: "snfCopayDays1to20", label: "SNF Copay (Days 1-20)", isDollar: true, isBoolean: false },
  { key: "snfCopayDays21to100", label: "SNF Copay (Days 21-100)", isDollar: true, isBoolean: false },
  { key: "homeHealthCopay", label: "Home Health Copay", isDollar: true, isBoolean: false },
  { key: "ambulanceCopay", label: "Ambulance Copay", isDollar: true, isBoolean: false },
  { key: "dmeCopayMin", label: "DME Copay Min", isDollar: true, isBoolean: false },
  { key: "dmeCopayMax", label: "DME Copay Max", isDollar: true, isBoolean: false },
  { key: "dentalCoverageLimit", label: "Dental Coverage Limit", isDollar: true, isBoolean: false },
  { key: "visionAllowance", label: "Vision Allowance", isDollar: true, isBoolean: false },
  { key: "hearingCopayMin", label: "Hearing Copay Min", isDollar: true, isBoolean: false },
  { key: "hearingCopayMax", label: "Hearing Copay Max", isDollar: true, isBoolean: false },
  { key: "partbGiveback", label: "Part B Giveback", isDollar: true, isBoolean: false },
  { key: "drugDeductible", label: "Drug Deductible", isDollar: true, isBoolean: false },
  { key: "tier1CopayPreferred", label: "Tier 1 Copay (Preferred)", isDollar: true, isBoolean: false },
  { key: "tier1CopayStandard", label: "Tier 1 Copay (Standard)", isDollar: true, isBoolean: false },
  { key: "tier2CopayPreferred", label: "Tier 2 Copay (Preferred)", isDollar: true, isBoolean: false },
  { key: "tier2CopayStandard", label: "Tier 2 Copay (Standard)", isDollar: true, isBoolean: false },
  { key: "tier3CopayPreferred", label: "Tier 3 Copay (Preferred)", isDollar: true, isBoolean: false },
  { key: "tier3CopayStandard", label: "Tier 3 Copay (Standard)", isDollar: true, isBoolean: false },
  { key: "tier4CoinsurancePreferred", label: "Tier 4 Coinsurance (Preferred)", isDollar: false, isBoolean: false },
  { key: "tier4CoinsuranceStandard", label: "Tier 4 Coinsurance (Standard)", isDollar: false, isBoolean: false },
  { key: "tier5CoinsurancePreferred", label: "Tier 5 Coinsurance (Preferred)", isDollar: false, isBoolean: false },
  { key: "tier5CoinsuranceStandard", label: "Tier 5 Coinsurance (Standard)", isDollar: false, isBoolean: false },
  { key: "tier6CopayPreferred", label: "Tier 6 Copay (Preferred)", isDollar: true, isBoolean: false },
  { key: "tier6CopayStandard", label: "Tier 6 Copay (Standard)", isDollar: true, isBoolean: false },
  { key: "catastrophicCopayGeneric", label: "Catastrophic Copay (Generic)", isDollar: true, isBoolean: false },
  { key: "catastrophicCopayBrand", label: "Catastrophic Copay (Brand)", isDollar: true, isBoolean: false },
  { key: "catastrophicCoinsurance", label: "Catastrophic Coinsurance", isDollar: false, isBoolean: false },
  { key: "otcAmountPerQuarter", label: "OTC Amount Per Quarter", isDollar: true, isBoolean: false },
  { key: "transportationTripsPerYear", label: "Transportation Trips/Year", isDollar: false, isBoolean: false },
  { key: "transportationAmountPerYear", label: "Transportation Amount/Year", isDollar: true, isBoolean: false },
  { key: "mealBenefitAmount", label: "Meal Benefit Amount", isDollar: true, isBoolean: false },
  { key: "flexCardAmount", label: "Flex Card Amount", isDollar: true, isBoolean: false },
  { key: "groceryAllowanceAmount", label: "Grocery Allowance Amount", isDollar: true, isBoolean: false },
  { key: "visionExamCopay", label: "Vision Exam Copay", isDollar: true, isBoolean: false },
  { key: "hearingAidAllowance", label: "Hearing Aid Allowance", isDollar: true, isBoolean: false },
  { key: "telehealthCopay", label: "Telehealth Copay", isDollar: true, isBoolean: false },
  { key: "overallStarRating", label: "Overall Star Rating", isDollar: false, isBoolean: false },
  { key: "hasOtc", label: "Has OTC", isDollar: false, isBoolean: true },
  { key: "hasTransportation", label: "Has Transportation", isDollar: false, isBoolean: true },
  { key: "hasMealBenefit", label: "Has Meal Benefit", isDollar: false, isBoolean: true },
  { key: "hasTelehealth", label: "Has Telehealth", isDollar: false, isBoolean: true },
  { key: "hasSilverSneakers", label: "Has Silver Sneakers", isDollar: false, isBoolean: true },
  { key: "hasFitnessBenefit", label: "Has Fitness Benefit", isDollar: false, isBoolean: true },
  { key: "hasInHomeSupport", label: "Has In-Home Support", isDollar: false, isBoolean: true },
  { key: "dentalPreventiveCovered", label: "Dental Preventive Covered", isDollar: false, isBoolean: true },
  { key: "dentalComprehensiveCovered", label: "Dental Comprehensive Covered", isDollar: false, isBoolean: true },
  { key: "lowPerforming", label: "Low Performing", isDollar: false, isBoolean: true },
  { key: "highPerforming", label: "High Performing", isDollar: false, isBoolean: true },
  { key: "name", label: "Plan Name", isDollar: false, isBoolean: false },
  { key: "category", label: "Category", isDollar: false, isBoolean: false },
  { key: "organizationName", label: "Organization Name", isDollar: false, isBoolean: false },
  { key: "snpType", label: "SNP Type", isDollar: false, isBoolean: false },
  { key: "enrollmentStatus", label: "Enrollment Status", isDollar: false, isBoolean: false },
  { key: "coverageGapTier1", label: "Coverage Gap Tier 1", isDollar: false, isBoolean: false },
  { key: "coverageGapTier2", label: "Coverage Gap Tier 2", isDollar: false, isBoolean: false },
  { key: "fitnessBenefitName", label: "Fitness Benefit Name", isDollar: false, isBoolean: false },
  { key: "flexCardFrequency", label: "Flex Card Frequency", isDollar: false, isBoolean: false },
  { key: "groceryAllowanceFrequency", label: "Grocery Allowance Frequency", isDollar: false, isBoolean: false },
  { key: "requiresPcpReferral", label: "Requires PCP Referral", isDollar: false, isBoolean: true },
  { key: "priorAuthNotes", label: "Prior Auth Notes", isDollar: false, isBoolean: false },
];

/**
 * Build a unique match key for pairing plans across years.
 * Uses contractId + planId + segmentId + county (fallback to fips).
 */
function planMatchKey(plan: Plan): string {
  const parts = [
    plan.contractId || "",
    plan.planId || "",
    plan.segmentId || "",
    plan.fips || plan.county || "",
  ];
  return parts.join("|").toUpperCase();
}

/**
 * Get numeric value from a plan field, handling dollar-string text fields.
 */
function getNumericValue(plan: Plan, key: string): number | null {
  const val = (plan as Record<string, unknown>)[key];
  if (val === null || val === undefined) return null;
  // Text dollar fields (annualDeductible, maximumOopc)
  if (typeof val === "string") {
    const parsed = parseDollar(val);
    return parsed;
  }
  if (typeof val === "number") return val;
  return null;
}

/**
 * Compare two plan records and return the list of changed fields with direction.
 */
function diffPlans(
  oldPlan: Plan,
  newPlan: Plan
): Array<{
  field: string;
  oldValue: string;
  newValue: string;
  direction: "increase" | "decrease" | "changed";
}> {
  const changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    direction: "increase" | "decrease" | "changed";
  }> = [];

  for (const { key, label, isDollar, isBoolean } of COMPARE_FIELDS) {
    const oldRaw = (oldPlan as Record<string, unknown>)[key] ?? null;
    const newRaw = (newPlan as Record<string, unknown>)[key] ?? null;

    // Normalize undefined to null
    const oldNorm = oldRaw === undefined ? null : oldRaw;
    const newNorm = newRaw === undefined ? null : newRaw;

    if (oldNorm === newNorm) continue;

    // Numeric comparison with tolerance
    if (typeof oldNorm === "number" && typeof newNorm === "number") {
      if (Math.abs(oldNorm - newNorm) < 0.001) continue;
      const direction = newNorm > oldNorm ? "increase" : "decrease";
      changes.push({
        field: label,
        oldValue: isDollar ? formatDollar(oldNorm) : String(oldNorm),
        newValue: isDollar ? formatDollar(newNorm) : String(newNorm),
        direction,
      });
      continue;
    }

    // Handle text dollar fields (annualDeductible, maximumOopc)
    if (isDollar && typeof oldNorm === "string" && typeof newNorm === "string") {
      const oldNum = parseDollar(oldNorm);
      const newNum = parseDollar(newNorm);
      if (Math.abs(oldNum - newNum) < 0.001) continue;
      const direction = newNum > oldNum ? "increase" : "decrease";
      changes.push({
        field: label,
        oldValue: formatDollar(oldNum),
        newValue: formatDollar(newNum),
        direction,
      });
      continue;
    }

    // Handle mixed null/number for dollar fields
    if (isDollar) {
      const oldNum = getNumericValue(oldPlan, key);
      const newNum = getNumericValue(newPlan, key);
      if (oldNum !== null && newNum !== null && Math.abs(oldNum - newNum) < 0.001) continue;
      const direction =
        oldNum !== null && newNum !== null
          ? newNum > oldNum
            ? "increase"
            : "decrease"
          : "changed";
      changes.push({
        field: label,
        oldValue: oldNum !== null ? formatDollar(oldNum) : String(oldNorm ?? "N/A"),
        newValue: newNum !== null ? formatDollar(newNum) : String(newNorm ?? "N/A"),
        direction,
      });
      continue;
    }

    // Boolean fields
    if (isBoolean) {
      changes.push({
        field: label,
        oldValue: String(oldNorm ?? "N/A"),
        newValue: String(newNorm ?? "N/A"),
        direction: "changed",
      });
      continue;
    }

    // Non-numeric / non-boolean fields
    changes.push({
      field: label,
      oldValue: String(oldNorm ?? "N/A"),
      newValue: String(newNorm ?? "N/A"),
      direction: "changed",
    });
  }

  return changes;
}

/**
 * Register year-over-year change report routes on the Express app.
 *
 * GET /api/changes?year1={2025}&year2={2026}&carrier={org}&state={ST}&county={county}
 */
export function registerChangeRoutes(app: Express): void {
  app.get("/api/changes", async (req: Request, res: Response) => {
    try {
      const year1Str = req.query.year1 as string | undefined;
      const year2Str = req.query.year2 as string | undefined;
      const carrierParam = req.query.carrier as string | undefined;
      const stateParam = req.query.state as string | undefined;
      const countyParam = req.query.county as string | undefined;

      if (!year1Str || !year2Str) {
        return res.status(400).json({ error: "year1 and year2 query parameters are required" });
      }

      const year1 = parseInt(year1Str, 10);
      const year2 = parseInt(year2Str, 10);

      if (isNaN(year1) || isNaN(year2)) {
        return res.status(400).json({ error: "year1 and year2 must be valid integers" });
      }

      // Build shared filter conditions (excluding year)
      const buildFilters = (): ReturnType<typeof eq>[] => {
        const filters: ReturnType<typeof eq>[] = [];
        if (carrierParam) filters.push(eq(plans.organizationName, carrierParam));
        if (stateParam) filters.push(eq(plans.state, stateParam.toUpperCase()));
        if (countyParam) filters.push(eq(plans.county, countyParam.toUpperCase()));
        return filters;
      };

      // Fetch year1 plans
      const year1Conditions = [
        eq(plans.contractYear, String(year1)),
        ...buildFilters(),
      ];
      const year1Plans = await db
        .select()
        .from(plans)
        .where(and(...year1Conditions));

      // Fetch year2 plans
      const year2Conditions = [
        eq(plans.contractYear, String(year2)),
        ...buildFilters(),
      ];
      const year2Plans = await db
        .select()
        .from(plans)
        .where(and(...year2Conditions));

      // Index by match key
      const year1Map = new Map<string, Plan>();
      for (const p of year1Plans) {
        const key = planMatchKey(p);
        if (key === "|||") continue; // skip plans missing all match fields
        year1Map.set(key, p);
      }

      const year2Map = new Map<string, Plan>();
      for (const p of year2Plans) {
        const key = planMatchKey(p);
        if (key === "|||") continue;
        year2Map.set(key, p);
      }

      // Classify plans
      const newPlans: Array<{
        planName: string;
        contractId: string;
        planId: string;
        segmentId: string;
        county: string;
      }> = [];

      const terminatedPlans: Array<{
        planName: string;
        contractId: string;
        planId: string;
        segmentId: string;
        county: string;
      }> = [];

      const changedPlans: Array<{
        planName: string;
        contractId: string;
        planId: string;
        segmentId: string;
        county: string;
        changes: Array<{
          field: string;
          oldValue: string;
          newValue: string;
          direction: "increase" | "decrease" | "changed";
        }>;
      }> = [];

      let unchangedCount = 0;

      // Check year2 plans against year1
      year2Map.forEach((y2Plan, key) => {
        const y1Plan = year1Map.get(key);

        if (!y1Plan) {
          newPlans.push({
            planName: y2Plan.name,
            contractId: y2Plan.contractId || "",
            planId: y2Plan.planId || "",
            segmentId: y2Plan.segmentId || "",
            county: y2Plan.county,
          });
          return;
        }

        // Matched: compare fields
        const changes = diffPlans(y1Plan, y2Plan);
        if (changes.length > 0) {
          changedPlans.push({
            planName: y2Plan.name,
            contractId: y2Plan.contractId || "",
            planId: y2Plan.planId || "",
            segmentId: y2Plan.segmentId || "",
            county: y2Plan.county,
            changes,
          });
        } else {
          unchangedCount++;
        }
      });

      // Find terminated plans (in year1 but not year2)
      year1Map.forEach((y1Plan, key) => {
        if (!year2Map.has(key)) {
          terminatedPlans.push({
            planName: y1Plan.name,
            contractId: y1Plan.contractId || "",
            planId: y1Plan.planId || "",
            segmentId: y1Plan.segmentId || "",
            county: y1Plan.county,
          });
        }
      });

      const totalCompared = newPlans.length + terminatedPlans.length + changedPlans.length + unchangedCount;

      // Build filters object for response
      const filters: Record<string, string> = {};
      if (carrierParam) filters.carrier = carrierParam;
      if (stateParam) filters.state = stateParam.toUpperCase();
      if (countyParam) filters.county = countyParam.toUpperCase();

      res.json({
        year1: year1Str,
        year2: year2Str,
        filters,
        summary: {
          totalCompared,
          newPlans: newPlans.length,
          terminatedPlans: terminatedPlans.length,
          changedPlans: changedPlans.length,
          unchangedPlans: unchangedCount,
        },
        newPlans,
        terminatedPlans,
        changedPlans,
      });
    } catch (err: any) {
      console.error("Error in /api/changes:", err.message);
      res.status(500).json({ error: "Failed to generate year-over-year change report" });
    }
  });
}

export default registerChangeRoutes;
