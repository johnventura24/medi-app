import { pool } from "../db";
import crypto from "crypto";

const MAX_SESSIONS_PER_USER = 5;
const SESSION_TTL_HOURS = 24;

export interface ActiveSession {
  id: string;
  userId: number;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

/**
 * Create a new session for a user. Enforces max concurrent session limit.
 * If limit is exceeded, the oldest session is evicted.
 */
export async function createSession(
  userId: number,
  token: string,
  ipAddress: string,
  userAgent: string
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  // Check current session count
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM active_sessions WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  const currentCount = parseInt(countResult.rows[0]?.cnt || "0");

  // Evict oldest sessions if at limit
  if (currentCount >= MAX_SESSIONS_PER_USER) {
    await pool.query(
      `DELETE FROM active_sessions WHERE id IN (
        SELECT id FROM active_sessions WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY last_activity_at ASC
        LIMIT $2
      )`,
      [userId, currentCount - MAX_SESSIONS_PER_USER + 1]
    );
  }

  await pool.query(
    `INSERT INTO active_sessions (id, user_id, token_hash, ip_address, user_agent, created_at, expires_at, last_activity_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sessionId, userId, tokenHash, ipAddress, userAgent, now.toISOString(), expiresAt.toISOString(), now.toISOString()]
  );

  return sessionId;
}

/**
 * Validate that a session exists and is not expired.
 */
export async function validateSession(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT id FROM active_sessions WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length > 0) {
    // Update last activity
    await pool.query(
      `UPDATE active_sessions SET last_activity_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );
    return true;
  }
  return false;
}

/**
 * Revoke a specific session by token.
 */
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.query(`DELETE FROM active_sessions WHERE token_hash = $1`, [tokenHash]);
}

/**
 * Revoke all sessions for a user (e.g., on password change).
 */
export async function revokeAllUserSessions(userId: number): Promise<number> {
  const result = await pool.query(
    `DELETE FROM active_sessions WHERE user_id = $1`,
    [userId]
  );
  return result.rowCount || 0;
}

/**
 * Get all active sessions for a user.
 */
export async function getUserSessions(userId: number): Promise<ActiveSession[]> {
  const result = await pool.query(
    `SELECT * FROM active_sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY last_activity_at DESC`,
    [userId]
  );
  return result.rows.map(mapSessionRow);
}

/**
 * Get all active sessions (admin).
 */
export async function getAllActiveSessions(): Promise<(ActiveSession & { userEmail?: string })[]> {
  const result = await pool.query(
    `SELECT s.*, u.email as user_email
     FROM active_sessions s
     LEFT JOIN app_users u ON s.user_id = u.id
     WHERE s.expires_at > NOW()
     ORDER BY s.last_activity_at DESC
     LIMIT 200`
  );
  return result.rows.map((row) => ({
    ...mapSessionRow(row),
    userEmail: row.user_email,
  }));
}

/**
 * Cleanup expired sessions (run periodically).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await pool.query(`DELETE FROM active_sessions WHERE expires_at <= NOW()`);
  return result.rowCount || 0;
}

// ── Helpers ──

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function mapSessionRow(row: any): ActiveSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
    lastActivityAt: row.last_activity_at instanceof Date ? row.last_activity_at.toISOString() : row.last_activity_at,
  };
}
