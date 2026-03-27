/**
 * CMS Part D Formulary Data Import Script
 *
 * Imports CMS Part D formulary CSV files into the formulary_drugs table.
 *
 * Usage:
 *   1. Download Part D formulary files from CMS
 *   2. Extract CSV files to a local directory (e.g., ./formulary-data/)
 *      Files should be named like: H1234_formulary.csv or H1234.csv
 *      (contract ID extracted from the filename prefix before '_' or '.')
 *   3. Run: npx tsx scripts/import-formulary.ts ./formulary-data
 *
 * Key CSV columns expected:
 *   RXCUI, DRUG_NAME, TIER_LEVEL_VALUE, PRIOR_AUTHORIZATION,
 *   STEP_THERAPY, QUANTITY_LIMIT, FORMULARY_ID
 */

import "dotenv/config";
import { parse } from 'csv-parse/sync';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { formularyDrugs } from '../shared/schema';

const FORMULARY_DIR = process.argv[2] || './formulary-data';
const BATCH_SIZE = 500;
const CONTRACT_YEAR = parseInt(process.argv[3] || '2026', 10);

async function importFormulary() {
  console.log(`Importing formulary data from ${FORMULARY_DIR} (year: ${CONTRACT_YEAR})`);

  if (!existsSync(FORMULARY_DIR)) {
    console.error(`[error] Formulary data directory not found: ${FORMULARY_DIR}`);
    console.error('Usage: npx tsx scripts/import-formulary.ts ./formulary-data [year]');
    process.exit(1);
  }

  const files = readdirSync(FORMULARY_DIR).filter(f => f.toLowerCase().endsWith('.csv'));

  if (files.length === 0) {
    console.warn('[warn] No CSV files found in', FORMULARY_DIR);
    process.exit(0);
  }

  console.log(`[info] Found ${files.length} CSV files to process`);
  let totalImported = 0;

  for (const file of files) {
    // Extract contract ID from filename (e.g., "H1234_formulary.csv" -> "H1234")
    const contractId = file.split(/[_.]/)[0].toUpperCase();
    if (!contractId) {
      console.warn(`[warn] Could not extract contract ID from filename: ${file}, skipping`);
      continue;
    }

    const filepath = join(FORMULARY_DIR, file);
    console.log(`[info] Processing ${file} (contract: ${contractId})...`);

    let content: string;
    try {
      content = readFileSync(filepath, 'utf8');
    } catch (err: any) {
      console.warn(`[warn] Could not read ${filepath}: ${err.message}`);
      continue;
    }

    let records: Record<string, string>[];
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (err: any) {
      console.warn(`[warn] Could not parse ${file}: ${err.message}`);
      continue;
    }

    if (records.length === 0) {
      console.warn(`[warn] No records in ${file}`);
      continue;
    }

    let batch: any[] = [];
    let fileImported = 0;

    for (const record of records) {
      const rxcui = record.RXCUI?.trim();
      const drugName = record.DRUG_NAME?.trim();

      if (!rxcui || !drugName) continue;

      batch.push({
        contractId,
        formularyId: record.FORMULARY_ID?.trim() || '',
        rxcui,
        drugName,
        tier: parseInt(record.TIER_LEVEL_VALUE) || 1,
        priorAuthorization: record.PRIOR_AUTHORIZATION?.trim().toUpperCase() === 'Y',
        stepTherapy: record.STEP_THERAPY?.trim().toUpperCase() === 'Y',
        quantityLimit: record.QUANTITY_LIMIT?.trim().toUpperCase() === 'Y',
        contractYear: CONTRACT_YEAR,
      });

      if (batch.length >= BATCH_SIZE) {
        try {
          await db.insert(formularyDrugs).values(batch);
          fileImported += batch.length;
        } catch (err: any) {
          console.warn(`[warn] Insert batch failed for ${contractId}: ${err.message}`);
        }
        batch = [];
      }
    }

    if (batch.length > 0) {
      try {
        await db.insert(formularyDrugs).values(batch);
        fileImported += batch.length;
      } catch (err: any) {
        console.warn(`[warn] Insert final batch failed for ${contractId}: ${err.message}`);
      }
    }

    console.log(`[info] Imported ${fileImported} drugs for ${contractId}`);
    totalImported += fileImported;
  }

  console.log(`\nFormulary import complete. Total drugs imported: ${totalImported}`);
  process.exit(0);
}

importFormulary().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
