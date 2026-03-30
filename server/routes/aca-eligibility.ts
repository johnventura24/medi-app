import type { Express, Request, Response } from "express";
import { determineACAEligibility, type ACAEligibilityInput } from "../services/aca-eligibility.service";

export function registerACAEligibilityRoutes(app: Express) {
  /**
   * POST /api/aca/eligibility/check
   *
   * ACA marketplace eligibility questionnaire — determines marketplace eligibility,
   * subsidy estimates, CSR eligibility, and Medicaid likelihood.
   */
  app.post("/api/aca/eligibility/check", async (req: Request, res: Response) => {
    try {
      const input = req.body as ACAEligibilityInput;

      // Basic validation
      if (typeof input.age !== "number" || input.age < 0 || input.age > 150) {
        return res.status(400).json({ error: "Invalid age" });
      }
      if (typeof input.income !== "number" || input.income < 0) {
        return res.status(400).json({ error: "Invalid income" });
      }
      if (typeof input.householdSize !== "number" || input.householdSize < 1 || input.householdSize > 8) {
        return res.status(400).json({ error: "Invalid household size (must be 1-8)" });
      }
      if (!input.state || typeof input.state !== "string") {
        return res.status(400).json({ error: "State is required" });
      }

      const result = determineACAEligibility(input);
      res.json(result);
    } catch (err: any) {
      console.error("Error checking ACA eligibility:", err.message);
      res.status(500).json({ error: "Failed to check ACA eligibility" });
    }
  });
}
