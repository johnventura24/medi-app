import type { Express } from "express";
import { db } from "../db";
import { clients, clientRecommendations, interactionLogs, scopeOfAppointments, plans, insertClientSchema } from "@shared/schema";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";

export function registerClientRoutes(app: Express) {
  // ── POST /api/clients ──
  app.post("/api/clients", authenticate, async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const [client] = await db
        .insert(clients)
        .values({
          ...parsed.data,
          agentUserId: req.user!.id,
        })
        .returning();

      res.status(201).json(client);
    } catch (err: any) {
      console.error("Create client error:", err.message);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  // ── GET /api/clients ──
  app.get("/api/clients", authenticate, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      const conditions: any[] = [eq(clients.agentUserId, req.user!.id)];

      if (status) {
        conditions.push(eq(clients.status, status));
      }

      if (search) {
        conditions.push(
          or(
            ilike(clients.firstName, `%${search}%`),
            ilike(clients.lastName, `%${search}%`)
          )
        );
      }

      const whereClause = and(...conditions);

      const [totalResult, rows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(clients).where(whereClause),
        db
          .select()
          .from(clients)
          .where(whereClause)
          .orderBy(desc(clients.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = Number(totalResult[0]?.count || 0);

      res.json({
        clients: rows,
        total,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("List clients error:", err.message);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // ── GET /api/clients/:id ──
  app.get("/api/clients/:id", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Fetch client — must be owned by current agent or user is admin
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (client.agentUserId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch related data in parallel
      const [recommendations, recentInteractions, activeSoas] = await Promise.all([
        db
          .select({
            id: clientRecommendations.id,
            planId: clientRecommendations.planId,
            score: clientRecommendations.score,
            scoreBreakdown: clientRecommendations.scoreBreakdown,
            rank: clientRecommendations.rank,
            createdAt: clientRecommendations.createdAt,
            planName: plans.name,
            carrier: plans.organizationName,
            premium: plans.calculatedMonthlyPremium,
          })
          .from(clientRecommendations)
          .leftJoin(plans, eq(clientRecommendations.planId, plans.id))
          .where(eq(clientRecommendations.clientId, clientId))
          .orderBy(clientRecommendations.rank),
        db
          .select()
          .from(interactionLogs)
          .where(eq(interactionLogs.clientId, clientId))
          .orderBy(desc(interactionLogs.createdAt))
          .limit(10),
        db
          .select()
          .from(scopeOfAppointments)
          .where(
            and(
              eq(scopeOfAppointments.clientId, clientId),
              eq(scopeOfAppointments.status, "active")
            )
          )
          .orderBy(desc(scopeOfAppointments.createdAt)),
      ]);

      res.json({
        ...client,
        recommendations,
        recentInteractions,
        activeSoas,
      });
    } catch (err: any) {
      console.error("Get client error:", err.message);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // ── PUT /api/clients/:id ──
  app.put("/api/clients/:id", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Verify ownership
      const [existing] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      // Build update payload — only allow safe fields
      const allowedFields = [
        "firstName", "lastName", "dateOfBirth", "gender", "zipCode", "county", "fips",
        "currentCoverage", "currentPlanName", "maxMonthlyPremium", "maxAnnualOop",
        "chronicConditions", "mobilityLevel", "hospitalizedLastYear", "medications",
        "preferredDoctors", "mustHaveBenefits", "benefitWeights", "notes", "status",
      ] as const;

      const updates: Record<string, any> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const [updated] = await db
        .update(clients)
        .set(updates)
        .where(eq(clients.id, clientId))
        .returning();

      res.json(updated);
    } catch (err: any) {
      console.error("Update client error:", err.message);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // ── DELETE /api/clients/:id — Soft delete (archive) ──
  app.delete("/api/clients/:id", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Verify ownership
      const [existing] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      const [archived] = await db
        .update(clients)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(clients.id, clientId))
        .returning();

      res.json(archived);
    } catch (err: any) {
      console.error("Delete client error:", err.message);
      res.status(500).json({ error: "Failed to archive client" });
    }
  });
}
