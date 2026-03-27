import type { Express, Request, Response } from "express";
import { db } from "../db";
import { plans } from "@shared/schema";
import { inArray } from "drizzle-orm";

/**
 * Parse dollar strings like "$1,234" or "$1,234.00" to a number.
 */
function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Fields where a LOWER value is better for the beneficiary (cost fields).
 */
const LOWER_IS_BETTER: readonly string[] = [
  "premium",
  "deductible",
  "moop",
  "pcpCopay",
  "specialistCopay",
  "emergencyCopay",
  "urgentCareCopay",
  "inpatientCopay",
  "outpatientCopayMin",
  "drugDeductible",
  "visionExamCopay",
  "telehealthCopay",
  "diagnosticCopay",
  "labCopay",
  "ambulanceCopay",
  "snfCopayDays1to20",
  "snfCopayDays21to100",
  "mentalHealthInpatientCopay",
  "mentalHealthOutpatientCopay",
];

/**
 * Fields where a HIGHER value is better for the beneficiary (benefit fields).
 */
const HIGHER_IS_BETTER: readonly string[] = [
  "dentalCoverageLimit",
  "visionAllowance",
  "otcAmountPerQuarter",
  "starRating",
  "partbGiveback",
  "hearingAidAllowance",
  "transportationAmountPerYear",
  "mealBenefitAmount",
  "flexCardAmount",
  "groceryAllowanceAmount",
];

/**
 * Boolean fields where true is better.
 */
const BOOLEAN_TRUE_IS_BETTER: readonly string[] = [
  "hasTransportation",
  "hasMealBenefit",
  "hasFitnessBenefit",
  "hasTelehealth",
  "hasOtc",
  "hasSilverSneakers",
  "hasInHomeSupport",
  "dentalPreventiveCovered",
  "dentalComprehensiveCovered",
];

/**
 * Shape a raw DB plan row into a flat comparison object.
 */
function shapePlan(r: any) {
  return {
    id: r.id,
    planName: r.name,
    carrier: r.organizationName,
    planType: (r.category || "").replace("PLAN_CATEGORY_", ""),
    contractId: r.contractId,
    planId: r.planId,
    segmentId: r.segmentId,
    state: r.state,
    county: r.county,
    zipcode: r.zipcode ?? "",

    // Cost fields
    premium: r.calculatedMonthlyPremium ?? 0,
    deductible: parseDollar(r.annualDeductible || "0"),
    moop: parseDollar(r.maximumOopc || "0"),
    pcpCopay: r.pcpCopayMin ?? 0,
    specialistCopay: r.specialistCopayMin ?? 0,
    emergencyCopay: r.emergencyCopay ?? 0,
    urgentCareCopay: r.urgentCareCopay ?? 0,
    inpatientCopay: r.inpatientCopay ?? 0,
    outpatientCopayMin: r.outpatientCopayMin ?? 0,
    drugDeductible: r.drugDeductible ?? null,
    visionExamCopay: r.visionExamCopay ?? null,
    telehealthCopay: r.telehealthCopay ?? null,
    diagnosticCopay: r.diagnosticCopay ?? null,
    labCopay: r.labCopay ?? null,
    ambulanceCopay: r.ambulanceCopay ?? null,
    snfCopayDays1to20: r.snfCopayDays1to20 ?? null,
    snfCopayDays21to100: r.snfCopayDays21to100 ?? null,
    mentalHealthInpatientCopay: r.mentalHealthInpatientCopay ?? null,
    mentalHealthOutpatientCopay: r.mentalHealthOutpatientCopay ?? null,

    // Benefit fields (higher is better)
    dentalCoverageLimit: r.dentalCoverageLimit ?? 0,
    visionAllowance: r.visionAllowance ?? 0,
    otcAmountPerQuarter: r.otcAmountPerQuarter ?? null,
    starRating: r.overallStarRating ?? null,
    partbGiveback: r.partbGiveback ?? null,
    hearingAidAllowance: r.hearingAidAllowance ?? null,
    transportationAmountPerYear: r.transportationAmountPerYear ?? null,
    mealBenefitAmount: r.mealBenefitAmount ?? null,
    flexCardAmount: r.flexCardAmount ?? null,
    groceryAllowanceAmount: r.groceryAllowanceAmount ?? null,

    // Boolean benefits
    hasTransportation: r.hasTransportation ?? false,
    hasMealBenefit: r.hasMealBenefit ?? false,
    hasFitnessBenefit: r.hasFitnessBenefit ?? false,
    hasTelehealth: r.hasTelehealth ?? false,
    hasOtc: r.hasOtc ?? false,
    hasSilverSneakers: r.hasSilverSneakers ?? false,
    hasInHomeSupport: r.hasInHomeSupport ?? false,
    dentalPreventiveCovered: r.dentalPreventiveCovered ?? null,
    dentalComprehensiveCovered: r.dentalComprehensiveCovered ?? null,
  };
}

