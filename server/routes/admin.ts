import type { Express } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getAuditLogs, getFailedLogins, getDataExports, getSecuritySummary, logAudit, auditFromRequest } from "../services/audit.service";
import { getAllActiveSessions, revokeAllUserSessions } from "../services/session.service";
import { DATA_CLASSIFICATIONS, classifyResource, requiredControls, classificationLabel } from "../services/data-classification.service";

export function registerAdminRoutes(app: Express) {
  // All admin routes require authentication + admin role
  const adminAuth = [authenticate, requireRole("admin")];

  // ── GET /api/admin/audit-logs ──
  app.get("/api/admin/audit-logs", ...adminAuth, async (req, res) => {
    try {
      const filters = {
        userId: req.query.userId ? Number(req.query.userId) : undefined,
        action: req.query.action as string | undefined,
        resource: req.query.resource as string | undefined,
        riskLevel: req.query.riskLevel as string | undefined,
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      };

      const logs = await getAuditLogs(filters);

      await logAudit({
        ...auditFromRequest(req),
        action: "admin_action",
        resource: "audit_logs",
        resourceId: null,
        details: { query: "view_audit_logs", filters },
        status: "success",
        riskLevel: "low",
      });

      res.json({ logs, count: logs.length });
    } catch (err: any) {
      console.error("Admin audit logs error:", err.message);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ── GET /api/admin/active-sessions ──
  app.get("/api/admin/active-sessions", ...adminAuth, async (_req, res) => {
    try {
      const sessions = await getAllActiveSessions();
      res.json({ sessions, count: sessions.length });
    } catch (err: any) {
      console.error("Admin sessions error:", err.message);
      res.status(500).json({ error: "Failed to fetch active sessions" });
    }
  });

  // ── DELETE /api/admin/sessions/:userId ── Force logout a user
  app.delete("/api/admin/sessions/:userId", ...adminAuth, async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const targetUserId = Number(req.params.userId);
      const revoked = await revokeAllUserSessions(targetUserId);

      await logAudit({
        ...audit,
        action: "force_logout",
        resource: "sessions",
        resourceId: String(targetUserId),
        details: { sessionsRevoked: revoked },
        status: "success",
        riskLevel: "high",
      });

      res.json({ success: true, sessionsRevoked: revoked });
    } catch (err: any) {
      console.error("Admin force logout error:", err.message);
      res.status(500).json({ error: "Failed to revoke sessions" });
    }
  });

  // ── GET /api/admin/failed-logins ──
  app.get("/api/admin/failed-logins", ...adminAuth, async (req, res) => {
    try {
      const hours = req.query.hours ? Number(req.query.hours) : 24;
      const logs = await getFailedLogins(hours);
      res.json({ logs, count: logs.length });
    } catch (err: any) {
      console.error("Admin failed logins error:", err.message);
      res.status(500).json({ error: "Failed to fetch failed login data" });
    }
  });

  // ── GET /api/admin/data-exports ──
  app.get("/api/admin/data-exports", ...adminAuth, async (req, res) => {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const logs = await getDataExports(days);
      res.json({ logs, count: logs.length });
    } catch (err: any) {
      console.error("Admin data exports error:", err.message);
      res.status(500).json({ error: "Failed to fetch export data" });
    }
  });

  // ── GET /api/admin/security-summary ──
  app.get("/api/admin/security-summary", ...adminAuth, async (_req, res) => {
    try {
      const summary = await getSecuritySummary();
      res.json(summary);
    } catch (err: any) {
      console.error("Admin security summary error:", err.message);
      res.status(500).json({ error: "Failed to generate security summary" });
    }
  });

  // ── GET /api/admin/data-classifications ──
  app.get("/api/admin/data-classifications", ...adminAuth, async (_req, res) => {
    try {
      const classifications = Object.entries(DATA_CLASSIFICATIONS).map(([level, items]) => ({
        level,
        label: classificationLabel(level as any),
        items,
        controls: requiredControls(level as any),
      }));
      res.json({ classifications });
    } catch (err: any) {
      console.error("Admin data classifications error:", err.message);
      res.status(500).json({ error: "Failed to fetch data classifications" });
    }
  });
}
