import { db } from "../db";
import { formularyDrugs } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Types ──

export interface FormularyDrugResult {
  rxcui: string;
  drugName: string;
  tier: number;
  copay: number | null;
  coinsurance: number | null;
  priorAuth: boolean;
  stepTherapy: boolean;
  quantityLimit: boolean;
  planId: string;
  carrier: string;
  source: "FHIR" | "Cache" | "PBP";
}

// ── Carrier FHIR Formulary Endpoints ──
// These are public APIs mandated by CMS interoperability rules (21st Century Cures Act).
// No API key or carrier contract needed.

const CARRIER_FORMULARY_ENDPOINTS: Record<string, { baseUrl: string; type: string }> = {
  "UnitedHealthcare": {
    baseUrl: "https://public.fhir.flex.optum.com",
    type: "optum",
  },
  "Humana": {
    baseUrl: "https://fhir.humana.com/api",
    type: "humana",
  },
  "Anthem": {
    baseUrl: "https://fhir.anthem.com",
    type: "anthem",
  },
  "Aetna": {
    baseUrl: "https://vteapif1.aetna.com/fhirdirectory/v2",
    type: "aetna",
  },
  "Cigna": {
    baseUrl: "https://provider-directory.cigna.com/api/1/fhir",
    type: "cigna",
  },
  "Blue Cross Blue Shield": {
    baseUrl: "https://fhir.bcbs.com",
    type: "bcbs",
  },
  "Centene": {
    baseUrl: "https://fhir.centene.com",
    type: "centene",
  },
  "Molina": {
    baseUrl: "https://fhir.molinahealthcare.com",
    type: "molina",
  },
};

// Timeout for FHIR calls
const FHIR_TIMEOUT_MS = 5000;

// Cache duration: 12 hours for FHIR results
const FHIR_CACHE_HOURS = 12;

// ── Helper: fetch with timeout ──

async function fetchWithTimeout(url: string, timeoutMs: number = FHIR_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/fhir+json, application/json",
        "User-Agent": "MediApp/1.0 FHIR Formulary Client",
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── Resolve carrier name to endpoint ──

function resolveCarrierEndpoint(carrier: string): { baseUrl: string; type: string } | null {
  // Exact match first
  if (CARRIER_FORMULARY_ENDPOINTS[carrier]) {
    return CARRIER_FORMULARY_ENDPOINTS[carrier];
  }

  // Fuzzy match by substring
  const carrierLower = carrier.toLowerCase();
  for (const [name, endpoint] of Object.entries(CARRIER_FORMULARY_ENDPOINTS)) {
    if (
      carrierLower.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(carrierLower)
    ) {
      return endpoint;
    }
  }

  // Common aliases
  if (carrierLower.includes("uhc") || carrierLower.includes("united")) {
    return CARRIER_FORMULARY_ENDPOINTS["UnitedHealthcare"];
  }
  if (carrierLower.includes("bcbs") || carrierLower.includes("blue cross")) {
    return CARRIER_FORMULARY_ENDPOINTS["Blue Cross Blue Shield"];
  }

  return null;
}

// ── Parse FHIR FormularyItem response ──

function parseFhirFormularyItem(
  bundle: any,
  rxcui: string,
  planId: string,
  carrier: string
): FormularyDrugResult | null {
  try {
    // FHIR Bundle of FormularyItem resources
    const entries = bundle?.entry || [];
    if (entries.length === 0) return null;

    const resource = entries[0]?.resource;
    if (!resource) return null;

    // DaVinci US Drug Formulary IG FormularyItem structure
    const extensions = resource.extension || [];
    let tier = 2; // default generic tier
    let priorAuth = false;
    let stepTherapy = false;
    let quantityLimit = false;
    let copay: number | null = null;
    let coinsurance: number | null = null;

    for (const ext of extensions) {
      const url = ext.url || "";

      // Tier extension
      if (url.includes("DrugTierID") || url.includes("drug-tier")) {
        const coding = ext.valueCodeableConcept?.coding?.[0];
        if (coding) {
          const tierCode = coding.code || "";
          // Map FHIR tier codes to numeric tiers
          if (tierCode.includes("generic") || tierCode === "1") tier = 1;
          else if (tierCode.includes("preferred-generic") || tierCode === "2") tier = 2;
          else if (tierCode.includes("preferred-brand") || tierCode === "3") tier = 3;
          else if (tierCode.includes("non-preferred") || tierCode === "4") tier = 4;
          else if (tierCode.includes("specialty") || tierCode === "5") tier = 5;
          else if (tierCode.includes("select") || tierCode === "6") tier = 6;
          else {
            const parsed = parseInt(tierCode);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) tier = parsed;
          }
        }
      }

      // Prior authorization
      if (url.includes("PriorAuthorization") || url.includes("prior-authorization")) {
        priorAuth = ext.valueBoolean === true;
      }

      // Step therapy
      if (url.includes("StepTherapyLimit") || url.includes("step-therapy")) {
        stepTherapy = ext.valueBoolean === true;
      }

      // Quantity limit
      if (url.includes("QuantityLimit") || url.includes("quantity-limit")) {
        quantityLimit = ext.valueBoolean === true;
      }

      // Cost sharing (copay/coinsurance)
      if (url.includes("CostSharing") || url.includes("cost-sharing")) {
        const subExts = ext.extension || [];
        for (const sub of subExts) {
          if (sub.url?.includes("copay") || sub.url?.includes("CopayAmount")) {
            copay = sub.valueMoney?.value ?? sub.valueDecimal ?? null;
          }
          if (sub.url?.includes("coinsurance") || sub.url?.includes("CoinsuranceRate")) {
            coinsurance = sub.valueDecimal ?? null;
          }
        }
      }
    }

    // Drug name from the code
    const drugName =
      resource.code?.coding?.[0]?.display ||
      resource.code?.text ||
      `Drug RXCUI ${rxcui}`;

    return {
      rxcui,
      drugName,
      tier,
      copay,
      coinsurance,
      priorAuth,
      stepTherapy,
      quantityLimit,
      planId,
      carrier,
      source: "FHIR",
    };
  } catch (err: any) {
    console.log(`[FHIR Formulary] Parse error: ${err.message}`);
    return null;
  }
}

