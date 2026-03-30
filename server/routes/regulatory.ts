/**
 * Regulatory Alert Routes — CMS regulatory dates and calendar
 *
 * GET /api/regulatory/alerts?upcoming=true&days=90&category={cat}
 * GET /api/regulatory/calendar
 */
import type { Express, Request, Response } from "express";
import {
  getUpcomingAlerts,
  getCalendar,
  getAllAlerts,
} from "../services/regulatory-alerts.service";

export function registerRegulatoryRoutes(app: Express): void {
  // Get alerts (upcoming or all)
  app.get("/api/regulatory/alerts", async (req: Request, res: Response) => {
    try {
      const { upcoming, days, category } = req.query;

      if (upcoming === "true") {
        const alerts = getUpcomingAlerts({
          days: days ? parseInt(String(days)) : 90,
          category: category && typeof category === "string" ? category : undefined,
        });
        return res.json(alerts);
      }

      const alerts = getAllAlerts();
      if (category && typeof category === "string") {
        return res.json(alerts.filter((a) => a.category === category));
      }
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching regulatory alerts:", err.message);
      res.status(500).json({ error: "Failed to fetch regulatory alerts" });
    }
  });

  // Get full calendar view
  app.get("/api/regulatory/calendar", async (_req: Request, res: Response) => {
    try {
      const calendar = getCalendar();
      res.json(calendar);
    } catch (err: any) {
      console.error("Error fetching regulatory calendar:", err.message);
      res.status(500).json({ error: "Failed to fetch regulatory calendar" });
    }
  });
}
