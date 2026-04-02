/**
 * Crosswalk Tracker Service
 *
 * Analyzes CMS Plan Crosswalk data to identify terminated plans,
 * service area changes, consolidations, and new market entrants.
 * Enriches with enrollment/star data from plans table.
 */

import { db } from "../db";
import { planCrosswalk, plans } from "@shared/schema";
import { eq, and, sql, desc, count, countDistinct, avg, inArray } from "drizzle-orm";

// ── Interfaces ──

export interface CrosswalkEntry {
  previousContractId: string;
  previousPlanId: string;
  previousPlanName: string;
  currentContractId: string;
  currentPlanId: string;
  currentPlanName: string;
  status: string;
  previousSnpType: string;
  currentSnpType: string;
  // Enriched from plans table
  previousEnrollment?: number;
  previousStarRating?: number;
  previousCarrier?: string;
  currentCarrier?: string;
  affectedStates?: string[];
  affectedCounties?: number;
  previousPremium?: number;
}

export interface CrosswalkSummary {
  totalPlans: number;
  terminated: number;
  serviceAreaReduction: number;
  serviceAreaExpansion: number;
  consolidated: number;
  newPlans: number;
  initialContracts: number;
  renewals: number;
  estimatedAffectedMembers: number;
  topAffectedStates: Array<{ state: string; affected: number }>;
}

// ── Helper: estimate members from county footprint ──

function estimateMembers(countyCount: number, starRating: number): number {
  const baseMembersPerCounty = starRating <= 2 ? 150 : starRating <= 3 ? 300 : 500;
  return Math.round(countyCount * baseMembersPerCounty);
}

// ── Enrich crosswalk entries with plans table data ──

