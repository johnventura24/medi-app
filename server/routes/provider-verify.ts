import type { Express } from "express";
import { db } from "../db";
import { providerNetworkCache } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Provider Verification Webhook
 * 
 * PolicyPulse (or any external tool) can push verified provider network data
 * into MediApp via these endpoints. Each verified result updates the
 * provider_network_cache table and boosts confidence scores.
 * 
 * Authentication: API key via X-API-Key header
 */
export function registerProviderVerifyRoutes(app: Express) {

  // Single verification
  // POST /api/providers/verify
  // Body: { npi, carrier, contractId?, inNetwork, source? }
  app.post("/api/providers/verify", async (req, res) => {
    try {
      const { npi, carrier, contractId, inNetwork, source } = req.body;

      if (!npi || !carrier || inNetwork === undefined) {
        return res.status(400).json({ error: "npi, carrier, and inNetwork are required" });
      }

      await db.execute(sql.raw(`
        INSERT INTO provider_network_cache (npi, carrier, contract_id, in_network, source, verified_at)
        VALUES ('${npi}', '${carrier.replace(/'/g, "''")}', ${contractId ? "'" + contractId.replace(/'/g, "''") + "'" : 'NULL'}, ${inNetwork ? 'true' : 'false'}, '${(source || 'PolicyPulse').replace(/'/g, "''")}', NOW())
        ON CONFLICT (npi, carrier, contract_id) DO UPDATE SET
          in_network = ${inNetwork ? 'true' : 'false'},
          source = '${(source || 'PolicyPulse').replace(/'/g, "''")}',
          verified_at = NOW()
      `));

      res.json({ success: true, npi, carrier, inNetwork, source: source || "PolicyPulse" });
    } catch (err: any) {
      console.error("Provider verify error:", err.message);
      res.status(500).json({ error: "Failed to store verification" });
    }
  });

  // Bulk verification
  // POST /api/providers/verify/bulk
  // Body: { verifications: [{ npi, carrier, contractId?, inNetwork }] }
  app.post("/api/providers/verify/bulk", async (req, res) => {
    try {
      const { verifications, source } = req.body;

      if (!Array.isArray(verifications) || verifications.length === 0) {
        return res.status(400).json({ error: "verifications array is required" });
      }

      if (verifications.length > 1000) {
        return res.status(400).json({ error: "Max 1000 verifications per batch" });
      }

      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const v of verifications) {
        if (!v.npi || !v.carrier || v.inNetwork === undefined) {
          errors++;
          continue;
        }
        try {
          await db.execute(sql.raw(`
            INSERT INTO provider_network_cache (npi, carrier, contract_id, in_network, source, verified_at)
            VALUES ('${v.npi}', '${v.carrier.replace(/'/g, "''")}', ${v.contractId ? "'" + v.contractId.replace(/'/g, "''") + "'" : 'NULL'}, ${v.inNetwork ? 'true' : 'false'}, '${(source || 'PolicyPulse').replace(/'/g, "''")}', NOW())
            ON CONFLICT (npi, carrier, contract_id) DO UPDATE SET
              in_network = ${v.inNetwork ? 'true' : 'false'},
              source = '${(source || 'PolicyPulse').replace(/'/g, "''")}',
              verified_at = NOW()
          `));
          inserted++;
        } catch {
          errors++;
        }
      }

      res.json({ success: true, inserted, errors, total: verifications.length });
    } catch (err: any) {
      console.error("Bulk verify error:", err.message);
      res.status(500).json({ error: "Failed to process bulk verification" });
    }
  });

  // Get verification stats
  // GET /api/providers/verify/stats
  app.get("/api/providers/verify/stats", async (_req, res) => {
    try {
      const stats = await db.execute(sql.raw(`
        SELECT 
          count(*) as total,
          count(*) filter (where source = 'PolicyPulse') as from_policypulse,
          count(*) filter (where source = 'FHIR_bulk') as from_fhir,
          count(*) filter (where source = 'inferred') as from_inferred,
          count(*) filter (where in_network = true) as confirmed_in,
          count(*) filter (where in_network = false) as confirmed_out,
          count(*) filter (where in_network is null) as unknown,
          count(distinct npi) as unique_providers,
          count(distinct carrier) as unique_carriers
        FROM provider_network_cache
      `));
      res.json(stats.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
