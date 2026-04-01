import type { Express } from "express";
import { getTurning65Pipeline } from "../services/turning65.service";
import { getOEPRemorseTargets } from "../services/oep-remorse.service";
import { getDSNPPipeline } from "../services/dsnp-pipeline.service";

export function registerPipelineRoutes(app: Express) {
  // GET /api/pipeline/turning-65?state={ST}&limit=20
  app.get("/api/pipeline/turning-65", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const data = await getTurning65Pipeline(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 20
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in turning-65 pipeline:", err.message);
      res.status(500).json({ error: "Failed to fetch turning-65 pipeline data" });
    }
  });

  // GET /api/pipeline/oep-remorse?state={ST}&limit=20
  app.get("/api/pipeline/oep-remorse", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const data = await getOEPRemorseTargets(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 20
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in OEP remorse pipeline:", err.message);
      res.status(500).json({ error: "Failed to fetch OEP remorse data" });
    }
  });

  // GET /api/pipeline/dsnp?state={ST}&limit=20
  app.get("/api/pipeline/dsnp", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const data = await getDSNPPipeline(
        typeof state === "string" ? state : undefined,
        typeof limit === "string" ? parseInt(limit, 10) : 20
      );
      res.json(data);
    } catch (err: any) {
      console.error("Error in D-SNP pipeline:", err.message);
      res.status(500).json({ error: "Failed to fetch D-SNP pipeline data" });
    }
  });
}
