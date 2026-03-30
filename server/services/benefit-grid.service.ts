/**
 * Benefit Grid Service — Multi-sheet XLSX generation matching carrier submission templates
 *
 * Generates compliance-ready benefit grids with 4 sheets:
 *   1. Dental
 *   2. Flex
 *   3. OTC
 *   4. Part B Reduction
 */
import XLSX from "xlsx";
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, inArray, or, gt, sql } from "drizzle-orm";

export interface BenefitGridOptions {
  carrier?: string;
  state?: string;
  counties?: string[];
  contractId?: string;
}

interface PlanRow {
  county: string;
  state: string;
  organizationName: string;
  contractId: string | null;
  planId: string | null;
  name: string;
  category: string | null;
  planType: string | null;
  dentalCoverageLimit: number | null;
  dentalPreventiveCovered: boolean | null;
  dentalComprehensiveCovered: boolean | null;
  hasOtc: boolean | null;
  otcAmountPerQuarter: number | null;
  hasMealBenefit: boolean | null;
  flexCardAmount: number | null;
  flexCardFrequency: string | null;
  partbGiveback: number | null;
  snpType: string | null;
}

function derivePlanType(category: string | null, planType: string | null): string {
  if (category) {
    return category.replace(/^PLAN_CATEGORY_/i, "");
  }
  return planType || "Unknown";
}

function sortRows(rows: any[][]): any[][] {
  return rows.sort((a, b) => {
    // Sort by State (index 1), County (index 0), Carrier (index 2), Plan Name (index 5)
    const stateComp = String(a[1]).localeCompare(String(b[1]));
    if (stateComp !== 0) return stateComp;
    const countyComp = String(a[0]).localeCompare(String(b[0]));
    if (countyComp !== 0) return countyComp;
    const carrierComp = String(a[2]).localeCompare(String(b[2]));
    if (carrierComp !== 0) return carrierComp;
    return String(a[5]).localeCompare(String(b[5]));
  });
}

