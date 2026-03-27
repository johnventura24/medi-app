import type { Express } from "express";
import {
  findUnderservedMarkets,
  findCompetitiveGaps,
  generateMarketingAngles,
  findAgentProspects,
  getCarrierMarketShare,
  getBenefitDistribution,
} from "../services/market-intelligence.service";

export function registerMarketIntelligenceRoutes(app: Express) {
  // GET /api/intelligence/underserved?state={ST}&limit=20
  app.get("/api/intelligence/underserved", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const results = await findUnderservedMarkets({
        state: typeof state === "string" ? state : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : 50,
      });
      res.json(results);
    } catch (err: any) {
      console.error("Error in underserved markets:", err.message);
      res.status(500).json({ error: "Failed to fetch underserved markets" });
    }
  });

  // GET /api/intelligence/competitive-gaps?carrier={org}&state={ST}
  app.get("/api/intelligence/competitive-gaps", async (req, res) => {
    try {
      const { carrier, state } = req.query;
      if (!carrier || typeof carrier !== "string") {
        return res.status(400).json({ error: "carrier query parameter is required" });
      }
      const results = await findCompetitiveGaps(
        carrier,
        typeof state === "string" ? state : undefined,
      );
      res.json(results);
    } catch (err: any) {
      console.error("Error in competitive gaps:", err.message);
      res.status(500).json({ error: "Failed to fetch competitive gaps" });
    }
  });

  // GET /api/intelligence/marketing-angles?county={county}&state={ST}
  app.get("/api/intelligence/marketing-angles", async (req, res) => {
    try {
      const { county, state } = req.query;
      if (!county || typeof county !== "string" || !state || typeof state !== "string") {
        return res.status(400).json({ error: "county and state query parameters are required" });
      }
      const results = await generateMarketingAngles(county, state);
      res.json(results);
    } catch (err: any) {
      console.error("Error in marketing angles:", err.message);
      res.status(500).json({ error: "Failed to generate marketing angles" });
    }
  });

  // GET /api/intelligence/prospects?carrier={org}&state={ST}&limit=20
  app.get("/api/intelligence/prospects", async (req, res) => {
    try {
      const { carrier, state, limit } = req.query;
      const results = await findAgentProspects({
        carrier: typeof carrier === "string" ? carrier : undefined,
        state: typeof state === "string" ? state : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : 50,
      });
      res.json(results);
    } catch (err: any) {
      console.error("Error in agent prospects:", err.message);
      res.status(500).json({ error: "Failed to fetch agent prospects" });
    }
  });

  // GET /api/intelligence/market-share?state={ST}
  app.get("/api/intelligence/market-share", async (req, res) => {
    try {
      const { state } = req.query;
      const results = await getCarrierMarketShare(
        typeof state === "string" ? state : undefined,
      );
      res.json(results);
    } catch (err: any) {
      console.error("Error in market share:", err.message);
      res.status(500).json({ error: "Failed to fetch market share" });
    }
  });

  // GET /api/intelligence/benefit-distribution?county={county}&state={ST}
  app.get("/api/intelligence/benefit-distribution", async (req, res) => {
    try {
      const { county, state } = req.query;
      const results = await getBenefitDistribution(
        typeof county === "string" ? county : undefined,
        typeof state === "string" ? state : undefined,
      );
      res.json(results);
    } catch (err: any) {
      console.error("Error in benefit distribution:", err.message);
      res.status(500).json({ error: "Failed to fetch benefit distribution" });
    }
  });
}
