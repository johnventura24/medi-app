/**
 * Plan Cheatsheet Service — Generates compact carrier comparison grids
 * for a specific carrier in a specific county, optimized for print.
 */
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, sql, count, avg } from "drizzle-orm";

export interface CheatsheetPlan {
  name: string;
  contractId: string | null;
  planId: string | null;
  planType: string;
  premium: number;
  deductible: string;
  moop: string;
  pcpCopay: number | null;
  specialistCopay: number | null;
  dentalLimit: number | null;
  visionAllowance: number | null;
  otcAmount: number | null;
  starRating: number | null;
  drugDeductible: number | null;
  partbGiveback: number | null;
  snpType: string | null;
  hasTransportation: boolean;
  hasFitness: boolean;
}

export interface CheatsheetData {
  carrier: string;
  state: string;
  county: string;
  generatedAt: string;
  planCount: number;
  plans: CheatsheetPlan[];
  marketContext: {
    avgPremium: number;
    avgMoop: number;
    avgDental: number;
    avgStarRating: number;
    totalPlansInCounty: number;
    totalCarriersInCounty: number;
  };
}

export async function generatePlanCheatsheet(options: {
  carrier: string;
  state: string;
  county: string;
}): Promise<CheatsheetData> {
  const { carrier, state, county } = options;

  // Get all plans from this carrier in this county
  const carrierPlans = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.organizationName, carrier),
        eq(plans.state, state.toUpperCase()),
        eq(plans.county, county.toUpperCase())
      )
    );

  // Get market context for the county
  const marketStats = await db
    .select({
      avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
      avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
      avgStar: avg(plans.overallStarRating).as("avg_star"),
      totalPlans: count().as("total_plans"),
      totalCarriers: sql<number>`count(distinct ${plans.organizationName})`.as("total_carriers"),
    })
    .from(plans)
    .where(
      and(
        eq(plans.state, state.toUpperCase()),
        eq(plans.county, county.toUpperCase())
      )
    );

  const stats = marketStats[0];

  const cheatsheetPlans: CheatsheetPlan[] = carrierPlans.map((p) => ({
    name: p.name,
    contractId: p.contractId,
    planId: p.planId,
    planType: (p.category || p.planType || "Unknown").replace(/^PLAN_CATEGORY_/i, ""),
    premium: p.calculatedMonthlyPremium || 0,
    deductible: p.annualDeductible || "$0",
    moop: p.maximumOopc || "$0",
    pcpCopay: p.pcpCopayMin,
    specialistCopay: p.specialistCopayMin,
    dentalLimit: p.dentalCoverageLimit,
    visionAllowance: p.visionAllowance,
    otcAmount: p.otcAmountPerQuarter,
    starRating: p.overallStarRating,
    drugDeductible: p.drugDeductible,
    partbGiveback: p.partbGiveback,
    snpType: p.snpType,
    hasTransportation: p.hasTransportation || false,
    hasFitness: p.hasFitnessBenefit || false,
  }));

  // Sort by premium ascending
  cheatsheetPlans.sort((a, b) => a.premium - b.premium);

  return {
    carrier,
    state: state.toUpperCase(),
    county: county.toUpperCase(),
    generatedAt: new Date().toISOString(),
    planCount: cheatsheetPlans.length,
    plans: cheatsheetPlans,
    marketContext: {
      avgPremium: Math.round(Number(stats.avgPremium) || 0),
      avgMoop: 0, // computed below if needed
      avgDental: Math.round(Number(stats.avgDental) || 0),
      avgStarRating: Math.round((Number(stats.avgStar) || 0) * 10) / 10,
      totalPlansInCounty: Number(stats.totalPlans) || 0,
      totalCarriersInCounty: Number(stats.totalCarriers) || 0,
    },
  };
}

/**
 * Generate a printable PDF cheatsheet for a carrier in a county.
 */
