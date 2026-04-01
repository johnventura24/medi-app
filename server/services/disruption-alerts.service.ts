/**
 * Member Disruption Alerts Service
 *
 * Identifies plans at risk of termination, sanction, or significant changes
 * and estimates the number of affected members.
 */

import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, sql, desc, lte, gte, count, countDistinct, avg } from "drizzle-orm";

// ── Interfaces ──

export interface AffectedPlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  state: string;
  starRating: number;
  estimatedMembers: number;
  issue: string;
  recommendation: string;
  alternativePlans: Array<{
    name: string;
    carrier: string;
    premium: number;
    whyBetter: string;
  }>;
}

export interface DisruptionAlert {
  alertType: "plan_exit" | "benefit_cut" | "star_drop" | "premium_increase" | "network_change";
  severity: "critical" | "warning" | "info";
  affectedPlans: AffectedPlan[];
  totalAffected: number;
  agentOpportunity: string;
}

export interface DisruptionSummary {
  totalAlertsCount: number;
  criticalCount: number;
  warningCount: number;
  totalAffectedMembers: number;
  topState: string;
  topStateCount: number;
}

// ── Helper: estimate members from county count ──

function estimateMembers(countyCount: number, starRating: number): number {
  // Rough estimate: plans with lower stars typically have fewer members
  // but we use county footprint as a proxy for market reach
  const baseMembersPerCounty = starRating <= 2 ? 150 : starRating <= 3 ? 300 : 500;
  return Math.round(countyCount * baseMembersPerCounty);
}

// ── Get alternative plans for a state ──

async function getAlternativesForState(
  state: string,
  minStars: number = 3.5
): Promise<Array<{ name: string; carrier: string; premium: number; whyBetter: string }>> {
  try {
    const rows = await db
      .select({
        name: plans.name,
        carrier: plans.organizationName,
        premium: plans.calculatedMonthlyPremium,
        starRating: plans.overallStarRating,
        dental: plans.dentalCoverageLimit,
        hasOtc: plans.hasOtc,
      })
      .from(plans)
      .where(
        and(eq(plans.state, state), gte(plans.overallStarRating, minStars))
      )
      .orderBy(desc(plans.overallStarRating), plans.calculatedMonthlyPremium)
      .limit(3);

    return rows.map((r) => {
      const highlights: string[] = [];
      if ((r.starRating ?? 0) >= 4) highlights.push(`${r.starRating}-star rated`);
      if ((r.premium ?? 0) === 0) highlights.push("$0 premium");
      if ((r.dental ?? 0) > 1000) highlights.push("Strong dental coverage");
      if (r.hasOtc) highlights.push("OTC benefit");

      return {
        name: r.name,
        carrier: r.carrier,
        premium: r.premium ?? 0,
        whyBetter: highlights.length > 0 ? highlights.join(", ") : "Higher quality rating",
      };
    });
  } catch {
    return [];
  }
}

// ── Main: Get Disruption Alerts ──

