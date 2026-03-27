import type { Express, Request, Response } from "express";
import { db } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, and, gte, lte, ilike, or, count } from "drizzle-orm";

/**
 * Parse dollar strings like "$1,234" or "$1,234.00" to a number.
 */
function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Helper to safely parse a query-string value as a number.
 * Returns undefined if the value is missing or not a valid number.
 */
function parseNum(val: unknown): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Helper to parse a query-string boolean ("true" / "1" => true).
 */
function parseBool(val: unknown): boolean | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  return val === "true" || val === "1";
}

export function registerPlanFinderRoutes(app: Express) {
  /**
   * GET /api/plans/find
   *
   * Benefit-based plan finder with dynamic filtering and match scoring.
   */
  app.get("/api/plans/find", async (req: Request, res: Response) => {
    try {
      const zip = req.query.zip as string | undefined;
      if (!zip) {
        return res.status(400).json({ error: "zip query parameter is required" });
      }

      // ── Parse all optional criteria ──
      const maxPremium = parseNum(req.query.maxPremium);
      const maxMoop = parseNum(req.query.maxMoop);
      const maxPcpCopay = parseNum(req.query.maxPcpCopay);
      const maxSpecialistCopay = parseNum(req.query.maxSpecialistCopay);
      const minDental = parseNum(req.query.minDental);
      const minVision = parseNum(req.query.minVision);
      const minOtc = parseNum(req.query.minOtc);
      const hasTransportation = parseBool(req.query.hasTransportation);
      const hasMealBenefit = parseBool(req.query.hasMealBenefit);
      const hasFitnessBenefit = parseBool(req.query.hasFitnessBenefit);
      const hasTelehealth = parseBool(req.query.hasTelehealth);
      const minStarRating = parseNum(req.query.minStarRating);
      const maxDrugDeductible = parseNum(req.query.maxDrugDeductible);
      const hasPartbGiveback = parseBool(req.query.hasPartbGiveback);
      const planType = req.query.planType as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));

      // ── Step 1: Resolve ZIP to county + state ──
      const zipRows = await db
        .selectDistinct({ county: plans.county, state: plans.state })
        .from(plans)
        .where(eq(plans.zipcode, zip))
        .limit(10);

      let zipResolved: { county: string; state: string } | null = null;

      // Build the location filter: if ZIP matches rows, use those counties;
      // otherwise fall back to exact ZIP match (which will return 0 rows).
      let locationCondition;
      if (zipRows.length > 0) {
        zipResolved = { county: zipRows[0].county, state: zipRows[0].state };
        if (zipRows.length === 1) {
          locationCondition = and(
            eq(plans.county, zipRows[0].county),
            eq(plans.state, zipRows[0].state)
          );
        } else {
          // ZIP spans multiple counties — use OR across all combos
          locationCondition = or(
            ...zipRows.map((r) =>
              and(eq(plans.county, r.county), eq(plans.state, r.state))
            )
          );
        }
      } else {
        // ZIP not found in data — still filter by it (will yield 0 rows)
        locationCondition = eq(plans.zipcode, zip);
      }

      // ── Step 2: Build hard WHERE clause (location only) ──
      // We fetch all plans in the location, then score in JS so we can
      // return partial matches and calculate matchScore properly.

      // Additional hard filters that are non-negotiable (location + planType)
      const hardConditions = [locationCondition!];

      if (planType) {
        hardConditions.push(ilike(plans.category, `%${planType}%`));
      }

      // ── Fetch all candidate plans for this location ──
      const candidateRows = await db
        .select()
        .from(plans)
        .where(and(...hardConditions))
        .limit(5000); // safety cap; a single county rarely exceeds this

      // ── Step 3: Score each plan against optional criteria ──
      interface CriterionCheck {
        name: string;
        test: (row: typeof candidateRows[number]) => boolean;
      }

      const criteria: CriterionCheck[] = [];

      if (maxPremium !== undefined) {
        criteria.push({
          name: "premium",
          test: (r) => (r.calculatedMonthlyPremium ?? 0) <= maxPremium,
        });
      }
      if (maxMoop !== undefined) {
        criteria.push({
          name: "moop",
          test: (r) => {
            const val = parseDollar(r.maximumOopc || "0");
            return val > 0 ? val <= maxMoop : false;
          },
        });
      }
      if (maxPcpCopay !== undefined) {
        criteria.push({
          name: "pcpCopay",
          test: (r) => r.pcpCopayMin != null && r.pcpCopayMin <= maxPcpCopay,
        });
      }
      if (maxSpecialistCopay !== undefined) {
        criteria.push({
          name: "specialistCopay",
          test: (r) =>
            r.specialistCopayMin != null && r.specialistCopayMin <= maxSpecialistCopay,
        });
      }
      if (minDental !== undefined) {
        criteria.push({
          name: "dental",
          test: (r) =>
            r.dentalCoverageLimit != null && r.dentalCoverageLimit >= minDental,
        });
      }
      if (minVision !== undefined) {
        criteria.push({
          name: "vision",
          test: (r) =>
            r.visionAllowance != null && r.visionAllowance >= minVision,
        });
      }
      if (minOtc !== undefined) {
        criteria.push({
          name: "otc",
          test: (r) => {
            if (r.otcAmountPerQuarter != null && r.otcAmountPerQuarter >= minOtc) return true;
            // Fall back to boolean flag if amount is missing
            if (r.otcAmountPerQuarter == null && r.hasOtc) return true;
            return false;
          },
        });
      }
      if (hasTransportation === true) {
        criteria.push({
          name: "transportation",
          test: (r) => r.hasTransportation === true,
        });
      }
      if (hasMealBenefit === true) {
        criteria.push({
          name: "mealBenefit",
          test: (r) => r.hasMealBenefit === true,
        });
      }
      if (hasFitnessBenefit === true) {
        criteria.push({
          name: "fitnessBenefit",
          test: (r) => r.hasFitnessBenefit === true,
        });
      }
      if (hasTelehealth === true) {
        criteria.push({
          name: "telehealth",
          test: (r) => r.hasTelehealth === true,
        });
      }
      if (minStarRating !== undefined) {
        criteria.push({
          name: "starRating",
          test: (r) =>
            r.overallStarRating != null && r.overallStarRating >= minStarRating,
        });
      }
      if (maxDrugDeductible !== undefined) {
        criteria.push({
          name: "drugDeductible",
          test: (r) =>
            r.drugDeductible != null && r.drugDeductible <= maxDrugDeductible,
        });
      }
      if (hasPartbGiveback === true) {
        criteria.push({
          name: "partbGiveback",
          test: (r) => r.partbGiveback != null && r.partbGiveback > 0,
        });
      }

      const totalCriteria = criteria.length;

      // Score and shape each candidate
      const scored = candidateRows.map((r) => {
        const matchedCriteria: string[] = [];
        const unmatchedCriteria: string[] = [];

        for (const c of criteria) {
          if (c.test(r)) {
            matchedCriteria.push(c.name);
          } else {
            unmatchedCriteria.push(c.name);
          }
        }

        const matchScore =
          totalCriteria > 0
            ? Math.round((matchedCriteria.length / totalCriteria) * 100)
            : 100; // no optional criteria => everything matches

        const moopVal = parseDollar(r.maximumOopc || "0");

        return {
          id: r.id,
          planName: r.name,
          carrier: r.organizationName,
          planType: (r.category || "").replace("PLAN_CATEGORY_", ""),
          premium: r.calculatedMonthlyPremium ?? 0,
          deductible: parseDollar(r.annualDeductible || "0"),
          moop: moopVal,
          pcpCopay: r.pcpCopayMin ?? 0,
          specialistCopay: r.specialistCopayMin ?? 0,
          dentalCoverageLimit: r.dentalCoverageLimit ?? 0,
          visionAllowance: r.visionAllowance ?? 0,
          otcAmountPerQuarter: r.otcAmountPerQuarter ?? null,
          hasTransportation: r.hasTransportation ?? false,
          hasMealBenefit: r.hasMealBenefit ?? false,
          hasFitnessBenefit: r.hasFitnessBenefit ?? false,
          hasTelehealth: r.hasTelehealth ?? false,
          starRating: r.overallStarRating ?? null,
          drugDeductible: r.drugDeductible ?? null,
          partbGiveback: r.partbGiveback ?? null,
          state: r.state,
          county: r.county,
          zipcode: r.zipcode ?? "",
          matchScore,
          matchedCriteria,
          unmatchedCriteria,
        };
      });

      // ── Step 4: Sort by matchScore DESC, then premium ASC ──
      scored.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return a.premium - b.premium;
      });

      // ── Step 5: Paginate ──
      const total = scored.length;
      const offset = (page - 1) * limit;
      const pagePlans = scored.slice(offset, offset + limit);

      // ── Step 6: Respond ──
      res.json({
        plans: pagePlans,
        total,
        page,
        limit,
        criteriaUsed: totalCriteria,
        zipResolved,
      });
    } catch (err: any) {
      console.error("Error in plan finder:", err.message);
      res.status(500).json({ error: "Failed to search plans" });
    }
  });
}
