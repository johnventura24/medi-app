import type { Express } from "express";
import { getRankedStates, getRankedCounties } from "../services/opportunity-ranker.service";

export function registerOpportunityRankerRoutes(app: Express) {
  // GET /api/opportunities/states — ranked states by composite opportunity score
  app.get("/api/opportunities/states", async (req, res) => {
    try {
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
      const data = await getRankedStates(Math.min(Math.max(limit, 1), 100));
      res.json(data);
    } catch (err: any) {
      console.error("Error in opportunity states:", err.message);
      res.status(500).json({ error: "Failed to fetch state opportunity rankings" });
    }
  });

  // GET /api/opportunities/counties — ranked counties, optionally filtered by state
  app.get("/api/opportunities/counties", async (req, res) => {
    try {
      const state = typeof req.query.state === "string" ? req.query.state : undefined;
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
      const data = await getRankedCounties(state, Math.min(Math.max(limit, 1), 500));
      res.json(data);
    } catch (err: any) {
      console.error("Error in opportunity counties:", err.message);
      res.status(500).json({ error: "Failed to fetch county opportunity rankings" });
    }
  });
}
