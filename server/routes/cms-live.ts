import type { Express } from "express";
import {
  searchPlansByZip,
  getPlanDetails,
  getCountyPlans,
  searchPlansLocal,
} from "../services/cms-finder.service";

export function registerCmsLiveRoutes(app: Express) {
  /**
   * GET /api/cms-live/plans?zip={zip}&state={state}&county={county}
   * Search for plans by ZIP code or state+county.
   */
  app.get("/api/cms-live/plans", async (req, res) => {
    try {
      const zip = req.query.zip as string | undefined;
      const state = req.query.state as string | undefined;
      const county = req.query.county as string | undefined;

      if (zip) {
        if (!/^\d{5}$/.test(zip)) {
          return res.status(400).json({ error: "Invalid ZIP code format. Must be 5 digits." });
        }
        // Try CMS API first, fall back to local PBP data
        let plans = await searchPlansByZip(zip);
        if (plans.length === 0) {
          plans = await searchPlansLocal(zip);
        }
        return res.json({
          query: { zip },
          count: plans.length,
          plans,
          source: plans.length > 0 ? plans[0].source : "local",
        });
      }

      if (state && county) {
        let plans = await getCountyPlans(state, county);
        if (plans.length === 0) {
          plans = await searchPlansLocal(undefined, state, county);
        }
        return res.json({
          query: { state, county },
          count: plans.length,
          plans,
          source: plans.length > 0 ? plans[0].source : "local",
        });
      }

      return res.status(400).json({
        error: "Provide either 'zip' or both 'state' and 'county' parameters.",
      });
    } catch (err: any) {
      console.error("[CMS Live Route] Error:", err.message);
      res.status(500).json({ error: "Failed to search CMS plans" });
    }
  });

  /**
   * GET /api/cms-live/plan/:contractId/:planId
   * Get details for a specific plan.
   */
  app.get("/api/cms-live/plan/:contractId/:planId", async (req, res) => {
    try {
      const { contractId, planId } = req.params;

      if (!contractId || !planId) {
        return res.status(400).json({ error: "contractId and planId are required" });
      }

      const plan = await getPlanDetails(contractId, planId);

      if (!plan) {
        return res.status(404).json({
          error: "Plan not found",
          contractId,
          planId,
        });
      }

      res.json({
        plan,
        source: plan.source,
      });
    } catch (err: any) {
      console.error("[CMS Live Route] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch plan details" });
    }
  });
}
