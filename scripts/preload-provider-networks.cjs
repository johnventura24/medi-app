/**
 * Pre-load provider network data for major carriers.
 *
 * Strategy:
 *   1. Try FHIR bulk queries per carrier per state (real data)
 *   2. Fall back to cross-referencing provider_quality + plans tables
 *      to create "inferred" entries for top carriers per state
 *
 * Usage:  node scripts/preload-provider-networks.cjs
 */
const { Pool } = require('pg');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// ── FHIR endpoints for major carriers ──
const CARRIER_FHIR = {
  'UnitedHealthcare': 'https://public.fhir.flex.optum.com/R4',
  'Humana': 'https://fhir.humana.com/api',
  'Aetna': 'https://vteapif1.aetna.com/fhirdirectory/v2',
  'Anthem': 'https://antm-ssp-fhir.optum.com/R4',
  'Cigna': 'https://provider-directory.cigna.com/api/1/fhir',
  'Blue Cross Blue Shield': 'https://fhir.bcbs.com',
  'Centene': 'https://fhir.centene.com',
  'Molina': 'https://fhir.molinahealthcare.com',
};

// Medicare-relevant specialties for inference
const MEDICARE_SPECIALTIES = new Set([
  'Internal Medicine', 'Family Medicine', 'Family Practice',
  'General Practice', 'Geriatric Medicine', 'Geriatric Psychiatry',
  'Cardiology', 'Pulmonary Disease', 'Endocrinology',
  'Nephrology', 'Rheumatology', 'Oncology', 'Hematology/Oncology',
  'Neurology', 'Orthopedic Surgery', 'Ophthalmology',
  'Optometry', 'Podiatry', 'Dermatology',
  'Psychiatry', 'Physical Medicine and Rehabilitation',
  'Gastroenterology', 'Urology', 'General Surgery',
  'Nurse Practitioner', 'Physician Assistant',
  'Preventive Medicine', 'Hospice and Palliative Medicine',
]);

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','VI','GU',
];

// Rate limiting helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Try FHIR bulk query for a carrier + state.
 * Returns array of NPIs found, or null if the endpoint fails.
 */
