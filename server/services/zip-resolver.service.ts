/**
 * ZIP Code Resolver Service
 *
 * Uses the zip_county_map table (populated from Census ZCTA-County crosswalk)
 * to resolve any US ZIP code to its county, state, and FIPS code.
 *
 * This replaces the old approach of looking up ZIPs in the plans table,
 * which only covered ~202 ZIPs. Now supports 33,000+ ZIPs.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export interface ZipResolution {
  county: string;
  state: string;
  fips: string;
}

/**
 * Resolve a ZIP code to one or more county/state pairs.
 * Returns the primary county (highest residential_ratio) first.
 *
 * Falls back to ZIP prefix matching if exact match not found.
 */
export async function resolveZipToCounty(
  zip: string
): Promise<ZipResolution | null> {
  if (!zip || !/^\d{5}$/.test(zip)) return null;

  // Try exact match from zip_county_map
  const rows = await db.execute(
    sql`SELECT county_name, state, county_fips, residential_ratio
        FROM zip_county_map
        WHERE zipcode = ${zip}
        ORDER BY residential_ratio DESC
        LIMIT 1`
  );

  if (rows.rows && rows.rows.length > 0) {
    const r = rows.rows[0] as any;
    return {
      county: r.county_name,
      state: r.state,
      fips: r.county_fips,
    };
  }

  // Fallback: try ZIP prefix (first 3 digits)
  const prefix = zip.substring(0, 3);
  const fallbackRows = await db.execute(
    sql`SELECT county_name, state, county_fips, residential_ratio
        FROM zip_county_map
        WHERE zipcode LIKE ${prefix + "%"}
        ORDER BY residential_ratio DESC
        LIMIT 1`
  );

  if (fallbackRows.rows && fallbackRows.rows.length > 0) {
    const r = fallbackRows.rows[0] as any;
    return {
      county: r.county_name,
      state: r.state,
      fips: r.county_fips,
    };
  }

  return null;
}

/**
 * Resolve a ZIP code to ALL matching counties (for ZIPs that span multiple counties).
 * Useful for plan searches where we want plans from all counties the ZIP covers.
 */
export async function resolveZipToAllCounties(
  zip: string
): Promise<ZipResolution[]> {
  if (!zip || !/^\d{5}$/.test(zip)) return [];

  const rows = await db.execute(
    sql`SELECT county_name, state, county_fips, residential_ratio
        FROM zip_county_map
        WHERE zipcode = ${zip}
        ORDER BY residential_ratio DESC`
  );

  if (rows.rows && rows.rows.length > 0) {
    return (rows.rows as any[]).map((r) => ({
      county: r.county_name,
      state: r.state,
      fips: r.county_fips,
    }));
  }

  // Fallback: ZIP prefix
  const prefix = zip.substring(0, 3);
  const fallbackRows = await db.execute(
    sql`SELECT DISTINCT county_name, state, county_fips, residential_ratio
        FROM zip_county_map
        WHERE zipcode LIKE ${prefix + "%"}
        ORDER BY residential_ratio DESC
        LIMIT 5`
  );

  return (fallbackRows.rows as any[]).map((r) => ({
    county: r.county_name,
    state: r.state,
    fips: r.county_fips,
  }));
}
