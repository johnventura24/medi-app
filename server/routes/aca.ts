import type { Express } from "express";
import {
  searchACAPlans,
  getACAMarketSummary,
  compareACAvsMA,
  getACAStates,
  getACACounties,
  calculateSubsidy,
  getCarrierCoverageAnalysis,
  getCarrierRankings,
  getSubsidyMap,
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

  // POST /api/aca/subsidy — calculate premium subsidy
  app.post("/api/aca/subsidy", async (req, res) => {
    try {
      const { income, householdSize, age, state, county } = req.body;
      if (!income || !householdSize || !age || !state) {
        return res.status(400).json({
          error: "income, householdSize, age, and state are required",
        });
      }
      const result = await calculateSubsidy({
        income: Number(income),
        householdSize: Number(householdSize),
        age: Number(age),
        state: String(state),
        county: county ? String(county) : undefined,
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error calculating subsidy:", err.message);
      res.status(500).json({ error: "Failed to calculate subsidy" });
    }
  });

  // GET /api/aca/carrier-analysis?carrier={name}
  app.get("/api/aca/carrier-analysis", async (req, res) => {
    try {
      const { carrier } = req.query;
      const result = await getCarrierCoverageAnalysis(
        typeof carrier === "string" ? carrier : undefined
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching carrier analysis:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier analysis" });
    }
  });

  // GET /api/aca/carrier-rankings?metalLevel={silver}&state={ST}
  app.get("/api/aca/carrier-rankings", async (req, res) => {
    try {
      const { metalLevel, state } = req.query;
      const result = await getCarrierRankings({
        metalLevel: typeof metalLevel === "string" ? metalLevel : undefined,
        state: typeof state === "string" ? state : undefined,
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching carrier rankings:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier rankings" });
    }
  });

  // GET /api/aca/subsidy-map
  app.get("/api/aca/subsidy-map", async (_req, res) => {
    try {
      const result = await getSubsidyMap();
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching subsidy map:", err.message);
      res.status(500).json({ error: "Failed to fetch subsidy map" });
    }
  });
}
