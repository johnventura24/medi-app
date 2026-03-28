import type { Express } from "express";
import { getStateOverview, getCountyBattleground, getAllStatesOverview } from "../services/battleground.service";

export function registerBattlegroundRoutes(app: Express) {
  // GET /api/battleground?state={ST}
  app.get("/api/battleground", async (req, res) => {
    try {
      const { state } = req.query;
      if (state && typeof state === "string") {
        const overview = await getStateOverview(state);
        return res.json(overview);
      }
      // No state specified — return all states overview
      const states = await getAllStatesOverview();
      res.json(states);
    } catch (err: any) {
      console.error("Error in battleground:", err.message);
      res.status(500).json({ error: "Failed to fetch battleground data" });
    }
  });

  // GET /api/battleground/county?county={county}&state={ST}
  app.get("/api/battleground/county", async (req, res) => {
    try {
      const { county, state } = req.query;
      if (!county || typeof county !== "string" || !state || typeof state !== "string") {
        return res.status(400).json({ error: "county and state query parameters are required" });
      }
      const result = await getCountyBattleground(county, state);
      if (!result) {
        return res.status(404).json({ error: "County not found" });
      }
      res.json(result);
    } catch (err: any) {
      console.error("Error in county battleground:", err.message);
      res.status(500).json({ error: "Failed to fetch county battleground data" });
    }
  });
}
