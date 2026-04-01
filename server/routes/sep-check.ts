import type { Express, Request, Response } from "express";
import { checkSEPEligibility, type SEPCheckInput } from "../services/sep-eligibility.service";

export function registerSEPCheckRoutes(app: Express) {
  /**
   * POST /api/sep/check
   * Body: SEPCheckInput
   * Returns: SEPCheckResult with active SEPs, best plans, agent scripts
   */
  app.post("/api/sep/check", async (req: Request, res: Response) => {
    try {
      const input = req.body as SEPCheckInput;

      // Basic validation
      if (typeof input.hasMedicare !== "boolean") {
        return res.status(400).json({ error: "hasMedicare is required" });
      }
      if (typeof input.hasPartA !== "boolean") {
        return res.status(400).json({ error: "hasPartA is required" });
      }
      if (typeof input.hasPartB !== "boolean") {
        return res.status(400).json({ error: "hasPartB is required" });
      }
      if (!input.zipCode || typeof input.zipCode !== "string") {
        return res.status(400).json({ error: "zipCode is required" });
      }

      const result = await checkSEPEligibility(input);
      res.json(result);
    } catch (err: any) {
      console.error("Error checking SEP eligibility:", err.message);
      res.status(500).json({ error: "Failed to check SEP eligibility" });
    }
  });
}
