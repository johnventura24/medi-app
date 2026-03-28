import type { Express } from "express";
import { findHiddenGems } from "../services/hidden-gems.service";

export function registerHiddenGemRoutes(app: Express) {
  // GET /api/gems?state={ST}&limit=20
  app.get("/api/gems", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const results = await findHiddenGems({
        state: typeof state === "string" ? state : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : 20,
      });
      res.json(results);
    } catch (err: any) {
      console.error("Error finding hidden gems:", err.message);
      res.status(500).json({ error: "Failed to find hidden gems" });
    }
  });

  // GET /api/gems/county?county={county}&state={ST}
  app.get("/api/gems/county", async (req, res) => {
    try {
      const { county, state } = req.query;
      if (!county || typeof county !== "string" || !state || typeof state !== "string") {
        return res.status(400).json({ error: "county and state query parameters are required" });
      }
      const results = await findHiddenGems({
        county,
        state,
        limit: 20,
      });
      res.json(results);
    } catch (err: any) {
      console.error("Error finding county gems:", err.message);
      res.status(500).json({ error: "Failed to find county gems" });
    }
  });
}
