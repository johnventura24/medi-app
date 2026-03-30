import type { Express, Request, Response } from "express";
import { acaSmartMatch, type ACAMatchProfile } from "../services/aca-smart-match.service";

const VALID_PROFILES: ACAMatchProfile[] = [
  "cheapest_after_subsidy",
  "lowest_deductible",
  "best_value_silver",
  "hsa_eligible",
  "family_friendly",
  "comprehensive",
];

export function registerACASmartMatchRoutes(app: Express) {
  /**
   * GET /api/aca/smart-match?state={ST}&profile={profile}&income={income}&householdSize={size}&age={age}&county={county}
   *
   * One-click ACA plan matching. Pick a profile, optionally provide income
   * for subsidy calculation, and get the best marketplace plans.
   */
  app.get("/api/aca/smart-match", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const profile = req.query.profile as string | undefined;
      const county = req.query.county as string | undefined;
      const income = req.query.income ? Number(req.query.income) : undefined;
      const householdSize = req.query.householdSize ? Number(req.query.householdSize) : undefined;
      const age = req.query.age ? Number(req.query.age) : undefined;

      if (!state || !/^[A-Za-z]{2}$/.test(state)) {
        return res.status(400).json({ error: "Valid 2-letter state code required" });
      }

      if (!profile || !VALID_PROFILES.includes(profile as ACAMatchProfile)) {
        return res.status(400).json({
          error: `Invalid profile. Must be one of: ${VALID_PROFILES.join(", ")}`,
        });
      }

      const result = await acaSmartMatch({
        state,
        county,
        profile: profile as ACAMatchProfile,
        income,
        householdSize,
        age,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Error in ACA smart match:", err.message);
      res.status(500).json({ error: "Failed to run ACA smart match" });
    }
  });
}
