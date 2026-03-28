import { db } from "../db";
import { cmsPlanCache } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Types ──

export interface CMSPlan {
  contractId: string;
  planId: string;
  planName: string;
  organizationName: string;
  planType: string;
  monthlyPremium: number | null;
  starRating: number | null;
  snpType: string | null;
  state: string;
  county: string;
  source: "CMS_API" | "Cache";
}

export interface CMSPlanDetail extends CMSPlan {
  deductible: number | null;
  moop: number | null;
  drugDeductible: number | null;
  partBPremiumReduction: number | null;
  rawData: any;
}

// ── CMS API Configuration ──
// data.cms.gov CKAN/DKAN API for Medicare data
const CMS_DATA_BASE = "https://data.cms.gov/api/1/datastore/query";

// Known dataset distribution IDs for Medicare plan data on data.cms.gov
// These can change — we try multiple known IDs and fall back gracefully
const MA_LANDSCAPE_DATASET_IDS = [
  "afd3c10d-3583-47ca-87f4-7b6a21bbd642", // MA Landscape source file 2026
  "94c3d872-7f5e-45bf-acfb-7d6a1f2cf4e7", // MA Landscape 2025
  "b4832aff-ffa1-4aa9-a1a9-3de38dda6d88", // MA Landscape 2024
];

const PDP_LANDSCAPE_DATASET_IDS = [
  "3c72d9b8-f779-468e-b02b-8e2a9e3d1a1e", // PDP Landscape 2026
  "8b44a0f7-4efe-4a92-aaab-7f5c3a31e6f0", // PDP Landscape 2025
];

// Coverage API (marketplace/plan finder backing API)
const COVERAGE_API_BASE = "https://api.coverage.cms.gov";

// Timeout for all external calls
const TIMEOUT_MS = 5000;

// Cache duration: 24 hours
const CACHE_DURATION_HOURS = 24;

// ── Helper: fetch with timeout ──

async function fetchWithTimeout(url: string, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "MediApp/1.0 Medicare Plan Comparison Tool",
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── Try data.cms.gov DKAN API ──

async function tryDataCmsGovQuery(
  datasetId: string,
  conditions: Record<string, string>,
  limit: number = 50
): Promise<any[] | null> {
  try {
    // Build the query URL with conditions
    const conditionParams = Object.entries(conditions)
      .map(([key, val]) => `conditions[${encodeURIComponent(key)}][value]=${encodeURIComponent(val)}`)
      .join("&");

    const url = `${CMS_DATA_BASE}/${datasetId}/0?${conditionParams}&limit=${limit}&offset=0`;
    console.log(`[CMS Finder] Trying data.cms.gov: ${url}`);

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.log(`[CMS Finder] data.cms.gov returned ${response.status} for dataset ${datasetId}`);
      return null;
    }

    const data = await response.json();
    if (data?.results && Array.isArray(data.results)) {
      console.log(`[CMS Finder] Got ${data.results.length} results from data.cms.gov dataset ${datasetId}`);
      return data.results;
    }
    return null;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log(`[CMS Finder] Timeout on data.cms.gov dataset ${datasetId}`);
    } else {
      console.log(`[CMS Finder] Error querying data.cms.gov: ${err.message}`);
    }
    return null;
  }
}

// ── Try CMS Coverage API ──

