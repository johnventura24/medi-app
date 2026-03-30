/**
 * Comparison Report Routes — Professional PDF report generation
 *
 * POST /api/reports/comparison  → streams PDF
 */
import type { Express, Request, Response } from "express";
import { generateComparisonReport } from "../services/comparison-report.service";

export function registerComparisonReportRoutes(app: Express): void {
  app.post("/api/reports/comparison", async (req: Request, res: Response) => {
    try {
      const {
        clientName,
        clientZip,
        clientNeeds,
        agentName,
        agentNpn,
        plans: planIds,
        includeDrugs,
        includeDoctor,
        medications,
        doctors,
      } = req.body;

      if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
        return res.status(400).json({
          error: "plans array with at least one plan ID is required",
        });
      }

      const buffer = await generateComparisonReport({
        clientName,
        clientZip,
        clientNeeds,
        agentName,
        agentNpn,
        planIds: planIds.map(Number),
        includeDrugs,
        includeDoctor,
        medications,
        doctors,
      });

      const filename = `Comparison_Report_${(clientName || "Client").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error("Error generating comparison report:", err.message);
      res.status(500).json({ error: "Failed to generate comparison report" });
    }
  });
}
