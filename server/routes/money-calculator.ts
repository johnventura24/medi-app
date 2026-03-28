import type { Express } from "express";
import {
  calculateMoneyOnTable,
  calculateFromManualInput,
  quickCheck,
  searchPlans,
} from "../services/money-calculator.service";

export function registerMoneyCalculatorRoutes(app: Express) {
  // POST /api/calculator/money-on-table
  app.post("/api/calculator/money-on-table", async (req, res) => {
    try {
      const { currentPlanId, zipCode, currentPremium, currentDental, currentOtc, currentVision } = req.body;

      if (currentPlanId) {
        const result = await calculateMoneyOnTable(currentPlanId);
        return res.json(result);
      }

      if (zipCode) {
        const result = await calculateFromManualInput({
          zipCode,
          currentPremium: currentPremium || 0,
          currentDental: currentDental || 0,
          currentOtc: currentOtc || 0,
          currentVision: currentVision || 0,
        });
        return res.json(result);
      }

      return res.status(400).json({ error: "Provide either currentPlanId or zipCode with plan details" });
    } catch (err: any) {
      console.error("Error in money calculator:", err.message);
      res.status(500).json({ error: "Failed to calculate savings" });
    }
  });

  // GET /api/calculator/quick-check
  app.get("/api/calculator/quick-check", async (req, res) => {
    try {
      const { zip, premium, dental } = req.query;
      if (!zip || typeof zip !== "string") {
        return res.status(400).json({ error: "zip query parameter is required" });
      }
      const result = await quickCheck(
        zip,
        typeof premium === "string" ? parseFloat(premium) : 0,
        typeof dental === "string" ? parseFloat(dental) : 0,
      );
      res.json(result);
    } catch (err: any) {
      console.error("Error in quick check:", err.message);
      res.status(500).json({ error: "Failed to run quick check" });
    }
  });

  // GET /api/calculator/search-plans
  app.get("/api/calculator/search-plans", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json([]);
      }
      const results = await searchPlans(q, 20);
      res.json(results);
    } catch (err: any) {
      console.error("Error searching plans:", err.message);
      res.status(500).json({ error: "Failed to search plans" });
    }
  });
}
