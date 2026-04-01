import type { Express, Request, Response } from "express";
import {
  getDisruptionAlerts,
  getDisruptionSummary,
  getAffectedMembers,
} from "../services/disruption-alerts.service";

export function registerDisruptionAlertRoutes(app: Express) {
  /**
   * GET /api/disruption/alerts?state={ST}
   * Returns disruption alerts, optionally filtered by state
   */
  app.get("/api/disruption/alerts", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const alerts = await getDisruptionAlerts(state);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching disruption alerts:", err.message);
      res.status(500).json({ error: "Failed to fetch disruption alerts" });
    }
  });

  /**
   * GET /api/disruption/summary?state={ST}
   * Returns summary stats for disruption alerts
   */
  app.get("/api/disruption/summary", async (req: Request, res: Response) => {
    try {
      const state = req.query.state as string | undefined;
      const summary = await getDisruptionSummary(state);
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching disruption summary:", err.message);
      res.status(500).json({ error: "Failed to fetch disruption summary" });
    }
  });

  /**
   * GET /api/disruption/affected-members?contractId={id}&planId={id}
   * Returns details about affected members for a specific plan
   */
  app.get("/api/disruption/affected-members", async (req: Request, res: Response) => {
    try {
      const contractId = req.query.contractId as string;
      const planId = req.query.planId as string;

      if (!contractId || !planId) {
        return res.status(400).json({ error: "contractId and planId are required" });
      }

      const result = await getAffectedMembers(contractId, planId);
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching affected members:", err.message);
      res.status(500).json({ error: "Failed to fetch affected members" });
    }
  });
}
