import type { Express, Request, Response } from "express";
import { db } from "../db";
import { consumerLeads, leadActivity, plans } from "@shared/schema";
import { sql, eq, and, desc, count } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["contacted", "enrolled", "lost"]),
  notes: z.string().optional(),
});

export function registerLeadRoutes(app: Express) {

  // ── GET /api/leads ──
  app.get("/api/leads", authenticate, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;

      const conditions = [];

      // Non-admin agents only see their own leads
      if (req.user!.role !== "admin") {
        conditions.push(eq(consumerLeads.assignedAgentId, req.user!.id));
      }

      if (status && status !== "all") {
        conditions.push(eq(consumerLeads.status, status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [leads, totalResult] = await Promise.all([
        db
          .select()
          .from(consumerLeads)
          .where(whereClause)
          .orderBy(desc(consumerLeads.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(consumerLeads)
          .where(whereClause),
      ]);

      res.json({
        leads,
        total: totalResult[0]?.count || 0,
        page,
        limit,
      });
    } catch (err: any) {
      console.error("Get leads error:", err.message);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // ── PUT /api/leads/:id/status ──
  app.put("/api/leads/:id/status", authenticate, async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }

      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { status, notes } = parsed.data;

      // Verify the agent owns this lead (or is admin)
      const [existing] = await db
        .select()
        .from(consumerLeads)
        .where(eq(consumerLeads.id, leadId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (req.user!.role !== "admin" && existing.assignedAgentId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to update this lead" });
      }

      // Update lead
      const updateData: Record<string, any> = { status };
      if (status === "contacted") {
        updateData.contactedAt = new Date();
      }

      const [updated] = await db
        .update(consumerLeads)
        .set(updateData)
        .where(eq(consumerLeads.id, leadId))
        .returning();

      // Log activity
      const actionMap: Record<string, string> = {
        contacted: "agent_contacted",
        enrolled: "enrolled",
        lost: "lost",
      };

      await db.insert(leadActivity).values({
        leadId,
        action: actionMap[status] || status,
        details: { updatedBy: req.user!.id, notes: notes || null },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Update lead status error:", err.message);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // ── GET /api/leads/stats ──
  app.get("/api/leads/stats", authenticate, async (req: Request, res: Response) => {
    try {
      const agentCondition = req.user!.role !== "admin"
        ? eq(consumerLeads.assignedAgentId, req.user!.id)
        : undefined;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        newLeadsResult,
        contactedTodayResult,
        enrolledThisMonthResult,
        totalLeadsResult,
        enrolledTotalResult,
      ] = await Promise.all([
        db
          .select({ count: count() })
          .from(consumerLeads)
          .where(agentCondition ? and(eq(consumerLeads.status, "new"), agentCondition) : eq(consumerLeads.status, "new")),
        db
          .select({ count: count() })
          .from(consumerLeads)
          .where(
            agentCondition
              ? and(
                  eq(consumerLeads.status, "contacted"),
                  sql`${consumerLeads.contactedAt} >= ${today.toISOString()}`,
                  agentCondition
                )
              : and(
                  eq(consumerLeads.status, "contacted"),
                  sql`${consumerLeads.contactedAt} >= ${today.toISOString()}`
                )
          ),
        db
          .select({ count: count() })
          .from(consumerLeads)
          .where(
            agentCondition
              ? and(
                  eq(consumerLeads.status, "enrolled"),
                  sql`${consumerLeads.createdAt} >= ${firstOfMonth.toISOString()}`,
                  agentCondition
                )
              : and(
                  eq(consumerLeads.status, "enrolled"),
                  sql`${consumerLeads.createdAt} >= ${firstOfMonth.toISOString()}`
                )
          ),
        db
          .select({ count: count() })
          .from(consumerLeads)
          .where(agentCondition || undefined),
        db
          .select({ count: count() })
          .from(consumerLeads)
          .where(
            agentCondition
              ? and(eq(consumerLeads.status, "enrolled"), agentCondition)
              : eq(consumerLeads.status, "enrolled")
          ),
      ]);

      const totalLeads = Number(totalLeadsResult[0]?.count || 0);
      const enrolledTotal = Number(enrolledTotalResult[0]?.count || 0);
      const conversionRate = totalLeads > 0
        ? Math.round((enrolledTotal / totalLeads) * 100)
        : 0;

      res.json({
        newLeads: Number(newLeadsResult[0]?.count || 0),
        contactedToday: Number(contactedTodayResult[0]?.count || 0),
        enrolledThisMonth: Number(enrolledThisMonthResult[0]?.count || 0),
        conversionRate,
      });
    } catch (err: any) {
      console.error("Lead stats error:", err.message);
      res.status(500).json({ error: "Failed to fetch lead stats" });
    }
  });
}
