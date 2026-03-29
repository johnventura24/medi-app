import type { Express, Request, Response } from "express";
import { smartMatch, type MatchProfile } from "../services/smart-match.service";

const VALID_PROFILES: MatchProfile[] = [
  "cheapest",
  "best_dental",
  "best_drugs",
  "best_overall",
  "doctor_friendly",
  "chronic_care",
  "extra_benefits",
];

export function registerSmartMatchRoutes(app: Express) {
  /**
   * GET /api/smart-match?zip={zip}&profile={profile}
   *
   * One-click plan matching. Pick a profile, get the best plans.
   */
  app.get("/api/smart-match", async (req: Request, res: Response) => {
    try {
      const zip = req.query.zip as string | undefined;
      const profile = req.query.profile as string | undefined;

      if (!zip || !/^\d{5}$/.test(zip)) {
        return res.status(400).json({ error: "Valid 5-digit ZIP required" });
      }

      if (!profile || !VALID_PROFILES.includes(profile as MatchProfile)) {
        return res.status(400).json({
          error: `Invalid profile. Must be one of: ${VALID_PROFILES.join(", ")}`,
        });
      }

      const result = await smartMatch(zip, profile as MatchProfile);
      res.json(result);
    } catch (err: any) {
      console.error("Error in smart match:", err.message);
      res.status(500).json({ error: "Failed to run smart match" });
    }
  });
}
