import type { Express } from "express";
import {
  searchACAPlans,
  getACAMarketSummary,
  compareACAvsMA,
  getACAStates,
  getACACounties,
} from "../services/aca.service";

export function registerACARoutes(app: Express) {
  // GET /api/aca/plans?state={ST}&county={county}&metalLevel={level}&planType={type}&issuer={name}&limit=100&offset=0
  app.get("/api/aca/plans", async (req, res) => {
    try {
      const { state, county, metalLevel, planType, issuer, limit, offset } = req.query;
      const result = await searchACAPlans({
        state: typeof state === "string" ? state : undefined,
        county: typeof county === "string" ? county : undefined,
        metalLevel: typeof metalLevel === "string" ? metalLevel : undefined,
        planType: typeof planType === "string" ? planType : undefined,
        issuer: typeof issuer === "string" ? issuer : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : 100,
        offset: typeof offset === "string" ? parseInt(offset, 10) : 0,
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error searching ACA plans:", err.message);
      res.status(500).json({ error: "Failed to search ACA plans" });
    }
  });

  // GET /api/aca/summary?state={ST}
  app.get("/api/aca/summary", async (req, res) => {
    try {
      const { state } = req.query;
      if (!state || typeof state !== "string") {
        return res.status(400).json({ error: "state query parameter is required" });
      }
      const summary = await getACAMarketSummary(state);
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching ACA summary:", err.message);
      res.status(500).json({ error: "Failed to fetch ACA market summary" });
    }
  });

  // GET /api/aca/compare?state={ST}&county={county}
  app.get("/api/aca/compare", async (req, res) => {
    try {
      const { state, county } = req.query;
      if (!state || typeof state !== "string" || !county || typeof county !== "string") {
        return res.status(400).json({ error: "state and county query parameters are required" });
      }
      const comparison = await compareACAvsMA(state, county);
      res.json(comparison);
    } catch (err: any) {
      console.error("Error comparing ACA vs MA:", err.message);
      res.status(500).json({ error: "Failed to compare ACA vs MA" });
    }
  });

  // GET /api/aca/states — list states with ACA data
  app.get("/api/aca/states", async (_req, res) => {
    try {
      const states = await getACAStates();
      res.json(states);
    } catch (err: any) {
      console.error("Error fetching ACA states:", err.message);
      res.status(500).json({ error: "Failed to fetch ACA states" });
    }
  });

  // GET /api/aca/counties?state={ST} — list counties for a state
  app.get("/api/aca/counties", async (req, res) => {
    try {
      const { state } = req.query;
      if (!state || typeof state !== "string") {
        return res.status(400).json({ error: "state query parameter is required" });
      }
      const counties = await getACACounties(state);
      res.json(counties);
    } catch (err: any) {
      console.error("Error fetching ACA counties:", err.message);
      res.status(500).json({ error: "Failed to fetch ACA counties" });
    }
  });
}
