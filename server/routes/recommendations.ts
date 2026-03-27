import type { Express } from "express";
import { db } from "../db";
import { clients, clientRecommendations, interactionLogs, plans } from "@shared/schema";
import { eq, and, or, lte, gte, sql, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";
import { scorePlans } from "../services/scoring.service";

/**
 * Parse dollar strings like "$1,234" or "$1,234.00" to a number.
 */
function parseDollar(val: string | null | undefined): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

export function registerRecommendationRoutes(app: Express) {
  // ── POST /api/clients/:id/recommend ──
  app.post("/api/clients/:id/recommend", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Fetch client — must be owned by current agent
      const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      // Resolve ZIP to county/state
      const zipRows = await db
        .selectDistinct({ county: plans.county, state: plans.state })
        .from(plans)
        .where(eq(plans.zipcode, client.zipCode))
        .limit(10);

      if (zipRows.length === 0) {
        return res.status(404).json({ error: "No plans found for client ZIP code" });
      }

      // Build location condition
      let locationCondition;
      if (zipRows.length === 1) {
        locationCondition = and(
          eq(plans.county, zipRows[0].county),
          eq(plans.state, zipRows[0].state)
        );
      } else {
        locationCondition = or(
          ...zipRows.map((r) =>
            and(eq(plans.county, r.county), eq(plans.state, r.state))
          )
        );
      }

      // Fetch candidate plans for that county
      const candidatePlans = await db
        .select()
        .from(plans)
        .where(locationCondition!)
        .limit(5000);

      // Apply hard filters
      let filtered = candidatePlans;

      if (client.maxMonthlyPremium != null) {
        filtered = filtered.filter(
          (p) => (p.calculatedMonthlyPremium ?? 0) <= client.maxMonthlyPremium!
        );
      }

      if (client.maxAnnualOop != null) {
        filtered = filtered.filter((p) => {
          const moop = parseDollar(p.maximumOopc);
          return moop === 0 || moop <= client.maxAnnualOop!;
        });
      }

      // Apply mustHaveBenefits hard filter — plan must have ALL must-haves
      // (scoring handles partial matches, but for hard filter we only exclude
      // plans missing critical benefits if the client has explicitly flagged them)
      // Note: We keep this lenient — scoring handles the nuance. Only exclude
      // if the plan matches NONE of the must-haves.
      const mustHaveBenefits = (client.mustHaveBenefits as string[]) || [];
      // We do NOT hard-filter on mustHaveBenefits — scoring penalizes missing benefits
      // and adds warnings. This keeps the candidate pool broader.

      if (filtered.length === 0) {
        return res.json({ recommendations: [], message: "No plans match the client's hard criteria" });
      }

      // Run scoring engine
      const scoringResults = scorePlans({ client, plans: filtered });

      // Take top 10
      const top10 = scoringResults.slice(0, 10);

      // Delete old recommendations for this client
      await db
        .delete(clientRecommendations)
        .where(eq(clientRecommendations.clientId, clientId));

      // Insert new recommendations
      if (top10.length > 0) {
        await db.insert(clientRecommendations).values(
          top10.map((r) => ({
            clientId,
            planId: r.planId,
            score: r.totalScore,
            scoreBreakdown: r.breakdown,
            rank: r.rank,
          }))
        );
      }

      // Log interaction
      await db.insert(interactionLogs).values({
        userId: req.user!.id,
        clientId,
        action: "recommend",
        details: { planIds: top10.map((r) => r.planId), count: top10.length },
      });

      // Update client status if still in intake
      if (client.status === "intake") {
        await db
          .update(clients)
          .set({ status: "plans_reviewed", updatedAt: new Date() })
          .where(eq(clients.id, clientId));
      }

      // Return full results with plan details
      const planIds = top10.map((r) => r.planId);
      const planDetails = planIds.length > 0
        ? await db
            .select()
            .from(plans)
            .where(sql`${plans.id} IN (${sql.join(planIds.map(id => sql`${id}`), sql`, `)})`)
        : [];

      const planMap = new Map(planDetails.map((p) => [p.id, p]));

      const recommendations = top10.map((r) => {
        const plan = planMap.get(r.planId);
        return {
          ...r,
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                carrier: plan.organizationName,
                planType: (plan.category || "").replace("PLAN_CATEGORY_", ""),
                premium: plan.calculatedMonthlyPremium ?? 0,
                moop: parseDollar(plan.maximumOopc),
                county: plan.county,
                state: plan.state,
                starRating: plan.overallStarRating,
                dentalCoverageLimit: plan.dentalCoverageLimit,
              }
            : null,
        };
      });

      res.json({ recommendations });
    } catch (err: any) {
      console.error("Recommend error:", err.message);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // ── GET /api/clients/:id/recommendations ──
  app.get("/api/clients/:id/recommendations", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Verify client ownership
      const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
        .limit(1);

      if (!client && req.user!.role !== "admin") {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      const rows = await db
        .select({
          id: clientRecommendations.id,
          clientId: clientRecommendations.clientId,
          planId: clientRecommendations.planId,
          score: clientRecommendations.score,
          scoreBreakdown: clientRecommendations.scoreBreakdown,
          rank: clientRecommendations.rank,
          createdAt: clientRecommendations.createdAt,
          planName: plans.name,
          carrier: plans.organizationName,
          planType: plans.category,
          premium: plans.calculatedMonthlyPremium,
          maximumOopc: plans.maximumOopc,
          county: plans.county,
          state: plans.state,
          starRating: plans.overallStarRating,
          dentalCoverageLimit: plans.dentalCoverageLimit,
        })
        .from(clientRecommendations)
        .leftJoin(plans, eq(clientRecommendations.planId, plans.id))
        .where(eq(clientRecommendations.clientId, clientId))
        .orderBy(clientRecommendations.rank);

      res.json({ recommendations: rows });
    } catch (err: any) {
      console.error("Get recommendations error:", err.message);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });
}
