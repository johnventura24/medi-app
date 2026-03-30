/**
 * Comparison Report Service — Generates professional PDF comparison reports
 * that agents can give to clients.
 */
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export interface ComparisonReportOptions {
  clientName?: string;
  clientZip?: string;
  clientNeeds?: string;
  agentName?: string;
  agentNpn?: string;
  planIds: number[];
  includeDrugs?: boolean;
  includeDoctor?: boolean;
  medications?: string[];
  doctors?: string[];
}

function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `$${val.toLocaleString()}`;
}

export async function generateComparisonReport(
  options: ComparisonReportOptions
): Promise<Buffer> {
  // Fetch selected plans
  const selectedPlans = await db
    .select()
    .from(plans)
    .where(inArray(plans.id, options.planIds));

  if (selectedPlans.length === 0) {
    throw new Error("No plans found for the given IDs");
  }

  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "portrait",
      margin: 48,
      info: { Title: `Medicare Plan Comparison - ${options.clientName || "Client"}` },
      bufferPages: true,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = 612 - 96; // letter width minus margins
    const margin = 48;

    // ═══════════════════════════════════════
    // PAGE 1: Client Summary
    // ═══════════════════════════════════════
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Medicare Advantage", { align: "center" });
    doc.fontSize(18).font("Helvetica")
      .text("Plan Comparison Report", { align: "center" });
    doc.moveDown(1);

    // Decorative line
    doc.moveTo(margin, doc.y).lineTo(margin + pageWidth, doc.y).lineWidth(2).stroke("#3b82f6");
    doc.moveDown(1);

    // Client info box
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Prepared For:");
    doc.moveDown(0.3);

    const clientName = options.clientName || "Valued Client";
    doc.fontSize(12).font("Helvetica").fillColor("#334155");
    doc.text(`Name: ${clientName}`);
    if (options.clientZip) doc.text(`ZIP Code: ${options.clientZip}`);
    doc.text(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
    doc.text(`Plans Compared: ${selectedPlans.length}`);
    doc.moveDown(0.5);

    if (options.clientNeeds) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1e293b")
        .text("Client Priorities:");
      doc.fontSize(11).font("Helvetica").fillColor("#334155")
        .text(options.clientNeeds);
    }
    doc.moveDown(1);

    // Plans summary cards
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Plans Under Consideration:");
    doc.moveDown(0.5);

    for (const plan of selectedPlans) {
      const premium = plan.calculatedMonthlyPremium || 0;
      const stars = plan.overallStarRating ? `${plan.overallStarRating} stars` : "N/A";

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1e40af")
        .text(`  ${plan.name}`);
      doc.fontSize(10).font("Helvetica").fillColor("#475569")
        .text(`    ${plan.organizationName} | $${premium}/mo | ${stars} | ${plan.county}, ${plan.state}`);
      doc.moveDown(0.3);
    }

    // ═══════════════════════════════════════
    // PAGE 2: Top Plans Side-by-Side
    // ═══════════════════════════════════════
    doc.addPage();
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#1e293b")
      .text("Plan Comparison at a Glance", { align: "center" });
    doc.moveDown(0.5);

    const maxCols = Math.min(selectedPlans.length, 3);
    const labelWidth = 130;
    const colWidth = Math.floor((pageWidth - labelWidth) / maxCols);
    let y = doc.y;

    // Column headers
    doc.rect(margin, y - 2, pageWidth, 16).fill("#1e293b");
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
    doc.text("Benefit", margin + 4, y, { width: labelWidth - 8 });
    let x = margin + labelWidth;
    for (let i = 0; i < maxCols; i++) {
      const name = selectedPlans[i].name.substring(0, 20);
      doc.text(name, x + 2, y, { width: colWidth - 4 });
      x += colWidth;
    }
    y += 18;

    // Comparison rows
    const comparisonRows = [
      { label: "Carrier", key: (p: any) => p.organizationName?.substring(0, 20) || "-" },
      { label: "Plan Type", key: (p: any) => (p.category || p.planType || "").replace(/^PLAN_CATEGORY_/i, "") || "-" },
      { label: "Monthly Premium", key: (p: any) => fmt(p.calculatedMonthlyPremium) },
      { label: "Part B Giveback", key: (p: any) => p.partbGiveback && p.partbGiveback > 0 ? fmt(p.partbGiveback) : "None" },
      { label: "Annual Deductible", key: (p: any) => p.annualDeductible || "$0" },
      { label: "Max Out-of-Pocket", key: (p: any) => p.maximumOopc || "-" },
      { label: "PCP Copay", key: (p: any) => fmt(p.pcpCopayMin) },
      { label: "Specialist Copay", key: (p: any) => fmt(p.specialistCopayMin) },
      { label: "Emergency Room", key: (p: any) => fmt(p.emergencyCopay) },
      { label: "Urgent Care", key: (p: any) => fmt(p.urgentCareCopay) },
      { label: "Inpatient", key: (p: any) => fmt(p.inpatientCopay) },
      { label: "Drug Deductible", key: (p: any) => fmt(p.drugDeductible) },
      { label: "Tier 1 (Generic)", key: (p: any) => fmt(p.tier1CopayPreferred) },
      { label: "Tier 2 (Preferred)", key: (p: any) => fmt(p.tier2CopayPreferred) },
      { label: "Dental Limit", key: (p: any) => fmt(p.dentalCoverageLimit) },
      { label: "Vision Allowance", key: (p: any) => fmt(p.visionAllowance) },
      { label: "Hearing Aid", key: (p: any) => fmt(p.hearingAidAllowance) },
      { label: "OTC (per Quarter)", key: (p: any) => fmt(p.otcAmountPerQuarter) },
      { label: "Flex Card", key: (p: any) => fmt(p.flexCardAmount) },
      { label: "Transportation", key: (p: any) => p.hasTransportation ? "Yes" : "No" },
      { label: "Meals", key: (p: any) => p.hasMealBenefit ? "Yes" : "No" },
      { label: "Fitness", key: (p: any) => p.hasFitnessBenefit ? "Yes" : "No" },
      { label: "Telehealth", key: (p: any) => p.hasTelehealth ? "Yes" : "No" },
      { label: "Star Rating", key: (p: any) => p.overallStarRating ? `${p.overallStarRating} / 5` : "N/A" },
      { label: "SNP Type", key: (p: any) => p.snpType || "None" },
    ];

    doc.fillColor("black");
    for (let i = 0; i < comparisonRows.length; i++) {
      if (y > 700) {
        doc.addPage();
        y = 48;
      }

      const row = comparisonRows[i];
      if (i % 2 === 0) {
        doc.rect(margin, y - 2, pageWidth, 14).fill("#f1f5f9").fillColor("black");
      }

      doc.fontSize(8).font("Helvetica-Bold").text(row.label, margin + 4, y, { width: labelWidth - 8 });
      x = margin + labelWidth;
      doc.font("Helvetica");
      for (let j = 0; j < maxCols; j++) {
        doc.text(row.key(selectedPlans[j]), x + 2, y, { width: colWidth - 4 });
        x += colWidth;
      }
      y += 14;
    }

    // ═══════════════════════════════════════
    // Drug coverage page (if requested)
    // ═══════════════════════════════════════
    if (options.includeDrugs && options.medications && options.medications.length > 0) {
      doc.addPage();
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#1e293b")
        .text("Drug Coverage Check", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").fillColor("#475569")
        .text("The following medications were provided for coverage review:");
      doc.moveDown(0.3);
      for (const med of options.medications) {
        doc.fontSize(10).font("Helvetica").text(`  - ${med}`);
      }
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#94a3b8")
        .text("Note: Drug coverage details should be verified using the plan's official formulary. Copay amounts shown in the comparison grid reflect standard Part D cost-sharing tiers.");
    }

    // ═══════════════════════════════════════
    // Provider page (if requested)
    // ═══════════════════════════════════════
    if (options.includeDoctor && options.doctors && options.doctors.length > 0) {
      doc.addPage();
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#1e293b")
        .text("Provider Network Check", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").fillColor("#475569")
        .text("The following providers were listed for network verification:");
      doc.moveDown(0.3);
      for (const dr of options.doctors) {
        doc.fontSize(10).font("Helvetica").text(`  - ${dr}`);
      }
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#94a3b8")
        .text("Note: Provider network participation should be verified directly with the carrier or through the CMS provider directory for the most current information.");
    }

    // ═══════════════════════════════════════
    // Footer on every page
    // ═══════════════════════════════════════
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const footerY = 742 - 48;

      doc.moveTo(margin, footerY).lineTo(margin + pageWidth, footerY).lineWidth(0.5).stroke("#e2e8f0");

      // Agent info
      if (options.agentName || options.agentNpn) {
        doc.fontSize(7).font("Helvetica").fillColor("#64748b");
        const agentLine = [
          options.agentName ? `Prepared by: ${options.agentName}` : "",
          options.agentNpn ? `NPN: ${options.agentNpn}` : "",
        ].filter(Boolean).join(" | ");
        doc.text(agentLine, margin, footerY + 4, { width: pageWidth, align: "left" });
      }

      // TPMO disclaimer
      doc.fontSize(6).font("Helvetica-Oblique").fillColor("#94a3b8")
        .text(
          "We do not offer every plan available in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP to get information on all of your options.",
          margin, footerY + 14,
          { width: pageWidth, align: "center" }
        );

      // Page number
      doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
        .text(`Page ${i + 1} of ${pageCount}`, margin, footerY + 24, { width: pageWidth, align: "right" });
    }

    doc.end();
  });
}
