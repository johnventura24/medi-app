import type { Express } from "express";
import { db } from "../db";
import { interactionLogs, clients } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";
import { z } from "zod";

const createInteractionSchema = z.object({
  clientId: z.union([z.number(), z.string().transform(Number)]).nullable().optional(),
  action: z.string().min(1, "action is required"),
  details: z.any().optional(),
});

export function registerInteractionRoutes(app: Express) {
  // ── POST /api/interactions ──
  app.post("/api/interactions", authenticate, async (req, res) => {
    try {
      const parsed = createInteractionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { clientId, action, details } = parsed.data;

      // If clientId is provided, verify the client belongs to the current agent
      if (clientId != null) {
        if (isNaN(clientId)) {
          return res.status(400).json({ error: "Invalid client ID" });
        }

        const [client] = await db
          .select()
          .from(clients)
          .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
          .limit(1);

        if (!client) {
          return res.status(404).json({ error: "Client not found or access denied" });
        }
      }

      const [interaction] = await db
        .insert(interactionLogs)
        .values({
          userId: req.user!.id,
          clientId: clientId ?? null,
          action,
          details: details || null,
        })
        .returning();

      res.status(201).json(interaction);
    } catch (err: any) {
      console.error("Create interaction error:", err.message);
      res.status(500).json({ error: "Failed to log interaction" });
    }
  });

  // ── GET /api/clients/:id/interactions ──
  app.get("/api/clients/:id/interactions", authenticate, async (req, res) => {
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

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const [totalResult, rows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(interactionLogs)
          .where(eq(interactionLogs.clientId, clientId)),
        db
          .select()
          .from(interactionLogs)
          .where(eq(interactionLogs.clientId, clientId))
          .orderBy(desc(interactionLogs.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = Number(totalResult[0]?.count || 0);

      res.json({
        interactions: rows,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("Get interactions error:", err.message);
      res.status(500).json({ error: "Failed to fetch interactions" });
    }
  });
}
