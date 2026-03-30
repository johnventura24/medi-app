/**
 * Carrier Scorecard Routes — Financial and market health scoring
 *
 * GET /api/scorecards?state={ST}
 */
import type { Express, Request, Response } from "express";
import { getCarrierScorecards } from "../services/carrier-scorecard.service";

export function registerCarrierScorecardRoutes(app: Express): void {
  app.get("/api/scorecards", async (req: Request, res: Response) => {
    try {
      const { state } = req.query;

      const scorecards = await getCarrierScorecards({
        state: state && typeof state === "string" ? state : undefined,
      });

      res.json(scorecards);
    } catch (err: any) {
      console.error("Error fetching carrier scorecards:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier scorecards" });
    }
  });
}
