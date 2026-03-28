import type { Express } from "express";
import { getWarRoomData, getHotPlans, getCountyAlerts } from "../services/aep-warroom.service";

export function registerAEPWarRoomRoutes(app: Express) {
  // GET /api/warroom?state={ST}
  app.get("/api/warroom", async (req, res) => {
    try {
      const { state } = req.query;
      const data = await getWarRoomData(
        typeof state === "string" ? state : undefined
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in war room:", err.message);
      res.status(500).json({ error: "Failed to fetch war room data" });
    }
  });

  // GET /api/warroom/hot-plans?state={ST}&limit=10
  app.get("/api/warroom/hot-plans", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const data = await getHotPlans(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 10
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in hot plans:", err.message);
      res.status(500).json({ error: "Failed to fetch hot plans" });
    }
  });

  // GET /api/warroom/alerts?state={ST}&limit=20
  app.get("/api/warroom/alerts", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const data = await getCountyAlerts(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 20
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in county alerts:", err.message);
      res.status(500).json({ error: "Failed to fetch county alerts" });
    }
  });
}
