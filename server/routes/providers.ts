import type { Express } from "express";
import { searchProviders, getProviderByNpi } from "../services/nppes.service";
import { checkProviderNetwork } from "../services/fhir-provider.service";
import { db } from "../db";
import { plans } from "@shared/schema";
import { inArray } from "drizzle-orm";

export function registerProviderRoutes(app: Express) {
  // ── GET /api/providers/search ──
  // Public: search for providers via NPPES
  app.get("/api/providers/search", async (req, res) => {
    try {
      const { name, npi, state, specialty, limit: limitStr } = req.query;
      const limit = Math.min(parseInt(limitStr as string) || 10, 50);

      if (!name && !npi && !state && !specialty) {
        return res.status(400).json({
          error: "At least one search parameter is required (name, npi, state, or specialty)",
        });
      }

      const results = await searchProviders({
        name: name as string | undefined,
        npi: npi as string | undefined,
        state: state as string | undefined,
        specialty: specialty as string | undefined,
        limit,
      });

      res.json({
        providers: results.map((p) => ({
          npi: p.npi,
          name: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.organizationName || "Unknown",
          firstName: p.firstName || null,
          lastName: p.lastName || null,
          organizationName: p.organizationName || null,
          specialty: p.specialty || null,
          address: {
            line1: p.addressLine1 || null,
            city: p.city || null,
            state: p.state || null,
            zip: p.zip || null,
          },
          phone: p.phone || null,
        })),
      });
    } catch (err: any) {
      console.error("Provider search error:", err.message);
      res.status(500).json({ error: "Provider search failed" });
    }
  });

  // ── GET /api/providers/:npi ──
  // Public: single provider lookup by NPI
  app.get("/api/providers/:npi", async (req, res) => {
    try {
      const { npi } = req.params;

      if (!/^\d{10}$/.test(npi)) {
        return res.status(400).json({ error: "NPI must be a 10-digit number" });
      }

      const provider = await getProviderByNpi(npi);

      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      res.json({
        npi: provider.npi,
        name: [provider.firstName, provider.lastName].filter(Boolean).join(" ") || provider.organizationName || "Unknown",
        firstName: provider.firstName || null,
        lastName: provider.lastName || null,
        organizationName: provider.organizationName || null,
        specialty: provider.specialty || null,
        address: {
          line1: provider.addressLine1 || null,
          city: provider.city || null,
          state: provider.state || null,
          zip: provider.zip || null,
        },
        phone: provider.phone || null,
      });
    } catch (err: any) {
      console.error("Provider lookup error:", err.message);
      res.status(500).json({ error: "Provider lookup failed" });
    }
  });

  // ── GET /api/providers/:npi/network ──
  // Check if a provider is in-network for given plans via carrier FHIR APIs
  app.get("/api/providers/:npi/network", async (req, res) => {
    try {
      const { npi } = req.params;
      const planIdsParam = req.query.planIds as string;

      if (!/^\d{10}$/.test(npi)) {
        return res.status(400).json({ error: "NPI must be a 10-digit number" });
      }

      if (!planIdsParam) {
        return res.status(400).json({ error: "planIds query parameter is required (comma-separated)" });
      }

      const planIds = planIdsParam
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));

      if (planIds.length === 0) {
        return res.status(400).json({ error: "At least one valid planId is required" });
      }

      // Fetch plan info for the requested IDs
      const matchedPlans = await db
        .select({
          id: plans.id,
          name: plans.name,
          organizationName: plans.organizationName,
          contractId: plans.contractId,
        })
        .from(plans)
        .where(inArray(plans.id, planIds));

      // Build plan inputs for the FHIR service
      const planInputs = matchedPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        carrier: plan.organizationName,
        contractId: plan.contractId || "",
      }));

      // Check network status via FHIR Provider Directory APIs
      const networkResults = await checkProviderNetwork(npi, planInputs);

      // Return in the shape the frontend expects: { npi, statuses: [...] }
      res.json({
        npi,
        statuses: networkResults.map((r) => ({
          planId: r.planId,
          planName: r.planName,
          carrier: r.carrier,
          inNetwork: r.inNetwork,
          source: r.source,
          verifiedAt: r.verifiedAt,
          carrierUrl: r.carrierUrl,
        })),
      });
    } catch (err: any) {
      console.error("Provider network check error:", err.message);
      res.status(500).json({ error: "Provider network check failed" });
    }
  });
}
