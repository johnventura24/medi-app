import type { Express, Request, Response } from "express";
import { determineEligibility, type EligibilityInput } from "../services/eligibility.service";

export function registerEligibilityRoutes(app: Express) {
  /**
   * POST /api/eligibility/check
   *
   * Self-reported eligibility questionnaire — determines what plans
   * a beneficiary qualifies for and what enrollment periods are active.
   */
  app.post("/api/eligibility/check", async (req: Request, res: Response) => {
    try {
      const input = req.body as EligibilityInput;

      // Basic validation
      if (typeof input.age !== "number" || input.age < 0 || input.age > 150) {
        return res.status(400).json({ error: "Invalid age" });
      }
      if (typeof input.hasPartA !== "boolean") {
        return res.status(400).json({ error: "hasPartA is required" });
      }
      if (typeof input.hasPartB !== "boolean") {
        return res.status(400).json({ error: "hasPartB is required" });
      }

      const result = determineEligibility(input);
      res.json(result);
    } catch (err: any) {
      console.error("Error checking eligibility:", err.message);
      res.status(500).json({ error: "Failed to check eligibility" });
    }
  });
}