async function enrichEntries(
  entries: Array<{
    previousContractId: string | null;
    previousPlanId: string | null;
    previousPlanName: string | null;
    currentContractId: string | null;
    currentPlanId: string | null;
    currentPlanName: string | null;
    status: string;
    previousSnpType: string | null;
    currentSnpType: string | null;
  }>,
  useCurrentForNew: boolean = false
): Promise<CrosswalkEntry[]> {
  // Collect unique contract+plan combos to look up
  const lookupKeys = new Set<string>();
  for (const e of entries) {
    if (e.previousContractId && e.previousPlanId) {
      lookupKeys.add(`${e.previousContractId}|${e.previousPlanId}`);
    }
    if (useCurrentForNew && e.currentContractId && e.currentPlanId) {
      lookupKeys.add(`${e.currentContractId}|${e.currentPlanId}`);
    }
  }

  // Batch lookup from plans table
  const planDataMap = new Map<
    string,
    { carrier: string; starRating: number; countyCount: number; states: string[]; premium: number }
  >();

  if (lookupKeys.size > 0) {
    const keysArray = Array.from(lookupKeys);
    // Query plans grouped by contract_id + plan_id
    const contractIds = [...new Set(keysArray.map((k) => k.split("|")[0]))];

    try {
      const rows = await db
        .select({
          contractId: plans.contractId,
          planId: plans.planId,
          carrier: plans.organizationName,
          starRating: plans.overallStarRating,
          premium: plans.calculatedMonthlyPremium,
          state: plans.state,
          countyCount: sql<number>`count(DISTINCT ${plans.county})`.as("county_count"),
          stateList: sql<string>`string_agg(DISTINCT ${plans.state}, ',')`.as("state_list"),
        })
        .from(plans)
        .where(inArray(plans.contractId, contractIds))
        .groupBy(
          plans.contractId,
          plans.planId,
          plans.organizationName,
          plans.overallStarRating,
          plans.calculatedMonthlyPremium,
          plans.state
        )
        .limit(5000);

      // Aggregate by contract+plan
      const aggregated = new Map<
        string,
        { carrier: string; starRating: number; counties: number; states: Set<string>; premium: number }
      >();

      for (const r of rows) {
        const key = `${r.contractId}|${r.planId}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.counties += Number(r.countyCount);
          existing.states.add(r.state);
        } else {
          aggregated.set(key, {
            carrier: r.carrier,
            starRating: r.starRating ?? 0,
            counties: Number(r.countyCount),
            states: new Set([r.state]),
            premium: r.premium ?? 0,
          });
        }
      }

      for (const [key, data] of aggregated) {
        planDataMap.set(key, {
          carrier: data.carrier,
          starRating: data.starRating,
          countyCount: data.counties,
          states: Array.from(data.states),
          premium: data.premium,
        });
      }
    } catch (err) {
      console.error("Error enriching crosswalk entries:", err);
    }
  }

  return entries.map((e) => {
    const prevKey = `${e.previousContractId}|${e.previousPlanId}`;
    const currKey = `${e.currentContractId}|${e.currentPlanId}`;
    const prevData = planDataMap.get(prevKey);
    const currData = planDataMap.get(currKey);
    const lookupData = prevData || (useCurrentForNew ? currData : undefined);

    return {
      previousContractId: e.previousContractId || "",
      previousPlanId: e.previousPlanId || "",
      previousPlanName: e.previousPlanName || "",
      currentContractId: e.currentContractId || "",
      currentPlanId: e.currentPlanId || "",
      currentPlanName: e.currentPlanName || "",
      status: e.status,
      previousSnpType: e.previousSnpType || "",
      currentSnpType: e.currentSnpType || "",
      previousEnrollment: lookupData
        ? estimateMembers(lookupData.countyCount, lookupData.starRating)
        : undefined,
      previousStarRating: prevData?.starRating ?? currData?.starRating,
      previousCarrier: prevData?.carrier,
      currentCarrier: currData?.carrier ?? prevData?.carrier,
      affectedStates: lookupData?.states,
      affectedCounties: lookupData?.countyCount,
      previousPremium: lookupData?.premium,
    };
  });
}

// ── Get Crosswalk Summary ──

export async function getCrosswalkSummary(state?: string): Promise<CrosswalkSummary> {
  try {
    // Get counts by status
    const statusCounts = await db
      .select({
        status: planCrosswalk.status,
        cnt: count().as("cnt"),
      })
      .from(planCrosswalk)
      .groupBy(planCrosswalk.status);

    const countMap: Record<string, number> = {};
    let total = 0;
    for (const row of statusCounts) {
      countMap[row.status] = Number(row.cnt);
      total += Number(row.cnt);
    }

    const terminated = countMap["Terminated/Non-renewed Contract"] || 0;
    const sar = countMap["Renewal Plan with SAR"] || 0;
    const sae = countMap["Renewal Plan with SAE"] || 0;
    const consolidated = countMap["Consolidated Renewal Plan"] || 0;
    const newPlans = countMap["New Plan"] || 0;
    const initialContracts = countMap["Initial Contract"] || 0;
    const renewals = countMap["Renewal Plan"] || 0;

    // Estimate affected members from terminated + SAR plans
    // Use plans table to look up terminated plan footprints
    let estimatedAffectedMembers = 0;
    const topStateMap: Record<string, number> = {};

    try {
      // Get contract IDs for terminated plans
      const terminatedPlans = await db
        .select({
          previousContractId: planCrosswalk.previousContractId,
          previousPlanId: planCrosswalk.previousPlanId,
        })
        .from(planCrosswalk)
        .where(
          inArray(planCrosswalk.status, [
            "Terminated/Non-renewed Contract",
            "Renewal Plan with SAR",
          ])
        );

      const contractIds = [
        ...new Set(terminatedPlans.map((p) => p.previousContractId).filter(Boolean)),
      ] as string[];

      if (contractIds.length > 0) {
        const footprint = await db
          .select({
            contractId: plans.contractId,
            planId: plans.planId,
            state: plans.state,
            countyCount: sql<number>`count(DISTINCT ${plans.county})`.as("county_count"),
            starRating: sql<number>`avg(${plans.overallStarRating})`.as("star_rating"),
          })
          .from(plans)
          .where(
            state
              ? and(inArray(plans.contractId, contractIds), eq(plans.state, state.toUpperCase()))
              : inArray(plans.contractId, contractIds)
          )
          .groupBy(plans.contractId, plans.planId, plans.state)
          .limit(3000);

        for (const f of footprint) {
          const members = estimateMembers(Number(f.countyCount), Number(f.starRating) || 3);
          estimatedAffectedMembers += members;
          topStateMap[f.state] = (topStateMap[f.state] || 0) + members;
        }
      }
    } catch (err) {
      console.error("Error estimating affected members:", err);
      // Fallback estimate
      estimatedAffectedMembers = (terminated + sar) * 250;
    }

    // If no real data, use rough estimate
    if (estimatedAffectedMembers === 0) {
      estimatedAffectedMembers = (terminated * 350) + (sar * 200);
    }

    const topAffectedStates = Object.entries(topStateMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([st, affected]) => ({ state: st, affected }));

    return {
      totalPlans: total,
      terminated,
      serviceAreaReduction: sar,
      serviceAreaExpansion: sae,
      consolidated,
      newPlans,
      initialContracts,
      renewals,
      estimatedAffectedMembers,
      topAffectedStates,
    };
  } catch (err) {
    console.error("Error in getCrosswalkSummary:", err);
    throw err;
  }
}

// ── Get Terminated Plans ──

export async function getTerminatedPlans(state?: string): Promise<CrosswalkEntry[]> {
  const rows = await db
    .select()
    .from(planCrosswalk)
    .where(eq(planCrosswalk.status, "Terminated/Non-renewed Contract"))
    .orderBy(planCrosswalk.previousPlanName);

  const enriched = await enrichEntries(rows);

  // Filter by state if provided
  let filtered = enriched;
  if (state) {
    const stateUpper = state.toUpperCase();
    filtered = enriched.filter(
      (e) => e.affectedStates?.includes(stateUpper) || !e.affectedStates
    );
  }

  // Sort by estimated enrollment (highest first = most affected)
  filtered.sort((a, b) => (b.previousEnrollment || 0) - (a.previousEnrollment || 0));

  return filtered;
}

// ── Get Service Area Changes ──

export async function getServiceAreaChanges(
  type: "reduction" | "expansion",
  state?: string
): Promise<CrosswalkEntry[]> {
  const statusValue =
    type === "reduction" ? "Renewal Plan with SAR" : "Renewal Plan with SAE";

  const rows = await db
    .select()
    .from(planCrosswalk)
    .where(eq(planCrosswalk.status, statusValue))
    .orderBy(planCrosswalk.previousPlanName);

  const enriched = await enrichEntries(rows);

  let filtered = enriched;
  if (state) {
    const stateUpper = state.toUpperCase();
    filtered = enriched.filter(
      (e) => e.affectedStates?.includes(stateUpper) || !e.affectedStates
    );
  }

  filtered.sort((a, b) => (b.previousEnrollment || 0) - (a.previousEnrollment || 0));

  return filtered;
}

// ── Get Consolidated Plans ──

export async function getConsolidatedPlans(state?: string): Promise<CrosswalkEntry[]> {
  const rows = await db
    .select()
    .from(planCrosswalk)
    .where(eq(planCrosswalk.status, "Consolidated Renewal Plan"))
    .orderBy(planCrosswalk.previousPlanName);

  const enriched = await enrichEntries(rows);

  let filtered = enriched;
  if (state) {
    const stateUpper = state.toUpperCase();
    filtered = enriched.filter(
      (e) => e.affectedStates?.includes(stateUpper) || !e.affectedStates
    );
  }

  filtered.sort((a, b) => (b.previousEnrollment || 0) - (a.previousEnrollment || 0));

  return filtered;
}

// ── Get New Plans ──

export async function getNewPlans(state?: string): Promise<CrosswalkEntry[]> {
  const newRows = await db
    .select()
    .from(planCrosswalk)
    .where(
      inArray(planCrosswalk.status, ["New Plan", "Initial Contract"])
    )
    .orderBy(planCrosswalk.currentPlanName);

  const enriched = await enrichEntries(newRows, true);

  let filtered = enriched;
  if (state) {
    const stateUpper = state.toUpperCase();
    filtered = enriched.filter(
      (e) => e.affectedStates?.includes(stateUpper) || !e.affectedStates
    );
  }

  return filtered;
}
