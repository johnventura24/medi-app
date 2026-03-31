const pg = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
  max: 10
});

// Period codes from CMS PBP spec
// 1=per day, 2=per week, 3=per year/annual, 4=per 2 years, 5=per quarter, 6=per half year, 7=per month
function periodToFreq(code) {
  switch (String(code)) {
    case '1': return 'per_benefit_period'; // per benefit period / per occurrence (typically annual)
    case '2': return 'weekly';
    case '3': return 'annually';
    case '4': return 'every_2_years';
    case '5': return 'quarterly';
    case '6': return 'semi-annually';
    case '7': return 'monthly';
    default: return null;
  }
}

function toQuarterly(amount, periodCode) {
  if (!amount || amount <= 0) return null;
  const freq = periodToFreq(periodCode);
  switch (freq) {
    case 'per_benefit_period': return Math.round(amount / 4 * 100) / 100; // treat as annual
    case 'weekly': return Math.round(amount * 13 * 100) / 100;
    case 'annually': return Math.round(amount / 4 * 100) / 100;
    case 'every_2_years': return Math.round(amount / 8 * 100) / 100;
    case 'quarterly': return Math.round(amount * 100) / 100;
    case 'semi-annually': return Math.round(amount / 2 * 100) / 100;
    case 'monthly': return Math.round(amount * 3 * 100) / 100;
    default: return Math.round(amount * 100) / 100; // fallback: treat as-is
  }
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function safeGet(obj, pathStr) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[p];
  }
  return cur;
}

