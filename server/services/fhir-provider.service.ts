import { db } from "../db";
import { providerNetworkCache } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// ── FHIR Provider Directory endpoints for major MA carriers ──
// These are CMS-mandated FHIR R4 Provider Directory APIs.
// URLs change frequently; the implementation gracefully falls back on failure.
const CARRIER_FHIR_ENDPOINTS: Record<string, string> = {
  "UnitedHealthcare": "https://public.fhir.flex.optum.com/R4/Practitioner",
  "Humana": "https://fhir.humana.com/api/Practitioner",
  "Aetna": "https://vteapif1.aetna.com/fhirdirectory/v2/Practitioner",
  "Cigna": "https://provider-directory.cigna.com/api/1/fhir/Practitioner",
  "Anthem": "https://fhir.anthem.com/provider-directory/v1/Practitioner",
  "Blue Cross Blue Shield": "https://fhir.bcbs.com/Practitioner",
  "Centene": "https://fhir.centene.com/Practitioner",
  "Molina": "https://fhir.molinahealthcare.com/Practitioner",
};

// ── Carrier directory URLs for manual verification ──
const CARRIER_DIRECTORY_URLS: Record<string, string> = {
  "UnitedHealthcare": "https://www.uhc.com/find-a-doctor",
  "Humana": "https://www.humana.com/finder/medical",
  "Aetna": "https://www.aetna.com/dsepublic/#/contentPage?page=providerSearchLanding",
  "Cigna": "https://hcpdirectory.cigna.com/web/public/consumer/directory",
  "Anthem": "https://www.anthem.com/find-care/",
  "Blue Cross Blue Shield": "https://www.bcbs.com/find-a-doctor",
  "Kaiser Permanente": "https://healthy.kaiserpermanente.org/doctors-locations",
  "Centene": "https://www.centene.com/products-and-services/browse-by-state.html",
  "Molina": "https://www.molinahealthcare.com/members/common/en-us/aff/findprovider.aspx",
};

// Cache TTL: 30 days
const NETWORK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Timeout for FHIR API calls
const FHIR_TIMEOUT_MS = 3000;

export interface NetworkCheckResult {
  planId: number;
  planName: string;
  carrier: string;
  inNetwork: boolean | null;
  source: string; // "FHIR API" | "Cache" | "Unknown"
  verifiedAt: string | null;
  carrierUrl?: string;
}

interface PlanInput {
  id: number;
  name: string;
  carrier: string;
  contractId: string;
}

/**
 * Find the best matching carrier key for a given organization name.
 * Carrier names in the DB may not match exactly (e.g., "Humana Insurance Company").
 */
function matchCarrierKey(organizationName: string): string | null {
  const normalized = organizationName.toLowerCase();
  const carrierKeys = [
    ...new Set([
      ...Object.keys(CARRIER_FHIR_ENDPOINTS),
      ...Object.keys(CARRIER_DIRECTORY_URLS),
    ]),
  ];
  for (const key of carrierKeys) {
    if (normalized.includes(key.toLowerCase())) {
      return key;
    }
  }
  // Try partial matches for common abbreviations
  if (normalized.includes("uhc") || normalized.includes("united")) return "UnitedHealthcare";
  if (normalized.includes("bcbs") || normalized.includes("blue cross")) return "Blue Cross Blue Shield";
  if (normalized.includes("kaiser")) return "Kaiser Permanente";
  return null;
}

/**
 * Look up cached network status for a given NPI + carrier + contractId.
 * Returns the cached entry if it exists and is within the TTL, otherwise null.
 */
async function getCachedNetworkStatus(
  npi: string,
  carrier: string,
  contractId: string | null
): Promise<{ inNetwork: boolean | null; source: string; originalSource: string; verifiedAt: Date } | null> {
  try {
    // First try exact match on contractId
    const conditions = [
      eq(providerNetworkCache.npi, npi),
      eq(providerNetworkCache.carrier, carrier),
    ];
    if (contractId) {
      conditions.push(eq(providerNetworkCache.contractId, contractId));
    } else {
      conditions.push(sql`${providerNetworkCache.contractId} IS NULL`);
    }

    let rows = await db
      .select()
      .from(providerNetworkCache)
      .where(and(...conditions))
      .limit(1);

    // Fallback: if contractId was specified but no match, try carrier-level (null contractId)
    if (rows.length === 0 && contractId) {
      rows = await db
        .select()
        .from(providerNetworkCache)
        .where(and(
          eq(providerNetworkCache.npi, npi),
          eq(providerNetworkCache.carrier, carrier),
          sql`${providerNetworkCache.contractId} IS NULL`
        ))
        .limit(1);
    }

    if (rows.length === 0) return null;

    const row = rows[0];
    const verifiedAt = row.verifiedAt ? new Date(row.verifiedAt) : new Date(0);
    if (Date.now() - verifiedAt.getTime() > NETWORK_CACHE_TTL_MS) {
      return null; // expired
    }

    return {
      inNetwork: row.inNetwork,
      source: "Cache",
      originalSource: row.source,
      verifiedAt,
    };
  } catch (err) {
    console.error("Provider network cache lookup error:", err);
    return null;
  }
}

/**
 * Write a network status result to the cache (upsert).
 */
