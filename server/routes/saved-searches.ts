import type { Express } from "express";
import { db } from "../db";
import { savedSearches, insertSavedSearchSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";

export function registerSavedSearchRoutes(app: Express) {
  // ── POST /api/saved-searches ──
  app.post("/api/saved-searches", authenticate, async (req, res) => {
    try {
      const parsed = insertSavedSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { name, criteria } = parsed.data;

      const [search] = await db
        .insert(savedSearches)
        .values({
          userId: req.user!.id,
          name,
          criteria,
        })
        .returning();

      res.status(201).json(search);
    } catch (err: any) {
      console.error("Create saved search error:", err.message);
      res.status(500).json({ error: "Failed to save search" });
    }
  });

  // ── GET /api/saved-searches ──
  app.get("/api/saved-searches", authenticate, async (req, res) => {
    try {
      const results = await db
        .select()
        .from(savedSearches)
        .where(eq(savedSearches.userId, req.user!.id))
        .orderBy(savedSearches.createdAt);

      res.json(results);
    } catch (err: any) {
      console.error("List saved searches error:", err.message);
      res.status(500).json({ error: "Failed to fetch saved searches" });
    }
  });

  // ── DELETE /api/saved-searches/:id ──
  app.delete("/api/saved-searches/:id", authenticate, async (req, res) => {
    try {
      const searchId = parseInt(req.params.id);
      if (isNaN(searchId)) {
        return res.status(400).json({ error: "Invalid search ID" });
      }

      // Verify ownership
      const [existing] = await db
        .select()
        .from(savedSearches)
        .where(and(eq(savedSearches.id, searchId), eq(savedSearches.userId, req.user!.id)))
        .limit(1);

      if (!existing) {
        return res.status(403).json({ error: "Not found or access denied" });
      }

      await db.delete(savedSearches).where(eq(savedSearches.id, searchId));

      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete saved search error:", err.message);
      res.status(500).json({ error: "Failed to delete saved search" });
    }
  });
}