async function tryCoverageApi(zipCode: string): Promise<any[] | null> {
  try {
    // The coverage API provides plan search by ZIP
    const url = `${COVERAGE_API_BASE}/marketplace/plans?zipCode=${zipCode}&year=2026&apikey=`;
    console.log(`[CMS Finder] Trying coverage API: ${url}`);

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.log(`[CMS Finder] Coverage API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data?.plans && Array.isArray(data.plans)) {
      return data.plans;
    }
    return null;
  } catch (err: any) {
    console.log(`[CMS Finder] Coverage API error: ${err.message}`);
    return null;
  }
}

// ── Parse CMS data.cms.gov row into CMSPlan ──

function parseCmsDataRow(row: any, zipCode?: string): CMSPlan | null {
  try {
    // data.cms.gov landscape files have varying column names
    const contractId = row.contract_id || row.Contract_ID || row.contractid || row.contract_number || "";
    const planId = row.plan_id || row.Plan_ID || row.planid || "";
    const planName = row.plan_name || row.Plan_Name || row.planname || row.plan_marketing_name || "Unknown Plan";
    const org = row.organization_name || row.Organization_Name || row.org_name || row.parent_organization || "";
    const planType = row.plan_type || row.Plan_Type || row.plantype || "";
    const premium = row.monthly_premium || row.Monthly_Premium || row.premium || null;
    const star = row.overall_star_rating || row.Overall_Star_Rating || row.star_rating || null;
    const snp = row.snp_type || row.SNP_Type || row.snptype || null;
    const state = row.state || row.State || "";
    const county = row.county || row.County || "";

    if (!contractId && !planName) return null;

    return {
      contractId: String(contractId),
      planId: String(planId),
      planName: String(planName),
      organizationName: String(org),
      planType: String(planType),
      monthlyPremium: premium ? parseFloat(String(premium).replace(/[$,]/g, "")) : null,
      starRating: star ? parseFloat(String(star)) : null,
      snpType: snp ? String(snp) : null,
      state: String(state),
      county: String(county),
      source: "CMS_API" as const,
    };
  } catch {
    return null;
  }
}

// ── Cache helpers ──

async function getCachedPlans(zipCode?: string, state?: string, county?: string): Promise<CMSPlan[] | null> {
  try {
    const cutoff = new Date(Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000);

    let rows: any[];
    if (zipCode) {
      rows = await db
        .select()
        .from(cmsPlanCache)
        .where(
          and(
            eq(cmsPlanCache.zipCode, zipCode),
            sql`${cmsPlanCache.fetchedAt} > ${cutoff}`
          )
        );
    } else if (state && county) {
      rows = await db
        .select()
        .from(cmsPlanCache)
        .where(
          and(
            eq(cmsPlanCache.state, state),
            eq(cmsPlanCache.county, county),
            sql`${cmsPlanCache.fetchedAt} > ${cutoff}`
          )
        );
    } else {
      return null;
    }

    if (rows.length === 0) return null;

    return rows.map((r) => ({
      contractId: r.contractId || "",
      planId: r.planId || "",
      planName: r.planName || "",
      organizationName: r.organizationName || "",
      planType: r.planType || "",
      monthlyPremium: r.monthlyPremium,
      starRating: r.starRating,
      snpType: r.snpType,
      state: r.state || "",
      county: r.county || "",
      source: "Cache" as const,
    }));
  } catch (err: any) {
    console.log(`[CMS Finder] Cache read error: ${err.message}`);
    return null;
  }
}

async function cachePlans(plans: CMSPlan[], zipCode?: string): Promise<void> {
  try {
    if (plans.length === 0) return;

    for (const plan of plans) {
      await db
        .insert(cmsPlanCache)
        .values({
          zipCode: zipCode || null,
          state: plan.state || null,
          county: plan.county || null,
          contractId: plan.contractId || null,
          planId: plan.planId || null,
          planName: plan.planName || null,
          organizationName: plan.organizationName || null,
          planType: plan.planType || null,
          monthlyPremium: plan.monthlyPremium,
          starRating: plan.starRating,
          snpType: plan.snpType,
          rawData: plan as any,
        });
    }
    console.log(`[CMS Finder] Cached ${plans.length} plans`);
  } catch (err: any) {
    console.log(`[CMS Finder] Cache write error: ${err.message}`);
  }
}

// ── Public API ──

/**
 * Search for plans by ZIP code using CMS data.cms.gov API.
 * Tries multiple dataset IDs and falls back to cache.
 */
export async function searchPlansByZip(zipCode: string): Promise<CMSPlan[]> {
  // Check cache first
  const cached = await getCachedPlans(zipCode);
  if (cached && cached.length > 0) {
    console.log(`[CMS Finder] Returning ${cached.length} cached plans for ZIP ${zipCode}`);
    return cached;
  }

  // Try data.cms.gov with MA landscape datasets
  for (const datasetId of MA_LANDSCAPE_DATASET_IDS) {
    const rows = await tryDataCmsGovQuery(datasetId, { zip_code: zipCode }, 100);
    if (rows && rows.length > 0) {
      const plans = rows.map((r) => parseCmsDataRow(r, zipCode)).filter(Boolean) as CMSPlan[];
      if (plans.length > 0) {
        await cachePlans(plans, zipCode);
        return plans;
      }
    }

    // Try alternate column name
    const rows2 = await tryDataCmsGovQuery(datasetId, { zipcode: zipCode }, 100);
    if (rows2 && rows2.length > 0) {
      const plans = rows2.map((r) => parseCmsDataRow(r, zipCode)).filter(Boolean) as CMSPlan[];
      if (plans.length > 0) {
        await cachePlans(plans, zipCode);
        return plans;
      }
    }
  }

  // Try PDP landscape datasets
  for (const datasetId of PDP_LANDSCAPE_DATASET_IDS) {
    const rows = await tryDataCmsGovQuery(datasetId, { zip_code: zipCode }, 100);
    if (rows && rows.length > 0) {
      const plans = rows.map((r) => parseCmsDataRow(r, zipCode)).filter(Boolean) as CMSPlan[];
      if (plans.length > 0) {
        await cachePlans(plans, zipCode);
        return plans;
      }
    }
  }

  // Try Coverage API
  const coverageResults = await tryCoverageApi(zipCode);
  if (coverageResults && coverageResults.length > 0) {
    const plans = coverageResults.map((r) => parseCmsDataRow(r, zipCode)).filter(Boolean) as CMSPlan[];
    if (plans.length > 0) {
      await cachePlans(plans, zipCode);
      return plans;
    }
  }

  console.log(`[CMS Finder] No live results for ZIP ${zipCode} — returning empty`);
  return [];
}

/**
 * Get details for a specific plan by contract ID and plan ID.
 */
export async function getPlanDetails(contractId: string, planId: string): Promise<CMSPlanDetail | null> {
  // Check cache
  try {
    const cached = await db
      .select()
      .from(cmsPlanCache)
      .where(
        and(
          eq(cmsPlanCache.contractId, contractId),
          eq(cmsPlanCache.planId, planId)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      const r = cached[0];
      return {
        contractId: r.contractId || "",
        planId: r.planId || "",
        planName: r.planName || "",
        organizationName: r.organizationName || "",
        planType: r.planType || "",
        monthlyPremium: r.monthlyPremium,
        starRating: r.starRating,
        snpType: r.snpType,
        state: r.state || "",
        county: r.county || "",
        deductible: null,
        moop: null,
        drugDeductible: null,
        partBPremiumReduction: null,
        rawData: r.rawData,
        source: "Cache",
      };
    }
  } catch (err: any) {
    console.log(`[CMS Finder] Cache lookup error: ${err.message}`);
  }

  // Try data.cms.gov with contract_id filter
  for (const datasetId of MA_LANDSCAPE_DATASET_IDS) {
    const rows = await tryDataCmsGovQuery(datasetId, {
      contract_id: contractId,
      plan_id: planId,
    }, 5);

    if (rows && rows.length > 0) {
      const base = parseCmsDataRow(rows[0]);
      if (base) {
        const detail: CMSPlanDetail = {
          ...base,
          deductible: rows[0].annual_deductible ? parseFloat(String(rows[0].annual_deductible).replace(/[$,]/g, "")) : null,
          moop: rows[0].moop ? parseFloat(String(rows[0].moop).replace(/[$,]/g, "")) : null,
          drugDeductible: rows[0].drug_deductible ? parseFloat(String(rows[0].drug_deductible).replace(/[$,]/g, "")) : null,
          partBPremiumReduction: rows[0].partb_premium_reduction ? parseFloat(String(rows[0].partb_premium_reduction).replace(/[$,]/g, "")) : null,
          rawData: rows[0],
          source: "CMS_API",
        };
        // Cache for next time
        await cachePlans([detail]);
        return detail;
      }
    }
  }

  console.log(`[CMS Finder] No details found for ${contractId}/${planId}`);
  return null;
}

/**
 * Get all plans available in a county.
 */
export async function getCountyPlans(state: string, county: string): Promise<CMSPlan[]> {
  // Check cache
  const cached = await getCachedPlans(undefined, state.toUpperCase(), county.toUpperCase());
  if (cached && cached.length > 0) {
    console.log(`[CMS Finder] Returning ${cached.length} cached plans for ${county}, ${state}`);
    return cached;
  }

  // Try data.cms.gov
  for (const datasetId of MA_LANDSCAPE_DATASET_IDS) {
    const rows = await tryDataCmsGovQuery(datasetId, {
      state: state.toUpperCase(),
      county: county.toUpperCase(),
    }, 200);

    if (rows && rows.length > 0) {
      const plans = rows.map((r) => parseCmsDataRow(r)).filter(Boolean) as CMSPlan[];
      if (plans.length > 0) {
        await cachePlans(plans);
        return plans;
      }
    }
  }

  console.log(`[CMS Finder] No live results for ${county}, ${state}`);
  return [];
}

/**
 * Check if the CMS API is responsive.
 */
export async function checkCmsApiStatus(): Promise<"connected" | "connecting" | "unavailable"> {
  try {
    // Try a simple query to see if the API is up
    const response = await fetchWithTimeout(`${CMS_DATA_BASE}/${MA_LANDSCAPE_DATASET_IDS[0]}/0?limit=1`, 3000);
    if (response.ok) return "connected";
    if (response.status === 429) return "connecting"; // Rate limited but alive
    return "connecting";
  } catch {
    return "unavailable";
  }
}