type ShapedPlan = ReturnType<typeof shapePlan>;

export function registerPlanCompareRoutes(app: Express) {
  /**
   * GET /api/plans/compare?ids=1,2,3,4,5
   *
   * Side-by-side comparison of up to 6 plans with best/worst highlights
   * and an "identical" list for the differences-only toggle.
   */
  app.get("/api/plans/compare", async (req: Request, res: Response) => {
    try {
      const idsRaw = req.query.ids as string | undefined;
      if (!idsRaw) {
        return res.status(400).json({ error: "ids query parameter is required (comma-separated plan IDs)" });
      }

      const ids = idsRaw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n));

      if (ids.length === 0) {
        return res.status(400).json({ error: "No valid plan IDs provided" });
      }
      if (ids.length > 6) {
        return res.status(400).json({ error: "Maximum 6 plans can be compared at once" });
      }

      // Fetch plans
      const rows = await db
        .select()
        .from(plans)
        .where(inArray(plans.id, ids));

      if (rows.length === 0) {
        return res.status(404).json({ error: "No plans found for the provided IDs" });
      }

      const shapedPlans = rows.map(shapePlan);

      // ── Build highlights (best/worst per field) ──
      const highlights: Record<string, { bestPlanId: number; worstPlanId: number }> = {};
      const identical: string[] = [];

      const allCompareFields = [
        ...LOWER_IS_BETTER,
        ...HIGHER_IS_BETTER,
        ...BOOLEAN_TRUE_IS_BETTER,
      ];

      for (const field of allCompareFields) {
        const values = shapedPlans.map((p) => ({
          id: p.id,
          val: (p as any)[field],
        }));

        // Filter out nulls for comparison
        const nonNull = values.filter((v) => v.val !== null && v.val !== undefined);
        if (nonNull.length === 0) continue;

        // Check if all values are identical
        const allSame = nonNull.every((v) => v.val === nonNull[0].val) && nonNull.length === shapedPlans.length;
        if (allSame) {
          identical.push(field);
          continue;
        }

        if (BOOLEAN_TRUE_IS_BETTER.includes(field)) {
          // For booleans: true is best, false is worst
          const trueEntries = nonNull.filter((v) => v.val === true);
          const falseEntries = nonNull.filter((v) => v.val === false);
          if (trueEntries.length > 0 && falseEntries.length > 0) {
            highlights[field] = {
              bestPlanId: trueEntries[0].id,
              worstPlanId: falseEntries[0].id,
            };
          }
        } else if (LOWER_IS_BETTER.includes(field)) {
          // Lower is better: min = best, max = worst
          const numericVals = nonNull.filter((v) => typeof v.val === "number");
          if (numericVals.length >= 2) {
            const sorted = [...numericVals].sort((a, b) => a.val - b.val);
            highlights[field] = {
              bestPlanId: sorted[0].id,
              worstPlanId: sorted[sorted.length - 1].id,
            };
          }
        } else {
          // Higher is better: max = best, min = worst
          const numericVals = nonNull.filter((v) => typeof v.val === "number");
          if (numericVals.length >= 2) {
            const sorted = [...numericVals].sort((a, b) => b.val - a.val);
            highlights[field] = {
              bestPlanId: sorted[0].id,
              worstPlanId: sorted[sorted.length - 1].id,
            };
          }
        }
      }

      res.json({
        plans: shapedPlans,
        highlights,
        identical,
      });
    } catch (err: any) {
      console.error("Error in plan compare:", err.message);
      res.status(500).json({ error: "Failed to compare plans" });
    }
  });
}
