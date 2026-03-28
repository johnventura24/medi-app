import type { Express } from "express";
import {
  getCarrierTrends,
  getBenefitTrends,
  getMarketTrends,
  getTopMovers,
  getPlanHistory,
  getStateComparison,
  getCarrierLeaderboard,
} from "../services/trends.service";

export function registerTrendRoutes(app: Express) {
  // GET /api/trends/carrier?carrier={name}&state={ST}
  app.get("/api/trends/carrier", async (req, res) => {
    try {
      const { carrier, state } = req.query;
      if (!carrier || typeof carrier !== "string") {
        return res.status(400).json({ error: "carrier query parameter is required" });
      }
      const result = await getCarrierTrends(
        carrier,
        typeof state === "string" ? state : undefined
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error in carrier trends:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier trends" });
    }
  });

  // GET /api/trends/benefits?state={ST}
  app.get("/api/trends/benefits", async (req, res) => {
    try {
      const { state } = req.query;
      const result = await getBenefitTrends(
        typeof state === "string" ? state : undefined
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error in benefit trends:", err.message);
      res.status(500).json({ error: "Failed to fetch benefit trends" });
    }
  });

  // GET /api/trends/market?state={ST}
  app.get("/api/trends/market", async (req, res) => {
    try {
      const { state } = req.query;
      if (!state || typeof state !== "string") {
        return res.status(400).json({ error: "state query parameter is required" });
      }
      const result = await getMarketTrends(state);
      res.json(result);
    } catch (err: any) {
      console.error("Error in market trends:", err.message);
      res.status(500).json({ error: "Failed to fetch market trends" });
    }
  });

  // GET /api/trends/movers?state={ST}&limit=10
  app.get("/api/trends/movers", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const result = await getTopMovers(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 10
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error in top movers:", err.message);
      res.status(500).json({ error: "Failed to fetch top movers" });
    }
  });

  // GET /api/trends/plan-history?contractId={id}&planId={id}
  app.get("/api/trends/plan-history", async (req, res) => {
    try {
      const { contractId, planId } = req.query;
      if (!contractId || typeof contractId !== "string" || !planId || typeof planId !== "string") {
        return res.status(400).json({ error: "contractId and planId query parameters are required" });
      }
      const result = await getPlanHistory(contractId, planId);
      res.json(result);
    } catch (err: any) {
      console.error("Error in plan history:", err.message);
      res.status(500).json({ error: "Failed to fetch plan history" });
    }
  });

  // GET /api/trends/states — state comparison for single-year fallback
  app.get("/api/trends/states", async (_req, res) => {
    try {
      const result = await getStateComparison();
      res.json(result);
    } catch (err: any) {
      console.error("Error in state comparison:", err.message);
      res.status(500).json({ error: "Failed to fetch state comparison" });
    }
  });

  // GET /api/trends/leaderboard?state={ST}&limit=15
  app.get("/api/trends/leaderboard", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const result = await getCarrierLeaderboard(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 15
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error in carrier leaderboard:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier leaderboard" });
    }
  });
}
