import type { Express, Request, Response } from "express";
import { db } from "../db";
import { plans, clients, aiExplanations } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { explainPlan, comparePlans, computePlanDataHash } from "../services/ai-explainer.service";
import { optionalAuth } from "../middleware/auth.middleware";

export function registerAIRoutes(app: Express) {
  // ── POST /api/ai/explain-plan ──
  // Generate a plain-English plan summary
  app.post("/api/ai/explain-plan", optionalAuth, async (req, res) => {
    try {
      const { planId, clientId } = req.body;

      if (!planId || typeof planId !== "number") {
        return res.status(400).json({ error: "planId (number) is required" });
      }

      // Fetch the plan
      const planRows = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      if (planRows.length === 0) {
        return res.status(404).json({ error: "Plan not found" });
      }

      const plan = planRows[0];

      // Optionally fetch the client (requires auth + ownership check)
      let client = undefined;
      if (clientId && typeof clientId === "number") {
        if (!req.user) {
          return res.status(401).json({ error: "Authentication required when using clientId" });
        }

        const clientRows = await db
          .select()
          .from(clients)
          .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user.id)))
          .limit(1);

        if (clientRows.length === 0) {
          return res.status(403).json({ error: "Client not found or access denied" });
        }

        client = clientRows[0];
      }

      const result = await explainPlan(plan, client);

      res.json({
        explanation: result.content,
        cached: result.cached,
        tokensUsed: result.tokensUsed ?? null,
      });
    } catch (err: any) {
      console.error("AI explain-plan error:", err.message);
      res.status(500).json({ error: "Failed to generate plan explanation" });
    }
  });

  // ── POST /api/ai/compare-plans ──
  // Generate a comparison narrative for multiple plans
  app.post("/api/ai/compare-plans", optionalAuth, async (req, res) => {
    try {
      const { planIds, clientId } = req.body;

      if (!planIds || !Array.isArray(planIds) || planIds.length < 2) {
        return res.status(400).json({ error: "planIds array with at least 2 plan IDs is required" });
      }

      if (planIds.length > 5) {
        return res.status(400).json({ error: "Maximum 5 plans can be compared at once" });
      }

      // Fetch plans
      const planRows = await db
        .select()
        .from(plans)
        .where(inArray(plans.id, planIds));

      if (planRows.length === 0) {
        return res.status(404).json({ error: "No plans found for the given IDs" });
      }

      // Optionally fetch the client (requires auth + ownership check)
      let client = undefined;
      if (clientId && typeof clientId === "number") {
        if (!req.user) {
          return res.status(401).json({ error: "Authentication required when using clientId" });
        }

        const clientRows = await db
          .select()
          .from(clients)
          .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user.id)))
          .limit(1);

        if (clientRows.length === 0) {
          return res.status(403).json({ error: "Client not found or access denied" });
        }

        client = clientRows[0];
      }

      const result = await comparePlans(planRows, client);

      res.json({
        narrative: result.content,
        cached: result.cached,
        tokensUsed: result.tokensUsed ?? null,
        planCount: planRows.length,
      });
    } catch (err: any) {
      console.error("AI compare-plans error:", err.message);
      res.status(500).json({ error: "Failed to generate plan comparison" });
    }
  });

  // ── GET /api/ai/explanations/:planId ──
  // Return cached explanation for a plan
  app.get("/api/ai/explanations/:planId", async (req, res) => {
    try {
      const planId = parseInt(req.params.planId, 10);

      if (isNaN(planId)) {
        return res.status(400).json({ error: "planId must be a number" });
      }

      // Verify the plan exists
      const planRows = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      if (planRows.length === 0) {
        return res.status(404).json({ error: "Plan not found" });
      }

      const plan = planRows[0];
      const currentHash = computePlanDataHash(plan);

      // Look for a cached explanation that matches the current plan data
      const cached = await db
        .select()
        .from(aiExplanations)
        .where(
          and(
            eq(aiExplanations.planId, planId),
            eq(aiExplanations.planDataHash, currentHash),
            eq(aiExplanations.explanationType, "plan_summary"),
          )
        )
        .limit(1);

      if (cached.length === 0) {
        return res.status(404).json({ error: "No cached explanation available for this plan" });
      }

      res.json({
        explanation: cached[0].content,
        model: cached[0].model,
        createdAt: cached[0].createdAt,
      });
    } catch (err: any) {
      console.error("AI get explanation error:", err.message);
      res.status(500).json({ error: "Failed to retrieve explanation" });
    }
  });
}
