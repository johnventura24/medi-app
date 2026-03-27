/**
 * Export Service — CSV and PDF generation for Medicare Advantage plan data
 *
 * CSV: UTF-8 BOM, CMS Summary of Benefits column ordering, proper escaping
 * PDF: pdfkit-based, 12pt min font (CMS compliance), detail/comparison/matrix formats
 */

// ── Column definitions in CMS Summary of Benefits order ──

export interface CsvColumn {
  key: string;
  label: string;
}

export const CSV_COLUMN_ORDER: CsvColumn[] = [
  // 1. Plan Identification
  { key: 'name', label: 'Plan Name' },
  { key: 'contractId', label: 'Contract ID' },
  { key: 'planId', label: 'Plan ID' },
  { key: 'planType', label: 'Plan Type' },
  { key: 'organizationName', label: 'Organization' },
  { key: 'state', label: 'State' },
  { key: 'county', label: 'County' },
  { key: 'zipcode', label: 'ZIP Code' },

  // 2. Premiums
  { key: 'calculatedMonthlyPremium', label: 'Monthly Premium' },
  { key: 'partcPremium', label: 'Part C Premium' },
  { key: 'partdPremium', label: 'Part D Premium' },
  { key: 'partbGiveback', label: 'Part B Giveback' },

  // 3. Cost Sharing
  { key: 'annualDeductible', label: 'Annual Deductible' },
  { key: 'maximumOopc', label: 'Max Out-of-Pocket' },

  // 4. Medical Copays
  { key: 'pcpCopayMin', label: 'PCP Copay' },
  { key: 'specialistCopayMin', label: 'Specialist Copay' },
  { key: 'emergencyCopay', label: 'Emergency Copay' },
  { key: 'urgentCareCopay', label: 'Urgent Care Copay' },
  { key: 'inpatientCopay', label: 'Inpatient Copay' },
  { key: 'outpatientCopayMin', label: 'Outpatient Copay' },
  { key: 'diagnosticCopay', label: 'Diagnostic' },
  { key: 'labCopay', label: 'Lab' },
  { key: 'imagingCopayMin', label: 'Imaging' },
  { key: 'dmeCopayMin', label: 'DME' },
  { key: 'mentalHealthOutpatientCopay', label: 'Mental Health' },
  { key: 'snfCopayDays1to20', label: 'SNF' },
  { key: 'homeHealthCopay', label: 'Home Health' },
  { key: 'ambulanceCopay', label: 'Ambulance' },

  // 5. Drug Coverage
  { key: 'drugDeductible', label: 'Drug Deductible' },
  { key: 'tier1CopayPreferred', label: 'Tier 1 Copay' },
  { key: 'tier2CopayPreferred', label: 'Tier 2 Copay' },
  { key: 'tier3CopayPreferred', label: 'Tier 3 Copay' },
  { key: 'tier4CoinsurancePreferred', label: 'Tier 4 Coinsurance' },
  { key: 'tier5CoinsurancePreferred', label: 'Tier 5 Coinsurance' },
  { key: 'tier6CopayPreferred', label: 'Tier 6 Copay' },

  // 6. Supplemental Benefits
  { key: 'dentalCoverageLimit', label: 'Dental Limit' },
  { key: 'visionAllowance', label: 'Vision Allowance' },
  { key: 'hearingAidAllowance', label: 'Hearing' },
  { key: 'otcAmountPerQuarter', label: 'OTC Amount' },
  { key: 'transportationAmountPerYear', label: 'Transportation' },
  { key: 'mealBenefitAmount', label: 'Meals' },
  { key: 'flexCardAmount', label: 'Flex Card' },
  { key: 'groceryAllowanceAmount', label: 'Grocery' },
  { key: 'telehealthCopay', label: 'Telehealth' },
  { key: 'fitnessBenefitName', label: 'Fitness' },
  { key: 'hasInHomeSupport', label: 'In-Home Support' },

  // 7. Quality
  { key: 'overallStarRating', label: 'Star Rating' },
  { key: 'snpType', label: 'SNP Type' },
];

// ── Human-readable labels for PDF detail/comparison views ──

const FIELD_LABELS: Record<string, string> = {};
for (const col of CSV_COLUMN_ORDER) {
  FIELD_LABELS[col.key] = col.label;
}