export async function generateCheatsheetPDF(options: {
  carrier: string;
  state: string;
  county: string;
}): Promise<Buffer> {
  const data = await generatePlanCheatsheet(options);
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "landscape",
      margin: 24,
      info: { Title: `${data.carrier} - ${data.county}, ${data.state} Plan Cheatsheet` },
      bufferPages: true,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(14).font("Helvetica-Bold")
      .text(`${data.carrier} Plan Cheatsheet`, { align: "center" });
    doc.fontSize(10).font("Helvetica")
      .text(`${data.county} County, ${data.state} | ${data.planCount} Plans | Generated ${new Date().toLocaleDateString()}`, { align: "center" });
    doc.moveDown(0.5);

    // Table header
    const margin = 24;
    const cols = [
      { label: "Plan Name", width: 140 },
      { label: "Type", width: 45 },
      { label: "Premium", width: 50 },
      { label: "Deduct.", width: 50 },
      { label: "MOOP", width: 55 },
      { label: "PCP", width: 35 },
      { label: "Spec.", width: 35 },
      { label: "Dental", width: 45 },
      { label: "Vision", width: 42 },
      { label: "OTC/Qtr", width: 45 },
      { label: "Stars", width: 35 },
      { label: "Drug Ded.", width: 50 },
      { label: "Part B GB", width: 50 },
      { label: "SNP", width: 35 },
    ];

    let y = doc.y;
    let x = margin;

    // Header row background
    doc.rect(margin, y - 2, 750 - margin * 2, 14).fill("#1e293b");
    doc.fillColor("white").fontSize(7).font("Helvetica-Bold");
    x = margin;
    for (const col of cols) {
      doc.text(col.label, x + 2, y, { width: col.width - 4, align: "left" });
      x += col.width;
    }
    y += 14;

    // Data rows
    doc.fillColor("black").fontSize(7).font("Helvetica");
    for (let i = 0; i < data.plans.length; i++) {
      if (y > 560) {
        doc.addPage();
        y = 24;
      }

      const plan = data.plans[i];
      if (i % 2 === 0) {
        doc.rect(margin, y - 2, 750 - margin * 2, 13).fill("#f1f5f9").fillColor("black");
      }

      x = margin;
      const vals = [
        plan.name.substring(0, 30),
        plan.planType.substring(0, 6),
        `$${plan.premium}`,
        plan.deductible,
        plan.moop,
        plan.pcpCopay != null ? `$${plan.pcpCopay}` : "-",
        plan.specialistCopay != null ? `$${plan.specialistCopay}` : "-",
        plan.dentalLimit != null ? `$${plan.dentalLimit}` : "-",
        plan.visionAllowance != null ? `$${plan.visionAllowance}` : "-",
        plan.otcAmount != null ? `$${plan.otcAmount}` : "-",
        plan.starRating != null ? `${plan.starRating}` : "-",
        plan.drugDeductible != null ? `$${plan.drugDeductible}` : "-",
        plan.partbGiveback != null && plan.partbGiveback > 0 ? `$${plan.partbGiveback}` : "-",
        plan.snpType || "-",
      ];

      doc.fontSize(6.5).font("Helvetica");
      for (let j = 0; j < cols.length; j++) {
        doc.text(vals[j], x + 2, y, { width: cols[j].width - 4, align: "left" });
        x += cols[j].width;
      }
      y += 13;
    }

    // Market context footer
    y += 8;
    doc.fontSize(7).font("Helvetica-Oblique").fillColor("#64748b");
    doc.text(
      `Market Context: ${data.marketContext.totalPlansInCounty} total plans from ${data.marketContext.totalCarriersInCounty} carriers | ` +
      `Avg Premium: $${data.marketContext.avgPremium} | Avg Dental: $${data.marketContext.avgDental} | Avg Stars: ${data.marketContext.avgStarRating}`,
      margin, y, { width: 700, align: "center" }
    );

    // TPMO disclaimer
    y += 14;
    doc.fontSize(6).font("Helvetica-Oblique").fillColor("#94a3b8");
    doc.text(
      "We do not offer every plan available in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP to get information on all of your options.",
      margin, y, { width: 700, align: "center" }
    );

    doc.end();
  });
}
