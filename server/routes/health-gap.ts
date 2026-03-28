import type { Express } from "express";
import { getStateHealthGaps, getCountyHealthGaps } from "../services/health-gap.service";

export function registerHealthGapRoutes(app: Express) {
  // GET /api/health-gaps?state={ST}&limit=20
  app.get("/api/health-gaps", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const data = await getStateHealthGaps(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 20
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in health gaps:", err.message);
      res.status(500).json({ error: "Failed to fetch health gap data" });
    }
  });

  // GET /api/health-gaps/county?county={county}&state={ST}
  app.get("/api/health-gaps/county", async (req, res) => {
    try {
      const { county, state } = req.query;
      if (!county || typeof county !== "string" || !state || typeof state !== "string") {
        return res.status(400).json({ error: "county and state query parameters are required" });
      }
      const result = await getCountyHealthGaps(county, state);
      if (!result) {
        return res.status(404).json({ error: "County not found or no plans available" });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error in county health gaps:", err.message);
      res.status(500).json({ error: "Failed to fetch county health gap data" });
    }
  });
}
