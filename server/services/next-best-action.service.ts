/**
 * Next Best Action Engine
 *
 * Analyzes each of an agent's clients and recommends prioritized actions
 * the agent should take right now.
 */

import { db } from "../db";
import { clients, plans, scopeOfAppointments, interactionLogs } from "@shared/schema";
import { eq, and, desc, sql, gte, lte, isNull } from "drizzle-orm";

// ── Interfaces ──

export interface ActionItem {
  priority: "urgent" | "high" | "medium" | "low";
  action: string;
  reason: string;
  deadline: string | null;
  planRecommendation?: {
    planId: number;
    name: string;
    carrier: string;
    whyBetter: string;
  };
  agentScript?: string;
}

export interface NextBestAction {
  clientId: number;
  clientName: string;
  actions: ActionItem[];
}

// ── Priority ordering helper ──

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

// ── Main engine ──

export async function getNextBestActions(agentUserId: number): Promise<NextBestAction[]> {
  // Fetch all active clients for this agent
  const agentClients = await db
    .select()
    .from(clients)
    .where(and(eq(clients.agentUserId, agentUserId), isNull(clients.deletedAt)));

  const results: NextBestAction[] = [];

  for (const client of agentClients) {
    const actions: ActionItem[] = [];
    const clientName = `${client.firstName} ${client.lastName}`;

    // 1. SOA expiring check
    await checkSOAStatus(agentUserId, client.id, clientName, actions);

    // 2. Better plan available check
    await checkBetterPlanAvailable(client, actions);

    // 3. SEP eligibility check
    checkSEPEligibility(client, actions);

    // 4. Plan at risk check
    await checkPlanAtRisk(client, actions);

    // 5. Annual review needed
    await checkAnnualReview(agentUserId, client.id, clientName, actions);

    // 6. Missing data
    checkMissingData(client, actions);

    // Sort actions by priority
    actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    if (actions.length > 0) {
      results.push({
        clientId: client.id,
        clientName,
        actions,
      });
    }
  }

  // Sort clients by their highest-priority action
  results.sort((a, b) => {
    const aPriority = a.actions.length > 0 ? PRIORITY_ORDER[a.actions[0].priority] : 999;
    const bPriority = b.actions.length > 0 ? PRIORITY_ORDER[b.actions[0].priority] : 999;
    return aPriority - bPriority;
  });

  return results;
}

export async function getNextBestActionsForClient(
  agentUserId: number,
  clientId: number
): Promise<NextBestAction | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.agentUserId, agentUserId), isNull(clients.deletedAt)));

  if (!client) return null;

  const actions: ActionItem[] = [];
  const clientName = `${client.firstName} ${client.lastName}`;

  await checkSOAStatus(agentUserId, client.id, clientName, actions);
  await checkBetterPlanAvailable(client, actions);
  checkSEPEligibility(client, actions);
  await checkPlanAtRisk(client, actions);
  await checkAnnualReview(agentUserId, client.id, clientName, actions);
  checkMissingData(client, actions);

  actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return {
    clientId: client.id,
    clientName,
    actions,
  };
}

// ── Check 1: SOA Expiring ──

async function checkSOAStatus(
  agentUserId: number,
  clientId: number,
  clientName: string,
  actions: ActionItem[]
): Promise<void> {
  try {
    const soas = await db
      .select()
      .from(scopeOfAppointments)
      .where(
        and(
          eq(scopeOfAppointments.agentUserId, agentUserId),
          eq(scopeOfAppointments.clientId, clientId),
          eq(scopeOfAppointments.status, "active")
        )
      )
      .orderBy(desc(scopeOfAppointments.expiresAt))
      .limit(1);

    if (soas.length > 0) {
      const soa = soas[0];
      if (soa.expiresAt) {
        const now = new Date();
        const hoursUntilExpiry =
          (soa.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilExpiry < 0) {
          actions.push({
            priority: "urgent",
            action: "SOA Expired",
            reason: `The Scope of Appointment for ${clientName} has expired. You need a new SOA before discussing plan options.`,
            deadline: null,
            agentScript: `Before we can continue discussing Medicare plan options, I need to complete a new Scope of Appointment form with you. This is a CMS requirement to document which plan types we'll be reviewing together. It will only take a moment.`,
          });
        } else if (hoursUntilExpiry <= 24) {
          actions.push({
            priority: "urgent",
            action: "Renew SOA — Expiring Soon",
            reason: `SOA expires in ${Math.round(hoursUntilExpiry)} hours. Renew before your next contact.`,
            deadline: soa.expiresAt.toISOString(),
            agentScript: `I wanted to let you know that our Scope of Appointment is expiring soon. Before we continue, let me quickly renew that so we can keep reviewing your options without interruption.`,
          });
        } else if (hoursUntilExpiry <= 72) {
          actions.push({
            priority: "high",
            action: "SOA Expiring in 3 Days",
            reason: `SOA expires on ${soa.expiresAt.toLocaleDateString()}. Plan a renewal if you need to continue discussions.`,
            deadline: soa.expiresAt.toISOString(),
          });
        }
      }
    } else {
      // No SOA at all
      actions.push({
        priority: "high",
        action: "No SOA on File",
        reason: `No Scope of Appointment found for ${clientName}. Required before plan discussions.`,
        deadline: null,
        agentScript: `Before we discuss any specific Medicare plan options, I need to complete a Scope of Appointment form. This documents which types of plans you'd like to explore and is required by CMS. It's quick and easy.`,
      });
    }
  } catch {
    // Silently skip if SOA table check fails
  }
}

