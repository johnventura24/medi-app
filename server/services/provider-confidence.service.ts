import { getProviderByNpi, type ProviderResult } from "./nppes.service";
import {
  checkProviderNetwork,
  getCarrierDirectoryUrl,
} from "./fhir-provider.service";

// ── Types ──

export interface ConfidenceFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

export interface ProviderConfidence {
  npi: string;
  providerName: string;
  planId: number;
  planName: string;
  carrier: string;
  confidence: number; // 0-100 percentage
  confidenceLevel: "high" | "medium" | "low" | "unknown";
  factors: ConfidenceFactor[];
  verificationUrl: string;
  recommendation: string;
}

export interface PlanConfidenceInput {
  id: number;
  name: string;
  carrier: string;
  contractId: string;
  planType: string;
  state: string;
  county: string;
}

// ── Specialty Classification ──

const PCP_SPECIALTIES = [
  "internal medicine",
  "family medicine",
  "family practice",
  "general practice",
  "geriatric medicine",
  "preventive medicine",
];

const SPECIALIST_SPECIALTIES = [
  "cardiology",
  "cardiologist",
  "dermatology",
  "dermatologist",
  "endocrinology",
  "gastroenterology",
  "hematology",
  "nephrology",
  "neurology",
  "neurologist",
  "oncology",
  "ophthalmology",
  "orthopedic",
  "otolaryngology",
  "pulmonology",
  "rheumatology",
  "urology",
  "surgery",
  "surgeon",
  "anesthesiology",
  "radiology",
  "pathology",
  "psychiatry",
];

// ── Carrier Market Share Estimates (national level, approximate) ──
// These are rough national market share percentages for Medicare Advantage.
// In a production system, this would come from a county-level database.

const CARRIER_MARKET_SHARE: Record<string, number> = {
  unitedhealthcare: 29,
  uhc: 29,
  united: 29,
  humana: 18,
  cvs: 10,
  aetna: 10,
  anthem: 8,
  elevance: 8,
  centene: 7,
  wellcare: 7,
  kaiser: 6,
  cigna: 5,
  molina: 4,
  "blue cross": 12,
  bcbs: 12,
};

// ── Carrier Directory URLs (fallback if getCarrierDirectoryUrl doesn't match) ──

const DEFAULT_VERIFICATION_URL = "https://www.medicare.gov/plan-compare/";

// ── Helper Functions ──

function isPcp(specialty: string | undefined): boolean {
  if (!specialty) return false;
  const lower = specialty.toLowerCase();
  return PCP_SPECIALTIES.some((s) => lower.includes(s));
}

function isSpecialist(specialty: string | undefined): boolean {
  if (!specialty) return false;
  const lower = specialty.toLowerCase();
  return SPECIALIST_SPECIALTIES.some((s) => lower.includes(s));
}

function getCarrierMarketShare(carrier: string): number {
  const normalized = carrier.toLowerCase();
  for (const [key, share] of Object.entries(CARRIER_MARKET_SHARE)) {
    if (normalized.includes(key)) {
      return share;
    }
  }
  return 0;
}

function getConfidenceLevel(
  confidence: number
): "high" | "medium" | "low" | "unknown" {
  if (confidence >= 70) return "high";
  if (confidence >= 40) return "medium";
  if (confidence > 0) return "low";
  return "unknown";
}

function buildRecommendation(
  confidence: number,
  level: string,
  carrier: string,
  verificationUrl: string
): string {
  const carrierShort = carrier.length > 30 ? carrier.substring(0, 30) + "..." : carrier;

  if (level === "high") {
    return `Likely in-network -- verify at ${carrierShort} website before enrolling.`;
  }
  if (level === "medium") {
    return `Possibly in-network (${confidence}% confidence). We recommend verifying directly with ${carrierShort} before making a decision.`;
  }
  if (level === "low") {
    return `Low confidence that this provider is in-network. Verify at the carrier website before enrolling.`;
  }
  return `Unable to determine network status. Please verify directly with ${carrierShort} or visit their provider directory.`;
}

function formatProviderName(provider: ProviderResult): string {
  const name =
    [provider.firstName, provider.lastName].filter(Boolean).join(" ") ||
    provider.organizationName ||
    "Unknown Provider";
  return name;
}

/**
 * Get a specialty note for the given provider specialty and plan type.
 * Useful for informing users about referral requirements.
 */
