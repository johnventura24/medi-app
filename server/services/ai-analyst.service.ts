import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, sql, desc, asc, count, avg, min, max } from "drizzle-orm";

const MODEL = "claude-sonnet-4-5-20250929";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `You are Prism AI, the intelligent analyst for the Prism Medicare Superintelligence platform.

You have access to a database of 171,906+ Medicare Advantage plans from CMS CY2026 Plan Benefit Package (PBP) data covering 56 states/territories, 1,934 counties, and 301 carriers.

RULES:
- ALWAYS use the provided tools to fetch real data. NEVER invent or guess numbers.
- When answering, cite the actual data you retrieved (counts, averages, specific plan names).
- Format currency as dollars (e.g., $0.00, $156.50).
- Format responses with markdown: use **bold** for plan names and carriers, tables for comparisons, bullet points for lists.
- Keep responses concise and actionable — agents and FMOs are busy.
- If a query returns no results, say so clearly and suggest broadening the search.
- End responses about specific plans with: "*Verify details in the official Summary of Benefits and Evidence of Coverage.*"

AVAILABLE DATA FIELDS:
- Plan basics: name, organizationName (carrier), planType (HMO/PPO/PFFS), state, county, category
- Costs: calculatedMonthlyPremium, annualDeductible, maximumOopc (max out-of-pocket)
- Medical copays: PCP, specialist, emergency, urgent care, inpatient, outpatient, SNF, mental health
- Drug coverage (Part D): drugDeductible, tier1-6 copays/coinsurance
- Supplemental benefits: hasOtc, hasDental, hasTransportation, hasMealBenefit, hasTelehealth, hasFitnessBenefit
- Benefit amounts: otcAmountPerQuarter, flexCardAmount, groceryAllowanceAmount, dentalCoverageLimit, visionAllowance, hearingAidAllowance, transportationAmountPerYear, mealBenefitAmount, partbGiveback
- Quality: overallStarRating, highPerforming, lowPerforming
- SNP: snpType (D-SNP, C-SNP, etc.)`;

// Claude tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: "search_plans",
    description: "Search for Medicare Advantage plans matching specific criteria. Returns up to 10 plans with key details.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "2-letter state code (e.g., FL, TX, CA)" },
        county: { type: "string", description: "County name (e.g., Miami-Dade, Los Angeles)" },
        organizationName: { type: "string", description: "Carrier/organization name (e.g., UnitedHealthcare, Humana)" },
        planType: { type: "string", description: "Plan type: HMO, PPO, PFFS, HMO-POS" },
        maxPremium: { type: "number", description: "Maximum monthly premium" },
        minStarRating: { type: "number", description: "Minimum overall star rating (1-5)" },
        hasDental: { type: "boolean", description: "Must have dental coverage" },
        hasOtc: { type: "boolean", description: "Must have OTC benefit" },
        snpType: { type: "string", description: "SNP type filter: D-SNP, C-SNP, I-SNP" },
        orderBy: { type: "string", enum: ["premium_asc", "premium_desc", "stars_desc", "otc_desc", "dental_desc"], description: "Sort order" },
        limit: { type: "number", description: "Max results (default 10, max 10)" },
      },
    },
  },
  {
    name: "get_plan_stats",
    description: "Get aggregate statistics (count, average, min, max) for plans matching criteria. Use for questions like 'how many plans' or 'what's the average premium'.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "2-letter state code" },
        county: { type: "string", description: "County name" },
        organizationName: { type: "string", description: "Carrier name" },
        planType: { type: "string", description: "Plan type: HMO, PPO, PFFS" },
        metric: { type: "string", enum: ["premium", "deductible", "moop", "starRating", "otcAmount", "dentalLimit", "flexCard", "partbGiveback"], description: "Which metric to aggregate" },
      },
      required: ["metric"],
    },
  },
  {
    name: "compare_carriers",
    description: "Compare two or more carriers side-by-side in a specific geography. Shows plan count, avg premium, avg star rating, and benefit percentages.",
    input_schema: {
      type: "object" as const,
      properties: {
        carriers: { type: "array", items: { type: "string" }, description: "List of carrier names to compare" },
        state: { type: "string", description: "2-letter state code" },
        county: { type: "string", description: "County name (optional)" },
      },
      required: ["carriers", "state"],
    },
  },
  {
    name: "get_top_plans",
    description: "Get the top N plans ranked by a specific metric (e.g., highest star rating, lowest premium, richest OTC benefit).",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "2-letter state code" },
        county: { type: "string", description: "County name" },
        metric: { type: "string", enum: ["premium", "starRating", "otcAmount", "dentalLimit", "flexCard", "moop"], description: "Metric to rank by" },
        direction: { type: "string", enum: ["asc", "desc"], description: "Sort direction (asc=lowest first, desc=highest first)" },
        planType: { type: "string", description: "Filter by plan type" },
        limit: { type: "number", description: "Number of plans to return (default 5, max 10)" },
      },
      required: ["metric", "direction"],
    },
  },
  {
    name: "count_plans",
    description: "Count plans matching specific criteria. Use for 'how many plans have...' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: { type: "string" },
        county: { type: "string" },
        organizationName: { type: "string" },
        planType: { type: "string" },
        maxPremium: { type: "number" },
        minStarRating: { type: "number" },
        zeroPremium: { type: "boolean", description: "Only $0 premium plans" },
        hasDental: { type: "boolean" },
        hasOtc: { type: "boolean" },
        hasMealBenefit: { type: "boolean" },
        hasTransportation: { type: "boolean" },
        highPerforming: { type: "boolean" },
        snpType: { type: "string" },
      },
    },
  },
  {
    name: "get_plan_by_id",
    description: "Fetch complete details for a specific plan by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: { type: "number", description: "The plan's database ID" },
      },
      required: ["planId"],
    },
  },
];

