/**
 * SEP Eligibility Checker Service
 *
 * Given a beneficiary's situation, determines exactly which Special Enrollment
 * Periods they qualify for, what they can do, best plans, and agent scripts.
 */

import { db } from "../db";
import { plans } from "@shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";

// ── Input / Output interfaces ──

export interface SEPCheckInput {
  hasMedicare: boolean;
  hasPartA: boolean;
  hasPartB: boolean;
  currentCoverage: "original_medicare" | "medicare_advantage" | "none";
  currentPlanName?: string;
  hasMedicaid: boolean;
  hasExtraHelp: boolean;
  recentlyMoved: boolean;
  moveDate?: string;
  lostEmployerCoverage: boolean;
  lostCoverageDate?: string;
  turningAge65: boolean;
  age65Date?: string;
  inNursingFacility: boolean;
  planTerminated: boolean;
  planSanctioned: boolean;
  hasChronicCondition: boolean;
  zipCode: string;
}

export interface SEPPlanRecommendation {
  planId: number;
  name: string;
  carrier: string;
  premium: number;
  whyItsGood: string;
}

export interface ActiveSEP {
  sepName: string;
  sepCode: string;
  eligible: boolean;
  window: { start: string; end: string; daysRemaining: number | null };
  whatYouCanDo: string[];
  bestPlans: SEPPlanRecommendation[];
  urgency: "high" | "medium" | "low";
  agentScript: string;
}

export interface SEPCheckResult {
  activeSEPs: ActiveSEP[];
  noSEPAvailable: boolean;
  nextOpportunity: { period: string; date: string; description: string } | null;
  recommendation: string;
}

