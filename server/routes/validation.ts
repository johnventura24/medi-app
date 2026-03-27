import type { Request, Response, Express } from "express";
import { db } from "../db";
import { plans } from "@shared/schema";
import type { Plan } from "@shared/schema";

// ── Types ──

interface ValidationIssue {
  id: number;
  planId: number;
  planName: string;
  carrier: string;
  ruleName: string;
  severity: "error" | "warning" | "info";
  message: string;
  fieldName: string | null;
  fieldValue: string | null;
}

interface ValidationSummary {
  totalPlans: number;
  validPlans: number;
  warnings: number;
  errors: number;
  lastRunAt: string | null;
}

// ── In-memory store ──
// TODO: When the data_validation_logs table is available and migrated,
// replace this in-memory storage with database queries against
// data_validation_logs for persistence across restarts.

let cachedIssues: ValidationIssue[] = [];
let cachedSummary: ValidationSummary = {
  totalPlans: 0,
  validPlans: 0,
  warnings: 0,
  errors: 0,
  lastRunAt: null,
};

// ── Helpers ──

function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// ── Validation rules ──

type ValidationRule = {
  name: string;
  severity: "error" | "warning" | "info";
  check: (plan: Plan) => {
    failed: boolean;
    message: string;
    fieldName: string | null;
    fieldValue: string | null;
  } | null;
};

const rules: ValidationRule[] = [
  // Rule 1: Premium < 0 or > 500 → warning
  {
    name: "premium_range",
    severity: "warning",
    check: (plan) => {
      const premium = plan.calculatedMonthlyPremium ?? 0;
      if (premium < 0 || premium > 500) {
        return {
          failed: true,
          message: `Monthly premium $${premium} is outside expected range ($0-$500)`,
          fieldName: "calculatedMonthlyPremium",
          fieldValue: String(premium),
        };
      }
      return null;
    },
  },
  // Rule 2: MOOP > 8850 (2026 limit) → error
  {
    name: "moop_exceeds_limit",
    severity: "error",
    check: (plan) => {
      const moopText = plan.maximumOopc || "";
      const moopVal = parseDollar(moopText);
      if (moopVal > 8850) {
        return {
          failed: true,
          message: `Max out-of-pocket $${moopVal.toLocaleString()} exceeds 2026 CMS limit of $8,850`,
          fieldName: "maximumOopc",
          fieldValue: moopText,
        };
      }
      return null;
    },
  },
  // Rule 3: MOOP = 0 or null → warning
  {
    name: "moop_missing",
    severity: "warning",
    check: (plan) => {
      const moopText = plan.maximumOopc || "";
      const moopVal = parseDollar(moopText);
      if (moopVal === 0 || !plan.maximumOopc) {
        return {
          failed: true,
          message: "Max out-of-pocket is $0 or missing",
          fieldName: "maximumOopc",
          fieldValue: plan.maximumOopc || null,
        };
      }
      return null;
    },
  },
  // Rule 4: Star rating outside 1-5 → error
  {
    name: "star_rating_range",
    severity: "error",
    check: (plan) => {
      const rating = plan.overallStarRating;
      if (rating !== null && rating !== undefined && (rating < 1 || rating > 5)) {
        return {
          failed: true,
          message: `Overall star rating ${rating} is outside valid range (1-5)`,
          fieldName: "overallStarRating",
          fieldValue: String(rating),
        };
      }
      return null;
    },
  },
  // Rule 5: Star rating = null → info
  {
    name: "star_rating_missing",
    severity: "info",
    check: (plan) => {
      if (plan.overallStarRating === null || plan.overallStarRating === undefined) {
        return {
          failed: true,
          message: "Overall star rating is missing",
          fieldName: "overallStarRating",
          fieldValue: null,
        };
      }
      return null;
    },
  },
  // Rule 6: $0 premium AND $0 deductible AND $0 MOOP → warning (suspicious)
  {
    name: "suspicious_zero_combo",
    severity: "warning",
    check: (plan) => {
      const premium = plan.calculatedMonthlyPremium ?? 0;
      const deductible = parseDollar(plan.annualDeductible || "0");
      const moop = parseDollar(plan.maximumOopc || "0");
      if (premium === 0 && deductible === 0 && moop === 0) {
        return {
          failed: true,
          message: "Suspicious combination: $0 premium, $0 deductible, and $0 MOOP",
          fieldName: "calculatedMonthlyPremium",
          fieldValue: "0",
        };
      }
      return null;
    },
  },
  // Rule 7: Missing organizationName → error
  {
    name: "missing_carrier",
    severity: "error",
    check: (plan) => {
      if (!plan.organizationName || plan.organizationName.trim() === "") {
        return {
          failed: true,
          message: "Organization name is empty",
          fieldName: "organizationName",
          fieldValue: null,
        };
      }
      return null;
    },
  },
  // Rule 8: Missing state or county → error
  {
    name: "missing_state_or_county",
    severity: "error",
    check: (plan) => {
      if (!plan.state || plan.state.trim() === "") {
        return {
          failed: true,
          message: "State is empty",
          fieldName: "state",
          fieldValue: null,
        };
      }
      if (!plan.county || plan.county.trim() === "") {
        return {
          failed: true,
          message: "County is empty",
          fieldName: "county",
          fieldValue: null,
        };
      }
      return null;
    },
  },
  // Rule 9: Dental coverage limit > 10000 → warning (outlier)
  {
    name: "dental_limit_outlier",
    severity: "warning",
    check: (plan) => {
      const dental = plan.dentalCoverageLimit;
      if (dental !== null && dental !== undefined && dental > 10000) {
        return {
          failed: true,
          message: `Dental coverage limit $${dental.toLocaleString()} is unusually high (>$10,000)`,
          fieldName: "dentalCoverageLimit",
          fieldValue: String(dental),
        };
      }
      return null;
    },
  },
  // Rule 10: PCP copay > 100 → warning (outlier)
  {
    name: "pcp_copay_outlier",
    severity: "warning",
    check: (plan) => {
      const pcpCopay = plan.pcpCopayMin;
      if (pcpCopay !== null && pcpCopay !== undefined && pcpCopay > 100) {
        return {
          failed: true,
          message: `PCP copay $${pcpCopay} exceeds $100 threshold (outlier)`,
          fieldName: "pcpCopayMin",
          fieldValue: String(pcpCopay),
        };
      }
      return null;
    },
  },
];

