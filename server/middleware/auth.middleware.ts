import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { verifyToken } from "../services/auth.service";
import { pool } from "../db";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
      authMethod?: "jwt" | "api-key";
    }
  }
}

/**
 * Try API key auth first (X-API-Key header), then fall back to JWT Bearer token.
 * Returns 401 if neither is valid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Check for API key first
  const apiKey = req.headers["x-api-key"] as string;
  if (apiKey) {
    authenticateApiKey(apiKey, req, res, next);
    return;
  }

  // Fall back to JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = payload;
  req.authMethod = "jwt";
  next();
}

/**
 * Like authenticate but does not fail if no token is provided.
 * If a token IS provided and is invalid, still returns 401.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  // Check for API key
  const apiKey = req.headers["x-api-key"] as string;
  if (apiKey) {
    authenticateApiKey(apiKey, req, res, next);
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = payload;
  req.authMethod = "jwt";
  next();
}

/**
 * Middleware factory: checks that req.user.role is one of the allowed roles.
 * Must be used after authenticate middleware.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

// ── Internal: API Key authentication ──

async function authenticateApiKey(
  apiKey: string,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const result = await pool.query(
      `SELECT k.id, k.user_id, k.scopes, u.email, u.role
       FROM api_keys k
       LEFT JOIN app_users u ON k.user_id = u.id
       WHERE k.key_hash = $1 AND k.is_active = true AND k.expires_at > NOW()`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid or expired API key" });
      return;
    }

    const row = result.rows[0];

    // Update last used timestamp (fire and forget)
    pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});

    req.user = {
      id: row.user_id || 0,
      email: row.email || "api-key-user",
      role: row.role || "viewer",
    };
    req.authMethod = "api-key";

    next();
  } catch (err: any) {
    console.error("API key auth error:", err.message);
    res.status(500).json({ error: "Authentication failed" });
  }
}