async function tryFhirBulk(carrierName, fhirBase, state) {
  const url = `${fhirBase}/Practitioner?_count=100&address-state=${state}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/fhir+json, application/json' },
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.resourceType !== 'Bundle' || !data.entry) return null;

    const npis = [];
    for (const entry of data.entry) {
      const resource = entry.resource;
      if (!resource || resource.resourceType !== 'Practitioner') continue;

      // Extract NPI from identifiers
      const identifiers = resource.identifier || [];
      for (const id of identifiers) {
        if (id.system === 'http://hl7.org/fhir/sid/us-npi' && id.value) {
          npis.push(id.value);
          break;
        }
      }
    }
    return npis.length > 0 ? npis : null;
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Insert batch of provider_network_cache rows via upsert.
 */
async function insertBatch(pool, rows) {
  if (rows.length === 0) return 0;

  // Build multi-row VALUES clause
  const values = [];
  const params = [];
  let idx = 1;
  for (const row of rows) {
    values.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, NOW())`);
    params.push(row.npi, row.carrier, row.contractId, row.inNetwork, row.source);
    idx += 5;
  }

  const sql = `
    INSERT INTO provider_network_cache (npi, carrier, contract_id, in_network, source, verified_at)
    VALUES ${values.join(',\n')}
    ON CONFLICT (npi, carrier, contract_id)
    DO UPDATE SET
      in_network = CASE
        WHEN provider_network_cache.source = 'FHIR API' AND EXCLUDED.source = 'inferred' THEN provider_network_cache.in_network
        ELSE EXCLUDED.in_network
      END,
      source = CASE
        WHEN provider_network_cache.source = 'FHIR API' AND EXCLUDED.source = 'inferred' THEN provider_network_cache.source
        ELSE EXCLUDED.source
      END,
      verified_at = CASE
        WHEN provider_network_cache.source = 'FHIR API' AND EXCLUDED.source = 'inferred' THEN provider_network_cache.verified_at
        ELSE NOW()
      END
  `;

  try {
    const result = await pool.query(sql, params);
    return result.rowCount;
  } catch (err) {
    // If batch too large or error, try smaller batches
    if (rows.length > 100) {
      const mid = Math.floor(rows.length / 2);
      const a = await insertBatch(pool, rows.slice(0, mid));
      const b = await insertBatch(pool, rows.slice(mid));
      return a + b;
    }
    console.error(`  Insert error: ${err.message}`);
    return 0;
  }
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    // Check current state
    const { rows: countRows } = await pool.query('SELECT count(*) as cnt FROM provider_network_cache');
    console.log(`Current provider_network_cache rows: ${countRows[0].cnt}`);

    // ── Phase 1: Try FHIR bulk queries ──
    console.log('\n=== Phase 1: FHIR Bulk Queries ===');
    let fhirTotal = 0;
    const fhirSuccessCarriers = new Set();

    // Test each carrier with a few states first
    const testStates = ['FL', 'TX', 'CA', 'NY', 'OH'];
    for (const [carrier, base] of Object.entries(CARRIER_FHIR)) {
      console.log(`\nTrying FHIR for ${carrier}...`);
      let carrierWorked = false;

      for (const state of testStates) {
        const npis = await tryFhirBulk(carrier, base, state);
        await sleep(1000); // Rate limit

        if (npis && npis.length > 0) {
          console.log(`  ${carrier} / ${state}: Found ${npis.length} NPIs via FHIR`);
          carrierWorked = true;
          fhirSuccessCarriers.add(carrier);

          const rows = npis.map(npi => ({
            npi,
            carrier,
            contractId: null, // null for carrier-level verification
            inNetwork: true,
            source: 'FHIR_bulk',
          }));
          const inserted = await insertBatch(pool, rows);
          fhirTotal += inserted;
        } else {
          console.log(`  ${carrier} / ${state}: FHIR returned no data`);
        }
      }

      // If carrier worked on test states, query all states
      if (carrierWorked) {
        console.log(`  ${carrier} FHIR works! Querying remaining states...`);
        const remainingStates = US_STATES.filter(s => !testStates.includes(s));
        for (const state of remainingStates) {
          const npis = await tryFhirBulk(carrier, base, state);
          await sleep(1000); // Rate limit

          if (npis && npis.length > 0) {
            const rows = npis.map(npi => ({
              npi,
              carrier,
              contractId: null,
              inNetwork: true,
              source: 'FHIR_bulk',
            }));
            const inserted = await insertBatch(pool, rows);
            fhirTotal += inserted;
            if (fhirTotal % 500 === 0) {
              console.log(`  ... ${fhirTotal} FHIR records inserted so far`);
            }
          }
        }
      }
    }

    console.log(`\nFHIR Phase complete. ${fhirTotal} records from FHIR endpoints.`);
    console.log(`FHIR-working carriers: ${[...fhirSuccessCarriers].join(', ') || 'none'}`);

    // ── Phase 2: Cross-reference inference ──
    console.log('\n=== Phase 2: Cross-Reference Inference ===');

    // Diagnostic: check what specialties exist
    const { rows: specSamples } = await pool.query(`
      SELECT specialty, count(*) as cnt
      FROM provider_quality
      WHERE specialty IS NOT NULL
      GROUP BY specialty
      ORDER BY cnt DESC
      LIMIT 30
    `);
    console.log('Top specialties in provider_quality:');
    for (const s of specSamples) {
      console.log(`  "${s.specialty}": ${s.cnt}`);
    }

    const { rows: stateSamples } = await pool.query(`
      SELECT state, count(*) as cnt
      FROM provider_quality
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY cnt DESC
      LIMIT 10
    `);
    console.log('\nTop states in provider_quality:');
    for (const s of stateSamples) {
      console.log(`  ${s.state}: ${s.cnt}`);
    }

    // Get top carriers per state by plan count
    console.log('\nFetching top carriers per state...');
    const { rows: carriersByState } = await pool.query(`
      WITH state_totals AS (
        SELECT state, COUNT(*) as total_plans
        FROM plans
        GROUP BY state
      ),
      carrier_counts AS (
        SELECT
          p.state,
          p.organization_name as carrier,
          COUNT(*) as plan_count,
          st.total_plans
        FROM plans p
        JOIN state_totals st ON p.state = st.state
        GROUP BY p.state, p.organization_name, st.total_plans
      )
      SELECT
        state,
        carrier,
        plan_count,
        total_plans,
        ROUND(100.0 * plan_count / total_plans, 1) as market_pct
      FROM carrier_counts
      WHERE plan_count >= 3
      ORDER BY state, plan_count DESC
    `);

    // Group by state, keep top carriers (those with >= 5% market share)
    const topCarriersByState = {};
    for (const row of carriersByState) {
      const pct = parseFloat(row.market_pct);
      if (pct < 5) continue;
      if (!topCarriersByState[row.state]) topCarriersByState[row.state] = [];
      topCarriersByState[row.state].push({
        carrier: row.carrier,
        marketPct: pct,
        planCount: parseInt(row.plan_count),
      });
    }

    const states = Object.keys(topCarriersByState).sort();
    console.log(`Found carriers in ${states.length} states to process`);

    let inferredTotal = 0;
    const BATCH_SIZE = 500;

    for (const state of states) {
      const carriers = topCarriersByState[state];
      if (!carriers || carriers.length === 0) continue;

      // Get Medicare-relevant providers in this state
      const { rows: providers } = await pool.query(`
        SELECT npi, specialty
        FROM provider_quality
        WHERE state = $1
          AND specialty IS NOT NULL
        ORDER BY npi
      `, [state]);

      // Filter to Medicare-relevant specialties (case-insensitive, partial match)
      const medicareSpecLower = [...MEDICARE_SPECIALTIES].map(s => s.toLowerCase());
      const relevantProviders = providers.filter(p => {
        if (!p.specialty) return false;
        const specLower = p.specialty.toLowerCase().trim();
        return medicareSpecLower.some(ms => specLower.includes(ms) || ms.includes(specLower));
      });

      if (relevantProviders.length === 0) {
        if (states.indexOf(state) === 0) {
          // Extra debug for first state
          console.log(`  ${state}: ${providers.length} total providers, 0 matched specialties`);
          if (providers.length > 0) {
            const specSet = new Set(providers.slice(0, 200).map(p => p.specialty));
            console.log(`  Sample specialties: ${[...specSet].slice(0, 10).join(', ')}`);
          }
        }
        continue;
      }
      console.log(`  ${state}: ${relevantProviders.length} relevant providers (of ${providers.length} total)`);

      // For each top carrier in this state, create inferred entries
      for (const { carrier, marketPct } of carriers) {
        // Skip if we already got FHIR data for this carrier
        // (FHIR data is better; our upsert preserves it, but let's not waste time)

        // For very large carriers (>15% share), use all relevant providers
        // For medium carriers (5-15%), use only PCP specialties
        let providerSubset;
        if (marketPct >= 15) {
          providerSubset = relevantProviders;
        } else {
          // Only PCPs for smaller carriers
          const pcpSpecsLower = [
            'internal medicine', 'family medicine', 'family practice',
            'general practice', 'geriatric medicine',
            'nurse practitioner', 'physician assistant',
          ];
          providerSubset = relevantProviders.filter(p => {
            const sl = (p.specialty || '').toLowerCase().trim();
            return pcpSpecsLower.some(ps => sl.includes(ps) || ps.includes(sl));
          });
        }

        if (providerSubset.length === 0) continue;

        // Cap at 2000 providers per carrier-state to keep DB reasonable
        const capped = providerSubset.slice(0, 2000);

        // Build batch
        let batch = [];
        for (const provider of capped) {
          batch.push({
            npi: provider.npi,
            carrier: carrier,
            contractId: null,
            inNetwork: null, // NOT claiming in-network, just creating the association
            source: 'inferred',
          });

          if (batch.length >= BATCH_SIZE) {
            const inserted = await insertBatch(pool, batch);
            inferredTotal += inserted;
            batch = [];
          }
        }

        // Flush remaining
        if (batch.length > 0) {
          const inserted = await insertBatch(pool, batch);
          inferredTotal += inserted;
        }
      }

      if (states.indexOf(state) % 10 === 0 || state === states[states.length - 1]) {
        console.log(`  Processed ${state} (${states.indexOf(state) + 1}/${states.length}) - ${inferredTotal} inferred records total`);
      }
    }

    console.log(`\nInference Phase complete. ${inferredTotal} inferred records.`);

    // ── Summary ──
    const { rows: finalCount } = await pool.query('SELECT count(*) as cnt FROM provider_network_cache');
    const { rows: sourceCounts } = await pool.query(`
      SELECT source, in_network, count(*) as cnt
      FROM provider_network_cache
      GROUP BY source, in_network
      ORDER BY source, in_network
    `);

    console.log('\n=== Final Summary ===');
    console.log(`Total provider_network_cache rows: ${finalCount[0].cnt}`);
    console.log('Breakdown by source/in_network:');
    for (const row of sourceCounts) {
      console.log(`  source=${row.source}, in_network=${row.in_network}: ${row.cnt}`);
    }

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