// ── Query executors (unchanged) ──────────────────────────────────────

function buildFilters(params: Record<string, any>) {
  const conditions: any[] = [];
  if (params.state) conditions.push(eq(plans.state, params.state.toUpperCase()));
  if (params.county) conditions.push(sql`LOWER(${plans.county}) = LOWER(${params.county})`);
  if (params.organizationName) conditions.push(sql`LOWER(${plans.organizationName}) LIKE LOWER(${'%' + params.organizationName + '%'})`);
  if (params.planType) conditions.push(sql`LOWER(${plans.planType}) = LOWER(${params.planType})`);
  if (params.maxPremium != null) conditions.push(sql`${plans.calculatedMonthlyPremium} <= ${params.maxPremium}`);
  if (params.minStarRating != null) conditions.push(sql`${plans.overallStarRating} >= ${params.minStarRating}`);
  if (params.zeroPremium) conditions.push(eq(plans.calculatedMonthlyPremium, 0));
  if (params.hasDental) conditions.push(sql`${plans.dentalCoverageLimit} > 0`);
  if (params.hasOtc) conditions.push(eq(plans.hasOtc, true));
  if (params.hasMealBenefit) conditions.push(eq(plans.hasMealBenefit, true));
  if (params.hasTransportation) conditions.push(eq(plans.hasTransportation, true));
  if (params.highPerforming) conditions.push(eq(plans.highPerforming, true));
  if (params.snpType) conditions.push(eq(plans.snpType, params.snpType));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function getOrderBy(orderBy?: string) {
  switch (orderBy) {
    case "premium_asc": return asc(plans.calculatedMonthlyPremium);
    case "premium_desc": return desc(plans.calculatedMonthlyPremium);
    case "stars_desc": return desc(plans.overallStarRating);
    case "otc_desc": return desc(plans.otcAmountPerQuarter);
    case "dental_desc": return desc(plans.dentalCoverageLimit);
    default: return asc(plans.calculatedMonthlyPremium);
  }
}

function metricColumn(metric: string) {
  switch (metric) {
    case "premium": return plans.calculatedMonthlyPremium;
    case "deductible": return sql`CAST(${plans.annualDeductible} AS REAL)`;
    case "moop": return sql`CAST(${plans.maximumOopc} AS REAL)`;
    case "starRating": return plans.overallStarRating;
    case "otcAmount": return plans.otcAmountPerQuarter;
    case "dentalLimit": return plans.dentalCoverageLimit;
    case "flexCard": return plans.flexCardAmount;
    case "partbGiveback": return plans.partbGiveback;
    default: return plans.calculatedMonthlyPremium;
  }
}

function formatPlanResult(p: any) {
  return {
    id: p.id,
    name: p.name,
    carrier: p.organizationName,
    planType: p.planType,
    state: p.state,
    county: p.county,
    premium: p.calculatedMonthlyPremium,
    deductible: p.annualDeductible,
    moop: p.maximumOopc,
    starRating: p.overallStarRating,
    pcpCopay: p.pcpCopayMin,
    specialistCopay: p.specialistCopayMin,
    emergencyCopay: p.emergencyCopay,
    dental: p.dentalCoverageLimit,
    otcPerQuarter: p.otcAmountPerQuarter,
    flexCard: p.flexCardAmount,
    partbGiveback: p.partbGiveback,
    hasDental: (p.dentalCoverageLimit ?? 0) > 0,
    hasOtc: p.hasOtc,
    hasTransportation: p.hasTransportation,
    hasMealBenefit: p.hasMealBenefit,
  };
}

async function executeSearchPlans(params: Record<string, any>) {
  const limit = Math.min(params.limit || 10, 10);
  const where = buildFilters(params);
  const order = getOrderBy(params.orderBy);
  const results = await db.select().from(plans).where(where).orderBy(order).limit(limit);
  return results.map(formatPlanResult);
}

async function executeGetPlanStats(params: Record<string, any>) {
  const col = metricColumn(params.metric);
  const where = buildFilters(params);
  const result = await db
    .select({
      count: count(),
      avg: avg(col),
      min: min(col),
      max: max(col),
    })
    .from(plans)
    .where(where);
  const row = result[0];
  return {
    metric: params.metric,
    filters: { state: params.state, county: params.county, organizationName: params.organizationName, planType: params.planType },
    count: Number(row.count),
    average: row.avg ? Number(Number(row.avg).toFixed(2)) : null,
    minimum: row.min != null ? Number(row.min) : null,
    maximum: row.max != null ? Number(row.max) : null,
  };
}

async function executeCompareCarriers(params: Record<string, any>) {
  const results = [];
  for (const carrier of params.carriers) {
    const carrierFilters: Record<string, any> = { organizationName: carrier, state: params.state };
    if (params.county) carrierFilters.county = params.county;
    const where = buildFilters(carrierFilters);

    const stats = await db
      .select({
        count: count(),
        avgPremium: avg(plans.calculatedMonthlyPremium),
        avgStar: avg(plans.overallStarRating),
        avgOtc: avg(plans.otcAmountPerQuarter),
        avgDental: avg(plans.dentalCoverageLimit),
        pctOtc: sql<number>`ROUND(100.0 * COUNT(CASE WHEN ${plans.hasOtc} THEN 1 END) / NULLIF(COUNT(*), 0), 1)`,
        pctDental: sql<number>`ROUND(100.0 * COUNT(CASE WHEN ${plans.dentalCoverageLimit} > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 1)`,
      })
      .from(plans)
      .where(where);

    const row = stats[0];
    results.push({
      carrier,
      planCount: Number(row.count),
      avgPremium: row.avgPremium ? Number(Number(row.avgPremium).toFixed(2)) : null,
      avgStarRating: row.avgStar ? Number(Number(row.avgStar).toFixed(1)) : null,
      avgOtcPerQuarter: row.avgOtc ? Number(Number(row.avgOtc).toFixed(2)) : null,
      avgDentalLimit: row.avgDental ? Number(Number(row.avgDental).toFixed(2)) : null,
      pctWithOtc: row.pctOtc,
      pctWithDental: row.pctDental,
    });
  }
  return { state: params.state, county: params.county || "all", carriers: results };
}

async function executeGetTopPlans(params: Record<string, any>) {
  const limit = Math.min(params.limit || 5, 10);
  const col = metricColumn(params.metric);
  const order = params.direction === "desc" ? desc(col) : asc(col);
  const filterParams: Record<string, any> = {};
  if (params.state) filterParams.state = params.state;
  if (params.county) filterParams.county = params.county;
  if (params.planType) filterParams.planType = params.planType;
  const where = buildFilters(filterParams);
  const nonNull = params.direction === "desc" ? sql`${col} IS NOT NULL AND ${col} > 0` : sql`${col} IS NOT NULL`;
  const fullWhere = where ? and(where, nonNull) : nonNull;
  const results = await db.select().from(plans).where(fullWhere).orderBy(order).limit(limit);
  return results.map(formatPlanResult);
}

async function executeCountPlans(params: Record<string, any>) {
  const where = buildFilters(params);
  const result = await db.select({ count: count() }).from(plans).where(where);
  return { count: Number(result[0].count), filters: params };
}

async function executeGetPlanById(params: Record<string, any>) {
  const result = await db.select().from(plans).where(eq(plans.id, params.planId)).limit(1);
  if (result.length === 0) return { error: "Plan not found" };
  return formatPlanResult(result[0]);
}

// ── Tool dispatcher ──────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  switch (name) {
    case "search_plans": return executeSearchPlans(args);
    case "get_plan_stats": return executeGetPlanStats(args);
    case "compare_carriers": return executeCompareCarriers(args);
    case "get_top_plans": return executeGetTopPlans(args);
    case "count_plans": return executeCountPlans(args);
    case "get_plan_by_id": return executeGetPlanById(args);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ── Streaming chat orchestration (Claude) ────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  currentPage?: string;
  filters?: Record<string, any>;
}

