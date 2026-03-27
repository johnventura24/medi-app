/**
 * Export Routes — CSV and PDF download endpoints
 *
 * GET /api/export/csv?scope={plans|states|cities|zips|carriers}&filters={JSON}
 * GET /api/export/pdf?scope={plan_detail|comparison|matrix}&ids={comma-separated}&filters={JSON}
 */
import { Router } from "express";
import { db } from "../db";
import { plans, exportLogs } from "@shared/schema";
import { eq, and, inArray, sql, like } from "drizzle-orm";
import { generateCSV, generatePDF, type PDFOptions } from "../services/export.service";

const router = Router();

// ── Shared filter parsing ──

interface ExportFilters {
  state?: string;
  county?: string;
  carrier?: string;
  planType?: string;
  zipcode?: string;
  category?: string;
}

function parseFilters(raw: string | undefined): ExportFilters {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ExportFilters;
  } catch {
    return {};
  }
}

function buildWhereConditions(filters: ExportFilters, queryParams: Record<string, any>) {
  // Merge query-string params with JSON filters (query params take precedence)
  const merged: ExportFilters = {
    ...filters,
    ...(queryParams.state ? { state: String(queryParams.state) } : {}),
    ...(queryParams.county ? { county: String(queryParams.county) } : {}),
    ...(queryParams.carrier ? { carrier: String(queryParams.carrier) } : {}),
    ...(queryParams.planType ? { planType: String(queryParams.planType) } : {}),
    ...(queryParams.zipcode ? { zipcode: String(queryParams.zipcode) } : {}),
    ...(queryParams.category ? { category: String(queryParams.category) } : {}),
  };

  const conditions = [];
  if (merged.state) conditions.push(eq(plans.state, merged.state.toUpperCase()));
  if (merged.county) conditions.push(eq(plans.county, merged.county));
  if (merged.carrier) conditions.push(eq(plans.organizationName, merged.carrier));
  if (merged.planType) conditions.push(eq(plans.planType, merged.planType));
  if (merged.zipcode) conditions.push(eq(plans.zipcode, merged.zipcode));
  if (merged.category) conditions.push(eq(plans.category, merged.category));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function logExport(
  exportType: string,
  exportScope: string,
  filters: ExportFilters,
  rowCount: number
): Promise<void> {
  try {
    await db.insert(exportLogs).values({
      exportType,
      exportScope,
      filters: filters as Record<string, unknown>,
      rowCount,
    });
  } catch (err) {
    // Non-critical — log but don't fail the export
    console.error("Failed to log export:", err);
  }
}

// ── GET /api/export/csv ──

router.get("/csv", async (req, res) => {
  try {
    const scope = String(req.query.scope || 'plans');
    const filters = parseFilters(req.query.filters as string | undefined);
    const whereClause = buildWhereConditions(filters, req.query);

    const rows = await db.select()
      .from(plans)
      .where(whereClause)
      .limit(10000);

    const csv = generateCSV(rows);

    const dateSuffix = new Date().toISOString().split('T')[0];
    const filename = `${scope}_${dateSuffix}.csv`;

    // Log the export
    await logExport('csv', scope, filters, rows.length);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    console.error("CSV export error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate CSV export" });
  }
});

// ── GET /api/export/pdf ──

router.get("/pdf", async (req, res) => {
  try {
    const scope = String(req.query.scope || 'plan_detail') as 'plan_detail' | 'comparison' | 'matrix';
    const idsParam = req.query.ids as string | undefined;
    const filters = parseFilters(req.query.filters as string | undefined);
    const titleParam = req.query.title as string | undefined;

    let rows: Record<string, any>[];
    let pdfOptions: PDFOptions;

    if (scope === 'plan_detail') {
      // Single plan detail
      const ids = idsParam ? idsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
      if (ids.length === 0) {
        return res.status(400).json({ error: "Plan ID required for plan_detail scope. Use ids parameter." });
      }
      rows = await db.select().from(plans).where(eq(plans.id, ids[0])).limit(1);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Plan not found" });
      }
      pdfOptions = {
        title: titleParam || `Plan Detail: ${rows[0].name}`,
        subtitle: `${rows[0].organizationName} — ${rows[0].state}, ${rows[0].county}`,
        format: 'detail',
      };
    } else if (scope === 'comparison') {
      // Multiple plans comparison
      const ids = idsParam ? idsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
      if (ids.length < 2) {
        return res.status(400).json({ error: "At least 2 plan IDs required for comparison. Use ids parameter." });
      }
      rows = await db.select().from(plans).where(inArray(plans.id, ids)).limit(10);
      if (rows.length === 0) {
        return res.status(404).json({ error: "No plans found for the provided IDs" });
      }
      pdfOptions = {
        title: titleParam || 'Plan Comparison',
        subtitle: `Comparing ${rows.length} plans`,
        format: 'comparison',
      };
    } else if (scope === 'matrix') {
      // Carrier-county matrix
      const whereClause = buildWhereConditions(filters, req.query);
      rows = await db.select().from(plans).where(whereClause).limit(5000);
      if (rows.length === 0) {
        return res.status(404).json({ error: "No plans found matching filters" });
      }
      const carrierLabel = filters.carrier || 'All Carriers';
      pdfOptions = {
        title: titleParam || `Carrier-County Matrix`,
        subtitle: `${carrierLabel} — ${rows.length} plans`,
        format: 'matrix',
      };
    } else {
      return res.status(400).json({ error: `Invalid scope: ${scope}. Use plan_detail, comparison, or matrix.` });
    }

    const pdfBuffer = await generatePDF(rows, pdfOptions);

    const dateSuffix = new Date().toISOString().split('T')[0];
    const filename = `${scope}_${dateSuffix}.pdf`;

    // Log the export
    await logExport('pdf', scope, filters, rows.length);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("PDF export error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate PDF export" });
  }
});

export default router;
