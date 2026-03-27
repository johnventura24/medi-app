import type { Express } from "express";
import { db } from "../db";
import { favoritePlans, plans, insertFavoritePlanSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";

export function registerFavoriteRoutes(app: Express) {
  // ── POST /api/favorites ──
  app.post("/api/favorites", authenticate, async (req, res) => {
    try {
      const parsed = insertFavoritePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { planId, notes } = parsed.data;

      // Verify the plan exists
      const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, planId)).limit(1);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      const [favorite] = await db
        .insert(favoritePlans)
        .values({
          userId: req.user!.id,
          planId,
          notes: notes || null,
        })
        .onConflictDoNothing()
        .returning();

      if (!favorite) {
        return res.status(409).json({ error: "Plan is already in favorites" });
      }

      res.status(201).json(favorite);
    } catch (err: any) {
      console.error("Add favorite error:", err.message);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  // ── GET /api/favorites ──
  app.get("/api/favorites", authenticate, async (req, res) => {
    try {
      const results = await db
        .select({
          id: favoritePlans.id,
          userId: favoritePlans.userId,
          planId: favoritePlans.planId,
          notes: favoritePlans.notes,
          createdAt: favoritePlans.createdAt,
          planName: plans.name,
          planType: plans.category,
          carrier: plans.organizationName,
          state: plans.state,
          county: plans.county,
          premium: plans.calculatedMonthlyPremium,
        })
        .from(favoritePlans)
        .innerJoin(plans, eq(favoritePlans.planId, plans.id))
        .where(eq(favoritePlans.userId, req.user!.id))
        .orderBy(favoritePlans.createdAt);

      res.json(results);
    } catch (err: any) {
      console.error("List favorites error:", err.message);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  // ── DELETE /api/favorites/:planId ──
  app.delete("/api/favorites/:planId", authenticate, async (req, res) => {
    try {
      const planId = parseInt(req.params.planId);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }

      const deleted = await db
        .delete(favoritePlans)
        .where(and(eq(favoritePlans.planId, planId), eq(favoritePlans.userId, req.user!.id)))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "Favorite not found" });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Remove favorite error:", err.message);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });
}
