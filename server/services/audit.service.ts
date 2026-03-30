import { pool } from "../db";
import crypto from "crypto";

// ── Types ──

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: number | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  status: "success" | "failure";
  riskLevel: "low" | "medium" | "high";
}

export type AuditLogInput = Omit<AuditLogEntry, "id" | "timestamp">;

export interface AuditLogFilters {
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  riskLevel?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ── Risk-level classification ──

const HIGH_RISK_ACTIONS = new Set([
  "login_failure",
  "account_locked",
  "role_change",
  "api_key_create",
  "api_key_revoke",
  "phi_access",
  "password_change",
  "force_logout",
  "data_export_bulk",
]);

const MEDIUM_RISK_ACTIONS = new Set([
  "data_export",
  "client_create",
  "client_update",
  "client_delete",
  "register",
  "admin_action",
]);

export function classifyRisk(action: string): "low" | "medium" | "high" {
  if (HIGH_RISK_ACTIONS.has(action)) return "high";
  if (MEDIUM_RISK_ACTIONS.has(action)) return "medium";
  return "low";
}

// ── Core logging function ──

export async function logAudit(entry: AuditLogInput): Promise<void> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    await pool.query(
      `INSERT INTO audit_logs (id, timestamp, user_id, user_email, user_role, action, resource, resource_id, ip_address, user_agent, details, status, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        timestamp,
        entry.userId,
        entry.userEmail,
        entry.userRole,
        entry.action,
        entry.resource,
        entry.resourceId,
        entry.ipAddress,
        entry.userAgent,
        JSON.stringify(entry.details),
        entry.status,
        entry.riskLevel,
      ]
    );
  } catch (err: any) {
    // Audit logging should never crash the application
    console.error("[audit] Failed to write audit log:", err.message);
  }
}

// ── Query audit logs ──

export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    params.push(filters.userId);
  }
  if (filters.action) {
    conditions.push(`action = $${paramIdx++}`);
    params.push(filters.action);
  }
  if (filters.resource) {
    conditions.push(`resource = $${paramIdx++}`);
    params.push(filters.resource);
  }
  if (filters.riskLevel) {
    conditions.push(`risk_level = $${paramIdx++}`);
    params.push(filters.riskLevel);
  }
  if (filters.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(filters.status);
  }
  if (filters.startDate) {
    conditions.push(`timestamp >= $${paramIdx++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`timestamp <= $${paramIdx++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(filters.limit || 50, 500);
  const offset = filters.offset || 0;

  const result = await pool.query(
    `SELECT id, timestamp, user_id, user_email, user_role, action, resource, resource_id, ip_address, user_agent, details, status, risk_level
     FROM audit_logs
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return result.rows.map(mapRow);
}

// ── Specialized queries for admin dashboard ──

export async function getFailedLogins(hours: number = 24): Promise<AuditLogEntry[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const result = await pool.query(
    `SELECT * FROM audit_logs WHERE action = 'login_failure' AND timestamp >= $1 ORDER BY timestamp DESC LIMIT 200`,
    [since]
  );
  return result.rows.map(mapRow);
}

export async function getDataExports(days: number = 30): Promise<AuditLogEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await pool.query(
    `SELECT * FROM audit_logs WHERE action LIKE 'data_export%' AND timestamp >= $1 ORDER BY timestamp DESC LIMIT 200`,
    [since]
  );
  return result.rows.map(mapRow);
}

export async function getSecuritySummary(): Promise<{
  failedLogins24h: number;
  dataExports7d: number;
  activeSessions: number;
  phiAccessCount24h: number;
  lockedAccounts: number;
  highRiskEvents24h: number;
  lastScanTimestamp: string;
}> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [failedLogins, exports7d, phiAccess, sessions, locked, highRisk] = await Promise.all([
    pool.query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'login_failure' AND timestamp >= $1`, [h24]),
    pool.query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action LIKE 'data_export%' AND timestamp >= $1`, [d7]),
    pool.query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE action = 'phi_access' AND timestamp >= $1`, [h24]),
    pool.query(`SELECT COUNT(*) as cnt FROM active_sessions WHERE expires_at > NOW()`),
    pool.query(`SELECT COUNT(*) as cnt FROM app_users WHERE is_active = false`),
    pool.query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE risk_level = 'high' AND timestamp >= $1`, [h24]),
  ]);

  return {
    failedLogins24h: parseInt(failedLogins.rows[0]?.cnt || "0"),
    dataExports7d: parseInt(exports7d.rows[0]?.cnt || "0"),
    activeSessions: parseInt(sessions.rows[0]?.cnt || "0"),
    phiAccessCount24h: parseInt(phiAccess.rows[0]?.cnt || "0"),
    lockedAccounts: parseInt(locked.rows[0]?.cnt || "0"),
    highRiskEvents24h: parseInt(highRisk.rows[0]?.cnt || "0"),
    lastScanTimestamp: now.toISOString(),
  };
}

// ── Helpers ──

function mapRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    userId: row.user_id,
    userEmail: row.user_email,
    userRole: row.user_role,
    action: row.action,
    resource: row.resource,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    details: typeof row.details === "string" ? JSON.parse(row.details) : row.details || {},
    status: row.status,
    riskLevel: row.risk_level,
  };
}

// ── Express helper: extract IP + UA from request ──

import type { Request } from "express";

export function auditFromRequest(req: Request) {
  return {
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    userId: req.user?.id ?? null,
    userEmail: req.user?.email ?? null,
    userRole: req.user?.role ?? null,
  };
}
