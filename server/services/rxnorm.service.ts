import { db } from "../db";
import { drugCache } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface DrugSearchResult {
  rxcui: string;
  name: string;
  synonym?: string;
  strength?: string;
  dosageForm?: string;
}

// Simple rate limiter: max 20 req/sec
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 50; // 1000ms / 20 = 50ms between requests

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search for drugs using the RxNorm API.
 * Results are cached in the drug_cache table.
 */
export async function searchDrugs(query: string): Promise<DrugSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();

  // Check cache first
  try {
    const cached = await db
      .select()
      .from(drugCache)
      .where(eq(drugCache.inputName, normalizedQuery))
      .limit(1);

    if (cached.length > 0 && cached[0].rxcui) {
      return [
        {
          rxcui: cached[0].rxcui!,
          name: cached[0].resolvedName || normalizedQuery,
          strength: cached[0].strength || undefined,
          dosageForm: cached[0].dosageForm || undefined,
        },
      ];
    }
  } catch (err) {
    // Cache lookup failed, continue to API
    console.error("Drug cache lookup error:", err);
  }

  // Call RxNorm API
  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const response = await rateLimitedFetch(
      `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodedQuery}`
    );

    if (!response.ok) {
      console.error(`RxNorm API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: DrugSearchResult[] = [];

    // Parse RxNorm response
    const drugGroup = data?.drugGroup;
    if (!drugGroup?.conceptGroup) {
      return [];
    }

    for (const group of drugGroup.conceptGroup) {
      if (!group.conceptProperties) continue;
      for (const concept of group.conceptProperties) {
        const result: DrugSearchResult = {
          rxcui: concept.rxcui,
          name: concept.name,
          synonym: concept.synonym || undefined,
        };

        // Try to parse strength and dosage form from the name
        const nameUpper = concept.name || "";
        const strengthMatch = nameUpper.match(
          /(\d+(?:\.\d+)?\s*(?:MG|MCG|ML|UNIT|%|MG\/ML|MCG\/HR|MG\/HR))/i
        );
        if (strengthMatch) {
          result.strength = strengthMatch[1];
        }

        const formPatterns = [
          "Oral Tablet",
          "Oral Capsule",
          "Injectable Solution",
          "Topical Cream",
          "Topical Ointment",
          "Oral Solution",
          "Oral Suspension",
          "Nasal Spray",
          "Inhalation Powder",
          "Ophthalmic Solution",
          "Transdermal Patch",
          "Sublingual Tablet",
          "Rectal Suppository",
          "Prefilled Syringe",
          "Auto-Injector",
        ];
        for (const form of formPatterns) {
          if (nameUpper.toLowerCase().includes(form.toLowerCase())) {
            result.dosageForm = form;
            break;
          }
        }

        results.push(result);
      }
    }

    // Cache results
    for (const result of results.slice(0, 5)) {
      try {
        await db
          .insert(drugCache)
          .values({
            inputName: normalizedQuery,
            rxcui: result.rxcui,
            resolvedName: result.name,
            strength: result.strength || null,
            dosageForm: result.dosageForm || null,
          })
          .onConflictDoUpdate({
            target: drugCache.inputName,
            set: {
              rxcui: result.rxcui,
              resolvedName: result.name,
              strength: result.strength || null,
              dosageForm: result.dosageForm || null,
              resolvedAt: new Date(),
            },
          });
        // Only cache the first result per query
        break;
      } catch (err) {
        console.error("Drug cache write error:", err);
      }
    }

    return results;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("RxNorm API request timed out");
    } else {
      console.error("RxNorm API error:", err.message);
    }
    return [];
  }
}

/**
 * Resolve a drug name to its RXCUI identifier.
 * Checks cache first, falls back to RxNorm API.
 */
export async function resolveToRxcui(drugName: string): Promise<string | null> {
  if (!drugName || drugName.trim().length === 0) {
    return null;
  }

  const normalizedName = drugName.trim().toLowerCase();

  // Check cache first
  try {
    const cached = await db
      .select()
      .from(drugCache)
      .where(eq(drugCache.inputName, normalizedName))
      .limit(1);

    if (cached.length > 0 && cached[0].rxcui) {
      return cached[0].rxcui;
    }
  } catch (err) {
    console.error("Drug cache lookup error (resolveToRxcui):", err);
  }

  // Call RxNorm API
  try {
    const encodedName = encodeURIComponent(drugName.trim());
    const response = await rateLimitedFetch(
      `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodedName}`
    );

    if (!response.ok) {
      console.error(`RxNorm API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const drugGroup = data?.drugGroup;
    if (!drugGroup?.conceptGroup) {
      return null;
    }

    for (const group of drugGroup.conceptGroup) {
      if (!group.conceptProperties || group.conceptProperties.length === 0) continue;
      const concept = group.conceptProperties[0];

      // Cache the result
      try {
        await db
          .insert(drugCache)
          .values({
            inputName: normalizedName,
            rxcui: concept.rxcui,
            resolvedName: concept.name,
            strength: null,
            dosageForm: null,
          })
          .onConflictDoUpdate({
            target: drugCache.inputName,
            set: {
              rxcui: concept.rxcui,
              resolvedName: concept.name,
              resolvedAt: new Date(),
            },
          });
      } catch (err) {
        console.error("Drug cache write error (resolveToRxcui):", err);
      }

      return concept.rxcui;
    }

    return null;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("RxNorm API request timed out (resolveToRxcui)");
    } else {
      console.error("RxNorm API error (resolveToRxcui):", err.message);
    }
    return null;
  }
}
