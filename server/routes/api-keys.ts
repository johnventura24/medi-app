import type { Express } from "express";
import crypto from "crypto";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { pool } from "../db";
import { logAudit, auditFromRequest } from "../services/audit.service";

export function registerApiKeyRoutes(app: Express) {
  const adminAuth = [authenticate, requireRole("admin")];

  // ── POST /api/admin/api-keys ── Create a new API key
  app.post("/api/admin/api-keys", ...adminAuth, async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const { name, userId, scopes, expiresInDays } = req.body;

      if (!name) {
        return res.status(400).json({ error: "API key name is required" });
      }

      // Generate a secure API key
      const keyPrefix = "mk_"; // medi-key prefix
      const rawKey = keyPrefix + crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const keyId = crypto.randomUUID();

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // default 1 year

      await pool.query(
        `INSERT INTO api_keys (id, name, key_hash, key_prefix, user_id, scopes, expires_at, created_by, created_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), true)`,
        [
          keyId,
          name,
          keyHash,
          rawKey.substring(0, 10) + "...", // show first 10 chars for identification
          userId || null,
          JSON.stringify(scopes || ["read"]),
          expiresAt.toISOString(),
          req.user!.id,
        ]
      );

      await logAudit({
        ...audit,
        action: "api_key_create",
        resource: "api-keys",
        resourceId: keyId,
        details: { name, userId, scopes: scopes || ["read"] },
        status: "success",
        riskLevel: "high",
      });

      // Return the raw key ONCE — it cannot be retrieved again
      res.status(201).json({
        id: keyId,
        name,
        key: rawKey,
        prefix: rawKey.substring(0, 10) + "...",
        scopes: scopes || ["read"],
        expiresAt: expiresAt.toISOString(),
        message: "Save this API key now. It will not be shown again.",
      });
    } catch (err: any) {
      console.error("Create API key error:", err.message);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  // ── GET /api/admin/api-keys ── List active API keys (without the actual key)
  app.get("/api/admin/api-keys", ...adminAuth, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT k.id, k.name, k.key_prefix, k.user_id, k.scopes, k.expires_at, k.created_at, k.is_active, k.last_used_at, u.email as user_email
         FROM api_keys k
         LEFT JOIN app_users u ON k.user_id = u.id
         WHERE k.is_active = true
         ORDER BY k.created_at DESC`
      );

      const keys = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        prefix: row.key_prefix,
        userId: row.user_id,
        userEmail: row.user_email,
        scopes: row.scopes,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        isActive: row.is_active,
      }));

      res.json({ keys, count: keys.length });
    } catch (err: any) {
      console.error("List API keys error:", err.message);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  });

  // ── DELETE /api/admin/api-keys/:id ── Revoke an API key
  app.delete("/api/admin/api-keys/:id", ...adminAuth, async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const keyId = req.params.id;

      const result = await pool.query(
        `UPDATE api_keys SET is_active = false WHERE id = $1 RETURNING name`,
        [keyId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "API key not found" });
      }

      await logAudit({
        ...audit,
        action: "api_key_revoke",
        resource: "api-keys",
        resourceId: keyId,
        details: { name: result.rows[0]?.name },
        status: "success",
        riskLevel: "high",
      });

      res.json({ success: true, message: "API key revoked" });
    } catch (err: any) {
      console.error("Revoke API key error:", err.message);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });
}
