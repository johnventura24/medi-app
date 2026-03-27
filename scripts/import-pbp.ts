/**
 * PBP (Plan Benefit Package) Data Import Script
 *
 * Downloads and parses CMS Plan Benefit Package CSV files to populate
 * extended schema columns that are currently empty.
 *
 * Usage:
 *   1. Download PBP files from:
 *      https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data/benefits-data
 *   2. Extract CSV files to a local directory (e.g., ./pbp-data/)
 *   3. Run: npx tsx scripts/import-pbp.ts ./pbp-data
 *
 * PBP file mapping to schema columns:
 *   pbp_b13a_b13b_b13c_oe.csv  -> Dental benefits (dentalCoverageLimit, dentalPreventiveCovered, dentalComprehensiveCovered)
 *   pbp_b14a_b14b_oe.csv       -> Vision benefits (visionAllowance, visionExamCopay)
 *   pbp_b16a_otc.csv           -> OTC benefits (hasOtc, otcAmountPerQuarter)
 *   pbp_b18_partd.csv          -> Part D drug tiers (drugDeductible, tier copays/coinsurance)
 *   pbp_b1a_b1b_b1c_oop.csv   -> Deductibles, MOOP, Part B giveback (partbGiveback)
 */

import "dotenv/config";
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { plans } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

const PBP_DIR = process.argv[2] || './pbp-data';
const BATCH_SIZE = 100;

interface UpdateBatch {
  contractId: string;
  planId: string;
  updates: Record<string, any>;
}

async function processBatch(batch: UpdateBatch[]) {
  for (const item of batch) {
    await db.update(plans)
      .set(item.updates)
      .where(
        and(
          eq(plans.contractId, item.contractId),
          eq(plans.planId, item.planId)
        )
      );
  }
}

