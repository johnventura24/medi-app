import type { Express } from "express";
import { db } from "../db";
import { formularyDrugs } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { searchDrugs } from "../services/rxnorm.service";
import { estimateDrugCosts, saveDrugCostEstimates, getCachedDrugCostEstimates } from "../services/drug-cost.service";
import { authenticate } from "../middleware/auth.middleware";

export function registerDrugRoutes(app: Express) {
  // ── GET /api/drugs/search ──
  // Public: search for drugs by name via RxNorm
  app.get("/api/drugs/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      if (!q || q.trim().length === 0) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const results = await searchDrugs(q);

      res.json({
        drugs: results.slice(0, limit).map((r) => ({
          rxcui: r.rxcui,
          name: r.name,
          strength: r.strength || null,
          dosageForm: r.dosageForm || null,
        })),
      });
    } catch (err: any) {
      console.error("Drug search error:", err.message);
      res.status(500).json({ error: "Drug search failed" });
    }
  });

  // ── POST /api/clients/:id/drug-costs ──
  // Authenticated: estimate drug costs for a client across plans
  app.post("/api/clients/:id/drug-costs", authenticate, async (req, res) => {
    try {
      const { planIds, medications } = req.body;

      if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
        return res.status(400).json({ error: "planIds array is required" });
      }

      if (!medications || !Array.isArray(medications) || medications.length === 0) {
        return res.status(400).json({ error: "medications array is required" });
      }

      // Validate medication objects
      for (const med of medications) {
        if (!med.rxcui || !med.name) {
          return res.status(400).json({
            error: "Each medication must have at least rxcui and name",
          });
        }
      }

      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const normalizedMeds = medications.map((m: any) => ({
        rxcui: String(m.rxcui),
        name: String(m.name),
        dosage: String(m.dosage || ""),
        frequency: String(m.frequency || "monthly"),
      }));

      const estimates = await estimateDrugCosts({
        planIds: planIds.map(Number),
        medications: normalizedMeds,
      });

      // Store estimates in the database
      try {
        await saveDrugCostEstimates(clientId, normalizedMeds, estimates);
      } catch (storeErr: any) {
        console.error("Failed to store drug cost estimates:", storeErr.message);
        // Don't fail the request if storage fails — still return estimates
      }

      res.json({ estimates });
    } catch (err: any) {
      console.error("Drug cost estimation error:", err.message);
      res.status(500).json({ error: "Drug cost estimation failed" });
    }
  });

  // ── GET /api/clients/:id/drug-costs ──
  // Authenticated: return cached drug cost estimates for a client
  app.get("/api/clients/:id/drug-costs", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const estimates = await getCachedDrugCostEstimates(clientId);
      res.json({ estimates });
    } catch (err: any) {
      console.error("Get cached drug costs error:", err.message);
      res.status(500).json({ error: "Failed to retrieve drug cost estimates" });
    }
  });

  // ── GET /api/formulary/:contractId/:rxcui ──
  // Public: direct formulary lookup
  app.get("/api/formulary/:contractId/:rxcui", async (req, res) => {
    try {
      const { contractId, rxcui } = req.params;

      const rows = await db
        .select()
        .from(formularyDrugs)
        .where(
          and(
            eq(formularyDrugs.contractId, contractId),
            eq(formularyDrugs.rxcui, rxcui)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        return res.json({
          covered: false,
          tier: null,
          priorAuth: false,
          stepTherapy: false,
          quantityLimit: false,
        });
      }

      const entry = rows[0];
      res.json({
        covered: true,
        tier: entry.tier,
        priorAuth: entry.priorAuthorization ?? false,
        stepTherapy: entry.stepTherapy ?? false,
        quantityLimit: entry.quantityLimit ?? false,
        quantityLimitAmount: entry.quantityLimitAmount,
        quantityLimitDays: entry.quantityLimitDays,
        drugName: entry.drugName,
        formularyId: entry.formularyId,
      });
    } catch (err: any) {
      console.error("Formulary lookup error:", err.message);
      res.status(500).json({ error: "Formulary lookup failed" });
    }
  });

  // ── GET /api/formulary/check ──
  // Public: bulk formulary check
  app.get("/api/formulary/check", async (req, res) => {
    try {
      const contractIdsParam = req.query.contractIds as string;
      const rxcuisParam = req.query.rxcuis as string;

      if (!contractIdsParam || !rxcuisParam) {
        return res.status(400).json({
          error: "Both contractIds and rxcuis query parameters are required",
        });
      }

      const contractIds = contractIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const rxcuis = rxcuisParam.split(",").map((s) => s.trim()).filter(Boolean);

      if (contractIds.length === 0 || rxcuis.length === 0) {
        return res.status(400).json({ error: "contractIds and rxcuis must not be empty" });
      }

      // Cap to prevent abuse
      if (contractIds.length > 50 || rxcuis.length > 50) {
        return res.status(400).json({ error: "Maximum 50 contractIds and 50 rxcuis per request" });
      }

      const rows = await db
        .select()
        .from(formularyDrugs)
        .where(
          and(
            inArray(formularyDrugs.contractId, contractIds),
            inArray(formularyDrugs.rxcui, rxcuis)
          )
        );

      // Build a set of found combinations
      const foundMap = new Map<string, typeof rows[0]>();
      for (const row of rows) {
        foundMap.set(`${row.contractId}:${row.rxcui}`, row);
      }

      // Build full results grid
      const results: any[] = [];
      for (const contractId of contractIds) {
        for (const rxcui of rxcuis) {
          const entry = foundMap.get(`${contractId}:${rxcui}`);
          if (entry) {
            results.push({
              contractId,
              rxcui,
              covered: true,
              tier: entry.tier,
              restrictions: {
                priorAuth: entry.priorAuthorization ?? false,
                stepTherapy: entry.stepTherapy ?? false,
                quantityLimit: entry.quantityLimit ?? false,
              },
              drugName: entry.drugName,
            });
          } else {
            results.push({
              contractId,
              rxcui,
              covered: false,
              tier: null,
              restrictions: {
                priorAuth: false,
                stepTherapy: false,
                quantityLimit: false,
              },
            });
          }
        }
      }

      res.json({ results });
    } catch (err: any) {
      console.error("Bulk formulary check error:", err.message);
      res.status(500).json({ error: "Bulk formulary check failed" });
    }
  });
}