export function getSpecialtyNote(
  specialty: string | undefined,
  planType?: string
): string | null {
  if (!specialty) return null;

  const specialistMatch = isSpecialist(specialty);
  const pcpMatch = isPcp(specialty);

  if (specialistMatch && planType) {
    const upper = planType.toUpperCase();
    if (upper === "HMO" || upper === "HMO-POS") {
      return `${specialty} -- HMO plans typically require a referral from your primary care physician to see specialists.`;
    }
    if (upper === "PPO" || upper === "PFFS") {
      return `${specialty} -- PPO/PFFS plans allow you to see specialists without a referral, though in-network providers cost less.`;
    }
    return `${specialty} -- check plan details for referral requirements.`;
  }

  if (specialistMatch) {
    return `${specialty} -- HMO plans require a referral to see specialists. PPO plans allow direct access.`;
  }

  if (pcpMatch) {
    return `${specialty} -- primary care provider. Works with all plan types.`;
  }

  return null;
}

// ── Main Scoring Function ──

/**
 * Calculate confidence scores for a provider across multiple plans.
 *
 * Scoring factors (max ~100):
 *   1. FHIR API result:          +50 confirmed in-network, -50 confirmed out, 0 if unavailable
 *   2. Provider location match:  +15 if provider's state matches plan's service area state
 *   3. Carrier market share:     +10 if carrier has >20% share (large networks)
 *   4. Specialty match:          +10 if specialty aligns with plan type (PCP for HMO, any for PPO)
 *   5. Plan type breadth:        +10 for PPO/PFFS (broader networks), +0 for HMO (restrictive)
 *   6. Provider practice size:   +5 if organization-based (group practice)
 *
 * Base score starts at 25 (prior: many providers are in-network for plans in their area).
 */
