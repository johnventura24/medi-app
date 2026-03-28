import type { Express } from "express";
import { getArchetypes, ARCHETYPES } from "../services/archetypes.service";

export function registerArchetypeRoutes(app: Express) {
  // GET /api/archetypes?zip={zip} OR ?county={county}&state={ST}
  app.get("/api/archetypes", async (req, res) => {
    try {
      const { zip, county, state } = req.query;
      const results = await getArchetypes({
        zipCode: typeof zip === "string" ? zip : undefined,
        county: typeof county === "string" ? county : undefined,
        state: typeof state === "string" ? state : undefined,
      });
      res.json(results);
    } catch (err: any) {
      console.error("Error in archetypes:", err.message);
      res.status(500).json({ error: err.message || "Failed to fetch archetypes" });
    }
  });

  // GET /api/archetypes/list — returns archetype definitions only
  app.get("/api/archetypes/list", async (_req, res) => {
    res.json(ARCHETYPES);
  });
}
