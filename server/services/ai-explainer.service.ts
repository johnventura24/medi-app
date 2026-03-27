import { createHash } from "crypto";
import OpenAI from "openai";
import { db } from "../db";
import { aiExplanations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { Plan, Client } from "@shared/schema";

const MODEL = "gpt-4o-mini";
const DISCLAIMER =
  "\n\n*AI-generated summary. Verify details in the official Summary of Benefits and Evidence of Coverage.*";

/**
 * Compute a SHA256 hash of the relevant plan fields for cache invalidation.
 */
export function computePlanDataHash(plan: Plan, client?: Client | null): string {
  const relevantFields = {
    id: plan.id,
    name: plan.name,
    organizationName: plan.organizationName,
    planType: plan.planType,
    calculatedMonthlyPremium: plan.calculatedMonthlyPremium,
    annualDeductible: plan.annualDeductible,
    maximumOopc: plan.maximumOopc,
    pcpCopayMin: plan.pcpCopayMin,
    pcpCopayMax: plan.pcpCopayMax,
    specialistCopayMin: plan.specialistCopayMin,
    specialistCopayMax: plan.specialistCopayMax,
    emergencyCopay: plan.emergencyCopay,
    urgentCareCopay: plan.urgentCareCopay,
    inpatientCopay: plan.inpatientCopay,
    outpatientCopayMin: plan.outpatientCopayMin,
    outpatientCopayMax: plan.outpatientCopayMax,
    drugDeductible: plan.drugDeductible,
    tier1CopayPreferred: plan.tier1CopayPreferred,
    tier2CopayPreferred: plan.tier2CopayPreferred,
    tier3CopayPreferred: plan.tier3CopayPreferred,
    tier4CoinsurancePreferred: plan.tier4CoinsurancePreferred,
    tier5CoinsurancePreferred: plan.tier5CoinsurancePreferred,
    dentalCoverageLimit: plan.dentalCoverageLimit,
    visionAllowance: plan.visionAllowance,
    hearingAidAllowance: plan.hearingAidAllowance,
    hasOtc: plan.hasOtc,
    hasTransportation: plan.hasTransportation,
    hasMealBenefit: plan.hasMealBenefit,
    hasTelehealth: plan.hasTelehealth,
    hasSilverSneakers: plan.hasSilverSneakers,
    hasFitnessBenefit: plan.hasFitnessBenefit,
    hasInHomeSupport: plan.hasInHomeSupport,
    overallStarRating: plan.overallStarRating,
    otcAmountPerQuarter: plan.otcAmountPerQuarter,
    flexCardAmount: plan.flexCardAmount,
    groceryAllowanceAmount: plan.groceryAllowanceAmount,
    transportationAmountPerYear: plan.transportationAmountPerYear,
    mealBenefitAmount: plan.mealBenefitAmount,
    partbGiveback: plan.partbGiveback,
    clientId: client?.id ?? null,
  };

  return createHash("sha256")
    .update(JSON.stringify(relevantFields))
    .digest("hex");
}

/**
 * Compute a combined hash for multiple plans (used for comparison caching).
 */
function computeMultiPlanHash(plans: Plan[], client?: Client | null): string {
  const combined = plans
    .map((p) => computePlanDataHash(p, client))
    .sort()
    .join("|");
  return createHash("sha256").update(combined).digest("hex");
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function formatDollar(val: number | null | undefined): string {
  if (val == null) return "N/A";
  return `$${val.toFixed(2)}`;
}

function formatCopayRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return "N/A";
  if (min != null && max != null && min !== max) {
    return `$${min} - $${max}`;
  }
  return formatDollar(min ?? max);
}

function buildPlanSummaryPrompt(plan: Plan, client?: Client | null): string {
  const lines: string[] = [
    "You are a Medicare plan advisor. Generate a clear, factual, plain-English summary of this Medicare Advantage plan.",
    'Do NOT use superlatives like "best" or "most." Do NOT imply government endorsement.',
    "",
    `Plan: ${plan.name} by ${plan.organizationName}`,
    `Type: ${plan.planType || "N/A"}`,
    `Category: ${plan.category || "N/A"}`,
    `State: ${plan.state}, County: ${plan.county}`,
    `Premium: ${formatDollar(plan.calculatedMonthlyPremium)}/month`,
    `Part B Giveback: ${formatDollar(plan.partbGiveback)}`,
    `Deductible: ${plan.annualDeductible || "N/A"}`,
    `Max Out-of-Pocket: ${plan.maximumOopc || "N/A"}`,
    "",
    "--- Doctor Visits ---",
    `PCP Copay: ${formatCopayRange(plan.pcpCopayMin, plan.pcpCopayMax)}`,
    `Specialist Copay: ${formatCopayRange(plan.specialistCopayMin, plan.specialistCopayMax)}`,
    `Telehealth Copay: ${formatDollar(plan.telehealthCopay)}`,
    "",
    "--- Hospital & Emergency ---",
    `Emergency Copay: ${formatDollar(plan.emergencyCopay)}`,
    `Urgent Care Copay: ${formatDollar(plan.urgentCareCopay)}`,
    `Inpatient Copay: ${formatDollar(plan.inpatientCopay)}`,
    `Outpatient Copay: ${formatCopayRange(plan.outpatientCopayMin, plan.outpatientCopayMax)}`,
    `Ambulance Copay: ${formatDollar(plan.ambulanceCopay)}`,
    `SNF Days 1-20: ${formatDollar(plan.snfCopayDays1to20)}`,
    `SNF Days 21-100: ${formatDollar(plan.snfCopayDays21to100)}`,
    "",
    "--- Drug Coverage (Part D) ---",
    `Drug Deductible: ${formatDollar(plan.drugDeductible)}`,
    `Tier 1 (Preferred): ${formatDollar(plan.tier1CopayPreferred)}`,
    `Tier 2 (Preferred): ${formatDollar(plan.tier2CopayPreferred)}`,
    `Tier 3 (Preferred): ${formatDollar(plan.tier3CopayPreferred)}`,
    `Tier 4 (Preferred): ${plan.tier4CoinsurancePreferred != null ? plan.tier4CoinsurancePreferred + "%" : "N/A"}`,
    `Tier 5 (Preferred): ${plan.tier5CoinsurancePreferred != null ? plan.tier5CoinsurancePreferred + "%" : "N/A"}`,
    "",
    "--- Extra Benefits ---",
    `Dental Coverage Limit: ${formatDollar(plan.dentalCoverageLimit)}`,
    `Dental Preventive: ${plan.dentalPreventiveCovered ? "Yes" : "N/A"}`,
    `Dental Comprehensive: ${plan.dentalComprehensiveCovered ? "Yes" : "N/A"}`,
    `Vision Allowance: ${formatDollar(plan.visionAllowance)}`,
    `Vision Exam Copay: ${formatDollar(plan.visionExamCopay)}`,
    `Hearing Aid Allowance: ${formatDollar(plan.hearingAidAllowance)}`,
    `OTC Allowance: ${plan.hasOtc ? formatDollar(plan.otcAmountPerQuarter) + "/quarter" : "Not included"}`,
    `Transportation: ${plan.hasTransportation ? (plan.transportationTripsPerYear ? plan.transportationTripsPerYear + " trips/year" : "Yes") + (plan.transportationAmountPerYear ? " (" + formatDollar(plan.transportationAmountPerYear) + "/year)" : "") : "Not included"}`,
    `Meal Benefit: ${plan.hasMealBenefit ? formatDollar(plan.mealBenefitAmount) : "Not included"}`,
    `Flex Card: ${plan.flexCardAmount ? formatDollar(plan.flexCardAmount) + " " + (plan.flexCardFrequency || "") : "Not included"}`,
    `Grocery Allowance: ${plan.groceryAllowanceAmount ? formatDollar(plan.groceryAllowanceAmount) + " " + (plan.groceryAllowanceFrequency || "") : "Not included"}`,
    `Fitness: ${plan.hasFitnessBenefit ? (plan.fitnessBenefitName || "Yes") : "Not included"}`,
    `SilverSneakers: ${plan.hasSilverSneakers ? "Yes" : "No"}`,
    `In-Home Support: ${plan.hasInHomeSupport ? (plan.inHomeSupportHoursPerYear ? plan.inHomeSupportHoursPerYear + " hours/year" : "Yes") : "Not included"}`,
    "",
    "--- Quality ---",
    `Overall Star Rating: ${plan.overallStarRating != null ? plan.overallStarRating + "/5" : "Not rated"}`,
    `High Performing: ${plan.highPerforming ? "Yes" : "No"}`,
    `Low Performing: ${plan.lowPerforming ? "Yes" : "No"}`,
    `SNP Type: ${plan.snpType || "None"}`,
    `Requires PCP Referral: ${plan.requiresPcpReferral ? "Yes" : "No"}`,
  ];

  if (client) {
    lines.push("");
    lines.push("--- Beneficiary Context ---");
    lines.push(`The beneficiary lives in ZIP ${client.zipCode}${client.county ? ", " + client.county + " County" : ""}.`);
    if (client.chronicConditions && Array.isArray(client.chronicConditions) && (client.chronicConditions as string[]).length > 0) {
      lines.push(`Chronic conditions: ${(client.chronicConditions as string[]).join(", ")}.`);
    }
    if (client.medications && Array.isArray(client.medications) && (client.medications as any[]).length > 0) {
      const medNames = (client.medications as any[]).map((m: any) => m.name || m).join(", ");
      lines.push(`Takes medications: ${medNames}.`);
    }
    if (client.mustHaveBenefits && Array.isArray(client.mustHaveBenefits) && (client.mustHaveBenefits as string[]).length > 0) {
      lines.push(`Prioritizes these benefits: ${(client.mustHaveBenefits as string[]).join(", ")}.`);
    }
    if (client.mobilityLevel) {
      lines.push(`Mobility level: ${client.mobilityLevel}.`);
    }
    if (client.hospitalizedLastYear) {
      lines.push("Was hospitalized in the last year.");
    }
  }

  lines.push("");
  lines.push("Structure your response with these sections:");
  lines.push("1. Monthly Costs");
  lines.push("2. Doctor Visit Costs");
  lines.push("3. Hospital & Emergency");
  lines.push("4. Drug Coverage");
  lines.push("5. Extra Benefits");
  lines.push("6. Quality Rating");
  lines.push("7. Who This Plan Is Best Suited For");

  return lines.join("\n");
}

function buildComparisonPrompt(plansList: Plan[], client?: Client | null): string {
  const lines: string[] = [
    "You are a Medicare plan advisor. Compare the following Medicare Advantage plans side by side.",
    'Be factual and balanced. Do NOT use superlatives like "best" or "most." Do NOT imply government endorsement.',
    "Highlight the key differences between the plans in terms of costs, coverage, and extra benefits.",
    "",
  ];

  for (let i = 0; i < plansList.length; i++) {
    const plan = plansList[i];
    lines.push(`--- Plan ${i + 1}: ${plan.name} by ${plan.organizationName} ---`);
    lines.push(`Type: ${plan.planType || "N/A"}`);
    lines.push(`Premium: ${formatDollar(plan.calculatedMonthlyPremium)}/month`);
    lines.push(`Deductible: ${plan.annualDeductible || "N/A"}`);
    lines.push(`Max Out-of-Pocket: ${plan.maximumOopc || "N/A"}`);
    lines.push(`PCP Copay: ${formatCopayRange(plan.pcpCopayMin, plan.pcpCopayMax)}`);
    lines.push(`Specialist Copay: ${formatCopayRange(plan.specialistCopayMin, plan.specialistCopayMax)}`);
    lines.push(`Emergency Copay: ${formatDollar(plan.emergencyCopay)}`);
    lines.push(`Inpatient Copay: ${formatDollar(plan.inpatientCopay)}`);
    lines.push(`Drug Deductible: ${formatDollar(plan.drugDeductible)}`);
    lines.push(`Dental: ${formatDollar(plan.dentalCoverageLimit)}`);
    lines.push(`Vision: ${formatDollar(plan.visionAllowance)}`);
    lines.push(`OTC: ${plan.hasOtc ? formatDollar(plan.otcAmountPerQuarter) + "/quarter" : "No"}`);
    lines.push(`Transportation: ${plan.hasTransportation ? "Yes" : "No"}`);
    lines.push(`Meal Benefit: ${plan.hasMealBenefit ? "Yes" : "No"}`);
    lines.push(`Flex Card: ${plan.flexCardAmount ? formatDollar(plan.flexCardAmount) : "No"}`);
    lines.push(`Star Rating: ${plan.overallStarRating != null ? plan.overallStarRating + "/5" : "Not rated"}`);
    lines.push("");
  }

  if (client) {
    lines.push("--- Beneficiary Context ---");
    lines.push(`The beneficiary lives in ZIP ${client.zipCode}.`);
    if (client.chronicConditions && Array.isArray(client.chronicConditions) && (client.chronicConditions as string[]).length > 0) {
      lines.push(`Chronic conditions: ${(client.chronicConditions as string[]).join(", ")}.`);
    }
    if (client.medications && Array.isArray(client.medications) && (client.medications as any[]).length > 0) {
      const medNames = (client.medications as any[]).map((m: any) => m.name || m).join(", ");
      lines.push(`Takes medications: ${medNames}.`);
    }
    if (client.mustHaveBenefits && Array.isArray(client.mustHaveBenefits) && (client.mustHaveBenefits as string[]).length > 0) {
      lines.push(`Prioritizes: ${(client.mustHaveBenefits as string[]).join(", ")}.`);
    }
    lines.push("");
  }

  lines.push("Structure your response with these sections:");
  lines.push("1. Cost Comparison (premiums, deductibles, out-of-pocket)");
  lines.push("2. Medical Coverage Comparison (copays for doctors, hospitals, emergency)");
  lines.push("3. Drug Coverage Comparison");
  lines.push("4. Extra Benefits Comparison");
  lines.push("5. Quality & Ratings");
  lines.push("6. Which Plan Suits Different Needs");

  return lines.join("\n");
}

/**
 * Generate a plain-English plan summary using OpenAI.
 * Returns cached content if available and the plan data hash matches.
 */
export async function explainPlan(plan: Plan, client?: Client | null): Promise<{ content: string; cached: boolean; tokensUsed?: number }> {
  const hash = computePlanDataHash(plan, client);

  // Check cache
  try {
    const conditions = [
      eq(aiExplanations.planId, plan.id),
      eq(aiExplanations.planDataHash, hash),
      eq(aiExplanations.explanationType, "plan_summary"),
    ];
    if (client) {
      conditions.push(eq(aiExplanations.clientId, client.id));
    }

    const cached = await db
      .select()
      .from(aiExplanations)
      .where(and(...conditions))
      .limit(1);

    if (cached.length > 0) {
      return { content: cached[0].content, cached: true };
    }
  } catch (err) {
    console.error("AI explanation cache lookup error:", err);
  }

  // Call OpenAI
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      content: "AI plan explanations are not available. The OPENAI_API_KEY environment variable is not configured." + DISCLAIMER,
      cached: false,
    };
  }

  const prompt = buildPlanSummaryPrompt(plan, client);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const content = (response.choices[0]?.message?.content || "Unable to generate explanation.") + DISCLAIMER;
    const tokensUsed = response.usage?.total_tokens ?? undefined;

    // Cache the result
    try {
      await db.insert(aiExplanations).values({
        planId: plan.id,
        clientId: client?.id ?? null,
        explanationType: "plan_summary",
        content,
        model: MODEL,
        tokensUsed: tokensUsed ?? null,
        planDataHash: hash,
      });
    } catch (err) {
      console.error("AI explanation cache write error:", err);
    }

    return { content, cached: false, tokensUsed };
  } catch (err: any) {
    console.error("OpenAI API error:", err.message);
    return {
      content: `AI explanation generation failed: ${err.message}` + DISCLAIMER,
      cached: false,
    };
  }
}

