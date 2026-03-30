/**
 * Plan Cheatsheet Routes — Compact carrier comparison grids
 *
 * GET /api/cheatsheets?carrier={name}&state={ST}&county={county}
 * GET /api/cheatsheets/pdf?carrier={name}&state={ST}&county={county}
 * GET /api/cheatsheets/carriers?state={ST}&county={county}
 */
import type { Express, Request, Response } from "express";
import {
  generatePlanCheatsheet,
  generateCheatsheetPDF,
} from "../services/plan-cheatsheet.service";
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export function registerCheatsheetRoutes(app: Express): void {
  // Get cheatsheet data as JSON
  app.get("/api/cheatsheets", async (req: Request, res: Response) => {
    try {
      const { carrier, state, county } = req.query;

      if (!carrier || !state || !county) {
        return res.status(400).json({
          error: "carrier, state, and county query parameters are required",
        });
      }

      const data = await generatePlanCheatsheet({
        carrier: String(carrier),
        state: String(state),
        county: String(county),
      });

      res.json(data);
    } catch (err: any) {
      console.error("Error generating cheatsheet:", err.message);
      res.status(500).json({ error: "Failed to generate cheatsheet" });
    }
  });

  // Download cheatsheet as PDF
  app.get("/api/cheatsheets/pdf", async (req: Request, res: Response) => {
    try {
      const { carrier, state, county } = req.query;

      if (!carrier || !state || !county) {
        return res.status(400).json({
          error: "carrier, state, and county query parameters are required",
        });
      }

      const buffer = await generateCheatsheetPDF({
        carrier: String(carrier),
        state: String(state),
        county: String(county),
      });

      const filename = `Cheatsheet_${String(carrier).replace(/\s+/g, "_")}_${state}_${county}_${new Date().toISOString().split("T")[0]}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error("Error generating cheatsheet PDF:", err.message);
      res.status(500).json({ error: "Failed to generate cheatsheet PDF" });
    }
  });

  // Get available carriers for a state/county
  app.get("/api/cheatsheets/carriers", async (req: Request, res: Response) => {
    try {
      const { state, county } = req.query;
      const conditions = [];
      if (state && typeof state === "string") {
        conditions.push(eq(plans.state, state.toUpperCase()));
      }
      if (county && typeof county === "string") {
        conditions.push(eq(plans.county, county.toUpperCase()));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const carriers = await db
        .select({
          carrier: plans.organizationName,
          planCount: sql<number>`count(*)`.as("plan_count"),
        })
        .from(plans)
        .where(whereClause)
        .groupBy(plans.organizationName)
        .orderBy(plans.organizationName);

      res.json(carriers);
    } catch (err: any) {
      console.error("Error fetching carriers:", err.message);
      res.status(500).json({ error: "Failed to fetch carriers" });
    }
  });

  // Get available counties for a state
  app.get("/api/cheatsheets/counties", async (req: Request, res: Response) => {
    try {
      const { state } = req.query;
      if (!state || typeof state !== "string") {
        return res.status(400).json({ error: "state query parameter is required" });
      }

      const counties = await db
        .select({
          county: plans.county,
          planCount: sql<number>`count(*)`.as("plan_count"),
        })
        .from(plans)
        .where(eq(plans.state, state.toUpperCase()))
        .groupBy(plans.county)
        .orderBy(plans.county);

      res.json(counties);
    } catch (err: any) {
      console.error("Error fetching counties:", err.message);
      res.status(500).json({ error: "Failed to fetch counties" });
    }
  });
}
