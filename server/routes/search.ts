/**
 * Search Routes — unified search across plans, carriers, and locations
 *
 * GET /api/search?q={term}&limit=20
 *
 * Returns categorized results:
 * - plans: matched by plan name (ILIKE) or contract ID (exact prefix)
 * - carriers: matched by organization name (ILIKE), with plan count
 * - locations: matched by state abbreviation (exact), city (ILIKE), or zipcode (prefix)
 */
import { Router } from "express";
import { db } from "../db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, desc } from "drizzle-orm";

const router = Router();

// State abbreviations for exact matching
const VALID_STATE_ABBRS = new Set(Object.keys(stateNames));

router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20')), 1), 50);

    if (!q || q.length < 2) {
      return res.json({ plans: [], carriers: [], locations: [] });
    }

    const ilikePat = `%${q}%`;
    const prefixPat = `${q}%`;
    const upperQ = q.toUpperCase();

    // Run all queries in parallel
    const [planResults, carrierResults, cityResults, zipResults] = await Promise.all([
      // Plans: search by name (ILIKE) or contract ID (exact prefix)
      db.select({
        id: plans.id,
        name: plans.name,
        carrier: plans.organizationName,
        state: plans.state,
        city: plans.county,
      })
        .from(plans)
        .where(sql`(${plans.name} ILIKE ${ilikePat} OR ${plans.contractId} LIKE ${prefixPat})`)
        .limit(limit),

      // Carriers: search by org name (ILIKE), grouped with plan count
      db.select({
        name: plans.organizationName,
        planCount: count().as('plan_count'),
      })
        .from(plans)
        .where(sql`${plans.organizationName} ILIKE ${ilikePat}`)
        .groupBy(plans.organizationName)
        .orderBy(desc(sql`count(*)`))
        .limit(limit),

      // Cities: search by city name (ILIKE)
      db.selectDistinct({
        city: plans.city,
        state: plans.state,
      })
        .from(plans)
        .where(sql`${plans.city} ILIKE ${ilikePat}`)
        .limit(limit),

      // Zipcodes: search by prefix
      db.selectDistinct({
        zipcode: plans.zipcode,
        city: plans.city,
        state: plans.state,
      })
        .from(plans)
        .where(sql`${plans.zipcode} LIKE ${prefixPat}`)
        .limit(limit),
    ]);

    // Build locations array from cities + zips + possible state match
    const locations: Array<{ type: 'state' | 'city' | 'zip'; name: string; state: string }> = [];

    // Check for exact state abbreviation match
    if (VALID_STATE_ABBRS.has(upperQ)) {
      locations.push({
        type: 'state',
        name: stateNames[upperQ] || upperQ,
        state: upperQ,
      });
    }

    // Add city results
    for (const c of cityResults) {
      if (c.city) {
        locations.push({ type: 'city', name: c.city, state: c.state });
      }
    }

    // Add zip results
    for (const z of zipResults) {
      if (z.zipcode) {
        locations.push({ type: 'zip', name: z.zipcode, state: z.state });
      }
    }

    res.json({
      plans: planResults,
      carriers: carrierResults.map(c => ({ name: c.name, planCount: Number(c.planCount) })),
      locations: locations.slice(0, limit),
    });
  } catch (error: any) {
    console.error("Search error:", error?.message || error);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