async function queryPlans(options: BenefitGridOptions): Promise<PlanRow[]> {
  const conditions = [];

  if (options.carrier) {
    conditions.push(eq(plans.organizationName, options.carrier));
  }
  if (options.state) {
    conditions.push(eq(plans.state, options.state.toUpperCase()));
  }
  if (options.counties && options.counties.length > 0) {
    conditions.push(inArray(plans.county, options.counties.map(c => c.toUpperCase())));
  }
  if (options.contractId) {
    conditions.push(eq(plans.contractId, options.contractId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      county: plans.county,
      state: plans.state,
      organizationName: plans.organizationName,
      contractId: plans.contractId,
      planId: plans.planId,
      name: plans.name,
      category: plans.category,
      planType: plans.planType,
      dentalCoverageLimit: plans.dentalCoverageLimit,
      dentalPreventiveCovered: plans.dentalPreventiveCovered,
      dentalComprehensiveCovered: plans.dentalComprehensiveCovered,
      hasOtc: plans.hasOtc,
      otcAmountPerQuarter: plans.otcAmountPerQuarter,
      hasMealBenefit: plans.hasMealBenefit,
      flexCardAmount: plans.flexCardAmount,
      flexCardFrequency: plans.flexCardFrequency,
      partbGiveback: plans.partbGiveback,
      snpType: plans.snpType,
    })
    .from(plans)
    .where(whereClause)
    .limit(50000);

  return rows;
}

function buildDentalRows(allPlans: PlanRow[]): any[][] {
  const header = [
    "County",
    "State",
    "Carrier",
    "Contract #",
    "PBP #",
    "Plan Name",
    "Plan Type",
    "Comprehensive Benefits",
    "Routine Benefits",
    "Annual Allowance",
    "Annual Allowance - Comp, Routine or both",
    "Summary of Benefits",
  ];

  const dataRows: any[][] = [];

  for (const p of allPlans) {
    const hasDental =
      (p.dentalCoverageLimit && p.dentalCoverageLimit > 0) ||
      p.dentalPreventiveCovered ||
      p.dentalComprehensiveCovered;

    if (!hasDental) continue;

    const hasLimit = p.dentalCoverageLimit && p.dentalCoverageLimit > 0;

    const comprehensive =
      p.dentalComprehensiveCovered != null
        ? p.dentalComprehensiveCovered
          ? "Yes"
          : "No"
        : hasLimit
          ? "Yes"
          : "No";

    const routine =
      p.dentalPreventiveCovered != null
        ? p.dentalPreventiveCovered
          ? "Yes"
          : "No"
        : hasLimit
          ? "Yes"
          : "No";

    dataRows.push([
      p.county,
      p.state,
      p.organizationName,
      p.contractId || "",
      p.planId || "",
      p.name,
      derivePlanType(p.category, p.planType),
      comprehensive,
      routine,
      p.dentalCoverageLimit || 0,
      "both",
      "Summary of Benefits",
    ]);
  }

  return [header, ...sortRows(dataRows)];
}

function buildFlexRows(allPlans: PlanRow[]): any[][] {
  const header = [
    "County",
    "State",
    "Carrier",
    "Contract #",
    "PBP #",
    "Plan Type",
    "Plan Name",
    "Flex Benefit Details",
    "SSBCI Qualifiers",
    "Amount",
    "Disbursement Parameter",
    "Summary of Benefits",
  ];

  const dataRows: any[][] = [];

  for (const p of allPlans) {
    // Only include plans flagged as having supplemental benefits
    // NOTE: Dollar amounts are NOT from CMS PBP filings — they are estimates.
    // The has_meal_benefit boolean IS from the CMS PBP b13 file.
    const hasFlex = p.hasMealBenefit;
    if (!hasFlex) continue;

    const ssbci =
      p.snpType && p.snpType.toUpperCase().includes("SNP")
        ? "See Evidence of Coverage for SSBCI chronic condition qualifiers"
        : "None";

    const amount = p.flexCardAmount || p.mealBenefitAmount || 0;
    const frequency = p.flexCardFrequency || (p.mealBenefitAmount ? "annually" : "See SB");

    const details = amount > 0
      ? `This plan offers a spending allowance of $${amount} ${frequency} for supplemental benefits.`
      : "This plan offers supplemental flex/meal benefits. See Evidence of Coverage for specific amounts.";

    dataRows.push([
      p.county,
      p.state,
      p.organizationName,
      p.contractId || "",
      p.planId || "",
      derivePlanType(p.category, p.planType),
      p.name,
      details,
      ssbci,
      amount > 0 ? amount : "See EOC",
      amount > 0 ? frequency : "See EOC",
      "Summary of Benefits",
    ]);
  }

  return [header, ...sortRows(dataRows)];
}

function buildOtcRows(allPlans: PlanRow[]): any[][] {
  const header = [
    "County",
    "State",
    "Carrier",
    "Contract #",
    "PBP #",
    "Plan Name",
    "Plan Type",
    "OTC Details",
    "Amount",
    "Disbursement Parameter",
    "Summary of Benefits",
  ];

  const dataRows: any[][] = [];

  for (const p of allPlans) {
    if (!p.hasOtc) continue;

    const amount = p.otcAmountPerQuarter || 0;
    const details = amount > 0
      ? `This plan provides an OTC allowance of $${amount} per quarter for over-the-counter health and wellness products.`
      : "This plan offers OTC benefits. See Summary of Benefits for amount details.";

    dataRows.push([
      p.county,
      p.state,
      p.organizationName,
      p.contractId || "",
      p.planId || "",
      p.name,
      derivePlanType(p.category, p.planType),
      details,
      amount > 0 ? amount : "See SB",
      amount > 0 ? "Quarterly" : "See SB",
      "Summary of Benefits",
    ]);
  }

  return [header, ...sortRows(dataRows)];
}

function buildPartBRows(allPlans: PlanRow[]): any[][] {
  const header = [
    "County",
    "State",
    "Carrier",
    "Contract #",
    "PBP #",
    "Plan Name",
    "Plan Type",
    "Monthly Reduction Amount",
    "Summary of Benefits",
  ];

  const dataRows: any[][] = [];

  for (const p of allPlans) {
    if (!p.partbGiveback || p.partbGiveback <= 0) continue;

    dataRows.push([
      p.county,
      p.state,
      p.organizationName,
      p.contractId || "",
      p.planId || "",
      p.name,
      derivePlanType(p.category, p.planType),
      p.partbGiveback,
      "Summary of Benefits",
    ]);
  }

  return [header, ...sortRows(dataRows)];
}

export async function generateBenefitGrid(options: BenefitGridOptions): Promise<Buffer> {
  const allPlans = await queryPlans(options);

  const dentalData = buildDentalRows(allPlans);
  const flexData = buildFlexRows(allPlans);
  const otcData = buildOtcRows(allPlans);
  const partBData = buildPartBRows(allPlans);

  const wb = XLSX.utils.book_new();

  // Dental sheet
  const wsDental = XLSX.utils.aoa_to_sheet(dentalData);
  wsDental["!cols"] = [
    { wch: 20 },  // County
    { wch: 10 },  // State
    { wch: 25 },  // Carrier
    { wch: 14 },  // Contract #
    { wch: 10 },  // PBP #
    { wch: 40 },  // Plan Name
    { wch: 15 },  // Plan Type
    { wch: 22 },  // Comprehensive Benefits
    { wch: 18 },  // Routine Benefits
    { wch: 18 },  // Annual Allowance
    { wch: 35 },  // Annual Allowance Type
    { wch: 22 },  // Summary of Benefits
  ];
  XLSX.utils.book_append_sheet(wb, wsDental, "Dental");

  // Flex sheet
  const wsFlex = XLSX.utils.aoa_to_sheet(flexData);
  wsFlex["!cols"] = [
    { wch: 20 },  // County
    { wch: 10 },  // State
    { wch: 25 },  // Carrier
    { wch: 14 },  // Contract #
    { wch: 10 },  // PBP #
    { wch: 15 },  // Plan Type
    { wch: 40 },  // Plan Name
    { wch: 60 },  // Flex Benefit Details
    { wch: 55 },  // SSBCI Qualifiers
    { wch: 12 },  // Amount
    { wch: 24 },  // Disbursement Parameter
    { wch: 22 },  // Summary of Benefits
  ];
  XLSX.utils.book_append_sheet(wb, wsFlex, "Flex");

  // OTC sheet
  const wsOtc = XLSX.utils.aoa_to_sheet(otcData);
  wsOtc["!cols"] = [
    { wch: 20 },  // County
    { wch: 10 },  // State
    { wch: 25 },  // Carrier
    { wch: 14 },  // Contract #
    { wch: 10 },  // PBP #
    { wch: 40 },  // Plan Name
    { wch: 15 },  // Plan Type
    { wch: 60 },  // OTC Details
    { wch: 12 },  // Amount
    { wch: 24 },  // Disbursement Parameter
    { wch: 22 },  // Summary of Benefits
  ];
  XLSX.utils.book_append_sheet(wb, wsOtc, "OTC");

  // Part B Reduction sheet
  const wsPartB = XLSX.utils.aoa_to_sheet(partBData);
  wsPartB["!cols"] = [
    { wch: 20 },  // County
    { wch: 10 },  // State
    { wch: 25 },  // Carrier
    { wch: 14 },  // Contract #
    { wch: 10 },  // PBP #
    { wch: 40 },  // Plan Name
    { wch: 15 },  // Plan Type
    { wch: 24 },  // Monthly Reduction Amount
    { wch: 22 },  // Summary of Benefits
  ];
  XLSX.utils.book_append_sheet(wb, wsPartB, "Part B Reduction");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

export interface BenefitGridPreview {
  sheet: string;
  headers: string[];
  rows: any[][];
  totalRows: number;
}

export async function previewBenefitGrid(
  options: BenefitGridOptions,
  sheet?: string,
): Promise<BenefitGridPreview[]> {
  const allPlans = await queryPlans(options);

  const sheets: { name: string; builder: (plans: PlanRow[]) => any[][] }[] = [
    { name: "dental", builder: buildDentalRows },
    { name: "flex", builder: buildFlexRows },
    { name: "otc", builder: buildOtcRows },
    { name: "partb", builder: buildPartBRows },
  ];

  const results: BenefitGridPreview[] = [];

  for (const s of sheets) {
    if (sheet && s.name !== sheet) continue;

    const data = s.builder(allPlans);
    const headers = data[0] || [];
    const allRows = data.slice(1);

    results.push({
      sheet: s.name,
      headers,
      rows: allRows.slice(0, 50),
      totalRows: allRows.length,
    });
  }

  return results;
}