// ── Helpers ──

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatShortDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysUntil(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDateStr(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ── Plan query helper ──

async function getTopPlansForZip(
  zipCode: string,
  filters?: { fiveStarOnly?: boolean; dsnpOnly?: boolean },
  limit = 3
): Promise<SEPPlanRecommendation[]> {
  try {
    let conditions: any[] = [eq(plans.zipcode, zipCode)];

    if (filters?.fiveStarOnly) {
      conditions.push(gte(plans.overallStarRating, 5));
    }
    if (filters?.dsnpOnly) {
      conditions.push(sql`${plans.snpType} ILIKE '%dual%' OR ${plans.snpType} ILIKE '%D-SNP%'`);
    }

    const rows = await db
      .select({
        id: plans.id,
        name: plans.name,
        carrier: plans.organizationName,
        premium: plans.calculatedMonthlyPremium,
        starRating: plans.overallStarRating,
        dental: plans.dentalCoverageLimit,
        hasOtc: plans.hasOtc,
        snpType: plans.snpType,
        planType: plans.planType,
      })
      .from(plans)
      .where(and(...conditions))
      .orderBy(desc(plans.overallStarRating), plans.calculatedMonthlyPremium)
      .limit(limit);

    return rows.map((r) => {
      const highlights: string[] = [];
      if ((r.starRating ?? 0) >= 4.5) highlights.push(`${r.starRating}-star rated`);
      if ((r.premium ?? 0) === 0) highlights.push("$0 premium");
      else if ((r.premium ?? 0) < 20) highlights.push(`Low premium ($${r.premium}/mo)`);
      if ((r.dental ?? 0) > 1000) highlights.push(`$${r.dental} dental`);
      if (r.hasOtc) highlights.push("Includes OTC benefit");
      if (r.snpType) highlights.push(`${r.snpType} plan`);

      return {
        planId: r.id,
        name: r.name,
        carrier: r.carrier,
        premium: r.premium ?? 0,
        whyItsGood: highlights.length > 0 ? highlights.join(", ") : "Good overall coverage",
      };
    });
  } catch {
    return [];
  }
}

async function has5StarPlansInZip(zipCode: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(plans)
      .where(and(eq(plans.zipcode, zipCode), gte(plans.overallStarRating, 5)));
    return Number(rows[0]?.cnt ?? 0) > 0;
  } catch {
    return false;
  }
}

// ── Main SEP Eligibility Check ──

export async function checkSEPEligibility(input: SEPCheckInput): Promise<SEPCheckResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const activeSEPs: ActiveSEP[] = [];

  // Fetch plans that will be used across checks
  const allTopPlans = await getTopPlansForZip(input.zipCode, {}, 5);
  const fiveStarPlans = await getTopPlansForZip(input.zipCode, { fiveStarOnly: true }, 3);
  const dsnpPlans = await getTopPlansForZip(input.zipCode, { dsnpOnly: true }, 3);

  // ── 1. 5-Star SEP ──
  const hasFiveStar = fiveStarPlans.length > 0 || await has5StarPlansInZip(input.zipCode);
  if (hasFiveStar && input.hasMedicare) {
    const yearEnd = new Date(currentYear, 11, 31);
    activeSEPs.push({
      sepName: "5-Star Special Enrollment Period",
      sepCode: "5_STAR",
      eligible: true,
      window: {
        start: formatShortDate(new Date(currentYear, 0, 1)),
        end: formatShortDate(yearEnd),
        daysRemaining: daysUntil(yearEnd),
      },
      whatYouCanDo: [
        "Join any Medicare Advantage plan with a 5-star overall rating",
        "Switch from your current plan to a 5-star plan",
        "This opportunity is available year-round",
      ],
      bestPlans: fiveStarPlans.length > 0 ? fiveStarPlans : allTopPlans.slice(0, 3),
      urgency: "medium",
      agentScript: `Good news — there are 5-star rated Medicare Advantage plans available in your area. Because these plans have earned CMS's highest quality rating, you can enroll at any time during the year, not just during open enrollment. This is a rare opportunity to get top-rated coverage whenever you're ready.`,
    });
  }

  // ── 2. Dual/LIS SEP ──
  if ((input.hasMedicaid || input.hasExtraHelp) && input.hasPartA && input.hasPartB) {
    const monthEnd = new Date(currentYear, now.getMonth() + 1, 0);
    activeSEPs.push({
      sepName: "Dual Eligible / Low-Income Subsidy SEP",
      sepCode: "DUAL_LIS",
      eligible: true,
      window: {
        start: formatShortDate(new Date(currentYear, now.getMonth(), 1)),
        end: formatShortDate(monthEnd),
        daysRemaining: daysUntil(monthEnd),
      },
      whatYouCanDo: [
        "Join any Medicare Advantage plan",
        "Switch to a different Medicare Advantage plan",
        "Switch to a D-SNP plan designed for dual-eligible beneficiaries",
        "Enroll in or switch Part D prescription drug plans",
        "You can switch once every month, all year long",
      ],
      bestPlans: dsnpPlans.length > 0 ? dsnpPlans : allTopPlans.slice(0, 3),
      urgency: "high",
      agentScript: input.hasMedicaid
        ? `Because you have both Medicare and Medicaid, you qualify for a special enrollment period that lets you change your plan once every month throughout the year. I'd like to show you some D-SNP plans specifically designed for people in your situation — they often include extra benefits like dental, vision, OTC allowances, and transportation at no additional cost to you.`
        : `Because you receive Extra Help with your prescription drug costs, you have the flexibility to change your Medicare plan once every month. Let me show you some plans that could give you better coverage and potentially lower your out-of-pocket costs.`,
    });
  }

  // ── 3. Moved SEP ──
  if (input.recentlyMoved) {
    const moveDate = parseDateStr(input.moveDate);
    if (moveDate) {
      const sepEnd = new Date(moveDate);
      sepEnd.setMonth(sepEnd.getMonth() + 2);
      const remaining = daysUntil(sepEnd);
      const isActive = remaining > 0;

      if (isActive) {
        activeSEPs.push({
          sepName: "Moved to New Area SEP",
          sepCode: "MOVED",
          eligible: true,
          window: {
            start: formatShortDate(moveDate),
            end: formatShortDate(sepEnd),
            daysRemaining: remaining,
          },
          whatYouCanDo: [
            "Join a Medicare Advantage plan available in your new area",
            "Switch to a different Medicare Advantage plan",
            "Join a Part D prescription drug plan",
            "Return to Original Medicare if desired",
          ],
          bestPlans: allTopPlans.slice(0, 3),
          urgency: remaining <= 14 ? "high" : remaining <= 30 ? "medium" : "low",
          agentScript: `Since you recently moved to a new area, you have a special 2-month window to enroll in or change your Medicare coverage. ${remaining <= 14 ? "Your window is closing soon — you only have " + remaining + " days left, so let's find you the best plan right away." : "You have " + remaining + " days remaining, which gives us time to find you the best plan in your new area."} Let me show you what's available in your ZIP code.`,
        });
      }
    }
  }

  // ── 4. Lost Employer Coverage SEP ──
  if (input.lostEmployerCoverage) {
    const lostDate = parseDateStr(input.lostCoverageDate);
    if (lostDate) {
      const sepEnd = new Date(lostDate);
      sepEnd.setMonth(sepEnd.getMonth() + 2);
      const remaining = daysUntil(sepEnd);
      const isActive = remaining > 0;

      if (isActive) {
        activeSEPs.push({
          sepName: "Lost Employer Coverage SEP",
          sepCode: "LOST_COVERAGE",
          eligible: true,
          window: {
            start: formatShortDate(lostDate),
            end: formatShortDate(sepEnd),
            daysRemaining: remaining,
          },
          whatYouCanDo: [
            "Enroll in a Medicare Advantage plan",
            "Enroll in a Medicare Advantage plan with Part D (MAPD)",
            "Enroll in a standalone Part D plan",
            "Enroll in a Medigap policy (no underwriting during this window)",
          ],
          bestPlans: allTopPlans.slice(0, 3),
          urgency: remaining <= 14 ? "high" : "medium",
          agentScript: `I understand you recently lost your employer health coverage. The good news is that you have a special enrollment window to choose a Medicare plan without any penalties. ${remaining <= 14 ? "Since your window closes in " + remaining + " days, I want to make sure we get you covered right away." : "You have " + remaining + " days to make your decision."} Let me walk you through the best options available to you.`,
        });
      }
    }
  }

  // ── 5. Initial Enrollment Period (IEP) ──
  if (input.turningAge65) {
    const age65Date = parseDateStr(input.age65Date);
    if (age65Date) {
      const iepStart = new Date(age65Date);
      iepStart.setMonth(iepStart.getMonth() - 3);
      const iepEnd = new Date(age65Date);
      iepEnd.setMonth(iepEnd.getMonth() + 3);
      const remaining = daysUntil(iepEnd);
      const isActive = now >= iepStart && remaining > 0;

      if (isActive) {
        activeSEPs.push({
          sepName: "Initial Enrollment Period (IEP)",
          sepCode: "IEP",
          eligible: true,
          window: {
            start: formatShortDate(iepStart),
            end: formatShortDate(iepEnd),
            daysRemaining: remaining,
          },
          whatYouCanDo: [
            "Enroll in Original Medicare (Part A and Part B)",
            "Join a Medicare Advantage plan",
            "Enroll in a Part D prescription drug plan",
            "Purchase a Medigap (Medicare Supplement) policy with guaranteed issue rights",
          ],
          bestPlans: allTopPlans.slice(0, 3),
          urgency: remaining <= 30 ? "high" : "medium",
          agentScript: `Congratulations on approaching your 65th birthday! You are currently in your Initial Enrollment Period, which is a 7-month window to make your Medicare choices. This is the most important enrollment period because it's your best opportunity to get coverage without any late enrollment penalties or medical underwriting. Let me help you understand all your options.`,
        });
      }
    }
  }

  // ── 6. Institutional SEP ──
  if (input.inNursingFacility && input.hasPartA && input.hasPartB) {
    const yearEnd = new Date(currentYear, 11, 31);
    activeSEPs.push({
      sepName: "Institutional Special Enrollment Period",
      sepCode: "INSTITUTIONAL",
      eligible: true,
      window: {
        start: formatShortDate(now),
        end: formatShortDate(yearEnd),
        daysRemaining: null, // continuous
      },
      whatYouCanDo: [
        "Join a Medicare Advantage plan at any time",
        "Switch between Medicare Advantage plans",
        "Enroll in an I-SNP plan designed for institutional care",
        "Return to Original Medicare if preferred",
        "This SEP is continuous — no deadline as long as you remain in a facility",
      ],
      bestPlans: allTopPlans.slice(0, 3),
      urgency: "low",
      agentScript: `Because you reside in a nursing facility or institution, you have a continuous special enrollment period. This means you can join or change your Medicare coverage at any time throughout the year. There are plans specifically designed for people in your situation that can provide specialized benefits and care coordination.`,
    });
  }

  // ── 7. Plan Termination SEP ──
  if (input.planTerminated) {
    const termStart = new Date(currentYear, 11, 8); // Dec 8
    const termEnd = new Date(currentYear + 1, 1, 28); // Feb 28
    // If we're past Feb 28 of current year, look at current year Dec 8 to next year Feb
    let windowStart = termStart;
    let windowEnd = termEnd;

    // Adjust if currently within the window from last year
    const lastYearDec8 = new Date(currentYear - 1, 11, 8);
    const thisYearFeb = new Date(currentYear, 1, 28);
    if (now >= lastYearDec8 && now <= thisYearFeb) {
      windowStart = lastYearDec8;
      windowEnd = thisYearFeb;
    }

    const remaining = daysUntil(windowEnd);
    const isActive = now >= windowStart && remaining > 0;

    if (isActive) {
      activeSEPs.push({
        sepName: "Plan Termination SEP",
        sepCode: "PLAN_TERM",
        eligible: true,
        window: {
          start: formatShortDate(windowStart),
          end: formatShortDate(windowEnd),
          daysRemaining: remaining,
        },
        whatYouCanDo: [
          "Enroll in another Medicare Advantage plan",
          "Switch to a Medicare Advantage plan with Part D",
          "Return to Original Medicare and enroll in a Part D plan",
        ],
        bestPlans: allTopPlans.slice(0, 3),
        urgency: "high",
        agentScript: `I see that your current plan is being terminated. This is a critical situation, but you do have options. You have a special enrollment window to choose a new plan. Let me help you find a replacement plan that provides equal or better coverage, so there's no gap in your benefits.`,
      });
    }
  }

  // ── 8. Plan Sanction SEP ──
  if (input.planSanctioned && input.hasPartA && input.hasPartB) {
    const yearEnd = new Date(currentYear, 11, 31);
    activeSEPs.push({
      sepName: "CMS Sanction SEP",
      sepCode: "SANCTION",
      eligible: true,
      window: {
        start: formatShortDate(now),
        end: formatShortDate(yearEnd),
        daysRemaining: daysUntil(yearEnd),
      },
      whatYouCanDo: [
        "Switch to any Medicare Advantage plan",
        "Enroll in a higher-rated plan",
        "Return to Original Medicare with a Part D plan",
        "Available as long as the CMS sanction is active against your plan",
      ],
      bestPlans: allTopPlans.slice(0, 3),
      urgency: "high",
      agentScript: `Your current plan has received a sanction from CMS, the agency that oversees Medicare. This means CMS has identified issues with your plan's performance. The good news is that this gives you the right to switch to a different plan at any time while the sanction is active. I strongly recommend we look at some better-rated alternatives for you.`,
    });
  }

  // ── 9. Integrated Care / D-SNP SEP ──
  if (input.hasMedicaid && input.hasPartA && input.hasPartB) {
    const monthEnd = new Date(currentYear, now.getMonth() + 1, 0);
    // Only add if DUAL_LIS wasn't already added (avoid duplicate)
    const hasDualLIS = activeSEPs.some((s) => s.sepCode === "DUAL_LIS");
    if (!hasDualLIS) {
      activeSEPs.push({
        sepName: "Integrated Care D-SNP SEP",
        sepCode: "INTEGRATED_CARE",
        eligible: true,
        window: {
          start: formatShortDate(new Date(currentYear, now.getMonth(), 1)),
          end: formatShortDate(monthEnd),
          daysRemaining: daysUntil(monthEnd),
        },
        whatYouCanDo: [
          "Enroll in a D-SNP (Dual Special Needs Plan) at any time",
          "Switch between D-SNP plans monthly",
          "Access integrated Medicare and Medicaid benefits",
        ],
        bestPlans: dsnpPlans.length > 0 ? dsnpPlans : allTopPlans.slice(0, 3),
        urgency: "medium",
        agentScript: `As someone with full Medicaid benefits, you have access to D-SNP plans that combine your Medicare and Medicaid benefits into one plan. These plans are specifically designed to coordinate all your care and often include extra benefits. You can enroll or switch monthly, so there's no rush, but I'd love to show you what's available.`,
      });
    }
  }

  // Sort by urgency
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  activeSEPs.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  // Determine next opportunity if no SEPs
  let nextOpportunity: SEPCheckResult["nextOpportunity"] = null;
  if (activeSEPs.length === 0) {
    const aepStart = new Date(currentYear, 9, 15); // Oct 15
    const oepStart = new Date(currentYear, 0, 1); // Jan 1
    const oepEnd = new Date(currentYear, 2, 31); // Mar 31
    const aepEnd = new Date(currentYear, 11, 7); // Dec 7

    if (now < aepStart) {
      nextOpportunity = {
        period: "Annual Enrollment Period (AEP)",
        date: formatShortDate(aepStart),
        description: `The Annual Enrollment Period starts ${formatDate(aepStart)} (${daysUntil(aepStart)} days away). During AEP, you can join, switch, or drop a Medicare Advantage or Part D plan.`,
      };
    } else if (now >= aepStart && now <= aepEnd) {
      nextOpportunity = {
        period: "Annual Enrollment Period (AEP)",
        date: formatShortDate(aepStart),
        description: "AEP is happening right now! You can enroll or switch plans until December 7.",
      };
    } else {
      const nextOepStart = new Date(currentYear + 1, 0, 1);
      nextOpportunity = {
        period: "Open Enrollment Period (OEP)",
        date: formatShortDate(nextOepStart),
        description: `The Open Enrollment Period starts ${formatDate(nextOepStart)} (${daysUntil(nextOepStart)} days away). During OEP, you can switch between MA plans or return to Original Medicare.`,
      };
    }
  }

  // Build recommendation
  let recommendation = "";
  if (activeSEPs.length === 0) {
    recommendation = "You don't currently qualify for any Special Enrollment Periods. Your next opportunity will be during the Annual Enrollment Period. In the meantime, you can compare plans and be ready to enroll when the window opens.";
  } else if (activeSEPs.length === 1) {
    recommendation = `You qualify for the ${activeSEPs[0].sepName}. ${activeSEPs[0].urgency === "high" ? "Act soon — this is time-sensitive." : "Take your time to review the available options."}`;
  } else {
    const urgent = activeSEPs.filter((s) => s.urgency === "high");
    recommendation = `You qualify for ${activeSEPs.length} Special Enrollment Periods. ${urgent.length > 0 ? `Focus on the ${urgent[0].sepName} first as it requires urgent attention.` : "Review each option to find the best fit for your situation."}`;
  }

  return {
    activeSEPs,
    noSEPAvailable: activeSEPs.length === 0,
    nextOpportunity,
    recommendation,
  };
}
