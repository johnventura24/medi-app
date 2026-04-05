import Stripe from "stripe";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// ── Stripe initialization (graceful if key is missing) ──

let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
  });
} else {
  console.warn("[stripe] STRIPE_SECRET_KEY not set — billing features disabled");
}

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }
  return stripe;
}

// ── Price IDs (from env or placeholders) ──

const PRICE_MAP: Record<string, string> = {
  agent: process.env.STRIPE_PRICE_AGENT || "PRICE_AGENT",
  team: process.env.STRIPE_PRICE_TEAM || "PRICE_TEAM",
};

// ── Create Checkout Session ──

export async function createCheckoutSession(
  userId: number,
  tier: "agent" | "team",
  email: string
): Promise<string> {
  const s = requireStripe();

  const priceId = PRICE_MAP[tier];
  if (!priceId) {
    throw new Error(`No price configured for tier: ${tier}`);
  }

  // Check if user already has a Stripe customer ID
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let customerId = user?.stripeCustomerId;

  // Create Stripe customer if needed
  if (!customerId) {
    const customer = await s.customers.create({
      email,
      metadata: { userId: String(userId) },
    });
    customerId = customer.id;

    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId));
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL || "http://localhost:5000"}/dashboard?billing=success`,
    cancel_url: `${process.env.APP_URL || "http://localhost:5000"}/pricing?billing=canceled`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId: String(userId), tier },
    },
    metadata: { userId: String(userId), tier },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}

// ── Billing Portal Session ──

export async function createBillingPortalSession(
  stripeCustomerId: string
): Promise<string> {
  const s = requireStripe();

  const session = await s.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.APP_URL || "http://localhost:5000"}/dashboard`,
  });

  return session.url;
}

// ── Webhook Handler ──

export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const s = requireStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not set");
  }

  const event = s.webhooks.constructEvent(payload, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;

      if (!userId) break;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      // Calculate trial end date (14 days from now)
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      await db
        .update(users)
        .set({
          stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          subscriptionTier: tier || "agent",
          subscriptionStatus: "active",
          subscriptionId: subscriptionId || null,
          trialEndsAt: trialEnd,
        })
        .where(eq(users.id, Number(userId)));

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      const statusMap: Record<string, string> = {
        active: "active",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "past_due",
        trialing: "active",
      };

      await db
        .update(users)
        .set({
          subscriptionStatus: statusMap[subscription.status] || subscription.status,
        })
        .where(eq(users.id, Number(userId)));

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      await db
        .update(users)
        .set({
          subscriptionTier: "free",
          subscriptionStatus: "canceled",
          subscriptionId: null,
        })
        .where(eq(users.id, Number(userId)));

      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }
}

export function isStripeConfigured(): boolean {
  return stripe !== null;
}