export async function getDisruptionAlerts(state?: string): Promise<DisruptionAlert[]> {
  const alerts: DisruptionAlert[] = [];

  // ── 1. Critical: Plans with <= 2.0 stars (likely termination) ──
  try {
    const criticalConditions: any[] = [lte(plans.overallStarRating, 2.0)];
    if (state) criticalConditions.push(eq(plans.state, state.toUpperCase()));

    const criticalPlans = await db
      .select({
        contractId: plans.contractId,
        planId: plans.planId,
        name: plans.name,
        carrier: plans.organizationName,
        state: plans.state,
        starRating: plans.overallStarRating,
        countyCount: sql<number>`count(DISTINCT ${plans.county})`.as("county_count"),
        lowPerforming: plans.lowPerforming,
      })
      .from(plans)
      .where(and(...criticalConditions))
      .groupBy(
        plans.contractId,
        plans.planId,
        plans.name,
        plans.organizationName,
        plans.state,
        plans.overallStarRating,
        plans.lowPerforming
      )
      .orderBy(plans.overallStarRating, desc(sql`count(DISTINCT ${plans.county})`))
      .limit(50);

    if (criticalPlans.length > 0) {
      const stateAlternatives: Record<string, any[]> = {};
      const affectedPlans: AffectedPlan[] = [];

      for (const p of criticalPlans) {
        if (!stateAlternatives[p.state]) {
          stateAlternatives[p.state] = await getAlternativesForState(p.state);
        }

        const members = estimateMembers(Number(p.countyCount), p.starRating ?? 0);

        affectedPlans.push({
          contractId: p.contractId ?? "",
          planId: p.planId ?? "",
          planName: p.name,
          carrier: p.carrier,
          state: p.state,
          starRating: p.starRating ?? 0,
          estimatedMembers: members,
          issue: p.lowPerforming
            ? `CMS Low-Performing plan with ${p.starRating}-star rating. At high risk of termination or enrollment sanctions.`
            : `Only ${p.starRating} stars. Plans below 2.5 stars face CMS scrutiny and potential termination.`,
          recommendation: `Proactively contact members in ${p.state}. They will need to switch plans if this plan is terminated.`,
          alternativePlans: stateAlternatives[p.state] || [],
        });
      }

      const totalAffected = affectedPlans.reduce((sum, p) => sum + p.estimatedMembers, 0);

      alerts.push({
        alertType: "plan_exit",
        severity: "critical",
        affectedPlans,
        totalAffected,
        agentOpportunity: `${totalAffected.toLocaleString()} estimated members across ${affectedPlans.length} plans need new coverage. These members MUST switch — contact them before competitors do.`,
      });
    }
  } catch (err) {
    console.error("Error fetching critical disruption plans:", err);
  }

  // ── 2. Warning: Plans with 2.5 stars ──
  try {
    const warningConditions: any[] = [
      gte(plans.overallStarRating, 2.0),
      lte(plans.overallStarRating, 2.5),
    ];
    if (state) warningConditions.push(eq(plans.state, state.toUpperCase()));

    const warningPlans = await db
      .select({
        contractId: plans.contractId,
        planId: plans.planId,
        name: plans.name,
        carrier: plans.organizationName,
        state: plans.state,
        starRating: plans.overallStarRating,
        countyCount: sql<number>`count(DISTINCT ${plans.county})`.as("county_count"),
      })
      .from(plans)
      .where(and(...warningConditions))
      .groupBy(
        plans.contractId,
        plans.planId,
        plans.name,
        plans.organizationName,
        plans.state,
        plans.overallStarRating
      )
      .orderBy(plans.overallStarRating, desc(sql`count(DISTINCT ${plans.county})`))
      .limit(50);

    if (warningPlans.length > 0) {
      const stateAlternatives: Record<string, any[]> = {};
      const affectedPlans: AffectedPlan[] = [];

      for (const p of warningPlans) {
        if (!stateAlternatives[p.state]) {
          stateAlternatives[p.state] = await getAlternativesForState(p.state);
        }

        const members = estimateMembers(Number(p.countyCount), p.starRating ?? 0);

        affectedPlans.push({
          contractId: p.contractId ?? "",
          planId: p.planId ?? "",
          planName: p.name,
          carrier: p.carrier,
          state: p.state,
          starRating: p.starRating ?? 0,
          estimatedMembers: members,
          issue: `${p.starRating}-star rating is below average. Members may face benefit reductions or higher premiums next year.`,
          recommendation: `Reach out to members during AEP to offer better alternatives.`,
          alternativePlans: stateAlternatives[p.state] || [],
        });
      }

      const totalAffected = affectedPlans.reduce((sum, p) => sum + p.estimatedMembers, 0);

      alerts.push({
        alertType: "star_drop",
        severity: "warning",
        affectedPlans,
        totalAffected,
        agentOpportunity: `${totalAffected.toLocaleString()} estimated members on below-average plans. Good prospects for plan switches during AEP or available SEPs.`,
      });
    }
  } catch (err) {
    console.error("Error fetching warning disruption plans:", err);
  }

  // ── 3. Info: Low-performing flagged plans ──
  try {
    const lpConditions: any[] = [eq(plans.lowPerforming, true)];
    if (state) lpConditions.push(eq(plans.state, state.toUpperCase()));

    const lpPlans = await db
      .select({
        contractId: plans.contractId,
        planId: plans.planId,
        name: plans.name,
        carrier: plans.organizationName,
        state: plans.state,
        starRating: plans.overallStarRating,
        countyCount: sql<number>`count(DISTINCT ${plans.county})`.as("county_count"),
      })
      .from(plans)
      .where(and(...lpConditions))
      .groupBy(
        plans.contractId,
        plans.planId,
        plans.name,
        plans.organizationName,
        plans.state,
        plans.overallStarRating
      )
      .orderBy(desc(sql`count(DISTINCT ${plans.county})`))
      .limit(30);

    if (lpPlans.length > 0) {
      const stateAlternatives: Record<string, any[]> = {};
      const affectedPlans: AffectedPlan[] = [];

      for (const p of lpPlans) {
        if (!stateAlternatives[p.state]) {
          stateAlternatives[p.state] = await getAlternativesForState(p.state);
        }

        const members = estimateMembers(Number(p.countyCount), p.starRating ?? 0);

        affectedPlans.push({
          contractId: p.contractId ?? "",
          planId: p.planId ?? "",
          planName: p.name,
          carrier: p.carrier,
          state: p.state,
          starRating: p.starRating ?? 0,
          estimatedMembers: members,
          issue: "Flagged as low-performing by CMS. New members may be restricted from enrolling.",
          recommendation: "Target existing members for plan switches. CMS restrictions limit new enrollment.",
          alternativePlans: stateAlternatives[p.state] || [],
        });
      }

      const totalAffected = affectedPlans.reduce((sum, p) => sum + p.estimatedMembers, 0);

      alerts.push({
        alertType: "benefit_cut",
        severity: "info" as any,
        affectedPlans,
        totalAffected,
        agentOpportunity: `${lpPlans.length} plans flagged as low-performing by CMS. Members may be looking for alternatives.`,
      });
    }
  } catch (err) {
    console.error("Error fetching LP disruption plans:", err);
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ── Summary stats ──

export async function getDisruptionSummary(state?: string): Promise<DisruptionSummary> {
  const alerts = await getDisruptionAlerts(state);

  let totalMembers = 0;
  let criticalCount = 0;
  let warningCount = 0;
  const stateCounts: Record<string, number> = {};

  for (const alert of alerts) {
    totalMembers += alert.totalAffected;
    if (alert.severity === "critical") criticalCount += alert.affectedPlans.length;
    if (alert.severity === "warning") warningCount += alert.affectedPlans.length;

    for (const plan of alert.affectedPlans) {
      stateCounts[plan.state] = (stateCounts[plan.state] || 0) + plan.estimatedMembers;
    }
  }

  const topState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalAlertsCount: alerts.reduce((sum, a) => sum + a.affectedPlans.length, 0),
    criticalCount,
    warningCount,
    totalAffectedMembers: totalMembers,
    topState: topState?.[0] ?? "N/A",
    topStateCount: topState?.[1] ?? 0,
  };
}

// ── Affected members for a specific contract/plan ──

export async function getAffectedMembers(
  contractId: string,
  planId: string
): Promise<{
  planName: string;
  carrier: string;
  starRating: number;
  states: string[];
  counties: string[];
  estimatedMembers: number;
  alternatives: Array<{ name: string; carrier: string; premium: number; whyBetter: string }>;
}> {
  const rows = await db
    .select({
      name: plans.name,
      carrier: plans.organizationName,
      starRating: plans.overallStarRating,
      state: plans.state,
      county: plans.county,
    })
    .from(plans)
    .where(and(eq(plans.contractId, contractId), eq(plans.planId, planId)));

  if (rows.length === 0) {
    return {
      planName: "Unknown",
      carrier: "Unknown",
      starRating: 0,
      states: [],
      counties: [],
      estimatedMembers: 0,
      alternatives: [],
    };
  }

  const states = [...new Set(rows.map((r) => r.state))];
  const counties = [...new Set(rows.map((r) => r.county))];
  const starRating = rows[0].starRating ?? 0;
  const estimatedMembers = estimateMembers(counties.length, starRating);

  // Get alternatives from the primary state
  const alternatives = await getAlternativesForState(states[0] ?? "", 3.5);

  return {
    planName: rows[0].name,
    carrier: rows[0].carrier,
    starRating,
    states,
    counties,
    estimatedMembers,
    alternatives,
  };
}
