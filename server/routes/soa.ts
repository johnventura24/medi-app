import type { Express } from "express";
import { db } from "../db";
import { scopeOfAppointments, clients, insertSOASchema } from "@shared/schema";
import { eq, and, lte, gte, sql, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";

export function registerSOARoutes(app: Express) {
  // ── POST /api/soa ──
  app.post("/api/soa", authenticate, async (req, res) => {
    try {
      // Coerce date strings to Date objects before validation
      const body = { ...req.body };
      if (typeof body.soaDate === "string") body.soaDate = new Date(body.soaDate);
      const parsed = insertSOASchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { clientId, beneficiaryName, soaDate, planTypesDiscussed, beneficiaryInitiated, method, signatureName } = parsed.data;

      // Verify client belongs to current agent
      const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      const now = new Date();
      const soaDateObj = new Date(soaDate);

      // If method is telephonic, set expiration to 48 hours after SOA date
      let expiresAt: Date | null = null;
      if (method === "telephonic") {
        expiresAt = new Date(soaDateObj.getTime() + 48 * 60 * 60 * 1000);
      }

      const [soa] = await db
        .insert(scopeOfAppointments)
        .values({
          agentUserId: req.user!.id,
          clientId,
          beneficiaryName,
          soaDate: soaDateObj,
          planTypesDiscussed,
          beneficiaryInitiated: beneficiaryInitiated ?? false,
          method,
          signatureName,
          signatureTimestamp: now,
          expiresAt,
          status: "active",
        })
        .returning();

      res.status(201).json(soa);
    } catch (err: any) {
      console.error("Create SOA error:", err.message);
      res.status(500).json({ error: "Failed to create scope of appointment" });
    }
  });

  // ── GET /api/soa ──
  app.get("/api/soa", authenticate, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const expiring = req.query.expiring === "true";

      const conditions: any[] = [eq(scopeOfAppointments.agentUserId, req.user!.id)];

      if (status) {
        conditions.push(eq(scopeOfAppointments.status, status));
      }

      if (expiring) {
        // Filter SOAs that expire within 24 hours from now
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        conditions.push(
          sql`${scopeOfAppointments.expiresAt} IS NOT NULL`
        );
        conditions.push(
          lte(scopeOfAppointments.expiresAt, in24Hours)
        );
        conditions.push(
          gte(scopeOfAppointments.expiresAt, now)
        );
      }

      const rows = await db
        .select()
        .from(scopeOfAppointments)
        .where(and(...conditions))
        .orderBy(desc(scopeOfAppointments.createdAt));

      res.json(rows);
    } catch (err: any) {
      console.error("List SOAs error:", err.message);
      res.status(500).json({ error: "Failed to fetch scope of appointments" });
    }
  });

  // ── GET /api/clients/:id/soa ──
  app.get("/api/clients/:id/soa", authenticate, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Verify client belongs to current agent
      const [client] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.agentUserId, req.user!.id)))
        .limit(1);

      if (!client && req.user!.role !== "admin") {
        return res.status(404).json({ error: "Client not found or access denied" });
      }

      const rows = await db
        .select()
        .from(scopeOfAppointments)
        .where(eq(scopeOfAppointments.clientId, clientId))
        .orderBy(desc(scopeOfAppointments.createdAt));

      res.json(rows);
    } catch (err: any) {
      console.error("Get client SOAs error:", err.message);
      res.status(500).json({ error: "Failed to fetch scope of appointments" });
    }
  });
}
