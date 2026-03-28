import { db } from "../db";
import { formularyDrugs, plans, drugCostEstimates } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { checkDrugCoverage, type FormularyDrugResult } from "./fhir-formulary.service";

// ── Interfaces ──

export interface DrugCostInput {
  medications: Array<{
    rxcui: string;
    name: string;
    dosage?: string;
    frequency?: string;
  }>;
  planIds: number[];
}

export interface PerDrugCost {
  rxcui: string;
  drugName: string;
  tier: number | null;
  covered: boolean;
  priorAuth: boolean;
  stepTherapy: boolean;
  quantityLimit: boolean;
  estimatedAnnualCost: number;
  phases: {
    deductible: number;
    initialCoverage: number;
    coverageGap: number;
    catastrophic: number;
  };
}

export interface DrugCostResult {
  planId: number;
  estimatedAnnualCost: number;
  perDrug: PerDrugCost[];
  totalByPhase: {
    deductible: number;
    initialCoverage: number;
    coverageGap: number;
    catastrophic: number;
  };
  warnings?: string[];
}

// IRA Out-of-Pocket cap for Part D (effective 2025+)
const IRA_OOP_CAP = 2000;

// Initial coverage limit (2025 value)
const INITIAL_COVERAGE_LIMIT = 5030;

// Default retail cost for uncovered drugs per month
const DEFAULT_RETAIL_MONTHLY = 200;

/**
 * Estimate the number of fills per year from a frequency description.
 */
function parseFillsPerYear(frequency?: string): number {
  const f = (frequency || "").toLowerCase();
  if (f.includes("daily") || f.includes("once a day") || f.includes("1x/day")) return 12;
  if (f.includes("twice") || f.includes("2x") || f.includes("bid")) return 12;
  if (f.includes("weekly")) return 52 / 4; // ~13 monthly fills
  if (f.includes("monthly") || f.includes("30 day")) return 12;
  if (f.includes("quarterly") || f.includes("90 day")) return 4;
  if (f.includes("yearly") || f.includes("annual")) return 1;
  // Default: monthly fills
  return 12;
}

/**
 * Get the copay/coinsurance for a given tier from a plan.
 * Uses preferred pharmacy by default.
 * Tiers 1-3 and 6 use copays (dollar amounts).
 * Tiers 4-5 use coinsurance (percentage).
 */
function getTierCost(plan: any, tier: number, retailCostPerFill: number): number {
  switch (tier) {
    case 1:
      return plan.tier1CopayPreferred ?? plan.tier1CopayStandard ?? 0;
    case 2:
      return plan.tier2CopayPreferred ?? plan.tier2CopayStandard ?? 10;
    case 3:
      return plan.tier3CopayPreferred ?? plan.tier3CopayStandard ?? 47;
    case 4: {
      // Coinsurance: percentage of retail cost
      const coinsurance = plan.tier4CoinsurancePreferred ?? plan.tier4CoinsuranceStandard ?? 25;
      return Math.round((coinsurance / 100) * retailCostPerFill * 100) / 100;
    }
    case 5: {
      const coinsurance = plan.tier5CoinsurancePreferred ?? plan.tier5CoinsuranceStandard ?? 25;
      return Math.round((coinsurance / 100) * retailCostPerFill * 100) / 100;
    }
    case 6:
      return plan.tier6CopayPreferred ?? plan.tier6CopayStandard ?? 0;
    default:
      return 0;
  }
}

/**
 * Estimate approximate retail cost per fill based on tier.
 * Simplified model since we don't have actual drug prices.
 */
function estimateRetailCostPerFill(tier: number): number {
  switch (tier) {
    case 1: return 15;    // Preferred generic
    case 2: return 30;    // Generic
    case 3: return 100;   // Preferred brand
    case 4: return 250;   // Non-preferred brand
    case 5: return 500;   // Specialty
    case 6: return 150;   // Biosimilar
    default: return DEFAULT_RETAIL_MONTHLY;
  }
}

/**
 * Check whether a plan has any drug tier data populated.
 */
function hasDrugTierData(plan: any): boolean {
  return (
    plan.tier1CopayPreferred != null ||
    plan.tier1CopayStandard != null ||
    plan.tier2CopayPreferred != null ||
    plan.tier2CopayStandard != null ||
    plan.tier3CopayPreferred != null ||
    plan.tier3CopayStandard != null ||
    plan.tier4CoinsurancePreferred != null ||
    plan.tier4CoinsuranceStandard != null ||
    plan.tier5CoinsurancePreferred != null ||
    plan.tier5CoinsuranceStandard != null ||
    plan.tier6CopayPreferred != null ||
    plan.tier6CopayStandard != null
  );
}

/**
 * Calculate drug costs for a set of medications across multiple plans.
 */