export interface ChatChunk {
  type: "content" | "tool_start" | "tool_result" | "done" | "error";
  text?: string;
  toolName?: string;
}

export async function streamAnalystChat(
  userMessages: ChatMessage[],
  context: ChatContext,
  onChunk: (chunk: ChatChunk) => void,
): Promise<void> {
  const client = getClient();
  if (!client) {
    onChunk({ type: "error", text: "Anthropic API key not configured. Set ANTHROPIC_API_KEY to enable the AI analyst." });
    onChunk({ type: "done" });
    return;
  }

  // Build context-aware system prompt
  let systemPrompt = SYSTEM_PROMPT;
  if (context.currentPage) {
    systemPrompt += `\n\nThe user is currently viewing: ${context.currentPage}`;
  }
  if (context.filters && Object.keys(context.filters).length > 0) {
    systemPrompt += `\nActive filters: ${JSON.stringify(context.filters)}`;
  }

  // Convert to Claude message format
  const messages: Anthropic.MessageParam[] = userMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Tool-use loop (max 5 rounds)
  for (let round = 0; round < 5; round++) {
    const stream = client.messages.stream({
      model: MODEL,
      system: systemPrompt,
      messages,
      tools,
      max_tokens: 4096,
    });

    // Collect the full response for the tool loop
    let textContent = "";
    const toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          onChunk({ type: "tool_start", toolName: event.content_block.name });
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          textContent += event.delta.text;
          onChunk({ type: "content", text: event.delta.text });
        }
      }
    }

    // Get the final message to extract tool_use blocks
    const finalMessage = await stream.finalMessage();

    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0) {
      onChunk({ type: "done" });
      return;
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: finalMessage.content });

    // Execute tools and add results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tc of toolUseBlocks) {
      const result = await executeTool(tc.name, tc.input as Record<string, any>);
      const resultStr = JSON.stringify(result);
      onChunk({ type: "tool_result", toolName: tc.name, text: `Found ${Array.isArray(result) ? result.length + ' results' : 'data'}` });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tc.id,
        content: resultStr,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  onChunk({ type: "done" });
}