async function cacheNetworkStatus(
  npi: string,
  carrier: string,
  contractId: string | null,
  inNetwork: boolean | null,
  source: string
): Promise<void> {
  try {
    await db
      .insert(providerNetworkCache)
      .values({
        npi,
        carrier,
        contractId: contractId || null,
        inNetwork,
        source,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          providerNetworkCache.npi,
          providerNetworkCache.carrier,
          providerNetworkCache.contractId,
        ],
        set: {
          inNetwork,
          source,
          verifiedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("Provider network cache write error:", err);
  }
}

/**
 * Query a carrier's FHIR Provider Directory API to check if an NPI is listed.
 * Returns true (found), false (not found / 404), or null (error / timeout).
 */
async function queryFhirEndpoint(
  endpointUrl: string,
  npi: string
): Promise<boolean | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FHIR_TIMEOUT_MS);

  try {
    // Try identifier-based search first (standard FHIR approach)
    const url = `${endpointUrl}?identifier=http://hl7.org/fhir/sid/us-npi|${npi}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/fhir+json, application/json",
      },
    });
    clearTimeout(timeout);

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      // Some endpoints might use a different query param; try _id fallback
      return await queryFhirFallback(endpointUrl, npi);
    }

    const data = await response.json();

    // FHIR Bundle response: check if there are any entries
    if (data.resourceType === "Bundle") {
      const total = data.total ?? (data.entry?.length ?? 0);
      return total > 0;
    }

    // Direct Practitioner resource returned
    if (data.resourceType === "Practitioner") {
      return true;
    }

    // If we got some response but can't parse it, treat as unknown
    return null;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.warn(`FHIR endpoint timed out: ${endpointUrl}`);
    } else {
      console.warn(`FHIR endpoint error for ${endpointUrl}: ${err.message}`);
    }
    return null;
  }
}

/**
 * Fallback FHIR query using ?_id={npi} instead of ?identifier=...
 */
async function queryFhirFallback(
  endpointUrl: string,
  npi: string
): Promise<boolean | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FHIR_TIMEOUT_MS);

  try {
    const url = `${endpointUrl}?_id=${npi}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/fhir+json, application/json",
      },
    });
    clearTimeout(timeout);

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.resourceType === "Bundle") {
      const total = data.total ?? (data.entry?.length ?? 0);
      return total > 0;
    }

    if (data.resourceType === "Practitioner") {
      return true;
    }

    return null;
  } catch (err: any) {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Check provider network status for a list of plans.
 * Groups plans by carrier, queries FHIR endpoints where available,
 * caches results, and provides manual verification URLs as fallback.
 */
export async function checkProviderNetwork(
  npi: string,
  plans: PlanInput[]
): Promise<NetworkCheckResult[]> {
  // Group plans by carrier
  const carrierPlans = new Map<string, PlanInput[]>();
  for (const plan of plans) {
    const key = plan.carrier;
    if (!carrierPlans.has(key)) {
      carrierPlans.set(key, []);
    }
    carrierPlans.get(key)!.push(plan);
  }

  const results: NetworkCheckResult[] = [];

  // Process each carrier group
  const carrierPromises = Array.from(carrierPlans.entries()).map(
    async ([carrier, carrierPlanList]) => {
      const carrierKey = matchCarrierKey(carrier);
      const carrierUrl = carrierKey
        ? CARRIER_DIRECTORY_URLS[carrierKey]
        : undefined;

      // Check cache first (use the first plan's contractId as representative)
      const representativeContractId = carrierPlanList[0]?.contractId || null;
      let cached = await getCachedNetworkStatus(
        npi,
        carrier,
        representativeContractId
      );

      // Also try the canonical carrier key (e.g., "UnitedHealthcare" for "UnitedHealthcare Insurance Company")
      if (!cached && carrierKey && carrierKey !== carrier) {
        cached = await getCachedNetworkStatus(
          npi,
          carrierKey,
          representativeContractId
        );
      }

      let inNetwork: boolean | null = null;
      let source = "Unknown";
      let verifiedAt: string | null = null;

      if (cached) {
        // Use cached result — preserve original source for scoring differentiation
        inNetwork = cached.inNetwork;
        source = cached.originalSource || (cached.source === "Cache" ? "Cache" : cached.source);
        verifiedAt = cached.verifiedAt.toISOString();
      } else {
        // Try FHIR endpoint for this carrier
        const fhirEndpoint = carrierKey
          ? CARRIER_FHIR_ENDPOINTS[carrierKey]
          : undefined;

        if (fhirEndpoint) {
          const fhirResult = await queryFhirEndpoint(fhirEndpoint, npi);
          if (fhirResult !== null) {
            inNetwork = fhirResult;
            source = "FHIR API";
            verifiedAt = new Date().toISOString();
          } else {
            source = "Unknown";
          }
        }

        // Cache the result regardless (even "Unknown" so we don't re-query too often)
        await cacheNetworkStatus(
          npi,
          carrier,
          representativeContractId,
          inNetwork,
          source
        );
        if (!verifiedAt && source !== "Unknown") {
          verifiedAt = new Date().toISOString();
        }
      }

      // Build results for all plans under this carrier
      for (const plan of carrierPlanList) {
        results.push({
          planId: plan.id,
          planName: plan.name,
          carrier,
          inNetwork,
          source,
          verifiedAt,
          carrierUrl,
        });
      }
    }
  );

  await Promise.all(carrierPromises);

  // Return in the same order as input plans
  const planOrder = new Map(plans.map((p, i) => [p.id, i]));
  results.sort(
    (a, b) => (planOrder.get(a.planId) ?? 0) - (planOrder.get(b.planId) ?? 0)
  );

  return results;
}

/**
 * Get the carrier directory URL for manual verification.
 */
export function getCarrierDirectoryUrl(
  organizationName: string
): string | undefined {
  const key = matchCarrierKey(organizationName);
  return key ? CARRIER_DIRECTORY_URLS[key] : undefined;
}