// ── CSV Generation ──

function escapeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  const str = String(val);
  // If the value contains commas, quotes, or newlines, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV string from plan data with CMS Summary of Benefits column ordering.
 * Includes UTF-8 BOM prefix for Excel compatibility.
 */
export function generateCSV(plans: Record<string, any>[], columnOrder?: CsvColumn[]): string {
  const cols = columnOrder || CSV_COLUMN_ORDER;
  const BOM = '\uFEFF';

  // Header row — always quoted for safety
  const header = cols.map(c => `"${c.label}"`).join(',');

  // Data rows
  const dataRows = plans.map(row => {
    return cols.map(c => escapeCSVValue(row[c.key])).join(',');
  });

  return BOM + header + '\n' + dataRows.join('\n');
}

// Legacy alias for backward compatibility
export const generateCsv = generateCSV;

// ── PDF Generation ──

export interface PDFOptions {
  title: string;
  subtitle?: string;
  format: 'detail' | 'comparison' | 'matrix';
}

const PDF_DISCLAIMER = 'This is not an official Summary of Benefits. For official plan documents, visit medicare.gov';
const PDF_TPMO_DISCLAIMER = 'We do not offer every plan available in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP to get information on all of your options.';

/**
 * Generate a PDF buffer from plan data.
 *
 * Formats:
 * - detail: Single plan with all fields listed vertically
 * - comparison: Multiple plans as columns, benefit fields as rows
 * - matrix: Carrier-county grid
 *
 * Uses pdfkit (already in dependencies).
 * CMS compliance: 12pt minimum font for body text.
 */
