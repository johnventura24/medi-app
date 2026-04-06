import { randomBytes, scryptSync, createHmac, timingSafeEqual } from "crypto";
import { pool } from "../db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  if (process.env.NODE_ENV === "production") process.exit(1);
}

const getJwtSecret = (): string => {
  if (JWT_SECRET) return JWT_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-only-insecure-secret";
  throw new Error("JWT_SECRET is required in production");
};

// ── Password Policy (SOC2 compliant) ──

const PASSWORD_MIN_LENGTH = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const PASSWORD_HISTORY_COUNT = 5;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push("Password must include at least one special character");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if the password was used in the last N password changes.
 */
export async function checkPasswordHistory(userId: number, newPassword: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, PASSWORD_HISTORY_COUNT]
    );

    for (const row of result.rows) {
      const matches = await verifyPassword(newPassword, row.password_hash);
      if (matches) return true; // password was previously used
    }
    return false;
  } catch {
    return false; // table may not exist yet
  }
}

/**
 * Record a password hash in the history table.
 */
export async function recordPasswordHistory(userId: number, passwordHash: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO password_history (user_id, password_hash, created_at) VALUES ($1, $2, NOW())`,
      [userId, passwordHash]
    );
    // Prune old entries
    await pool.query(
      `DELETE FROM password_history WHERE user_id = $1 AND id NOT IN (
        SELECT id FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
      )`,
      [userId, PASSWORD_HISTORY_COUNT]
    );
  } catch {
    // Non-fatal
  }
}

// ── Account Lockout ──

export async function recordFailedLogin(email: string): Promise<{ locked: boolean; attempts: number }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOCKOUT_DURATION_MINUTES * 60 * 1000);

    // Count recent failures
    const result = await pool.query(
      `SELECT COUNT(*) as cnt FROM login_attempts WHERE email = $1 AND attempted_at > $2 AND success = false`,
      [email, windowStart.toISOString()]
    );
    const currentAttempts = parseInt(result.rows[0]?.cnt || "0");

    // Record this attempt
    await pool.query(
      `INSERT INTO login_attempts (email, success, attempted_at, ip_address) VALUES ($1, false, NOW(), '')`,
      [email]
    );

    const totalAttempts = currentAttempts + 1;

    if (totalAttempts >= MAX_FAILED_ATTEMPTS) {
      // Lock the account
      await pool.query(
        `UPDATE app_users SET is_active = false WHERE email = $1`,
        [email]
      );
      return { locked: true, attempts: totalAttempts };
    }

    return { locked: false, attempts: totalAttempts };
  } catch {
    return { locked: false, attempts: 0 };
  }
}

export async function recordSuccessfulLogin(email: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO login_attempts (email, success, attempted_at, ip_address) VALUES ($1, true, NOW(), '')`,
      [email]
    );
  } catch {
    // Non-fatal
  }
}

export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000);
    const result = await pool.query(
      `SELECT COUNT(*) as cnt FROM login_attempts WHERE email = $1 AND attempted_at > $2 AND success = false`,
      [email, windowStart.toISOString()]
    );
    return parseInt(result.rows[0]?.cnt || "0") >= MAX_FAILED_ATTEMPTS;
  } catch {
    return false;
  }
}

// ── Token Refresh ──

export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export async function storeRefreshToken(userId: number, refreshToken: string, expiresInDays: number = 7): Promise<void> {
  const tokenHash = createHmac("sha256", getJwtSecret()).update(refreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  try {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW())`,
      [userId, tokenHash, expiresAt.toISOString()]
    );
  } catch {
    // Non-fatal
  }
}

export async function validateRefreshToken(refreshToken: string): Promise<number | null> {
  const tokenHash = createHmac("sha256", getJwtSecret()).update(refreshToken).digest("hex");
  try {
    const result = await pool.query(
      `SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW() AND revoked = false`,
      [tokenHash]
    );
    if (result.rows.length > 0) return result.rows[0].user_id;
    return null;
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = createHmac("sha256", getJwtSecret()).update(refreshToken).digest("hex");
  try {
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
      [tokenHash]
    );
  } catch {
    // Non-fatal
  }
}

export async function revokeAllRefreshTokens(userId: number): Promise<void> {
  try {
    await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [userId]);
  } catch {
    // Non-fatal
  }
}

// ── Password Hashing (scrypt) ──

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  return timingSafeEqual(derived, keyBuffer);
}

// ── JWT (HMAC-SHA256, no external dependency) ──

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  // Restore padding
  let padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const mod = padded.length % 4;
  if (mod === 2) padded += "==";
  else if (mod === 3) padded += "=";
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function generateToken(user: TokenPayload): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours (SOC2 compliant)
    })
  );
  const signature = createHmac("sha256", getJwtSecret())
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Verify signature
    const expectedSig = createHmac("sha256", getJwtSecret())
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSig) return null;

    // Decode and validate payload
    const decoded = JSON.parse(base64UrlDecode(payload));

    // Check expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}
