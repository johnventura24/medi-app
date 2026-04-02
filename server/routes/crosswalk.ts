import type { Express, Request, Response } from "express";
import {
  getCrosswalkSummary,
  getTerminatedPlans,
  getServiceAreaChanges,
  getConsolidatedPlans,
  getNewPlans,
} from "../services/crosswalk.service";

export function registerCrosswalkRoutes(app: Express) {
  /**
   * GET /api/crosswalk/summary?state={ST}
   */
  app.get("/api/crosswalk/summary", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const summary = await getCrosswalkSummary(state);
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching crosswalk summary:", err.message);
      res.status(500).json({ error: "Failed to fetch crosswalk summary" });
    }
  });

  /**
   * GET /api/crosswalk/terminated?state={ST}
   */
  app.get("/api/crosswalk/terminated", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const data = await getTerminatedPlans(state);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching terminated plans:", err.message);
      res.status(500).json({ error: "Failed to fetch terminated plans" });
    }
  });

  /**
   * GET /api/crosswalk/sar?state={ST} — Service Area Reductions
   */
  app.get("/api/crosswalk/sar", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const data = await getServiceAreaChanges("reduction", state);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching SAR plans:", err.message);
      res.status(500).json({ error: "Failed to fetch service area reductions" });
    }
  });

  /**
   * GET /api/crosswalk/sae?state={ST} — Service Area Expansions
   */
  app.get("/api/crosswalk/sae", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const data = await getServiceAreaChanges("expansion", state);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching SAE plans:", err.message);
      res.status(500).json({ error: "Failed to fetch service area expansions" });
    }
  });

  /**
   * GET /api/crosswalk/consolidated?state={ST}
   */
  app.get("/api/crosswalk/consolidated", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const data = await getConsolidatedPlans(state);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching consolidated plans:", err.message);
      res.status(500).json({ error: "Failed to fetch consolidated plans" });
    }
  });

  /**
   * GET /api/crosswalk/new?state={ST}
   */
  app.get("/api/crosswalk/new", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const data = await getNewPlans(state);
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching new plans:", err.message);
      res.status(500).json({ error: "Failed to fetch new plans" });
    }
  });
}