// ── Parse FHIR MedicationKnowledge for drug info ──

function parseFhirMedicationKnowledge(
  bundle: any,
  rxcui: string,
  planId: string,
  carrier: string
): FormularyDrugResult | null {
  try {
    const entries = bundle?.entry || [];
    if (entries.length === 0) return null;

    const resource = entries[0]?.resource;
    if (!resource) return null;

    const drugName = resource.code?.coding?.[0]?.display || resource.code?.text || `Drug RXCUI ${rxcui}`;

    // Extract tier from regulatory classification or extension
    let tier = 2;
    const regulatory = resource.regulatory || [];
    for (const reg of regulatory) {
      const schedule = reg.schedule?.coding?.[0]?.code;
      if (schedule) {
        const parsed = parseInt(schedule);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) tier = parsed;
      }
    }

    return {
      rxcui,
      drugName,
      tier,
      copay: null,
      coinsurance: null,
      priorAuth: false,
      stepTherapy: false,
      quantityLimit: false,
      planId,
      carrier,
      source: "FHIR",
    };
  } catch {
    return null;
  }
}

// ── Cache helpers ──

async function getCachedFhirResult(
  carrier: string,
  planId: string,
  rxcui: string
): Promise<FormularyDrugResult | null> {
  try {
    const cutoff = new Date(Date.now() - FHIR_CACHE_HOURS * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(formularyDrugs)
      .where(
        and(
          eq(formularyDrugs.rxcui, rxcui),
          eq(formularyDrugs.source, "FHIR"),
          eq(formularyDrugs.carrier, carrier),
          sql`${formularyDrugs.lastFhirCheck} > ${cutoff}`
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      rxcui: row.rxcui,
      drugName: row.drugName,
      tier: row.tier,
      copay: row.copay,
      coinsurance: row.coinsurance,
      priorAuth: row.priorAuthorization ?? false,
      stepTherapy: row.stepTherapy ?? false,
      quantityLimit: row.quantityLimit ?? false,
      planId,
      carrier,
      source: "Cache",
    };
  } catch (err: any) {
    console.log(`[FHIR Formulary] Cache read error: ${err.message}`);
    return null;
  }
}

async function cacheFhirResult(result: FormularyDrugResult): Promise<void> {
  try {
    await db
      .insert(formularyDrugs)
      .values({
        contractId: result.planId,
        formularyId: `FHIR-${result.carrier}`,
        rxcui: result.rxcui,
        drugName: result.drugName,
        tier: result.tier,
        priorAuthorization: result.priorAuth,
        stepTherapy: result.stepTherapy,
        quantityLimit: result.quantityLimit,
        contractYear: new Date().getFullYear(),
        source: "FHIR",
        carrier: result.carrier,
        copay: result.copay,
        coinsurance: result.coinsurance,
        lastFhirCheck: new Date(),
      });
    console.log(`[FHIR Formulary] Cached FHIR result for ${result.drugName} (${result.carrier})`);
  } catch (err: any) {
    // Likely duplicate — that's fine
    console.log(`[FHIR Formulary] Cache write note: ${err.message}`);
  }
}

// ── Public API ──

/**
 * Check if a drug is covered by a specific plan via real-time FHIR lookup.
 * Falls back to cache, then to local PBP formulary data.
 */
export async function checkDrugCoverage(
  carrier: string,
  planId: string,
  rxcui: string
): Promise<FormularyDrugResult | null> {
  // 1. Check FHIR cache
  const cached = await getCachedFhirResult(carrier, planId, rxcui);
  if (cached) {
    console.log(`[FHIR Formulary] Cache hit for ${rxcui} (${carrier})`);
    return cached;
  }

  // 2. Try live FHIR lookup
  const endpoint = resolveCarrierEndpoint(carrier);
  if (endpoint) {
    // Try FormularyItem endpoint (DaVinci Drug Formulary IG)
    try {
      const formularyUrl = `${endpoint.baseUrl}/FormularyItem?code=${rxcui}`;
      console.log(`[FHIR Formulary] Querying: ${formularyUrl}`);

      const response = await fetchWithTimeout(formularyUrl);
      if (response.ok) {
        const bundle = await response.json();
        const result = parseFhirFormularyItem(bundle, rxcui, planId, carrier);
        if (result) {
          await cacheFhirResult(result);
          return result;
        }
      } else {
        console.log(`[FHIR Formulary] FormularyItem returned ${response.status} for ${carrier}`);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log(`[FHIR Formulary] Timeout on FormularyItem for ${carrier}`);
      } else {
        console.log(`[FHIR Formulary] FormularyItem error (${carrier}): ${err.message}`);
      }
    }

    // Try MedicationKnowledge endpoint
    try {
      const medUrl = `${endpoint.baseUrl}/MedicationKnowledge?code=${rxcui}`;
      console.log(`[FHIR Formulary] Trying MedicationKnowledge: ${medUrl}`);

      const response = await fetchWithTimeout(medUrl);
      if (response.ok) {
        const bundle = await response.json();
        const result = parseFhirMedicationKnowledge(bundle, rxcui, planId, carrier);
        if (result) {
          await cacheFhirResult(result);
          return result;
        }
      }
    } catch (err: any) {
      console.log(`[FHIR Formulary] MedicationKnowledge error (${carrier}): ${err.message}`);
    }

    // Try InsurancePlan endpoint filtered by plan and drug
    try {
      const planUrl = `${endpoint.baseUrl}/InsurancePlan?identifier=${planId}`;
      console.log(`[FHIR Formulary] Trying InsurancePlan: ${planUrl}`);

      const response = await fetchWithTimeout(planUrl);
      if (response.ok) {
        const bundle = await response.json();
        // InsurancePlan gives us formulary reference; limited drug-level info
        console.log(`[FHIR Formulary] InsurancePlan response received for ${carrier}`);
      }
    } catch (err: any) {
      console.log(`[FHIR Formulary] InsurancePlan error (${carrier}): ${err.message}`);
    }
  }

  // 3. Fall back to local PBP formulary data
  try {
    const localRows = await db
      .select()
      .from(formularyDrugs)
      .where(eq(formularyDrugs.rxcui, rxcui))
      .limit(1);

    if (localRows.length > 0) {
      const row = localRows[0];
      console.log(`[FHIR Formulary] Falling back to PBP data for ${rxcui}`);
      return {
        rxcui: row.rxcui,
        drugName: row.drugName,
        tier: row.tier,
        copay: row.copay,
        coinsurance: row.coinsurance,
        priorAuth: row.priorAuthorization ?? false,
        stepTherapy: row.stepTherapy ?? false,
        quantityLimit: row.quantityLimit ?? false,
        planId,
        carrier,
        source: "PBP",
      };
    }
  } catch (err: any) {
    console.log(`[FHIR Formulary] PBP fallback error: ${err.message}`);
  }

  console.log(`[FHIR Formulary] No coverage data found for ${rxcui} (${carrier}/${planId})`);
  return null;
}

/**
 * Get formulary entries for a plan. Returns available drugs from FHIR and local data.
 */
export async function getPlanFormulary(
  carrier: string,
  planId: string
): Promise<FormularyDrugResult[]> {
  const results: FormularyDrugResult[] = [];

  // Try FHIR InsurancePlan to get formulary reference
  const endpoint = resolveCarrierEndpoint(carrier);
  if (endpoint) {
    try {
      const url = `${endpoint.baseUrl}/InsurancePlan?identifier=${planId}&_include=InsurancePlan:formulary`;
      console.log(`[FHIR Formulary] Fetching plan formulary: ${url}`);

      const response = await fetchWithTimeout(url);
      if (response.ok) {
        const bundle = await response.json();
        const entries = bundle?.entry || [];

        for (const entry of entries) {
          const resource = entry?.resource;
          if (resource?.resourceType === "FormularyItem") {
            const rxcui = resource.code?.coding?.[0]?.code || "";
            if (rxcui) {
              const parsed = parseFhirFormularyItem({ entry: [entry] }, rxcui, planId, carrier);
              if (parsed) {
                results.push(parsed);
              }
            }
          }
        }

        if (results.length > 0) {
          console.log(`[FHIR Formulary] Got ${results.length} formulary items from FHIR for ${carrier}/${planId}`);
          return results;
        }
      }
    } catch (err: any) {
      console.log(`[FHIR Formulary] Plan formulary error (${carrier}): ${err.message}`);
    }
  }

  // Fall back to local PBP data for this contract
  try {
    const localRows = await db
      .select()
      .from(formularyDrugs)
      .where(eq(formularyDrugs.contractId, planId))
      .limit(200);

    for (const row of localRows) {
      results.push({
        rxcui: row.rxcui,
        drugName: row.drugName,
        tier: row.tier,
        copay: row.copay,
        coinsurance: row.coinsurance,
        priorAuth: row.priorAuthorization ?? false,
        stepTherapy: row.stepTherapy ?? false,
        quantityLimit: row.quantityLimit ?? false,
        planId,
        carrier,
        source: (row.source as "FHIR" | "Cache" | "PBP") || "PBP",
      });
    }

    console.log(`[FHIR Formulary] Returning ${results.length} PBP formulary items for ${planId}`);
  } catch (err: any) {
    console.log(`[FHIR Formulary] PBP formulary fallback error: ${err.message}`);
  }

  return results;
}

/**
 * Bulk check: multiple drugs across multiple plans.
 * Returns a map of `{carrier}:{planId}` -> FormularyDrugResult[].
 */
export async function bulkDrugCheck(
  drugs: Array<{ rxcui: string; name: string }>,
  planSpecs: Array<{ carrier: string; planId: string }>
): Promise<Record<string, FormularyDrugResult[]>> {
  const result: Record<string, FormularyDrugResult[]> = {};

  // Process each plan+drug combination with concurrency limiting
  const tasks: Array<{ key: string; carrier: string; planId: string; rxcui: string; name: string }> = [];

  for (const plan of planSpecs) {
    const key = `${plan.carrier}:${plan.planId}`;
    result[key] = [];
    for (const drug of drugs) {
      tasks.push({ key, carrier: plan.carrier, planId: plan.planId, rxcui: drug.rxcui, name: drug.name });
    }
  }

  // Process in batches of 5 to avoid overwhelming APIs
  const BATCH_SIZE = 5;
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (task) => {
        const drugResult = await checkDrugCoverage(task.carrier, task.planId, task.rxcui);
        return { key: task.key, drugResult };
      })
    );

    for (const settled of batchResults) {
      if (settled.status === "fulfilled" && settled.value.drugResult) {
        result[settled.value.key].push(settled.value.drugResult);
      }
    }
  }

  return result;
}

/**
 * Check if a specific carrier's FHIR endpoint is responsive.
 */
export async function checkCarrierFhirStatus(
  carrier: string
): Promise<"connected" | "partial" | "unavailable"> {
  const endpoint = resolveCarrierEndpoint(carrier);
  if (!endpoint) return "unavailable";

  try {
    const url = `${endpoint.baseUrl}/metadata`;
    const response = await fetchWithTimeout(url, 3000);
    if (response.ok) return "connected";
    if (response.status === 401 || response.status === 403) return "partial";
    return "partial";
  } catch {
    return "unavailable";
  }
}

/**
 * Get list of supported carriers and their FHIR status.
 */
export function getSupportedCarriers(): string[] {
  return Object.keys(CARRIER_FORMULARY_ENDPOINTS);
}