/**
 * Run all validation rules against all plans in the database.
 * Returns the issues found and stores them in memory.
 */
async function runValidation(): Promise<{ summary: ValidationSummary; issues: ValidationIssue[] }> {
  // TODO: For very large datasets, consider batching with LIMIT/OFFSET
  const allPlans = await db.select().from(plans);

  const issues: ValidationIssue[] = [];
  let issueIdCounter = 1;
  const plansWithIssues = new Set<number>();

  for (const plan of allPlans) {
    for (const rule of rules) {
      const result = rule.check(plan);
      if (result) {
        issues.push({
          id: issueIdCounter++,
          planId: plan.id,
          planName: plan.name,
          carrier: plan.organizationName,
          ruleName: rule.name,
          severity: rule.severity,
          message: result.message,
          fieldName: result.fieldName,
          fieldValue: result.fieldValue,
        });

        plansWithIssues.add(plan.id);
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const summary: ValidationSummary = {
    totalPlans: allPlans.length,
    validPlans: allPlans.length - plansWithIssues.size,
    warnings: warningCount,
    errors: errorCount,
    lastRunAt: new Date().toISOString(),
  };

  // Store in memory
  // TODO: Persist to data_validation_logs table when available
  cachedIssues = issues;
  cachedSummary = summary;

  return { summary, issues };
}

/**
 * Register validation routes on the Express app.
 *
 * GET  /api/validation/summary
 * GET  /api/validation/details?severity={error|warning|info}&page=1&limit=50
 * POST /api/validation/run
 */
export function registerValidationRoutes(app: Express): void {
  /**
   * GET /api/validation/summary
   * Returns the current validation summary.
   * If no validation has been run yet, returns zeroed summary.
   */
  app.get("/api/validation/summary", async (_req: Request, res: Response) => {
    try {
      res.json(cachedSummary);
    } catch (err: any) {
      console.error("Error in /api/validation/summary:", err.message);
      res.status(500).json({ error: "Failed to retrieve validation summary" });
    }
  });

  /**
   * GET /api/validation/details
   * Query params:
   *   severity - "error" | "warning" | "info" (filter)
   *   page     - page number (default 1)
   *   limit    - results per page (default 50)
   */
  app.get("/api/validation/details", async (req: Request, res: Response) => {
    try {
      const severityFilter = req.query.severity as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

      let filtered = cachedIssues;

      if (
        severityFilter &&
        (severityFilter === "error" || severityFilter === "warning" || severityFilter === "info")
      ) {
        filtered = filtered.filter((i) => i.severity === severityFilter);
      }

      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / limit);
      const offset = (page - 1) * limit;
      const pageItems = filtered.slice(offset, offset + limit);

      res.json({
        items: pageItems,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      });
    } catch (err: any) {
      console.error("Error in /api/validation/details:", err.message);
      res.status(500).json({ error: "Failed to retrieve validation details" });
    }
  });

  /**
   * POST /api/validation/run
   * Triggers a full validation run against all plans.
   * Returns the summary and issue count.
   */
  app.post("/api/validation/run", async (_req: Request, res: Response) => {
    try {
      const result = await runValidation();

      res.json({
        summary: result.summary,
        issueCount: result.issues.length,
        message: `Validation complete. Found ${result.summary.errors} errors and ${result.summary.warnings} warnings across ${result.summary.totalPlans} plans.`,
      });
    } catch (err: any) {
      console.error("Error in /api/validation/run:", err.message);
      res.status(500).json({ error: "Failed to run validation" });
    }
  });
}

export default registerValidationRoutes;
