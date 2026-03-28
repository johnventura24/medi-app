/**
 * Import CMS 2025 Star Ratings into the plans table.
 * Source: 2025 Star Ratings Data Table - Summary Ratings (Dec 2 2024).csv
 *
 * Updates overall_star_rating, and adds partc_star_rating / partd_star_rating columns.
 */
const { Pool } = require('pg');
const fs = require('fs');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

function parseCSVLine(line) {
  // Handle quoted CSV fields
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseRating(val) {
  if (!val || val === 'Not Applicable' || val === 'Not enough data available' || val === 'Plan too new to be measured' || val === 'N/A' || val === '') {
    return null;
  }
  const n = parseFloat(val);
  return (isFinite(n) && n >= 1 && n <= 5) ? n : null;
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    console.log('[Star Ratings] Reading Summary Ratings CSV...');
    const data = fs.readFileSync('/tmp/star_ratings/2025 Star Ratings Data Table - Summary Ratings (Dec 2 2024).csv', 'utf8');
    const lines = data.split('\n').filter(l => l.trim());

    // First line is title, second line is actual header
    // Header: Contract Number,Organization Type,Contract Name,...,2025 Part C Summary,2025 Part D Summary,2025 Overall
    console.log('[Star Ratings] Title:', lines[0].substring(0, 80));
    console.log('[Star Ratings] Header:', lines[1].substring(0, 200));

    const header = parseCSVLine(lines[1]);
    console.log('[Star Ratings] Columns:', header.filter(h => h).join(' | '));

    // Find column indexes
    const contractIdx = header.findIndex(h => h.toLowerCase().includes('contract number'));
    const partcIdx = header.findIndex(h => h.toLowerCase().includes('part c summary'));
    const partdIdx = header.findIndex(h => h.toLowerCase().includes('part d summary'));
    const overallIdx = header.findIndex(h => h.toLowerCase().includes('overall'));

    console.log('[Star Ratings] Column indexes - Contract:', contractIdx, 'Part C:', partcIdx, 'Part D:', partdIdx, 'Overall:', overallIdx);

    if (contractIdx < 0) {
      throw new Error('Cannot find Contract Number column');
    }

    // Parse all ratings
    const ratings = new Map(); // contractId -> { overall, partc, partd }
    for (let i = 2; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const contractId = (cols[contractIdx] || '').trim();
      if (!contractId || contractId.length < 3) continue;

      const overall = overallIdx >= 0 ? parseRating(cols[overallIdx]) : null;
      const partc = partcIdx >= 0 ? parseRating(cols[partcIdx]) : null;
      const partd = partdIdx >= 0 ? parseRating(cols[partdIdx]) : null;

      if (overall !== null || partc !== null || partd !== null) {
        ratings.set(contractId, { overall, partc, partd });
      }
    }

    console.log(`[Star Ratings] Parsed ${ratings.size} contracts with ratings`);

    // Show sample
    let sample = 0;
    for (const [k, v] of ratings) {
      if (sample++ < 5) console.log(`  ${k}: overall=${v.overall}, partC=${v.partc}, partD=${v.partd}`);
    }

    // Add new columns if needed
    console.log('[Star Ratings] Adding partc/partd columns if needed...');
    await pool.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS partc_star_rating REAL');
    await pool.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS partd_star_rating REAL');

    // Get distinct contract IDs from plans
    const planContracts = await pool.query('SELECT DISTINCT contract_id FROM plans WHERE contract_id IS NOT NULL');
    const planContractSet = new Set(planContracts.rows.map(r => r.contract_id));
    console.log(`[Star Ratings] Plans table has ${planContractSet.size} distinct contract IDs`);

    // Find matches
    let matched = 0;
    let unmatched = 0;
    for (const [contractId] of ratings) {
      if (planContractSet.has(contractId)) matched++;
      else unmatched++;
    }
    console.log(`[Star Ratings] Matched: ${matched}, Unmatched: ${unmatched}`);

    // Update plans
    console.log('[Star Ratings] Updating plans...');
    let updated = 0;
    for (const [contractId, rating] of ratings) {
      if (!planContractSet.has(contractId)) continue;

      const setClauses = [];
      const params = [];
      let paramIdx = 1;

      if (rating.overall !== null) {
        setClauses.push(`overall_star_rating = $${paramIdx++}`);
        params.push(rating.overall);
      }
      if (rating.partc !== null) {
        setClauses.push(`partc_star_rating = $${paramIdx++}`);
        params.push(rating.partc);
      }
      if (rating.partd !== null) {
        setClauses.push(`partd_star_rating = $${paramIdx++}`);
        params.push(rating.partd);
      }

      if (setClauses.length === 0) continue;

      params.push(contractId);
      const result = await pool.query(
        `UPDATE plans SET ${setClauses.join(', ')} WHERE contract_id = $${paramIdx}`,
        params
      );
      updated += result.rowCount;

      if (updated % 10000 === 0 && updated > 0) {
        console.log(`[Star Ratings]   Updated ${updated} plan rows...`);
      }
    }

    console.log(`[Star Ratings] Updated ${updated} total plan rows`);

    // Also parse High/Low performing contracts
    console.log('[Star Ratings] Processing High/Low performing contracts...');

    const highPerf = fs.readFileSync('/tmp/star_ratings/2025 Star Ratings Data Table - High Performing Contracts (Dec 2 2024).csv', 'utf8');
    const highLines = highPerf.split('\n').filter(l => l.trim());
    let highCount = 0;
    for (let i = 2; i < highLines.length; i++) {
      const cols = parseCSVLine(highLines[i]);
      const cid = (cols[0] || '').trim();
      if (cid && cid.length >= 3 && planContractSet.has(cid)) {
        const r = await pool.query('UPDATE plans SET high_performing = true WHERE contract_id = $1', [cid]);
        highCount += r.rowCount;
      }
    }
    console.log(`[Star Ratings] Marked ${highCount} plan rows as high performing`);

    const lowPerf = fs.readFileSync('/tmp/star_ratings/2025 Star Ratings Data Table - Low Performing Contracts (Dec 2 2024).csv', 'utf8');
    const lowLines = lowPerf.split('\n').filter(l => l.trim());
    let lowCount = 0;
    for (let i = 2; i < lowLines.length; i++) {
      const cols = parseCSVLine(lowLines[i]);
      const cid = (cols[0] || '').trim();
      if (cid && cid.length >= 3 && planContractSet.has(cid)) {
        const r = await pool.query('UPDATE plans SET low_performing = true WHERE contract_id = $1', [cid]);
        lowCount += r.rowCount;
      }
    }
    console.log(`[Star Ratings] Marked ${lowCount} plan rows as low performing`);

    // Verify
    const verify = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE overall_star_rating IS NOT NULL) as with_overall,
        COUNT(*) FILTER (WHERE partc_star_rating IS NOT NULL) as with_partc,
        COUNT(*) FILTER (WHERE partd_star_rating IS NOT NULL) as with_partd,
        ROUND(AVG(overall_star_rating)::numeric, 2) as avg_overall,
        ROUND(AVG(partc_star_rating)::numeric, 2) as avg_partc,
        ROUND(AVG(partd_star_rating)::numeric, 2) as avg_partd
      FROM plans
    `);
    console.log('[Star Ratings] Verification:', verify.rows[0]);

    console.log('[Star Ratings] DONE');
  } catch (err) {
    console.error('[Star Ratings] ERROR:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

main();
