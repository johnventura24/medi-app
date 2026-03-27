import type { Express } from "express";
import { db } from "../db";
import { clients, clientRecommendations, interactionLogs, scopeOfAppointments, plans, insertClientSchema } from "@shared/schema";
import { eq, and, or, ilike, sql, desc, isNull } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";
import { encrypt, decrypt, encryptJson, decryptJson } from "../services/encryption.service";
import { z } from "zod";

const updateClientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  zipCode: z.string().optional(),
  county: z.string().optional(),
  fips: z.string().optional(),
  currentCoverage: z.string().optional(),
  currentPlanName: z.string().optional(),
  maxMonthlyPremium: z.number().optional(),
  maxAnnualOop: z.number().optional(),
  chronicConditions: z.any().optional(),
  mobilityLevel: z.string().optional(),
  hospitalizedLastYear: z.boolean().optional(),
  medications: z.any().optional(),
  preferredDoctors: z.any().optional(),
  mustHaveBenefits: z.any().optional(),
  benefitWeights: z.any().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

function encryptClientData(data: any) {
  const encrypted = { ...data };
  if (encrypted.chronicConditions) encrypted.chronicConditions = encryptJson(encrypted.chronicConditions);
  if (encrypted.medications) encrypted.medications = encryptJson(encrypted.medications);
  if (encrypted.preferredDoctors) encrypted.preferredDoctors = encryptJson(encrypted.preferredDoctors);
  if (encrypted.dateOfBirth) encrypted.dateOfBirth = encrypt(encrypted.dateOfBirth);
  return encrypted;
}

function decryptClientData(data: any) {
  const decrypted = { ...data };
  if (decrypted.chronicConditions) decrypted.chronicConditions = decryptJson(decrypted.chronicConditions);
  if (decrypted.medications) decrypted.medications = decryptJson(decrypted.medications);
  if (decrypted.preferredDoctors) decrypted.preferredDoctors = decryptJson(decrypted.preferredDoctors);
  if (decrypted.dateOfBirth) decrypted.dateOfBirth = decrypt(decrypted.dateOfBirth);
  return decrypted;
}

export function registerClientRoutes(app: Express) {
  // ── POST /api/clients ──
  app.post("/api/clients", authenticate, async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const encryptedData = encryptClientData(parsed.data);

      const [client] = await db
        .insert(clients)
        .values({
          ...encryptedData,
          agentUserId: req.user!.id,
        })
        .returning();

      res.status(201).json(decryptClientData(client));
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

      const conditions: any[] = [eq(clients.agentUserId, req.user!.id), isNull(clients.deletedAt)];

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
        clients: rows.map(decryptClientData),
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

      // Fetch client — must be owned by current agent or user is admin, exclude soft-deleted
      const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
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
        ...decryptClientData(client),
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

      const parsed = updateClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      // Verify ownership (exclude soft-deleted)
      const [existing] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id), isNull(clients.deletedAt)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          updates[key] = value;
        }
      }

      // Encrypt sensitive fields before saving
      const encryptedUpdates = encryptClientData(updates);

      const [updated] = await db
        .update(clients)
        .set(encryptedUpdates)
        .where(eq(clients.id, clientId))
        .returning();

      res.json(decryptClientData(updated));
    } catch (err: any) {
      console.error("Update client error:", err.message);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // ── DELETE /api/clients/:id — Soft delete ──
  app.delete("/api/clients/:id", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Verify ownership (exclude already soft-deleted)
      const [existing] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id), isNull(clients.deletedAt)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      const [deleted] = await db
        .update(clients)
        .set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() })
        .where(eq(clients.id, clientId))
        .returning();

      res.json(deleted);
    } catch (err: any) {
      console.error("Delete client error:", err.message);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });
}
