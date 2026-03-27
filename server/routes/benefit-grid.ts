/**
 * Benefit Grid Routes — XLSX export and preview endpoints for compliance templates
 *
 * GET /api/export/benefit-grid?carrier={org}&state={ST}&counties={c1,c2}&contractId={H1234}
 * GET /api/export/benefit-grid/preview?carrier={org}&state={ST}&sheet={dental|flex|otc|partb}
 */
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { exportLogs } from "@shared/schema";
import {
  generateBenefitGrid,
  previewBenefitGrid,
  type BenefitGridOptions,
} from "../services/benefit-grid.service";

function parseOptions(query: Record<string, any>): BenefitGridOptions {
  const options: BenefitGridOptions = {};

  if (query.carrier && typeof query.carrier === "string") {
    options.carrier = query.carrier;
  }
  if (query.state && typeof query.state === "string") {
    options.state = query.state;
  }
  if (query.counties && typeof query.counties === "string") {
    options.counties = query.counties.split(",").map((c: string) => c.trim());
  }
  if (query.contractId && typeof query.contractId === "string") {
    options.contractId = query.contractId;
  }

  return options;
}

async function logExport(options: BenefitGridOptions, rowCount: number): Promise<void> {
  try {
    await db.insert(exportLogs).values({
      exportType: "xlsx",
      exportScope: "benefit_grid",
      filters: options as Record<string, unknown>,
      rowCount,
    });
  } catch (err) {
    console.error("Failed to log benefit grid export:", err);
  }
}

export function registerBenefitGridRoutes(app: Express): void {
  // Download XLSX benefit grid
  app.get("/api/export/benefit-grid", async (req: Request, res: Response) => {
    try {
      const options = parseOptions(req.query);
      const buffer = await generateBenefitGrid(options);

      // Build filename
      const parts = ["Benefit_Grid"];
      if (options.carrier) parts.push(options.carrier.replace(/\s+/g, "_"));
      if (options.state) parts.push(options.state);
      const dateSuffix = new Date().toISOString().split("T")[0];
      parts.push(dateSuffix);
      const filename = parts.join("_") + ".xlsx";

      // Get row count for logging from preview
      const previews = await previewBenefitGrid(options);
      const totalRows = previews.reduce((sum, p) => sum + p.totalRows, 0);
      await logExport(options, totalRows);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error("Error generating benefit grid:", err.message);
      res.status(500).json({ error: "Failed to generate benefit grid" });
    }
  });

  // JSON preview of benefit grid
  app.get("/api/export/benefit-grid/preview", async (req: Request, res: Response) => {
    try {
      const options = parseOptions(req.query);
      const sheet =
        typeof req.query.sheet === "string" ? req.query.sheet : undefined;

      const previews = await previewBenefitGrid(options, sheet);
      res.json(previews);
    } catch (err: any) {
      console.error("Error previewing benefit grid:", err.message);
      res.status(500).json({ error: "Failed to preview benefit grid" });
    }
  });

  // Recent benefit grid exports
  app.get("/api/export/benefit-grid/logs", async (_req: Request, res: Response) => {
    try {
      const { eq, desc } = await import("drizzle-orm");
      const logs = await db
        .select()
        .from(exportLogs)
        .where(eq(exportLogs.exportScope, "benefit_grid"))
        .orderBy(desc(exportLogs.createdAt))
        .limit(20);

      res.json(logs);
    } catch (err: any) {
      console.error("Error fetching benefit grid logs:", err.message);
      res.status(500).json({ error: "Failed to fetch export logs" });
    }
  });
}
