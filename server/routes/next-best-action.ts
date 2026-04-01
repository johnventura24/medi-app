import type { Express, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getNextBestActions, getNextBestActionsForClient } from "../services/next-best-action.service";

export function registerNextBestActionRoutes(app: Express) {
  /**
   * GET /api/next-best-action
   * Requires auth — returns actions for the current agent's clients
   */
  app.get("/api/next-best-action", authenticate, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const results = await getNextBestActions(req.user.id);
      res.json(results);
    } catch (err: any) {
      console.error("Error getting next best actions:", err.message);
      res.status(500).json({ error: "Failed to compute next best actions" });
    }
  });

  /**
   * GET /api/next-best-action/:clientId
   * Requires auth — returns actions for a specific client
   */
  app.get("/api/next-best-action/:clientId", authenticate, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const clientId = parseInt(req.params.clientId, 10);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const result = await getNextBestActionsForClient(req.user.id, clientId);
      if (!result) {
        return res.status(404).json({ error: "Client not found" });
      }

      res.json(result);
    } catch (err: any) {
      console.error("Error getting next best actions for client:", err.message);
      res.status(500).json({ error: "Failed to compute next best actions" });
    }
  });
}
