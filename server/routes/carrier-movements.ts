import type { Express } from "express";
import {
  getCarrierFootprint,
  getCarrierMovements,
  getStateCarrierDynamics,
  forecastMarketGrowth,
  getCarrierExpansionMap,
  getAllCarriers,
  getAllStates,
} from "../services/carrier-movements.service";

export function registerCarrierMovementRoutes(app: Express) {
  // GET /api/carrier-movements/carriers — list all carrier names
  app.get("/api/carrier-movements/carriers", async (_req, res) => {
    try {
      const carriers = await getAllCarriers();
      res.json(carriers);
    } catch (err: any) {
      console.error("Error fetching carriers:", err.message);
      res.status(500).json({ error: "Failed to fetch carriers" });
    }
  });

  // GET /api/carrier-movements/states — list all states
  app.get("/api/carrier-movements/states", async (_req, res) => {
    try {
      const states = await getAllStates();
      res.json(states);
    } catch (err: any) {
      console.error("Error fetching states:", err.message);
      res.status(500).json({ error: "Failed to fetch states" });
    }
  });

  // GET /api/carrier-movements/footprint?carrier={name}
  app.get("/api/carrier-movements/footprint", async (req, res) => {
    try {
      const { carrier } = req.query;
      if (!carrier || typeof carrier !== "string") {
        return res.status(400).json({ error: "carrier query parameter is required" });
      }
      const footprint = await getCarrierFootprint(carrier);
      res.json(footprint);
    } catch (err: any) {
      console.error("Error fetching carrier footprint:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier footprint" });
    }
  });

  // GET /api/carrier-movements/movements?carrier={name}
  app.get("/api/carrier-movements/movements", async (req, res) => {
    try {
      const { carrier } = req.query;
      if (!carrier || typeof carrier !== "string") {
        return res.status(400).json({ error: "carrier query parameter is required" });
      }
      const movements = await getCarrierMovements(carrier);
      res.json(movements);
    } catch (err: any) {
      console.error("Error fetching carrier movements:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier movements" });
    }
  });

  // GET /api/carrier-movements/dynamics?state={ST}
  app.get("/api/carrier-movements/dynamics", async (req, res) => {
    try {
      const { state } = req.query;
      if (!state || typeof state !== "string") {
        return res.status(400).json({ error: "state query parameter is required" });
      }
      const dynamics = await getStateCarrierDynamics(state.toUpperCase());
      res.json(dynamics);
    } catch (err: any) {
      console.error("Error fetching state dynamics:", err.message);
      res.status(500).json({ error: "Failed to fetch state carrier dynamics" });
    }
  });

  // GET /api/carrier-movements/forecast?state={ST}&limit=20
  app.get("/api/carrier-movements/forecast", async (req, res) => {
    try {
      const { state, limit } = req.query;
      const stateVal = state && typeof state === "string" ? state.toUpperCase() : undefined;
      const limitVal = limit ? parseInt(limit as string) : 30;
      const forecast = await forecastMarketGrowth(stateVal, limitVal);
      res.json(forecast);
    } catch (err: any) {
      console.error("Error fetching market forecast:", err.message);
      res.status(500).json({ error: "Failed to fetch market forecast" });
    }
  });

  // GET /api/carrier-movements/expansion-map?carrier={name}&state={ST}
  app.get("/api/carrier-movements/expansion-map", async (req, res) => {
    try {
      const { carrier, state } = req.query;
      if (!carrier || typeof carrier !== "string" || !state || typeof state !== "string") {
        return res.status(400).json({ error: "carrier and state query parameters are required" });
      }
      const map = await getCarrierExpansionMap(carrier, state.toUpperCase());
      res.json(map);
    } catch (err: any) {
      console.error("Error fetching expansion map:", err.message);
      res.status(500).json({ error: "Failed to fetch expansion map" });
    }
  });
}
