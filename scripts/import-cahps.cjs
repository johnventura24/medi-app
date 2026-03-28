/**
 * Import CAHPS/Star Ratings member satisfaction data into plans table.
 * Source: CMS 2025 Star Ratings - Measure Data and Summary Ratings
 *
 * We extract CAHPS-related measures per contract:
 *  - C19: Getting Needed Care (cahps_care_access)
 *  - C23: Rating of Health Plan (cahps_plan_rating)
 *  - Overall Star Rating from Summary (cahps_overall)
 * And also: C20 Getting Appointments Quickly, C21 Customer Service, C22 Rating of Health Care Quality
 */
const { Pool } = require('pg');
const fs = require('fs');

const DB_URL = 'postgresql://postgres.dwcughxlcuuzdpyihilr:IikqfBQWJvMkN2LP@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// Measure Data columns (from inspection):
// Col 0: CONTRACT_ID
// Col 23: C19: Getting Needed Care
// Col 24: C20: Getting Appointments and Care Quickly
// Col 25: C21: Customer Service
// Col 26: C22: Rating of Health Care Quality
// Col 27: C23: Rating of Health Plan
// Col 39: D05: Rating of Drug Plan

function parseCSVLine(line) {
  // Handle quoted fields with commas
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    // Add CAHPS columns to plans
    console.log('Adding CAHPS columns to plans table...');
    await pool.query(`
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS cahps_overall REAL;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS cahps_care_access REAL;
      ALTER TABLE plans ADD COLUMN IF NOT EXISTS cahps_plan_rating REAL;
    `);
    console.log('Columns added.');

    // --- Parse Summary Ratings for Overall Rating ---
    console.log('\nParsing Summary Ratings...');
    const summaryContent = fs.readFileSync('/tmp/star-ratings/2025 Star Ratings Data Table - Summary Ratings (Dec 2 2024).csv', 'utf8');
    const summaryLines = summaryContent.split('\n');
    // Line 0: title, Line 1: headers, Line 2+: data
    // Headers: Contract Number, Organization Type, ..., 2025 Part C Summary, 2025 Part D Summary, 2025 Overall
    const summaryHeaders = parseCSVLine(summaryLines[1]);
    console.log('Summary headers:', summaryHeaders.slice(0, 11).join(' | '));

    const overallRatings = new Map(); // contract_id -> overall star rating
    for (let i = 2; i < summaryLines.length; i++) {
      if (!summaryLines[i].trim()) continue;
      const cols = parseCSVLine(summaryLines[i]);
      const contractId = cols[0].trim();
      const overallStr = cols[10]; // 2025 Overall
      const partCSummary = cols[8]; // 2025 Part C Summary

      if (!contractId) continue;

      // Try overall first, then Part C summary
      let rating = parseFloat(overallStr);
      if (isNaN(rating)) rating = parseFloat(partCSummary);
      if (!isNaN(rating)) {
        overallRatings.set(contractId, rating);
      }
    }
    console.log(`Found ${overallRatings.size} contracts with overall ratings`);

    // --- Parse Measure Data for CAHPS measures ---
    console.log('\nParsing Measure Data for CAHPS scores...');
    const measureContent = fs.readFileSync('/tmp/star-ratings/2025 Star Ratings Data Table - Measure Data (Dec 2 2024).csv', 'utf8');
    const measureLines = measureContent.split('\n');
    // Line 0: title, Line 1: domain headers, Line 2: measure names, Line 3: date ranges, Line 4+: data

    const cahpsData = new Map(); // contract_id -> { care_access, plan_rating }
    for (let i = 4; i < measureLines.length; i++) {
      if (!measureLines[i].trim()) continue;
      const cols = parseCSVLine(measureLines[i]);
      const contractId = cols[0].trim();
      if (!contractId) continue;

      // The values are percentages or star ratings or text like "Not enough data available"
      const parseScore = (val) => {
        if (!val) return null;
        const v = val.replace('%', '').trim();
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      const gettingNeededCare = parseScore(cols[23]); // C19
      const gettingAppts = parseScore(cols[24]); // C20
      const customerService = parseScore(cols[25]); // C21
      const ratingHealthCare = parseScore(cols[26]); // C22
      const ratingPlan = parseScore(cols[27]); // C23

      // Calculate care_access as average of C19 and C20
      const careAccessVals = [gettingNeededCare, gettingAppts].filter(v => v !== null);
      const careAccess = careAccessVals.length > 0 ? careAccessVals.reduce((a, b) => a + b, 0) / careAccessVals.length : null;

      // Plan rating = C23 (Rating of Health Plan)
      const planRating = ratingPlan;

      if (careAccess !== null || planRating !== null) {
        cahpsData.set(contractId, { care_access: careAccess, plan_rating: planRating });
      }
    }
    console.log(`Found ${cahpsData.size} contracts with CAHPS measure data`);

    // --- Get distinct contract IDs from plans ---
    const plansRes = await pool.query('SELECT DISTINCT contract_id FROM plans WHERE contract_id IS NOT NULL');
    const planContracts = new Set(plansRes.rows.map(r => r.contract_id.trim()));
    console.log(`\nPlans table has ${planContracts.size} distinct contract IDs`);

    // Find matches
    let matchedOverall = 0, matchedCahps = 0;
    for (const cid of planContracts) {
      if (overallRatings.has(cid)) matchedOverall++;
      if (cahpsData.has(cid)) matchedCahps++;
    }
    console.log(`Matched: ${matchedOverall} overall ratings, ${matchedCahps} CAHPS measure data`);

    // --- Update plans table ---
    console.log('\nUpdating plans with CAHPS data...');
    let updated = 0;

    for (const [contractId, rating] of overallRatings) {
      if (!planContracts.has(contractId)) continue;
      const cahps = cahpsData.get(contractId) || {};

      const res = await pool.query(`
        UPDATE plans SET
          cahps_overall = $1,
          cahps_care_access = $2,
          cahps_plan_rating = $3
        WHERE TRIM(contract_id) = $4
      `, [rating, cahps.care_access || null, cahps.plan_rating || null, contractId]);

      updated += res.rowCount;
      if (updated % 5000 === 0) {
        console.log(`  Updated ${updated} plan rows...`);
      }
    }

    // Also update contracts that have CAHPS but no overall rating
    for (const [contractId, cahps] of cahpsData) {
      if (!planContracts.has(contractId) || overallRatings.has(contractId)) continue;
      const res = await pool.query(`
        UPDATE plans SET
          cahps_care_access = $1,
          cahps_plan_rating = $2
        WHERE TRIM(contract_id) = $3
      `, [cahps.care_access, cahps.plan_rating, contractId]);
      updated += res.rowCount;
    }

    console.log(`Updated ${updated} total plan rows with CAHPS data`);

    // Verify
    const verifyRes = await pool.query(`
      SELECT COUNT(*) as total,
        COUNT(cahps_overall) as with_overall,
        COUNT(cahps_care_access) as with_care_access,
        COUNT(cahps_plan_rating) as with_plan_rating,
        ROUND(AVG(cahps_overall)::numeric, 2) as avg_overall,
        ROUND(AVG(cahps_care_access)::numeric, 2) as avg_care_access,
        ROUND(AVG(cahps_plan_rating)::numeric, 2) as avg_plan_rating
      FROM plans
    `);
    console.log('\nVerification:', verifyRes.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
