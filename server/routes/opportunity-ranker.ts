import type { Express } from "express";
import { getRankedStates, getRankedCounties, type OpportunityFilters } from "../services/opportunity-ranker.service";

const VALID_PERIODS = ["aep", "oep", "sep", "all"] as const;
const VALID_DEMOGRAPHICS = ["turning_65", "dual_eligible", "chronic", "low_income", "rural", "all"] as const;

function parseFilters(query: any): OpportunityFilters {
  const period = typeof query.period === "string" && VALID_PERIODS.includes(query.period as any)
    ? (query.period as OpportunityFilters["enrollmentPeriod"])
    : "all";
  const demographic = typeof query.demographic === "string" && VALID_DEMOGRAPHICS.includes(query.demographic as any)
    ? (query.demographic as OpportunityFilters["demographic"])
    : "all";
  return { enrollmentPeriod: period, demographic };
}

export function registerOpportunityRankerRoutes(app: Express) {
  // GET /api/opportunities/states — ranked states by composite opportunity score
  app.get("/api/opportunities/states", async (req, res) => {
    try {
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
      const filters = parseFilters(req.query);
      const data = await getRankedStates(Math.min(Math.max(limit, 1), 100), filters);
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
      const filters = parseFilters(req.query);
      const data = await getRankedCounties(state, Math.min(Math.max(limit, 1), 500), filters);
      res.json(data);
    } catch (err: any) {
      console.error("Error in opportunity counties:", err.message);
      res.status(500).json({ error: "Failed to fetch county opportunity rankings" });
    }
  });
}
