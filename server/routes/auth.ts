import type { Express } from "express";
import { db } from "../db";
import { users, registerSchema, loginSchema } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  validatePasswordPolicy,
  checkPasswordHistory,
  recordPasswordHistory,
  recordFailedLogin,
  recordSuccessfulLogin,
  isAccountLocked,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from "../services/auth.service";
import { authenticate } from "../middleware/auth.middleware";
import { logAudit, auditFromRequest, classifyRisk } from "../services/audit.service";
import { createSession, revokeSession, revokeAllUserSessions } from "../services/session.service";

/** Strip passwordHash from a user record before returning it to the client */
function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function registerAuthRoutes(app: Express) {
  // ── POST /api/auth/register ──
  app.post("/api/auth/register", async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { email, password, fullName, role, organization, npn } = parsed.data;

      // Enforce password policy
      const policyResult = validatePasswordPolicy(password);
      if (!policyResult.valid) {
        await logAudit({
          ...audit,
          userEmail: email,
          action: "register_failure",
          resource: "auth",
          resourceId: null,
          details: { reason: "password_policy", errors: policyResult.errors },
          status: "failure",
          riskLevel: "medium",
        });
        return res.status(400).json({ error: "Password does not meet requirements", details: policyResult.errors });
      }

      // Check for existing user
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        await logAudit({
          ...audit,
          userEmail: email,
          action: "register_failure",
          resource: "auth",
          resourceId: null,
          details: { reason: "email_exists" },
          status: "failure",
          riskLevel: "medium",
        });
        return res.status(409).json({ error: "Email already registered" });
      }

      const hashed = await hashPassword(password);

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          passwordHash: hashed,
          fullName: fullName || null,
          role: role || "agent",
          organization: organization || null,
          npn: npn || null,
        })
        .returning();

      // Record password in history
      await recordPasswordHistory(newUser.id, hashed);

      const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(newUser.id, refreshToken);

      // Create session
      await createSession(newUser.id, token, audit.ipAddress, audit.userAgent);

      await logAudit({
        ...audit,
        userId: newUser.id,
        userEmail: newUser.email,
        userRole: newUser.role,
        action: "register",
        resource: "auth",
        resourceId: String(newUser.id),
        details: { organization: organization || null },
        status: "success",
        riskLevel: classifyRisk("register"),
      });

      res.status(201).json({ user: sanitizeUser(newUser), token, refreshToken });
    } catch (err: any) {
      console.error("Register error:", err.message);
      if (err.message?.includes('relation "users" does not exist')) {
        return res.status(503).json({ error: "User system not yet initialized. Run the database migration to create the users table." });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── POST /api/auth/login ──
  app.post("/api/auth/login", async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;

      // Check account lockout
      const locked = await isAccountLocked(email);
      if (locked) {
        await logAudit({
          ...audit,
          userEmail: email,
          action: "login_failure",
          resource: "auth",
          resourceId: null,
          details: { reason: "account_locked" },
          status: "failure",
          riskLevel: "high",
        });
        return res.status(423).json({ error: "Account is temporarily locked due to too many failed attempts. Please try again in 15 minutes." });
      }

      const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
      if (!user) {
        await recordFailedLogin(email);
        await logAudit({
          ...audit,
          userEmail: email,
          action: "login_failure",
          resource: "auth",
          resourceId: null,
          details: { reason: "user_not_found" },
          status: "failure",
          riskLevel: "high",
        });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!user.isActive) {
        await logAudit({
          ...audit,
          userId: user.id,
          userEmail: email,
          userRole: user.role,
          action: "login_failure",
          resource: "auth",
          resourceId: String(user.id),
          details: { reason: "account_deactivated" },
          status: "failure",
          riskLevel: "high",
        });
        return res.status(403).json({ error: "Account is deactivated" });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        const lockResult = await recordFailedLogin(email);
        await logAudit({
          ...audit,
          userId: user.id,
          userEmail: email,
          userRole: user.role,
          action: "login_failure",
          resource: "auth",
          resourceId: String(user.id),
          details: {
            reason: "invalid_password",
            failedAttempts: lockResult.attempts,
            accountLocked: lockResult.locked,
          },
          status: "failure",
          riskLevel: "high",
        });

        if (lockResult.locked) {
          return res.status(423).json({ error: "Account locked after too many failed attempts. Please try again in 15 minutes." });
        }
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Successful login
      await recordSuccessfulLogin(email);

      // Update lastLoginAt
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(user.id, refreshToken);

      // Create session
      await createSession(user.id, token, audit.ipAddress, audit.userAgent);

      await logAudit({
        ...audit,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: "login",
        resource: "auth",
        resourceId: String(user.id),
        details: {},
        status: "success",
        riskLevel: "low",
      });

      res.json({ user: sanitizeUser({ ...user, lastLoginAt: new Date() }), token, refreshToken });
    } catch (err: any) {
      console.error("Login error:", err.message);
      if (err.message?.includes('relation "users" does not exist')) {
        return res.status(503).json({ error: "User system not yet initialized. Run the database migration to create the users table." });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ── POST /api/auth/refresh ──
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token required" });
      }

      const userId = await validateRefreshToken(refreshToken);
      if (!userId) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }

      // Look up user
      const [user] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "User not found or deactivated" });
      }

      // Revoke old refresh token and issue new ones
      await revokeRefreshToken(refreshToken);
      const newToken = generateToken({ id: user.id, email: user.email, role: user.role });
      const newRefreshToken = generateRefreshToken();
      await storeRefreshToken(user.id, newRefreshToken);

      const audit = auditFromRequest(req);
      await createSession(user.id, newToken, audit.ipAddress, audit.userAgent);

      res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (err: any) {
      console.error("Token refresh error:", err.message);
      res.status(500).json({ error: "Token refresh failed" });
    }
  });

  // ── POST /api/auth/change-password ──
  app.post("/api/auth/change-password", authenticate, async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      // Validate new password policy
      const policyResult = validatePasswordPolicy(newPassword);
      if (!policyResult.valid) {
        return res.status(400).json({ error: "New password does not meet requirements", details: policyResult.errors });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Check password history
      const wasUsed = await checkPasswordHistory(user.id, newPassword);
      if (wasUsed) {
        return res.status(400).json({ error: "Cannot reuse one of your last 5 passwords" });
      }

      const newHash = await hashPassword(newPassword);
      await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));
      await recordPasswordHistory(user.id, newHash);

      // Force logout: revoke all sessions and refresh tokens
      await revokeAllUserSessions(user.id);
      await revokeAllRefreshTokens(user.id);

      // Issue new token
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(user.id, refreshToken);
      await createSession(user.id, token, audit.ipAddress, audit.userAgent);

      await logAudit({
        ...audit,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: "password_change",
        resource: "auth",
        resourceId: String(user.id),
        details: { sessionsRevoked: true },
        status: "success",
        riskLevel: "high",
      });

      res.json({ success: true, token, refreshToken, message: "Password changed. All other sessions have been revoked." });
    } catch (err: any) {
      console.error("Change password error:", err.message);
      res.status(500).json({ error: "Password change failed" });
    }
  });

  // ── GET /api/auth/me ──
  app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, req.user!.id), isNull(users.deletedAt)))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: sanitizeUser(user) });
    } catch (err: any) {
      console.error("Get profile error:", err.message);
      if (err.message?.includes('relation "users" does not exist')) {
        return res.status(503).json({ error: "User system not yet initialized. Run the database migration to create the users table." });
      }
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // ── POST /api/auth/logout ──
  app.post("/api/auth/logout", authenticate, async (req, res) => {
    const audit = auditFromRequest(req);
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.slice(7);
        await revokeSession(token);
      }

      await logAudit({
        ...audit,
        action: "logout",
        resource: "auth",
        resourceId: req.user?.id ? String(req.user.id) : null,
        details: {},
        status: "success",
        riskLevel: "low",
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Logout error:", err.message);
      res.json({ success: true }); // always succeed for logout
    }
  });
}