export async function generatePDF(
  plans: Record<string, any>[],
  options: PDFOptions
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const isLandscape = options.format === 'comparison' || options.format === 'matrix';

    const doc = new PDFDocument({
      size: 'LETTER',
      layout: isLandscape ? 'landscape' : 'portrait',
      margin: 36,
      info: { Title: options.title },
      bufferPages: true,
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ──
    doc.fontSize(18).font('Helvetica-Bold').text(options.title, { align: 'center' });
    if (options.subtitle) {
      doc.fontSize(12).font('Helvetica').text(options.subtitle, { align: 'center' });
    }
    doc.fontSize(10).font('Helvetica').text(
      `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      { align: 'right' }
    );
    doc.moveDown(1);

    // ── Body — dispatch to format-specific renderer ──
    switch (options.format) {
      case 'detail':
        renderDetailFormat(doc, plans[0] || {});
        break;
      case 'comparison':
        renderComparisonFormat(doc, plans);
        break;
      case 'matrix':
        renderMatrixFormat(doc, plans);
        break;
    }

    // ── Add footer to every page ──
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const pageHeight = isLandscape ? 612 : 792; // letter dimensions
      const footerY = pageHeight - 50;
      doc.fontSize(7).font('Helvetica-Oblique')
        .text(PDF_DISCLAIMER, 36, footerY, {
          width: isLandscape ? 700 : 540,
          align: 'center',
        });
      doc.fontSize(7).font('Helvetica')
        .text(`Page ${i + 1} of ${pageCount}`, 36, footerY + 12, {
          width: isLandscape ? 700 : 540,
          align: 'right',
        });
    }

    doc.end();
  });
}

// Legacy alias for backward compatibility
export const generatePlansPdf = async (rows: Record<string, any>[], title: string): Promise<Buffer> => {
  return generatePDF(rows, { title, format: rows.length === 1 ? 'detail' : 'comparison' });
};

// ── Detail format: single plan, all fields listed vertically ──

function renderDetailFormat(doc: PDFKit.PDFDocument, plan: Record<string, any>): void {
  const margin = 36;
  let y = doc.y;

  // Group fields by section
  const sections: Array<{ title: string; fields: CsvColumn[] }> = [
    {
      title: 'Plan Identification',
      fields: CSV_COLUMN_ORDER.filter(c =>
        ['name', 'contractId', 'planId', 'planType', 'organizationName', 'state', 'county', 'zipcode'].includes(c.key)
      ),
    },
    {
      title: 'Premiums & Cost Sharing',
      fields: CSV_COLUMN_ORDER.filter(c =>
        ['calculatedMonthlyPremium', 'partcPremium', 'partdPremium', 'partbGiveback', 'annualDeductible', 'maximumOopc'].includes(c.key)
      ),
    },
    {
      title: 'Medical Copays',
      fields: CSV_COLUMN_ORDER.filter(c =>
        ['pcpCopayMin', 'specialistCopayMin', 'emergencyCopay', 'urgentCareCopay', 'inpatientCopay',
         'outpatientCopayMin', 'diagnosticCopay', 'labCopay', 'imagingCopayMin', 'dmeCopayMin',
         'mentalHealthOutpatientCopay', 'snfCopayDays1to20', 'homeHealthCopay', 'ambulanceCopay'].includes(c.key)
      ),
    },
    {
      title: 'Drug Coverage',
      fields: CSV_COLUMN_ORDER.filter(c =>
        ['drugDeductible', 'tier1CopayPreferred', 'tier2CopayPreferred', 'tier3CopayPreferred',
         'tier4CoinsurancePreferred', 'tier5CoinsurancePreferred', 'tier6CopayPreferred'].includes(c.key)
      ),
    },
    {
      title: 'Supplemental Benefits',
      fields: CSV_COLUMN_ORDER.filter(c =>
        ['dentalCoverageLimit', 'visionAllowance', 'hearingAidAllowance', 'otcAmountPerQuarter',
         'transportationAmountPerYear', 'mealBenefitAmount', 'flexCardAmount', 'groceryAllowanceAmount',
         'telehealthCopay', 'fitnessBenefitName', 'hasInHomeSupport'].includes(c.key)
      ),
    },
    {
      title: 'Quality & SNP',
      fields: CSV_COLUMN_ORDER.filter(c =>
        ['overallStarRating', 'snpType'].includes(c.key)
      ),
    },
  ];

  for (const section of sections) {
    // Check if we need a new page
    if (y > 680) {
      doc.addPage();
      y = 36;
    }

    // Section header
    doc.fontSize(14).font('Helvetica-Bold').text(section.title, margin, y);
    y += 20;
    doc.moveTo(margin, y).lineTo(540 + margin, y).stroke('#cccccc');
    y += 8;

    // Fields as label: value pairs
    doc.fontSize(12).font('Helvetica');
    for (const field of section.fields) {
      if (y > 700) {
        doc.addPage();
        y = 36;
      }
      const val = formatFieldValue(plan[field.key]);
      doc.font('Helvetica-Bold').text(`${field.label}:`, margin, y, { continued: true, width: 200 });
      doc.font('Helvetica').text(`  ${val}`, { width: 340 });
      y += 18;
    }

    y += 12;
  }
}

// ── Comparison format: plans as columns, fields as rows ──

function renderComparisonFormat(doc: PDFKit.PDFDocument, planRows: Record<string, any>[]): void {
  const margin = 36;
  const maxPlans = Math.min(planRows.length, 4); // Max 4 plans side by side
  const plansToShow = planRows.slice(0, maxPlans);

  const labelWidth = 140;
  const colWidth = Math.floor((700 - labelWidth) / maxPlans);
  let y = doc.y;

  // Column headers (plan names)
  doc.fontSize(10).font('Helvetica-Bold');
  let x = margin + labelWidth;
  for (const plan of plansToShow) {
    const name = String(plan.name || 'Unknown').substring(0, 25);
    doc.text(name, x, y, { width: colWidth - 5, align: 'left' });
    x += colWidth;
  }
  y += 20;
  doc.moveTo(margin, y).lineTo(margin + 700, y).stroke();
  y += 5;

  // Benefit rows — use a subset of key fields for comparison
  const comparisonFields: CsvColumn[] = [
    { key: 'organizationName', label: 'Carrier' },
    { key: 'calculatedMonthlyPremium', label: 'Monthly Premium' },
    { key: 'annualDeductible', label: 'Annual Deductible' },
    { key: 'maximumOopc', label: 'Max Out-of-Pocket' },
    { key: 'pcpCopayMin', label: 'PCP Copay' },
    { key: 'specialistCopayMin', label: 'Specialist Copay' },
    { key: 'emergencyCopay', label: 'Emergency Copay' },
    { key: 'urgentCareCopay', label: 'Urgent Care Copay' },
    { key: 'inpatientCopay', label: 'Inpatient Copay' },
    { key: 'outpatientCopayMin', label: 'Outpatient Copay' },
    { key: 'drugDeductible', label: 'Drug Deductible' },
    { key: 'tier1CopayPreferred', label: 'Tier 1 Copay' },
    { key: 'tier2CopayPreferred', label: 'Tier 2 Copay' },
    { key: 'dentalCoverageLimit', label: 'Dental Limit' },
    { key: 'visionAllowance', label: 'Vision Allowance' },
    { key: 'hearingAidAllowance', label: 'Hearing' },
    { key: 'otcAmountPerQuarter', label: 'OTC Amount' },
    { key: 'flexCardAmount', label: 'Flex Card' },
    { key: 'groceryAllowanceAmount', label: 'Grocery' },
    { key: 'transportationAmountPerYear', label: 'Transportation' },
    { key: 'mealBenefitAmount', label: 'Meals' },
    { key: 'telehealthCopay', label: 'Telehealth' },
    { key: 'overallStarRating', label: 'Star Rating' },
    { key: 'snpType', label: 'SNP Type' },
  ];

  let rowIdx = 0;
  for (const field of comparisonFields) {
    if (y > 550) {
      doc.addPage();
      y = 36;
    }

    // Alternate row background
    if (rowIdx % 2 === 0) {
      doc.rect(margin, y - 2, 700, 16).fill('#f8f8f8').fillColor('black');
    }

    // Label
    doc.fontSize(10).font('Helvetica-Bold').text(field.label, margin, y, { width: labelWidth - 5 });

    // Values for each plan
    x = margin + labelWidth;
    doc.fontSize(10).font('Helvetica');
    for (const plan of plansToShow) {
      const val = formatFieldValue(plan[field.key]);
      doc.text(val, x, y, { width: colWidth - 5, align: 'left' });
      x += colWidth;
    }

    y += 16;
    rowIdx++;
  }
}

// ── Matrix format: carrier-county grid ──

function renderMatrixFormat(doc: PDFKit.PDFDocument, planRows: Record<string, any>[]): void {
  const margin = 36;

  // Build carrier-county grid
  const carrierSet = new Set<string>();
  const countySet = new Set<string>();
  for (const p of planRows) {
    carrierSet.add(p.organizationName as string);
    countySet.add(p.county as string);
  }
  const carriers = Array.from(carrierSet).sort();
  const counties = Array.from(countySet).sort();

  // Build lookup: carrier+county -> plan count
  const lookup = new Map<string, number>();
  for (const plan of planRows) {
    const key = `${plan.organizationName}||${plan.county}`;
    lookup.set(key, (lookup.get(key) || 0) + 1);
  }

  let y = doc.y;

  doc.fontSize(12).font('Helvetica-Bold').text('Carrier-County Plan Distribution', margin, y, { align: 'center' });
  y += 24;

  // Column headers (counties) — show up to 8
  const maxCols = Math.min(counties.length, 8);
  const shownCounties = counties.slice(0, maxCols);
  const labelWidth = 160;
  const colWidth = Math.floor((700 - labelWidth) / maxCols);

  doc.fontSize(8).font('Helvetica-Bold');
  let x = margin + labelWidth;
  for (const county of shownCounties) {
    doc.text(county.substring(0, 15), x, y, { width: colWidth - 2, align: 'center' });
    x += colWidth;
  }
  y += 16;
  doc.moveTo(margin, y).lineTo(margin + 700, y).stroke();
  y += 4;

  // Rows (carriers)
  doc.fontSize(9).font('Helvetica');
  for (const carrier of carriers) {
    if (y > 550) {
      doc.addPage();
      y = 36;
    }

    doc.font('Helvetica-Bold').text(carrier.substring(0, 30), margin, y, { width: labelWidth - 5 });
    x = margin + labelWidth;
    doc.font('Helvetica');
    for (const county of shownCounties) {
      const cnt = lookup.get(`${carrier}||${county}`) || 0;
      doc.text(cnt > 0 ? String(cnt) : '-', x, y, { width: colWidth - 2, align: 'center' });
      x += colWidth;
    }
    y += 14;
  }
}

// ── Helpers ──

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    // Format currency-like values
    if (val === 0) return '$0';
    return val % 1 === 0 ? `$${val.toLocaleString()}` : `$${val.toFixed(2)}`;
  }
  return String(val);
}
