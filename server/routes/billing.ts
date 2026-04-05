import type { Express } from "express";
import express from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth.middleware";
import {
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhook,
  isStripeConfigured,
} from "../services/stripe.service";

export function registerBillingRoutes(app: Express) {
  // ── Webhook (raw body, no auth — Stripe calls this) ──
  // MUST be registered before any JSON body-parser middleware
  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!isStripeConfigured()) {
        res.status(503).json({ error: "Billing not configured" });
        return;
      }

      const signature = req.headers["stripe-signature"] as string;
      if (!signature) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      try {
        await handleWebhook(req.body, signature);
        res.json({ received: true });
      } catch (err: any) {
        console.error("[billing] Webhook error:", err.message);
        res.status(400).json({ error: err.message });
      }
    }
  );

  // ── Create Checkout Session ──
  app.post("/api/billing/checkout", authenticate, async (req, res) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Billing not configured" });
      return;
    }

    const { tier } = req.body;
    if (!tier || !["agent", "team"].includes(tier)) {
      res.status(400).json({ error: "Invalid tier. Must be 'agent' or 'team'." });
      return;
    }

    try {
      const url = await createCheckoutSession(
        req.user!.id,
        tier,
        req.user!.email
      );
      res.json({ url });
    } catch (err: any) {
      console.error("[billing] Checkout error:", err.message);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // ── Billing Portal ──
  app.post("/api/billing/portal", authenticate, async (req, res) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Billing not configured" });
      return;
    }

    try {
      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!user?.stripeCustomerId) {
        res.status(400).json({ error: "No billing account found" });
        return;
      }

      const url = await createBillingPortalSession(user.stripeCustomerId);
      res.json({ url });
    } catch (err: any) {
      console.error("[billing] Portal error:", err.message);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // ── Billing Status ──
  app.get("/api/billing/status", authenticate, async (req, res) => {
    try {
      const [user] = await db
        .select({
          subscriptionTier: users.subscriptionTier,
          subscriptionStatus: users.subscriptionStatus,
          trialEndsAt: users.trialEndsAt,
        })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        tier: user.subscriptionTier || "free",
        status: user.subscriptionStatus || "inactive",
        trialEndsAt: user.trialEndsAt,
      });
    } catch (err: any) {
      console.error("[billing] Status error:", err.message);
      res.status(500).json({ error: "Failed to fetch billing status" });
    }
  });
}
