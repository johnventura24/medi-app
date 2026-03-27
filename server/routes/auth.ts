import type { Express } from "express";
import { db } from "../db";
import { users, registerSchema, loginSchema } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../services/auth.service";
import { authenticate } from "../middleware/auth.middleware";

/** Strip passwordHash from a user record before returning it to the client */
function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function registerAuthRoutes(app: Express) {
  // ── POST /api/auth/register ──
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { email, password, fullName, role, organization, npn } = parsed.data;

      // Check for existing user
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
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

      const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });

      res.status(201).json({ user: sanitizeUser(newUser), token });
    } catch (err: any) {
      console.error("Register error:", err.message);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── POST /api/auth/login ──
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;

      const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update lastLoginAt
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      const token = generateToken({ id: user.id, email: user.email, role: user.role });

      res.json({ user: sanitizeUser({ ...user, lastLoginAt: new Date() }), token });
    } catch (err: any) {
      console.error("Login error:", err.message);
      res.status(500).json({ error: "Login failed" });
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
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // ── POST /api/auth/logout ──
  app.post("/api/auth/logout", (_req, res) => {
    // Client-side only — just discard the token. Endpoint exists for API completeness.
    res.json({ success: true });
  });
}