export async function estimateDrugCosts(input: DrugCostInput): Promise<DrugCostResult[]> {
  const { medications, planIds } = input;

  if (!planIds.length || !medications.length) {
    return [];
  }

  // Fetch all relevant plans
  const planRows = await db
    .select()
    .from(plans)
    .where(inArray(plans.id, planIds));

  if (!planRows.length) {
    return [];
  }

  // Collect all rxcuis and contractIds we need
  const rxcuis = medications.map((m) => m.rxcui);
  const contractIdSet = new Set<string>();
  for (const p of planRows) {
    if (p.contractId) contractIdSet.add(p.contractId);
  }
  const contractIds = Array.from(contractIdSet);

  // Fetch formulary data for all relevant drug + contract combinations
  let formularyRows: any[] = [];
  if (contractIds.length > 0 && rxcuis.length > 0) {
    formularyRows = await db
      .select()
      .from(formularyDrugs)
      .where(
        and(
          inArray(formularyDrugs.contractId, contractIds),
          inArray(formularyDrugs.rxcui, rxcuis)
        )
      );
  }

  // Build a lookup map: contractId+rxcui -> formulary entry
  const formularyMap = new Map<string, typeof formularyRows[0]>();
  for (const row of formularyRows) {
    formularyMap.set(`${row.contractId}:${row.rxcui}`, row);
  }

  // Calculate costs for each plan
  const results: DrugCostResult[] = [];

  for (const plan of planRows) {
    const warnings: string[] = [];

    // Warn if plan has no drug tier data
    if (!hasDrugTierData(plan)) {
      warnings.push(
        `Plan "${plan.name}" (ID: ${plan.id}) does not have drug tier cost-sharing data. Estimates may be inaccurate.`
      );
    }

    const drugDeductible = plan.drugDeductible ?? 0;

    // Build per-drug info with formulary lookup
    // Priority: 1) FHIR real-time data, 2) Local formulary_drugs table (PBP), 3) Default
    const drugInfos: Array<{
      med: typeof medications[0];
      formularyEntry: any;
      fillsPerYear: number;
      retailPerFill: number;
      copayPerFill: number;
      dataSource: string;
    }> = [];

    for (const med of medications) {
      const fillsPerYear = parseFillsPerYear(med.frequency);
      let formularyEntry: any = null;
      let dataSource = "default";

      // Step 1: Try FHIR real-time lookup (non-blocking, with fallback)
      if (plan.organizationName) {
        try {
          const fhirResult: FormularyDrugResult | null = await checkDrugCoverage(
            plan.organizationName,
            plan.contractId || plan.planId || String(plan.id),
            med.rxcui
          );
          if (fhirResult) {
            formularyEntry = {
              tier: fhirResult.tier,
              priorAuthorization: fhirResult.priorAuth,
              stepTherapy: fhirResult.stepTherapy,
              quantityLimit: fhirResult.quantityLimit,
              copay: fhirResult.copay,
              coinsurance: fhirResult.coinsurance,
            };
            dataSource = `FHIR (${fhirResult.source})`;
          }
        } catch (err: any) {
          console.log(`[DrugCost] FHIR lookup failed for ${med.rxcui}: ${err.message}`);
        }
      }

      // Step 2: Fall back to local PBP formulary data
      if (!formularyEntry && plan.contractId) {
        formularyEntry = formularyMap.get(`${plan.contractId}:${med.rxcui}`);
        if (formularyEntry) {
          dataSource = "PBP";
        }
      }

      if (formularyEntry) {
        const tier = formularyEntry.tier;
        const retailPerFill = estimateRetailCostPerFill(tier);
        // If FHIR returned a copay, use it directly; otherwise use plan tier costs
        const copayPerFill = formularyEntry.copay != null
          ? formularyEntry.copay
          : getTierCost(plan, tier, retailPerFill);
        drugInfos.push({ med, formularyEntry, fillsPerYear, retailPerFill, copayPerFill, dataSource });
      } else {
        drugInfos.push({
          med,
          formularyEntry: null,
          fillsPerYear,
          retailPerFill: DEFAULT_RETAIL_MONTHLY,
          copayPerFill: DEFAULT_RETAIL_MONTHLY,
          dataSource: "default",
        });
      }

      console.log(`[DrugCost] ${med.name} (${med.rxcui}) for plan ${plan.id}: source=${dataSource}`);
    }

    // Simulate month by month to properly phase spending
    let oopSpent = 0;
    let retailSpentInYear = 0;
    let deductibleRemaining = drugDeductible;

    // Per-drug phase accumulators
    const drugPhases = drugInfos.map(() => ({
      deductible: 0,
      initialCoverage: 0,
      coverageGap: 0,
      catastrophic: 0,
    }));

    for (let month = 0; month < 12; month++) {
      for (let i = 0; i < drugInfos.length; i++) {
        const info = drugInfos[i];
        const monthlyRetail = info.retailPerFill * (info.fillsPerYear / 12);
        const monthlyCopay = info.copayPerFill * (info.fillsPerYear / 12);

        // Check if we've hit the OOP cap
        if (oopSpent >= IRA_OOP_CAP) {
          // Catastrophic: $0 OOP (IRA benefit)
          // Track what would have been paid as catastrophic savings
          drugPhases[i].catastrophic += monthlyCopay;
          continue;
        }

        retailSpentInYear += monthlyRetail;

        if (deductibleRemaining > 0) {
          // Deductible phase: beneficiary pays full retail
          const deductiblePayment = Math.min(monthlyRetail, deductibleRemaining);
          deductibleRemaining -= deductiblePayment;
          oopSpent += deductiblePayment;
          drugPhases[i].deductible += deductiblePayment;
        } else if (retailSpentInYear <= INITIAL_COVERAGE_LIMIT) {
          // Initial coverage phase: apply tier copay
          const payment = Math.min(monthlyCopay, IRA_OOP_CAP - oopSpent);
          oopSpent += payment;
          drugPhases[i].initialCoverage += payment;
        } else {
          // Coverage gap: 25% coinsurance (post-IRA)
          const gapCost = monthlyRetail * 0.25;
          const payment = Math.min(gapCost, IRA_OOP_CAP - oopSpent);
          oopSpent += payment;
          drugPhases[i].coverageGap += payment;
        }
      }
    }

    // Build per-drug results
    let totalDeductible = 0;
    let totalInitialCoverage = 0;
    let totalCoverageGap = 0;
    let totalCatastrophic = 0;
    const perDrug: PerDrugCost[] = [];

    for (let i = 0; i < drugInfos.length; i++) {
      const info = drugInfos[i];
      const phases = drugPhases[i];
      const drugAnnualCost =
        phases.deductible + phases.initialCoverage + phases.coverageGap;
      // catastrophic phase = $0 OOP for beneficiary

      totalDeductible += phases.deductible;
      totalInitialCoverage += phases.initialCoverage;
      totalCoverageGap += phases.coverageGap;
      totalCatastrophic += phases.catastrophic;

      perDrug.push({
        rxcui: info.med.rxcui,
        drugName: info.med.name,
        tier: info.formularyEntry ? info.formularyEntry.tier : null,
        covered: !!info.formularyEntry,
        priorAuth: info.formularyEntry?.priorAuthorization ?? false,
        stepTherapy: info.formularyEntry?.stepTherapy ?? false,
        quantityLimit: info.formularyEntry?.quantityLimit ?? false,
        estimatedAnnualCost: Math.round(drugAnnualCost * 100) / 100,
        phases: {
          deductible: Math.round(phases.deductible * 100) / 100,
          initialCoverage: Math.round(phases.initialCoverage * 100) / 100,
          coverageGap: Math.round(phases.coverageGap * 100) / 100,
          catastrophic: Math.round(phases.catastrophic * 100) / 100,
        },
      });
    }

    // Apply IRA OOP cap to total
    const estimatedAnnualCost = Math.min(oopSpent, IRA_OOP_CAP);

    const result: DrugCostResult = {
      planId: plan.id,
      estimatedAnnualCost: Math.round(estimatedAnnualCost * 100) / 100,
      perDrug,
      totalByPhase: {
        deductible: Math.round(totalDeductible * 100) / 100,
        initialCoverage: Math.round(totalInitialCoverage * 100) / 100,
        coverageGap: Math.round(totalCoverageGap * 100) / 100,
        catastrophic: Math.round(totalCatastrophic * 100) / 100,
      },
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    results.push(result);
  }

  return results;
}

/**
 * Save drug cost estimates to the database for a client.
 */
export async function saveDrugCostEstimates(
  clientId: number,
  medications: any[],
  results: DrugCostResult[]
): Promise<void> {
  for (const result of results) {
    await db
      .insert(drugCostEstimates)
      .values({
        clientId,
        planId: result.planId,
        medications: medications as any,
        estimatedAnnualCost: result.estimatedAnnualCost,
        costBreakdown: {
          perDrug: result.perDrug,
          totalByPhase: result.totalByPhase,
          warnings: result.warnings || [],
        } as any,
      });
  }
}

/**
 * Get cached drug cost estimates for a client.
 */
export async function getCachedDrugCostEstimates(clientId: number): Promise<any[]> {
  const rows = await db
    .select()
    .from(drugCostEstimates)
    .where(eq(drugCostEstimates.clientId, clientId))
    .orderBy(drugCostEstimates.calculatedAt);

  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    planId: row.planId,
    medications: row.medications,
    estimatedAnnualCost: row.estimatedAnnualCost,
    costBreakdown: row.costBreakdown,
    calculatedAt: row.calculatedAt,
  }));
}