function extractBenefits(json, contractId, planId) {
  const result = {
    contractId,
    planId,
    partbGiveback: null,
    otcAmountPerQuarter: null,
    flexCardAmount: null,
    flexCardFrequency: null,
    mealBenefitAmount: null,
    groceryAllowanceAmount: null,
    groceryAllowanceFrequency: null,
    hasDebitCard: false,
    combGroups: []
  };

  const pbp = json.pbp ? json.pbp[0] : null;
  if (!pbp) return result;

  // 1. Part B Giveback
  const partBAmount = safeGet(pbp, 'planLevelCostSharing.planLevelCostSharingDetails.csbPartBPrmReducAmt');
  result.partbGiveback = num(partBAmount);

  // 2. Combined Supplemental Benefits
  const combDetails = safeGet(pbp, 'costShareGroups.combinedSupplementalBenefits.combinedSupplementalBenefitsDetails');
  const combGroups = combDetails ? combDetails.combNetworkGroupData : null;

  if (combGroups && Array.isArray(combGroups)) {
    for (const group of combGroups) {
      const name = (group.combGroupName || '').toLowerCase();
      const codes = (group.nonMedCovBenCombSupp || '').toLowerCase();
      const amount = num(group.maxPlanBenCovAmnt);
      const periodCode = group.combSuppBenMaxAmntPrdty;
      const freq = periodToFreq(periodCode);
      const deliveryMode = group.combSuppBenModeDev; // 1=DebitCard, 2=Catalogue, 3=Claims, 5=Other

      result.combGroups.push({
        name: group.combGroupName,
        codes,
        amount,
        periodCode,
        freq,
        deliveryMode
      });

      if (!amount || amount <= 0) continue;

      const codeList = codes.split(',').map(c => c.trim());
      const hasOtc = codeList.includes('13b');
      const hasMeals = codeList.includes('13c');
      const hasGrocery = codeList.includes('19b3');
      const hasHearing = codeList.includes('18c');
      const hasTransport = codeList.some(c => c.startsWith('10b'));

      // Determine if this is a flex/OTC/grocery combined card
      // Must contain OTC (13b) or grocery (19b3) to be considered flex-like
      // Pure dental or hearing groups are NOT flex cards
      const isDentalOnly = codeList.every(c => c.startsWith('16'));
      const isHearingOnly = codeList.every(c => c.startsWith('18'));
      const isFlexLike = !isDentalOnly && !isHearingOnly && (
                          (hasOtc && (hasGrocery || hasHearing || hasMeals)) ||
                          (name.includes('healthy option') && hasOtc) ||
                          (name.includes('flex') && hasOtc) ||
                          (name.includes('otc') && (hasGrocery || hasMeals))
                         );

      // If it's an OTC-only group (with or without hearing aids bundled)
      if (hasOtc && !hasGrocery && !hasMeals && !name.includes('flex') && !name.includes('healthy option')) {
        // Pure OTC allowance
        const quarterly = toQuarterly(amount, periodCode);
        if (quarterly !== null && (result.otcAmountPerQuarter === null || quarterly > result.otcAmountPerQuarter)) {
          result.otcAmountPerQuarter = quarterly;
        }
      }

      // If it's a combined flex-like card (OTC + grocery + hearing etc)
      if (isFlexLike) {
        // This is a flex card / healthy options allowance
        if (result.flexCardAmount === null || amount > result.flexCardAmount) {
          result.flexCardAmount = amount;
          result.flexCardFrequency = freq || 'see_eoc';
        }
        // Also derive OTC quarterly from this if no pure OTC found
        if (hasOtc && result.otcAmountPerQuarter === null) {
          // Use the combined amount as the OTC amount too (they share the allowance)
          const quarterly = toQuarterly(amount, periodCode);
          if (quarterly !== null) {
            result.otcAmountPerQuarter = quarterly;
          }
        }
      }

      // Grocery-only group
      if (hasGrocery && !hasOtc && !hasMeals) {
        if (result.groceryAllowanceAmount === null || amount > result.groceryAllowanceAmount) {
          result.groceryAllowanceAmount = amount;
          result.groceryAllowanceFrequency = freq || 'see_eoc';
        }
      }

      // Meals included in a combined group
      if (hasMeals) {
        // Meals are in a combined group; note the group amount
        // We'll record meal benefit from the individual section below if available
      }

      // Delivery mode: 1 = DebitCard
      if (deliveryMode === '1' || deliveryMode === 1) {
        result.hasDebitCard = true;
      }
    }
  }

  // 3. Check individual benefit sections for meals/OTC if not found in combined
  const costShareGroups = safeGet(pbp, 'costShareGroups');
  if (costShareGroups) {
    // Look through nonMedicareServices or supplementalBenefits
    const sections = [
      safeGet(costShareGroups, 'nonMedicareServices'),
      safeGet(costShareGroups, 'supplementalBenefits')
    ];

    for (const section of sections) {
      if (!section || !Array.isArray(section)) continue;
      for (const item of section) {
        const catCode = (item.categoryCode || '').toLowerCase();
        const details = item.benefitDetails || item.costShareDetails || {};

        // OTC from individual 13b section
        if (catCode === '13b' && result.otcAmountPerQuarter === null) {
          const otcComp = details.DrugsOnCMSOTCListComponent || {};
          // Check for max plan benefit coverage
          const maxComp = details.MaximumPlanBenefitCoverageComponent || {};
          const amt = num(maxComp.bdMaxPlanBenefitCovAmt);
          const per = maxComp.bdMaxPlanBenefitCovAmtPrdty;
          if (amt && amt > 0) {
            result.otcAmountPerQuarter = toQuarterly(amt, per);
          }
        }

        // Meal benefits from 13c section
        if (catCode === '13c') {
          const mealComp = details.MealBenefitsComponent || {};
          const maxComp = details.MaximumPlanBenefitCoverageComponent || {};
          const amt = num(maxComp.bdMaxPlanBenefitCovAmt);
          if (amt && amt > 0 && (result.mealBenefitAmount === null || amt > result.mealBenefitAmount)) {
            result.mealBenefitAmount = amt;
          }
        }
      }
    }
  }

  // 4. Also scan vbid sections for additional benefit amounts
  const vbid = safeGet(pbp, 'costShareGroups.vbidAdditionalBenefits');
  if (vbid && Array.isArray(vbid)) {
    for (const vbidItem of vbid) {
      const packages = vbidItem.vbidAdditionalBenefitPackages || [];
      for (const pkg of packages) {
        const pkgName = (pkg.vbidAbpPackageName || '').toLowerCase();
        const catItems = pkg.vbidAbpCostShareGroupData || [];
        for (const catItem of catItems) {
          const catCode = (catItem.categoryCode || '').toLowerCase();
          const innDetails = catItem.inNetworkDetails || {};

          // Look through all components for MaximumPlanBenefitCoverage
          if (innDetails && typeof innDetails === 'object') {
            for (const compKey of Object.keys(innDetails)) {
              const comp = innDetails[compKey];
              if (comp && typeof comp === 'object') {
                const maxComp = comp.MaximumPlanBenefitCoverageComponent || {};
                const amt = num(maxComp.bdMaxPlanBenefitCovAmt);
                const per = maxComp.bdMaxPlanBenefitCovAmtPrdty;

                if (amt && amt > 0) {
                  if (catCode === '13b' && result.otcAmountPerQuarter === null) {
                    result.otcAmountPerQuarter = toQuarterly(amt, per);
                  }
                  if (catCode === '13c' && (result.mealBenefitAmount === null || amt > result.mealBenefitAmount)) {
                    result.mealBenefitAmount = amt;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return result;
}

async function main() {
  console.log('=== PARSE PBP JSON FILES FOR REAL SUPPLEMENTAL BENEFIT AMOUNTS ===\n');

  const zipPath = '/tmp/pbp-data/pbp-benefits-2026-json.zip';
  const extractDir = '/tmp/pbp-json-extracted';

  // Step 1: Extract ZIP
  console.log('Step 1: Extracting ZIP file...');
  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir, { recursive: true });
  }

  // Check if already extracted
  const existingFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.json'));
  if (existingFiles.length < 100) {
    console.log('  Extracting from ZIP...');
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { maxBuffer: 200 * 1024 * 1024 });
    console.log('  Extraction complete.');
  } else {
    console.log(`  Already extracted (${existingFiles.length} files found).`);
  }

  const jsonFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.json'));
  console.log(`  Found ${jsonFiles.length} JSON files.\n`);

  // Step 2: Clear existing amounts
  console.log('Step 2: Clearing existing supplemental amounts...');
  const clearResult = await pool.query(`
    UPDATE plans SET
      partb_giveback = NULL,
      otc_amount_per_quarter = NULL,
      flex_card_amount = NULL,
      flex_card_frequency = NULL,
      meal_benefit_amount = NULL,
      grocery_allowance_amount = NULL,
      grocery_allowance_frequency = NULL
    WHERE 1=1
  `);
  console.log(`  Cleared amounts on ${clearResult.rowCount} plans.\n`);

  // Step 3: Process JSON files in batches
  console.log('Step 3: Processing JSON files...');

  let processed = 0;
  let partbCount = 0;
  let otcCount = 0;
  let flexCount = 0;
  let mealCount = 0;
  let groceryCount = 0;
  let updateCount = 0;
  let errorCount = 0;
  let noMatchCount = 0;

  const BATCH_SIZE = 50;
  const updates = [];

  for (let i = 0; i < jsonFiles.length; i++) {
    const filename = jsonFiles[i];
    // Parse contract/plan from filename: H1036-818-000-2026.json
    const match = filename.match(/^([A-Za-z]\d{4})-(\d{3})-(\d{3})-(\d{4})\.json$/);
    if (!match) {
      errorCount++;
      if (errorCount <= 5) console.log(`  WARNING: Unrecognized filename: ${filename}`);
      processed++;
      continue;
    }

    const contractId = match[1];
    const planId = match[2];
    const segmentId = match[3];

    try {
      const filePath = path.join(extractDir, filename);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(raw);

      const benefits = extractBenefits(json, contractId, planId);

      // Only update if we found something
      const hasData = benefits.partbGiveback !== null ||
                      benefits.otcAmountPerQuarter !== null ||
                      benefits.flexCardAmount !== null ||
                      benefits.mealBenefitAmount !== null ||
                      benefits.groceryAllowanceAmount !== null;

      if (hasData) {
        updates.push(benefits);

        if (benefits.partbGiveback !== null) partbCount++;
        if (benefits.otcAmountPerQuarter !== null) otcCount++;
        if (benefits.flexCardAmount !== null) flexCount++;
        if (benefits.mealBenefitAmount !== null) mealCount++;
        if (benefits.groceryAllowanceAmount !== null) groceryCount++;
      }
    } catch (err) {
      errorCount++;
      if (errorCount <= 10) console.log(`  ERROR parsing ${filename}: ${err.message}`);
    }

    processed++;
    if (processed % 500 === 0) {
      console.log(`  Processed ${processed} of ${jsonFiles.length} files (${updates.length} with data so far)...`);
    }

    // Execute batch updates
    if (updates.length >= BATCH_SIZE) {
      await flushUpdates(updates);
      updateCount += updates.length;
      updates.length = 0;
    }
  }

  // Flush remaining
  if (updates.length > 0) {
    await flushUpdates(updates);
    updateCount += updates.length;
    updates.length = 0;
  }

  console.log(`\n  Processing complete: ${processed} files processed.\n`);

  // Step 4: Summary
  console.log('=== RESULTS ===');
  console.log(`  Total JSON files:          ${jsonFiles.length}`);
  console.log(`  Files with benefit data:   ${updateCount}`);
  console.log(`  Part B Giveback amounts:   ${partbCount}`);
  console.log(`  OTC amounts:               ${otcCount}`);
  console.log(`  Flex card amounts:         ${flexCount}`);
  console.log(`  Meal benefit amounts:      ${mealCount}`);
  console.log(`  Grocery amounts:           ${groceryCount}`);
  console.log(`  Parse errors:              ${errorCount}`);

  // Verify
  console.log('\n=== VERIFICATION ===');
  const verify = await pool.query(`
    SELECT
      COUNT(*) AS total_plans,
      COUNT(partb_giveback) AS with_partb,
      COUNT(otc_amount_per_quarter) AS with_otc,
      COUNT(flex_card_amount) AS with_flex,
      COUNT(meal_benefit_amount) AS with_meals,
      COUNT(grocery_allowance_amount) AS with_grocery,
      ROUND(AVG(partb_giveback)::numeric, 2) AS avg_partb,
      ROUND(AVG(otc_amount_per_quarter)::numeric, 2) AS avg_otc_q,
      ROUND(AVG(flex_card_amount)::numeric, 2) AS avg_flex,
      ROUND(AVG(meal_benefit_amount)::numeric, 2) AS avg_meal,
      ROUND(MAX(partb_giveback)::numeric, 2) AS max_partb,
      ROUND(MAX(otc_amount_per_quarter)::numeric, 2) AS max_otc_q,
      ROUND(MAX(flex_card_amount)::numeric, 2) AS max_flex
    FROM plans
  `);
  console.log('  Database state after update:');
  const v = verify.rows[0];
  console.log(`    Total plans:     ${v.total_plans}`);
  console.log(`    With Part B:     ${v.with_partb} (avg $${v.avg_partb}/mo, max $${v.max_partb}/mo)`);
  console.log(`    With OTC:        ${v.with_otc} (avg $${v.avg_otc_q}/qtr, max $${v.max_otc_q}/qtr)`);
  console.log(`    With Flex Card:  ${v.with_flex} (avg $${v.avg_flex}, max $${v.max_flex})`);
  console.log(`    With Meals:      ${v.with_meals} (avg $${v.avg_meal})`);
  console.log(`    With Grocery:    ${v.with_grocery}`);

  // Sample some plans with flex amounts
  const samples = await pool.query(`
    SELECT DISTINCT contract_id, plan_id,
           partb_giveback, otc_amount_per_quarter,
           flex_card_amount, flex_card_frequency,
           meal_benefit_amount, grocery_allowance_amount
    FROM plans
    WHERE flex_card_amount IS NOT NULL
    ORDER BY flex_card_amount DESC
    LIMIT 10
  `);
  console.log('\n  Top 10 plans by flex card amount:');
  for (const s of samples.rows) {
    console.log(`    ${s.contract_id}-${s.plan_id}: $${s.flex_card_amount} ${s.flex_card_frequency || ''} | OTC/qtr: $${s.otc_amount_per_quarter || 'N/A'} | Part B: $${s.partb_giveback || 'N/A'}`);
  }

  await pool.end();
  console.log('\nDone.');
}

async function flushUpdates(updates) {
  // Build a single batch of UPDATE queries using a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query(`
        UPDATE plans SET
          partb_giveback = COALESCE($1, partb_giveback),
          otc_amount_per_quarter = COALESCE($2, otc_amount_per_quarter),
          flex_card_amount = COALESCE($3, flex_card_amount),
          flex_card_frequency = COALESCE($4, flex_card_frequency),
          meal_benefit_amount = COALESCE($5, meal_benefit_amount),
          grocery_allowance_amount = COALESCE($6, grocery_allowance_amount),
          grocery_allowance_frequency = COALESCE($7, grocery_allowance_frequency)
        WHERE contract_id = $8 AND plan_id = $9
      `, [
        u.partbGiveback,
        u.otcAmountPerQuarter,
        u.flexCardAmount,
        u.flexCardFrequency,
        u.mealBenefitAmount,
        u.groceryAllowanceAmount,
        u.groceryAllowanceFrequency,
        u.contractId,
        u.planId
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log(`  ERROR in batch update: ${err.message}`);
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