// ── Check 2: Better Plan Available ──

async function checkBetterPlanAvailable(
  client: typeof clients.$inferSelect,
  actions: ActionItem[]
): Promise<void> {
  if (!client.zipCode) return;

  try {
    // Get top plans in client's ZIP
    const topPlans = await db
      .select({
        id: plans.id,
        name: plans.name,
        carrier: plans.organizationName,
        premium: plans.calculatedMonthlyPremium,
        starRating: plans.overallStarRating,
        dental: plans.dentalCoverageLimit,
        hasOtc: plans.hasOtc,
        snpType: plans.snpType,
      })
      .from(plans)
      .where(eq(plans.zipcode, client.zipCode))
      .orderBy(desc(plans.overallStarRating), plans.calculatedMonthlyPremium)
      .limit(3);

    if (topPlans.length === 0) return;

    const bestPlan = topPlans[0];
    const bestStars = bestPlan.starRating ?? 0;
    const bestPremium = bestPlan.premium ?? 0;

    // If client has a current plan, check if better exists
    if (client.currentPlanName && bestStars >= 4) {
      const highlights: string[] = [];
      if (bestStars >= 4.5) highlights.push(`${bestStars}-star rating`);
      if (bestPremium === 0) highlights.push("$0 premium");
      if (bestPlan.dental && bestPlan.dental > 1000) highlights.push(`$${bestPlan.dental} dental`);
      if (bestPlan.hasOtc) highlights.push("OTC benefit included");

      actions.push({
        priority: "medium",
        action: "Better Plan Available",
        reason: `A higher-rated plan (${bestPlan.name}) is available in ${client.zipCode}. ${highlights.join(", ")}.`,
        deadline: null,
        planRecommendation: {
          planId: bestPlan.id,
          name: bestPlan.name,
          carrier: bestPlan.carrier,
          whyBetter: highlights.join(", ") || "Higher quality rating",
        },
        agentScript: `I've been reviewing the plans available in your area, and I found one that might be a better fit for you. The ${bestPlan.name} from ${bestPlan.carrier} has ${highlights.join(", ")}. Would you like me to walk you through how it compares to your current coverage?`,
      });
    }
  } catch {
    // Skip silently
  }
}

// ── Check 3: SEP Eligibility ──

function checkSEPEligibility(
  client: typeof clients.$inferSelect,
  actions: ActionItem[]
): void {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Check if dual eligible
  if (client.currentCoverage === "medicaid" ||
      (client.currentCoverage as string)?.includes("dual")) {
    actions.push({
      priority: "high",
      action: "Dual/LIS SEP — Can Switch This Month",
      reason: "Client appears dual-eligible (Medicare + Medicaid). They can switch plans once every month.",
      deadline: new Date(currentYear, now.getMonth() + 1, 0).toISOString(),
      agentScript: `I noticed you have both Medicare and Medicaid. This means you have the flexibility to switch your plan once every month. Would you like me to check if there's a better D-SNP plan available for you?`,
    });
  }

  // Check chronic conditions for C-SNP eligibility
  const conditions = (client.chronicConditions as string[]) || [];
  const csnpConditions = ["diabetes", "copd", "heart_failure", "cardiovascular", "esrd", "chronic_lung"];
  const matchedConditions = conditions.filter(c =>
    csnpConditions.includes(c.toLowerCase())
  );

  if (matchedConditions.length > 0) {
    actions.push({
      priority: "medium",
      action: "C-SNP Plan May Be Available",
      reason: `Client has ${matchedConditions.join(", ")} — may qualify for a Chronic Condition SNP with specialized benefits.`,
      deadline: null,
      agentScript: `Based on your health conditions, you may qualify for a special type of Medicare plan called a C-SNP that provides dedicated care coordination and extra benefits for managing ${matchedConditions.join(" and ")}. Would you like to explore that option?`,
    });
  }

  // Check for nursing facility / I-SNP
  if (client.mobilityLevel === "homebound") {
    actions.push({
      priority: "medium",
      action: "Institutional SEP May Apply",
      reason: "Client marked as homebound — may qualify for I-SNP or institutional SEP with continuous enrollment.",
      deadline: null,
    });
  }
}

