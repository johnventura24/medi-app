import type { Client, Plan } from "@shared/schema";

// ── Interfaces ──

export interface ScoringInput {
  client: Client;
  plans: Plan[];
}

export interface ScoreBreakdown {
  premiumScore: number;
  copayScore: number;
  dentalScore: number;
  drugScore: number;
  supplementalScore: number;
  starScore: number;
}

export interface ScoringResult {
  planId: number;
  totalScore: number; // 0-100
  rank: number;
  breakdown: ScoreBreakdown;
  matchedBenefits: string[];
  warnings: string[];
}

interface BenefitWeights {
  lowPremium: number;
  lowCopays: number;
  dentalGenerosity: number;
  drugCoverage: number;
  supplementalBenefits: number;
  starRating: number;
}

// ── Default weights ──

const DEFAULT_WEIGHTS: BenefitWeights = {
  lowPremium: 3,
  lowCopays: 3,
  dentalGenerosity: 3,
  drugCoverage: 3,
  supplementalBenefits: 3,
  starRating: 3,
};

// ── Supplemental benefit mapping from plan boolean fields to benefit names ──

const SUPPLEMENTAL_BENEFIT_MAP: Record<string, keyof Plan> = {
  dental: "dentalCoverageLimit" as keyof Plan,
  otc: "hasOtc" as keyof Plan,
  transportation: "hasTransportation" as keyof Plan,
  meals: "hasMealBenefit" as keyof Plan,
  telehealth: "hasTelehealth" as keyof Plan,
  fitness: "hasFitnessBenefit" as keyof Plan,
  silver_sneakers: "hasSilverSneakers" as keyof Plan,
  in_home_support: "hasInHomeSupport" as keyof Plan,
  vision: "visionAllowance" as keyof Plan,
  hearing: "hearingAidAllowance" as keyof Plan,
};

// ── Helper: parse dollar strings like "$1,234" to number ──

function parseDollar(val: string | null | undefined): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// ── Helper: safe max from array, returning fallback if empty/all-zero ──

function safeMax(values: number[], fallback: number = 1): number {
  const max = Math.max(...values);
  return max > 0 ? max : fallback;
}

// ── Check if a plan has a given supplemental benefit ──

function planHasBenefit(plan: Plan, benefitName: string): boolean {
  const normalized = benefitName.toLowerCase().replace(/[-\s]/g, "_");
  const field = SUPPLEMENTAL_BENEFIT_MAP[normalized];
  if (!field) return false;

  const value = (plan as any)[field];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return false;
}

// ── Count total supplemental booleans that are true ──

function countAllSupplementals(plan: Plan): number {
  let count = 0;
  if (plan.hasOtc) count++;
  if (plan.hasTransportation) count++;
  if (plan.hasMealBenefit) count++;
  if (plan.hasTelehealth) count++;
  if (plan.hasFitnessBenefit) count++;
  if (plan.hasSilverSneakers) count++;
  if (plan.hasInHomeSupport) count++;
  if ((plan.dentalCoverageLimit ?? 0) > 0) count++;
  if ((plan.visionAllowance ?? 0) > 0) count++;
  if ((plan.hearingAidAllowance ?? 0) > 0) count++;
  return count;
}

const TOTAL_SUPPLEMENTAL_FIELDS = 10;

// ── Main Scoring Engine ──