function readCsvFile(filename: string): Record<string, string>[] | null {
  const filepath = join(PBP_DIR, filename);
  if (!existsSync(filepath)) {
    console.warn(`[warn] File not found, skipping: ${filepath}`);
    return null;
  }
  console.log(`[info] Reading ${filepath}...`);
  const content = readFileSync(filepath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

async function importDental() {
  const records = readCsvFile('pbp_b13a_b13b_b13c_oe.csv');
  if (!records) return;

  console.log(`[dental] Processing ${records.length} rows...`);
  let batch: UpdateBatch[] = [];
  let processed = 0;

  for (const row of records) {
    const contractId = row.pbp_a_hnumber?.trim();
    const planId = row.pbp_a_plan_identifier?.trim();
    if (!contractId || !planId) continue;

    const hasDental = row.pbp_b13a_bendesc_yn?.trim().toUpperCase() === 'Y';
    const maxAmt = parseFloat(row.pbp_b13a_maxplan_amt) || null;
    const preventive = row.pbp_b13a_prev_yn?.trim().toUpperCase() === 'Y';
    const comprehensive = row.pbp_b13a_comp_yn?.trim().toUpperCase() === 'Y';

    batch.push({
      contractId,
      planId,
      updates: {
        dentalCoverageLimit: hasDental ? maxAmt : 0,
        dentalPreventiveCovered: preventive,
        dentalComprehensiveCovered: comprehensive,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      processed += batch.length;
      console.log(`[dental] ${processed} of ${records.length} rows processed`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
    processed += batch.length;
  }
  console.log(`[dental] Done. ${processed} rows processed.`);
}

async function importVision() {
  const records = readCsvFile('pbp_b14a_b14b_oe.csv');
  if (!records) return;

  console.log(`[vision] Processing ${records.length} rows...`);
  let batch: UpdateBatch[] = [];
  let processed = 0;

  for (const row of records) {
    const contractId = row.pbp_a_hnumber?.trim();
    const planId = row.pbp_a_plan_identifier?.trim();
    if (!contractId || !planId) continue;

    const hasVision = row.pbp_b14a_bendesc_yn?.trim().toUpperCase() === 'Y';
    const allowanceAmt = parseFloat(row.pbp_b14a_maxplan_amt) || null;
    const examCopay = parseFloat(row.pbp_b14a_copay_mc_min) || null;

    batch.push({
      contractId,
      planId,
      updates: {
        visionAllowance: hasVision ? allowanceAmt : 0,
        visionExamCopay: examCopay,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      processed += batch.length;
      console.log(`[vision] ${processed} of ${records.length} rows processed`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
    processed += batch.length;
  }
  console.log(`[vision] Done. ${processed} rows processed.`);
}

async function importOTC() {
  const records = readCsvFile('pbp_b16a_otc.csv');
  if (!records) return;

  console.log(`[otc] Processing ${records.length} rows...`);
  let batch: UpdateBatch[] = [];
  let processed = 0;

  for (const row of records) {
    const contractId = row.pbp_a_hnumber?.trim();
    const planId = row.pbp_a_plan_identifier?.trim();
    if (!contractId || !planId) continue;

    const hasOtc = row.pbp_b16a_bendesc_yn?.trim().toUpperCase() === 'Y';
    const maxAmt = parseFloat(row.pbp_b16a_maxplan_amt) || null;
    const frequency = row.pbp_b16a_per_desc?.trim().toLowerCase() || '';

    // Normalize to quarterly amount
    let quarterlyAmount = maxAmt;
    if (maxAmt) {
      if (frequency.includes('month')) {
        quarterlyAmount = maxAmt * 3;
      } else if (frequency.includes('annual') || frequency.includes('year')) {
        quarterlyAmount = maxAmt / 4;
      }
      // quarterly stays as-is
    }

    batch.push({
      contractId,
      planId,
      updates: {
        hasOtc,
        otcAmountPerQuarter: hasOtc ? quarterlyAmount : null,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      processed += batch.length;
      console.log(`[otc] ${processed} of ${records.length} rows processed`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
    processed += batch.length;
  }
  console.log(`[otc] Done. ${processed} rows processed.`);
}

async function importPartBGiveback() {
  const records = readCsvFile('pbp_b1a_b1b_b1c_oop.csv');
  if (!records) return;

  console.log(`[partb-giveback] Processing ${records.length} rows...`);
  let batch: UpdateBatch[] = [];
  let processed = 0;

  for (const row of records) {
    const contractId = row.pbp_a_hnumber?.trim();
    const planId = row.pbp_a_plan_identifier?.trim();
    if (!contractId || !planId) continue;

    const giveback = parseFloat(row.pbp_b1a_partb_red_amt) || null;

    batch.push({
      contractId,
      planId,
      updates: {
        partbGiveback: giveback,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      processed += batch.length;
      console.log(`[partb-giveback] ${processed} of ${records.length} rows processed`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
    processed += batch.length;
  }
  console.log(`[partb-giveback] Done. ${processed} rows processed.`);
}

async function importDrugTiers() {
  const records = readCsvFile('pbp_b18_partd.csv');
  if (!records) return;

  console.log(`[drug-tiers] Processing ${records.length} rows...`);
  let batch: UpdateBatch[] = [];
  let processed = 0;

  for (const row of records) {
    const contractId = row.pbp_a_hnumber?.trim();
    const planId = row.pbp_a_plan_identifier?.trim();
    if (!contractId || !planId) continue;

    const updates: Record<string, any> = {};

    // Drug deductible
    const deductible = parseFloat(row.pbp_b18_partd_deductible);
    if (!isNaN(deductible)) updates.drugDeductible = deductible;

    // Tier 1 (preferred generic)
    const t1pref = parseFloat(row.pbp_b18_t1_copay_pref);
    if (!isNaN(t1pref)) updates.tier1CopayPreferred = t1pref;
    const t1std = parseFloat(row.pbp_b18_t1_copay_std);
    if (!isNaN(t1std)) updates.tier1CopayStandard = t1std;

    // Tier 2 (generic)
    const t2pref = parseFloat(row.pbp_b18_t2_copay_pref);
    if (!isNaN(t2pref)) updates.tier2CopayPreferred = t2pref;
    const t2std = parseFloat(row.pbp_b18_t2_copay_std);
    if (!isNaN(t2std)) updates.tier2CopayStandard = t2std;

    // Tier 3 (preferred brand)
    const t3pref = parseFloat(row.pbp_b18_t3_copay_pref);
    if (!isNaN(t3pref)) updates.tier3CopayPreferred = t3pref;
    const t3std = parseFloat(row.pbp_b18_t3_copay_std);
    if (!isNaN(t3std)) updates.tier3CopayStandard = t3std;

    // Tier 4 (non-preferred brand) - coinsurance
    const t4pref = parseFloat(row.pbp_b18_t4_coins_pref);
    if (!isNaN(t4pref)) updates.tier4CoinsurancePreferred = t4pref;
    const t4std = parseFloat(row.pbp_b18_t4_coins_std);
    if (!isNaN(t4std)) updates.tier4CoinsuranceStandard = t4std;

    // Tier 5 (specialty) - coinsurance
    const t5pref = parseFloat(row.pbp_b18_t5_coins_pref);
    if (!isNaN(t5pref)) updates.tier5CoinsurancePreferred = t5pref;
    const t5std = parseFloat(row.pbp_b18_t5_coins_std);
    if (!isNaN(t5std)) updates.tier5CoinsuranceStandard = t5std;

    if (Object.keys(updates).length === 0) continue;

    batch.push({ contractId, planId, updates });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      processed += batch.length;
      console.log(`[drug-tiers] ${processed} of ${records.length} rows processed`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await processBatch(batch);
    processed += batch.length;
  }
  console.log(`[drug-tiers] Done. ${processed} rows processed.`);
}

async function importPBP() {
  console.log(`Importing PBP data from ${PBP_DIR}`);

  if (!existsSync(PBP_DIR)) {
    console.error(`[error] PBP data directory not found: ${PBP_DIR}`);
    console.error('Usage: npx tsx scripts/import-pbp.ts ./pbp-data');
    process.exit(1);
  }

  await importDental();
  await importVision();
  await importOTC();
  await importPartBGiveback();
  await importDrugTiers();

  console.log('PBP import complete');
  process.exit(0);
}

importPBP().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
