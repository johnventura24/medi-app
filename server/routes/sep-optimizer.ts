import type { Express } from "express";
import {
  getSEPOpportunities,
  getFiveStarPlans,
  getDSNPPlans,
  getAtRiskPlans,
  getConversionOpportunities,
} from "../services/sep-optimizer.service";

export function registerSEPOptimizerRoutes(app: Express) {
  // GET /api/sep/opportunities?state={ST}
  app.get("/api/sep/opportunities", async (req, res) => {
    try {
      const { state } = req.query;
      const stateStr = state && typeof state === "string" ? state : undefined;
      const opportunities = await getSEPOpportunities(stateStr);
      res.json(opportunities);
    } catch (err: any) {
      console.error("Error fetching SEP opportunities:", err.message);
      res.status(500).json({ error: "Failed to fetch SEP opportunities" });
    }
  });

  // GET /api/sep/five-star?state={ST}&county={county}
  app.get("/api/sep/five-star", async (req, res) => {
    try {
      const { state, county } = req.query;
      const stateStr = state && typeof state === "string" ? state : undefined;
      const countyStr = county && typeof county === "string" ? county : undefined;
      const plans = await getFiveStarPlans(stateStr, countyStr);
      res.json(plans);
    } catch (err: any) {
      console.error("Error fetching 5-star plans:", err.message);
      res.status(500).json({ error: "Failed to fetch 5-star plans" });
    }
  });

  // GET /api/sep/dsnp?state={ST}
  app.get("/api/sep/dsnp", async (req, res) => {
    try {
      const { state } = req.query;
      const stateStr = state && typeof state === "string" ? state : undefined;
      const plans = await getDSNPPlans(stateStr);
      res.json(plans);
    } catch (err: any) {
      console.error("Error fetching D-SNP plans:", err.message);
      res.status(500).json({ error: "Failed to fetch D-SNP plans" });
    }
  });

  // GET /api/sep/at-risk?state={ST}
  app.get("/api/sep/at-risk", async (req, res) => {
    try {
      const { state } = req.query;
      const stateStr = state && typeof state === "string" ? state : undefined;
      const plans = await getAtRiskPlans(stateStr);
      res.json(plans);
    } catch (err: any) {
      console.error("Error fetching at-risk plans:", err.message);
      res.status(500).json({ error: "Failed to fetch at-risk plans" });
    }
  });

  // GET /api/sep/conversion?state={ST}&limit=20
  app.get("/api/sep/conversion", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const stateStr = state && typeof state === "string" ? state : undefined;
      const limitNum = limit && typeof limit === "string" ? parseInt(limit) : 20;
      const opportunities = await getConversionOpportunities(stateStr, limitNum);
      res.json(opportunities);
    } catch (err: any) {
      console.error("Error fetching conversion opportunities:", err.message);
      res.status(500).json({ error: "Failed to fetch conversion opportunities" });
    }
  });
}