export async function calculateProviderConfidence(
  npi: string,
  plans: PlanConfidenceInput[]
): Promise<{
  provider: ProviderResult | null;
  confidences: ProviderConfidence[];
}> {
  // Look up provider details from NPPES
  const provider = await getProviderByNpi(npi);

  if (!provider) {
    // If we can't find the provider, return unknown for all plans
    return {
      provider: null,
      confidences: plans.map((plan) => ({
        npi,
        providerName: "Unknown Provider",
        planId: plan.id,
        planName: plan.name,
        carrier: plan.carrier,
        confidence: 0,
        confidenceLevel: "unknown" as const,
        factors: [
          {
            factor: "Provider Lookup",
            impact: "negative" as const,
            detail: "Could not find this NPI in the NPPES registry.",
          },
        ],
        verificationUrl:
          getCarrierDirectoryUrl(plan.carrier) || DEFAULT_VERIFICATION_URL,
        recommendation:
          "Unable to verify this provider. Please check the NPI number and try again.",
      })),
    };
  }

  const providerName = formatProviderName(provider);

  // Run FHIR network checks for all plans
  const fhirInputs = plans.map((p) => ({
    id: p.id,
    name: p.name,
    carrier: p.carrier,
    contractId: p.contractId,
  }));

  const networkResults = await checkProviderNetwork(npi, fhirInputs);

  // Build a lookup map: planId -> FHIR result
  const fhirMap = new Map(networkResults.map((r) => [r.planId, r]));

  // Calculate confidence for each plan
  const confidences: ProviderConfidence[] = plans.map((plan) => {
    const factors: ConfidenceFactor[] = [];
    let score = 25; // base prior

    // ── Factor 1: Network verification result (+50 / -30 / +10 / 0) ──
    const fhirResult = fhirMap.get(plan.id);
    if (fhirResult) {
      const src = fhirResult.source || "";
      if (fhirResult.inNetwork === true) {
        // Confirmed in-network (FHIR API or FHIR_bulk)
        score += 50;
        factors.push({
          factor: "Network Verification",
          impact: "positive",
          detail: src.includes("FHIR")
            ? `Provider confirmed in ${plan.carrier}'s electronic provider directory.`
            : `Provider found in ${plan.carrier}'s provider network cache.`,
        });
      } else if (fhirResult.inNetwork === false) {
        // Confirmed out-of-network
        score -= 30;
        factors.push({
          factor: "Network Verification",
          impact: "negative",
          detail: `Provider not found in ${plan.carrier}'s electronic provider directory.`,
        });
      } else if (src === "inferred") {
        // Inferred association: provider is in same state as carrier's service area
        // and has a Medicare-relevant specialty — mild positive signal
        score += 10;
        factors.push({
          factor: "Network Verification",
          impact: "positive",
          detail: `Provider is in ${plan.carrier}'s service area with a Medicare-relevant specialty. Not yet independently verified.`,
        });
      } else {
        factors.push({
          factor: "Network Verification",
          impact: "neutral",
          detail: `${plan.carrier}'s electronic provider directory was unavailable or returned no results.`,
        });
      }
    } else {
      factors.push({
        factor: "Network Verification",
        impact: "neutral",
        detail: "No network verification data available for this carrier.",
      });
    }

    // ── Factor 2: Provider location match (+15) ──
    if (provider.state) {
      if (
        provider.state.toUpperCase() === plan.state.toUpperCase()
      ) {
        score += 15;
        factors.push({
          factor: "Service Area Match",
          impact: "positive",
          detail: `Provider is located in ${provider.state}, which matches the plan's service area.`,
        });
      } else {
        factors.push({
          factor: "Service Area Match",
          impact: "negative",
          detail: `Provider is in ${provider.state}, but this plan serves ${plan.state}. Out-of-area providers are less likely to be in-network.`,
        });
      }
    } else {
      factors.push({
        factor: "Service Area Match",
        impact: "neutral",
        detail: "Provider location information unavailable.",
      });
    }

    // ── Factor 3: Carrier market share (+10 if >20%) ──
    const marketShare = getCarrierMarketShare(plan.carrier);
    if (marketShare > 20) {
      score += 10;
      factors.push({
        factor: "Carrier Market Share",
        impact: "positive",
        detail: `${plan.carrier} has approximately ${marketShare}% Medicare Advantage market share. Larger carriers tend to have broader provider networks.`,
      });
    } else if (marketShare > 10) {
      score += 5;
      factors.push({
        factor: "Carrier Market Share",
        impact: "neutral",
        detail: `${plan.carrier} has approximately ${marketShare}% Medicare Advantage market share.`,
      });
    } else if (marketShare > 0) {
      factors.push({
        factor: "Carrier Market Share",
        impact: "neutral",
        detail: `${plan.carrier} has a smaller Medicare Advantage market share (~${marketShare}%).`,
      });
    }

    // ── Factor 4: Specialty match (+10) ──
    const planTypeUpper = (plan.planType || "").toUpperCase();
    const providerIsPcp = isPcp(provider.specialty);
    const providerIsSpecialist = isSpecialist(provider.specialty);

    if (providerIsPcp) {
      // PCPs are generally in-network for all plan types
      score += 10;
      factors.push({
        factor: "Specialty Alignment",
        impact: "positive",
        detail: `${provider.specialty} is a primary care specialty. PCPs are widely included in Medicare Advantage networks.`,
      });
    } else if (providerIsSpecialist) {
      if (planTypeUpper === "PPO" || planTypeUpper === "PFFS") {
        score += 10;
        factors.push({
          factor: "Specialty Alignment",
          impact: "positive",
          detail: `${provider.specialty} can be seen without a referral on PPO/PFFS plans.`,
        });
      } else if (planTypeUpper === "HMO" || planTypeUpper === "HMO-POS") {
        score += 5;
        factors.push({
          factor: "Specialty Alignment",
          impact: "neutral",
          detail: `${provider.specialty} is a specialist. HMO plans typically require a PCP referral for specialist visits.`,
        });
      } else {
        factors.push({
          factor: "Specialty Alignment",
          impact: "neutral",
          detail: `${provider.specialty}. Check plan requirements for specialist referrals.`,
        });
      }
    } else if (provider.specialty) {
      factors.push({
        factor: "Specialty Alignment",
        impact: "neutral",
        detail: `${provider.specialty}. Unable to assess specialty-network alignment.`,
      });
    }

    // ── Factor 5: Plan type breadth (+10 for PPO/PFFS, +0 for HMO) ──
    if (planTypeUpper === "PPO" || planTypeUpper === "PFFS") {
      score += 10;
      factors.push({
        factor: "Plan Network Type",
        impact: "positive",
        detail: `${plan.planType} plans have broader provider networks and may cover out-of-network providers at higher cost.`,
      });
    } else if (planTypeUpper === "HMO") {
      factors.push({
        factor: "Plan Network Type",
        impact: "neutral",
        detail: "HMO plans have more restrictive networks. Coverage is limited to in-network providers (except emergencies).",
      });
    } else if (planTypeUpper === "HMO-POS") {
      score += 5;
      factors.push({
        factor: "Plan Network Type",
        impact: "neutral",
        detail: "HMO-POS plans are somewhat restrictive but may allow some out-of-network coverage with a referral.",
      });
    }

    // ── Factor 6: Provider practice size (+5 for organizations) ──
    if (provider.organizationName) {
      score += 5;
      factors.push({
        factor: "Practice Size",
        impact: "positive",
        detail: `${provider.organizationName} is an organization/group practice. Larger groups are more likely to contract with major carriers.`,
      });
    }

    // Clamp score to 0-100
    const confidence = Math.max(0, Math.min(100, score));
    const confidenceLevel = getConfidenceLevel(confidence);

    const verificationUrl =
      getCarrierDirectoryUrl(plan.carrier) || DEFAULT_VERIFICATION_URL;

    const recommendation = buildRecommendation(
      confidence,
      confidenceLevel,
      plan.carrier,
      verificationUrl
    );

    return {
      npi,
      providerName,
      planId: plan.id,
      planName: plan.name,
      carrier: plan.carrier,
      confidence,
      confidenceLevel,
      factors,
      verificationUrl,
      recommendation,
    };
  });

  return { provider, confidences };
}
