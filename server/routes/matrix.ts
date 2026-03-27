import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { Express } from "express";

/**
 * Parse dollar strings like "$1,234" or "$1,234.00" to a number.
 */
function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/** Ordered list of benefit field labels for the matrix grid */
const BENEFIT_FIELDS = [
  "Monthly Premium",
  "Annual Deductible",
  "Max Out-of-Pocket",
  "PCP Copay",
  "Specialist Copay",
  "Emergency Copay",
  "Urgent Care Copay",
  "Inpatient Copay",
  "Outpatient Copay",
  "Dental Limit",
  "Vision Allowance",
  "Hearing Copay",
  "OTC",
  "Transportation",
  "Meal Benefit",
  "Telehealth",
  "Fitness",
  "Star Rating",
];

/**
 * Register carrier-by-county matrix routes on the Express app.
 *
 * GET /api/matrix?carrier={organizationName}&counties={county1,county2,...}&state={ST}
 */
export function registerMatrixRoutes(app: Express): void {
  app.get("/api/matrix", async (req: Request, res: Response) => {
    try {
      const carrier = req.query.carrier as string | undefined;
      const countiesParam = req.query.counties as string | undefined;
      const stateParam = req.query.state as string | undefined;

      if (!carrier) {
        return res.status(400).json({ error: "carrier query parameter is required" });
      }

      // Build conditions
      const conditions: ReturnType<typeof eq>[] = [eq(plans.organizationName, carrier)];

      const countyList: string[] = [];
      if (countiesParam) {
        const parsed = countiesParam.split(",").map((c) => c.trim().toUpperCase());
        countyList.push(...parsed);
        conditions.push(inArray(plans.county, parsed));
      }

      if (stateParam) {
        conditions.push(eq(plans.state, stateParam.toUpperCase()));
      }

      const rows = await db
        .select()
        .from(plans)
        .where(and(...conditions))
        .limit(500);

      if (rows.length === 0) {
        return res.json({
          carrier,
          counties: countyList,
          plans: [],
          benefitFields: BENEFIT_FIELDS,
        });
      }

      // Derive the unique set of counties from results if not explicitly provided
      const resultCounties = countyList.length > 0
        ? countyList
        : Array.from(new Set(rows.map((r) => r.county)));

      // Build flat plan list with benefit data
      const planList = rows.map((r) => ({
        planId: `${r.contractId || ""}-${r.planId || ""}-${r.segmentId || "0"}`,
        planName: r.name,
        county: r.county,
        planType: (r.category || "").replace("PLAN_CATEGORY_", ""),
        premium: r.calculatedMonthlyPremium ?? 0,
        deductible: parseDollar(r.annualDeductible || "0"),
        moop: parseDollar(r.maximumOopc || "0"),
        pcpCopay: r.pcpCopayMin ?? 0,
        specialistCopay: r.specialistCopayMin ?? 0,
        emergencyCopay: r.emergencyCopay ?? 0,
        urgentCareCopay: r.urgentCareCopay ?? 0,
        inpatientCopay: r.inpatientCopay ?? 0,
        outpatientCopayMin: r.outpatientCopayMin ?? 0,
        outpatientCopayMax: r.outpatientCopayMax ?? 0,
        dentalCoverageLimit: r.dentalCoverageLimit ?? 0,
        visionAllowance: r.visionAllowance ?? 0,
        hearingCopay: r.hearingCopayMin ?? 0,
        hasOtc: r.hasOtc ?? false,
        hasTransportation: r.hasTransportation ?? false,
        hasMealBenefit: r.hasMealBenefit ?? false,
        hasTelehealth: r.hasTelehealth ?? false,
        hasFitnessBenefit: r.hasFitnessBenefit ?? false,
        starRating: r.overallStarRating ?? null,
      }));

      res.json({
        carrier,
        counties: resultCounties,
        plans: planList,
        benefitFields: BENEFIT_FIELDS,
      });
    } catch (err: any) {
      console.error("Error in /api/matrix:", err.message);
      res.status(500).json({ error: "Failed to generate carrier-by-county matrix" });
    }
  });
}

export default registerMatrixRoutes;
