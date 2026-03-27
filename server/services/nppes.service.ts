import { db } from "../db";
import { providerCache } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface ProviderResult {
  npi: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  specialty?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

// 30-day TTL for provider cache entries
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Search for providers using the NPPES NPI Registry API.
 * Results are cached in the provider_cache table with a 30-day TTL.
 */
export async function searchProviders(query: {
  name?: string;
  npi?: string;
  state?: string;
  specialty?: string;
  limit?: number;
}): Promise<ProviderResult[]> {
  const { name, npi, state, specialty, limit = 10 } = query;

  // If searching by NPI, check cache first
  if (npi) {
    try {
      const cached = await db
        .select()
        .from(providerCache)
        .where(eq(providerCache.npi, npi))
        .limit(1);

      if (cached.length > 0) {
        const entry = cached[0];
        const resolvedAt = entry.resolvedAt ? new Date(entry.resolvedAt).getTime() : 0;
        if (Date.now() - resolvedAt < CACHE_TTL_MS) {
          return [cacheEntryToResult(entry)];
        }
      }
    } catch (err) {
      console.error("Provider cache lookup error:", err);
    }
  }

  // Build NPPES API URL
  const params = new URLSearchParams({
    version: "2.1",
    limit: String(Math.min(limit, 200)),
  });

  if (npi) {
    params.set("number", npi);
  }
  if (name) {
    // Try to split name into first/last for individual provider search
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      params.set("first_name", parts[0]);
      params.set("last_name", parts.slice(1).join(" "));
    } else {
      // Single name — search as last name and also try organization
      params.set("last_name", parts[0]);
    }
  }
  if (state) {
    params.set("state", state.toUpperCase());
  }
  if (specialty) {
    params.set("taxonomy_description", specialty);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`NPPES API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    const results: ProviderResult[] = [];

    for (const result of data.results) {
      const basic = result.basic || {};
      const addresses = result.addresses || [];
      const taxonomies = result.taxonomies || [];

      // Get the primary practice location address (type = "DOM" for mailing, use practice location first)
      const practiceAddr =
        addresses.find((a: any) => a.address_purpose === "LOCATION") ||
        addresses[0] ||
        {};

      const primaryTaxonomy =
        taxonomies.find((t: any) => t.primary === true) || taxonomies[0] || {};

      const provider: ProviderResult = {
        npi: String(result.number),
        firstName: basic.first_name || undefined,
        lastName: basic.last_name || undefined,
        organizationName: basic.organization_name || undefined,
        specialty: primaryTaxonomy.desc || undefined,
        addressLine1: practiceAddr.address_1 || undefined,
        city: practiceAddr.city || undefined,
        state: practiceAddr.state || undefined,
        zip: practiceAddr.postal_code?.substring(0, 5) || undefined,
        phone: practiceAddr.telephone_number || undefined,
      };

      results.push(provider);

      // Cache the result
      try {
        await db
          .insert(providerCache)
          .values({
            npi: provider.npi,
            firstName: provider.firstName || null,
            lastName: provider.lastName || null,
            organizationName: provider.organizationName || null,
            specialty: provider.specialty || null,
            addressLine1: provider.addressLine1 || null,
            city: provider.city || null,
            state: provider.state || null,
            zip: provider.zip || null,
            phone: provider.phone || null,
          })
          .onConflictDoUpdate({
            target: providerCache.npi,
            set: {
              firstName: provider.firstName || null,
              lastName: provider.lastName || null,
              organizationName: provider.organizationName || null,
              specialty: provider.specialty || null,
              addressLine1: provider.addressLine1 || null,
              city: provider.city || null,
              state: provider.state || null,
              zip: provider.zip || null,
              phone: provider.phone || null,
              resolvedAt: new Date(),
            },
          });
      } catch (err) {
        console.error("Provider cache write error:", err);
      }
    }

    return results;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("NPPES API request timed out");
    } else {
      console.error("NPPES API error:", err.message);
    }
    return [];
  }
}

/**
 * Look up a single provider by NPI.
 */
export async function getProviderByNpi(npi: string): Promise<ProviderResult | null> {
  const results = await searchProviders({ npi, limit: 1 });
  return results.length > 0 ? results[0] : null;
}

function cacheEntryToResult(entry: any): ProviderResult {
  return {
    npi: entry.npi,
    firstName: entry.firstName || undefined,
    lastName: entry.lastName || undefined,
    organizationName: entry.organizationName || undefined,
    specialty: entry.specialty || undefined,
    addressLine1: entry.addressLine1 || undefined,
    city: entry.city || undefined,
    state: entry.state || undefined,
    zip: entry.zip || undefined,
    phone: entry.phone || undefined,
  };
}