/**
 * Generate a comparison narrative for multiple plans using OpenAI.
 */
export async function comparePlans(plansList: Plan[], client?: Client | null): Promise<{ content: string; cached: boolean; tokensUsed?: number }> {
  if (plansList.length === 0) {
    return { content: "No plans provided for comparison.", cached: false };
  }

  const hash = computeMultiPlanHash(plansList, client);
  // Use the first plan's ID as the reference for caching comparisons
  const refPlanId = plansList[0].id;

  // Check cache
  try {
    const conditions = [
      eq(aiExplanations.planId, refPlanId),
      eq(aiExplanations.planDataHash, hash),
      eq(aiExplanations.explanationType, "comparison"),
    ];
    if (client) {
      conditions.push(eq(aiExplanations.clientId, client.id));
    }

    const cached = await db
      .select()
      .from(aiExplanations)
      .where(and(...conditions))
      .limit(1);

    if (cached.length > 0) {
      return { content: cached[0].content, cached: true };
    }
  } catch (err) {
    console.error("AI comparison cache lookup error:", err);
  }

  // Call OpenAI
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      content: "AI plan comparisons are not available. The OPENAI_API_KEY environment variable is not configured." + DISCLAIMER,
      cached: false,
    };
  }

  const prompt = buildComparisonPrompt(plansList, client);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.3,
    });

    const content = (response.choices[0]?.message?.content || "Unable to generate comparison.") + DISCLAIMER;
    const tokensUsed = response.usage?.total_tokens ?? undefined;

    // Cache the result
    try {
      await db.insert(aiExplanations).values({
        planId: refPlanId,
        clientId: client?.id ?? null,
        explanationType: "comparison",
        content,
        model: MODEL,
        tokensUsed: tokensUsed ?? null,
        planDataHash: hash,
      });
    } catch (err) {
      console.error("AI comparison cache write error:", err);
    }

    return { content, cached: false, tokensUsed };
  } catch (err: any) {
    console.error("OpenAI API error:", err.message);
    return {
      content: `AI comparison generation failed: ${err.message}` + DISCLAIMER,
      cached: false,
    };
  }
}