// ── Check 4: Plan at Risk ──

async function checkPlanAtRisk(
  client: typeof clients.$inferSelect,
  actions: ActionItem[]
): Promise<void> {
  if (!client.currentPlanName || !client.zipCode) return;

  try {
    // Search for the client's current plan
    const currentPlans = await db
      .select({
        id: plans.id,
        name: plans.name,
        carrier: plans.organizationName,
        starRating: plans.overallStarRating,
        lowPerforming: plans.lowPerforming,
      })
      .from(plans)
      .where(
        and(
          eq(plans.zipcode, client.zipCode),
          sql`LOWER(${plans.name}) LIKE LOWER(${'%' + client.currentPlanName.split(' ').slice(0, 3).join(' ') + '%'})`
        )
      )
      .limit(1);

    if (currentPlans.length > 0) {
      const currentPlan = currentPlans[0];
      const stars = currentPlan.starRating ?? 0;

      if (stars <= 2.0 || currentPlan.lowPerforming) {
        actions.push({
          priority: "urgent",
          action: "Client's Plan at Risk of Termination",
          reason: `${currentPlan.name} has only ${stars} stars and is ${currentPlan.lowPerforming ? "flagged as low-performing by CMS" : "at risk"}. This plan may be terminated. Proactively reach out.`,
          deadline: null,
          agentScript: `I'm reaching out because I noticed your current plan, ${currentPlan.name}, has received a low quality rating from Medicare. Plans with ratings this low sometimes face termination or restrictions. I want to make sure you're protected. Let me show you some better-rated alternatives in your area.`,
        });
      } else if (stars <= 2.5) {
        actions.push({
          priority: "high",
          action: "Client's Plan Has Low Star Rating",
          reason: `${currentPlan.name} has a ${stars}-star rating. Consider recommending a higher-rated plan during the next enrollment window.`,
          deadline: null,
          agentScript: `I wanted to touch base about your current plan. It has a ${stars}-star quality rating from Medicare, which is below average. There may be better options available to you. Would you like to compare some alternatives?`,
        });
      }
    }
  } catch {
    // Skip silently
  }
}

// ── Check 5: Annual Review Needed ──

async function checkAnnualReview(
  agentUserId: number,
  clientId: number,
  clientName: string,
  actions: ActionItem[]
): Promise<void> {
  try {
    const lastInteraction = await db
      .select({ createdAt: interactionLogs.createdAt })
      .from(interactionLogs)
      .where(
        and(
          eq(interactionLogs.userId, agentUserId),
          eq(interactionLogs.clientId, clientId)
        )
      )
      .orderBy(desc(interactionLogs.createdAt))
      .limit(1);

    if (lastInteraction.length > 0 && lastInteraction[0].createdAt) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastInteraction[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSince > 180) {
        actions.push({
          priority: "low",
          action: "Annual Review Needed",
          reason: `Last interaction with ${clientName} was ${daysSince} days ago. Time for a check-in.`,
          deadline: null,
          agentScript: `Hi, this is your Medicare agent. I'm doing annual check-ins with all my clients to make sure your coverage is still meeting your needs. Has anything changed in your health or situation since we last spoke?`,
        });
      }
    } else {
      // No interactions at all
      actions.push({
        priority: "medium",
        action: "No Interaction History",
        reason: `No recorded interactions with ${clientName}. Schedule an initial review.`,
        deadline: null,
      });
    }
  } catch {
    // Skip silently
  }
}

// ── Check 6: Missing Data ──

function checkMissingData(
  client: typeof clients.$inferSelect,
  actions: ActionItem[]
): void {
  const missing: string[] = [];

  const meds = (client.medications as any[]) || [];
  const docs = (client.preferredDoctors as any[]) || [];
  const conditions = (client.chronicConditions as string[]) || [];
  const benefits = (client.mustHaveBenefits as string[]) || [];

  if (meds.length === 0) missing.push("medications");
  if (docs.length === 0) missing.push("preferred doctors");
  if (conditions.length === 0 && !client.chronicConditions) missing.push("health conditions");
  if (benefits.length === 0) missing.push("benefit preferences");
  if (!client.currentCoverage) missing.push("current coverage type");

  if (missing.length >= 2) {
    actions.push({
      priority: "low",
      action: "Complete Client Profile",
      reason: `Missing: ${missing.join(", ")}. A complete profile enables better plan recommendations.`,
      deadline: null,
      agentScript: `To make sure I find you the best possible Medicare plan, I'd like to update your profile with a few more details. Could you tell me about your ${missing.slice(0, 2).join(" and ")}?`,
    });
  }
}