export function scorePlans(input: ScoringInput): ScoringResult[] {
  const { client, plans } = input;

  if (plans.length === 0) return [];

  // 1. Resolve client weights
  const rawWeights = (client.benefitWeights as Partial<BenefitWeights>) || {};
  const weights: BenefitWeights = {
    lowPremium: rawWeights.lowPremium ?? DEFAULT_WEIGHTS.lowPremium,
    lowCopays: rawWeights.lowCopays ?? DEFAULT_WEIGHTS.lowCopays,
    dentalGenerosity: rawWeights.dentalGenerosity ?? DEFAULT_WEIGHTS.dentalGenerosity,
    drugCoverage: rawWeights.drugCoverage ?? DEFAULT_WEIGHTS.drugCoverage,
    supplementalBenefits: rawWeights.supplementalBenefits ?? DEFAULT_WEIGHTS.supplementalBenefits,
    starRating: rawWeights.starRating ?? DEFAULT_WEIGHTS.starRating,
  };

  const totalWeight =
    weights.lowPremium +
    weights.lowCopays +
    weights.dentalGenerosity +
    weights.drugCoverage +
    weights.supplementalBenefits +
    weights.starRating;

  // 2. Precompute max values across the plan set for normalization
  const premiums = plans.map((p) => p.calculatedMonthlyPremium ?? 0);
  const maxPremium = safeMax(premiums);

  const pcpCopays = plans.map((p) => p.pcpCopayMin ?? 0);
  const specCopays = plans.map((p) => p.specialistCopayMin ?? 0);
  const erCopays = plans.map((p) => p.emergencyCopay ?? 0);
  const inpatientCopays = plans.map((p) => p.inpatientCopay ?? 0);
  const maxPcp = safeMax(pcpCopays);
  const maxSpec = safeMax(specCopays);
  const maxEr = safeMax(erCopays);
  const maxInpatient = safeMax(inpatientCopays);

  const dentalLimits = plans.map((p) => p.dentalCoverageLimit ?? 0);
  const maxDental = safeMax(dentalLimits);

  const drugCosts = plans.map((p) => {
    return (p.drugDeductible ?? 0) + (p.tier1CopayPreferred ?? 0) + (p.tier2CopayPreferred ?? 0);
  });
  const maxDrugCost = safeMax(drugCosts);

  const mustHaveBenefits = (client.mustHaveBenefits as string[]) || [];

  // 3. Score each plan
  const scored = plans.map((plan) => {
    // -- Premium Score --
    const premium = plan.calculatedMonthlyPremium ?? 0;
    const allZeroPremium = maxPremium === 0 || premiums.every((p) => p === 0);
    const premiumScore = allZeroPremium ? 100 : (1 - premium / maxPremium) * 100;

    // -- Copay Score --
    const pcpScore = maxPcp > 0 ? (1 - (plan.pcpCopayMin ?? 0) / maxPcp) * 100 : 100;
    const specScore = maxSpec > 0 ? (1 - (plan.specialistCopayMin ?? 0) / maxSpec) * 100 : 100;
    const erScore = maxEr > 0 ? (1 - (plan.emergencyCopay ?? 0) / maxEr) * 100 : 100;
    const inpScore = maxInpatient > 0 ? (1 - (plan.inpatientCopay ?? 0) / maxInpatient) * 100 : 100;
    const copayScore = (pcpScore + specScore + erScore + inpScore) / 4;

    // -- Dental Score --
    const dentalScore = maxDental > 0 ? ((plan.dentalCoverageLimit ?? 0) / maxDental) * 100 : 0;

    // -- Drug Score --
    const planDrugCost = (plan.drugDeductible ?? 0) + (plan.tier1CopayPreferred ?? 0) + (plan.tier2CopayPreferred ?? 0);
    const hasDrugData = plan.drugDeductible != null || plan.tier1CopayPreferred != null || plan.tier2CopayPreferred != null;
    const drugScore = hasDrugData
      ? maxDrugCost > 0
        ? (1 - planDrugCost / maxDrugCost) * 100
        : 100
      : 50; // neutral if no drug data

    // -- Supplemental Score --
    let supplementalScore: number;
    const matchedBenefits: string[] = [];

    if (mustHaveBenefits.length > 0) {
      let matchCount = 0;
      for (const benefit of mustHaveBenefits) {
        if (planHasBenefit(plan, benefit)) {
          matchCount++;
          matchedBenefits.push(benefit);
        }
      }
      supplementalScore = (matchCount / mustHaveBenefits.length) * 100;
    } else {
      // No must-haves: count total supplementals
      const totalTrue = countAllSupplementals(plan);
      supplementalScore = (totalTrue / TOTAL_SUPPLEMENTAL_FIELDS) * 100;

      // Populate matchedBenefits with what the plan has
      for (const [name] of Object.entries(SUPPLEMENTAL_BENEFIT_MAP)) {
        if (planHasBenefit(plan, name)) {
          matchedBenefits.push(name);
        }
      }
    }

    // -- Star Score --
    const starScore = plan.overallStarRating != null
      ? (plan.overallStarRating / 5) * 100
      : 60; // neutral default

    // -- Weighted Total --
    const weightedSum =
      premiumScore * weights.lowPremium +
      copayScore * weights.lowCopays +
      dentalScore * weights.dentalGenerosity +
      drugScore * weights.drugCoverage +
      supplementalScore * weights.supplementalBenefits +
      starScore * weights.starRating;

    const totalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // -- Warnings --
    const warnings: string[] = [];
    for (const benefit of mustHaveBenefits) {
      if (!planHasBenefit(plan, benefit)) {
        warnings.push(`This plan does not cover ${benefit}`);
      }
    }
    if (plan.lowPerforming) {
      warnings.push("This is a CMS low-performing plan");
    }

    return {
      planId: plan.id,
      totalScore: Math.round(totalScore * 100) / 100,
      rank: 0, // assigned after sort
      breakdown: {
        premiumScore: Math.round(premiumScore * 100) / 100,
        copayScore: Math.round(copayScore * 100) / 100,
        dentalScore: Math.round(dentalScore * 100) / 100,
        drugScore: Math.round(drugScore * 100) / 100,
        supplementalScore: Math.round(supplementalScore * 100) / 100,
        starScore: Math.round(starScore * 100) / 100,
      },
      matchedBenefits,
      warnings,
    };
  });

  // 4. Sort by totalScore DESC
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // 5. Assign ranks
  scored.forEach((s, i) => {
    s.rank = i + 1;
  });

  return scored;
}
