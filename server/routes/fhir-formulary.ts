import type { Express } from "express";
import {
  checkDrugCoverage,
  getPlanFormulary,
  bulkDrugCheck,
} from "../services/fhir-formulary.service";

export function registerFhirFormularyRoutes(app: Express) {
  /**
   * GET /api/fhir-formulary/check?carrier={name}&planId={id}&rxcui={rxcui}
   * Check if a specific drug is covered by a plan via real-time FHIR lookup.
   */
  app.get("/api/fhir-formulary/check", async (req, res) => {
    try {
      const carrier = req.query.carrier as string | undefined;
      const planId = req.query.planId as string | undefined;
      const rxcui = req.query.rxcui as string | undefined;

      if (!carrier || !planId || !rxcui) {
        return res.status(400).json({
          error: "Required parameters: carrier, planId, rxcui",
        });
      }

      const result = await checkDrugCoverage(carrier, planId, rxcui);

      if (!result) {
        return res.json({
          found: false,
          carrier,
          planId,
          rxcui,
          message: "Drug coverage data not found via FHIR or local data.",
        });
      }

      res.json({
        found: true,
        result,
        source: result.source,
      });
    } catch (err: any) {
      console.error("[FHIR Formulary Route] Check error:", err.message);
      res.status(500).json({ error: "Failed to check drug coverage" });
    }
  });

  /**
   * GET /api/fhir-formulary/formulary?carrier={name}&planId={id}
   * Get available formulary for a plan.
   */
  app.get("/api/fhir-formulary/formulary", async (req, res) => {
    try {
      const carrier = req.query.carrier as string | undefined;
      const planId = req.query.planId as string | undefined;

      if (!carrier || !planId) {
        return res.status(400).json({
          error: "Required parameters: carrier, planId",
        });
      }

      const results = await getPlanFormulary(carrier, planId);

      res.json({
        carrier,
        planId,
        count: results.length,
        drugs: results,
      });
    } catch (err: any) {
      console.error("[FHIR Formulary Route] Formulary error:", err.message);
      res.status(500).json({ error: "Failed to fetch plan formulary" });
    }
  });

  /**
   * POST /api/fhir-formulary/bulk-check
   * Bulk check multiple drugs across multiple plans.
   * Body: { drugs: [{rxcui, name}], plans: [{carrier, planId}] }
   */
  app.post("/api/fhir-formulary/bulk-check", async (req, res) => {
    try {
      const { drugs, plans } = req.body || {};

      if (!drugs || !Array.isArray(drugs) || drugs.length === 0) {
        return res.status(400).json({ error: "drugs array is required with at least one entry" });
      }

      if (!plans || !Array.isArray(plans) || plans.length === 0) {
        return res.status(400).json({ error: "plans array is required with at least one entry" });
      }

      // Validate drugs format
      for (const drug of drugs) {
        if (!drug.rxcui || !drug.name) {
          return res.status(400).json({ error: "Each drug must have rxcui and name" });
        }
      }

      // Validate plans format
      for (const plan of plans) {
        if (!plan.carrier || !plan.planId) {
          return res.status(400).json({ error: "Each plan must have carrier and planId" });
        }
      }

      // Limit to prevent abuse
      if (drugs.length > 20) {
        return res.status(400).json({ error: "Maximum 20 drugs per bulk check" });
      }
      if (plans.length > 10) {
        return res.status(400).json({ error: "Maximum 10 plans per bulk check" });
      }

      const results = await bulkDrugCheck(drugs, plans);

      res.json({
        drugCount: drugs.length,
        planCount: plans.length,
        results,
      });
    } catch (err: any) {
      console.error("[FHIR Formulary Route] Bulk check error:", err.message);
      res.status(500).json({ error: "Failed to perform bulk drug check" });
    }
  });
}
