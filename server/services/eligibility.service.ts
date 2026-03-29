/**
 * Eligibility Engine Service
 *
 * Self-reported eligibility questionnaire that determines what plans
 * a beneficiary qualifies for WITHOUT needing CMS BEQ access.
 */

export interface EligibilityInput {
  age: number;
  hasPartA: boolean;
  hasPartB: boolean;
  hasMedicaid: boolean;
  hasChronicCondition: boolean;
  chronicConditions?: string[];
  isInstitutionalized: boolean;
  currentCoverage: "none" | "original_medicare" | "medicare_advantage" | "employer" | "medicaid";
  currentPlanName?: string;
  partAEffectiveDate?: string; // YYYY-MM
  turningAge65Date?: string; // YYYY-MM for IEP
  recentlyMoved?: boolean;
  lostEmployerCoverage?: boolean;
}

export interface EligibilityResult {
  eligible: {
    ma: boolean;
    mapd: boolean;
    pdp: boolean;
    medigap: boolean;
    dsnp: boolean;
    csnp: boolean;
    isnp: boolean;
  };
  enrollmentPeriods: {
    iep: { eligible: boolean; reason: string; window?: string };
    aep: { eligible: boolean; reason: string; window: string };
    oep: { eligible: boolean; reason: string; window: string };
    sep: { eligible: boolean; reasons: string[] };
    dualSep: { eligible: boolean; reason: string };
  };
  recommendations: string[];
  warnings: string[];
  nextSteps: string[];
}

const CSNP_CONDITIONS = [
  "diabetes",
  "copd",
  "chronic_lung",
  "heart_failure",
  "cardiovascular",
  "esrd",
];

function parseMonth(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}$/.test(dateStr)) return null;
  const [year, month] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function determineEligibility(input: EligibilityInput): EligibilityResult {
  const now = new Date();
  const currentYear = now.getFullYear();

  // ── Plan type eligibility ──
  const hasPartAB = input.hasPartA && input.hasPartB;

  const eligible = {
    ma: hasPartAB,
    mapd: hasPartAB,
    pdp: input.hasPartA || input.hasPartB, // Part D standalone requires Part A or B
    medigap: hasPartAB,
    dsnp: hasPartAB && input.hasMedicaid,
    csnp:
      hasPartAB &&
      input.hasChronicCondition &&
      (input.chronicConditions ?? []).some((c) =>
        CSNP_CONDITIONS.includes(c.toLowerCase())
      ),
    isnp: hasPartAB && input.isInstitutionalized,
  };

  // ── Enrollment periods ──

  // IEP: 7-month window around turning 65
  let iep: EligibilityResult["enrollmentPeriods"]["iep"] = {
    eligible: false,
    reason: "The Initial Enrollment Period applies when you first turn 65.",
  };

  if (input.turningAge65Date) {
    const t65 = parseMonth(input.turningAge65Date);
    if (t65) {
      const iepStart = new Date(t65);
      iepStart.setMonth(iepStart.getMonth() - 3);
      const iepEnd = new Date(t65);
      iepEnd.setMonth(iepEnd.getMonth() + 3);

      const inIep = now >= iepStart && now <= iepEnd;
      const windowStr = `${formatMonthYear(iepStart)} through ${formatMonthYear(iepEnd)}`;

      iep = {
        eligible: inIep,
        reason: inIep
          ? "You are currently in your Initial Enrollment Period! This is the best time to enroll."
          : `Your IEP window is ${windowStr}.`,
        window: windowStr,
      };
    }
  } else if (input.age >= 64 && input.age <= 65) {
    iep = {
      eligible: true,
      reason:
        "You may be in or near your Initial Enrollment Period. This is a great time to explore all your options.",
    };
  }

  // AEP: Oct 15 - Dec 7 every year
  const aepStart = new Date(currentYear, 9, 15); // Oct 15
  const aepEnd = new Date(currentYear, 11, 7); // Dec 7
  const inAep = now >= aepStart && now <= aepEnd;
  const aep = {
    eligible: inAep,
    reason: inAep
      ? "Annual Enrollment is open right now! You can join, switch, or drop a Medicare Advantage or Part D plan."
      : "The Annual Enrollment Period runs October 15 through December 7 each year.",
    window: `October 15 - December 7, ${inAep ? currentYear : currentYear}`,
  };

  // OEP: Jan 1 - Mar 31
  const oepStart = new Date(currentYear, 0, 1);
  const oepEnd = new Date(currentYear, 2, 31);
  const inOep = now >= oepStart && now <= oepEnd;
  const oep = {
    eligible:
      inOep &&
      (input.currentCoverage === "medicare_advantage" || hasPartAB),
    reason: inOep
      ? "The Medicare Advantage Open Enrollment Period is open. If you have an MA plan, you can switch to a different one or return to Original Medicare."
      : "The Open Enrollment Period runs January 1 through March 31 each year.",
    window: `January 1 - March 31, ${currentYear}`,
  };

  // SEP
  const sepReasons: string[] = [];
  if (input.recentlyMoved) {
    sepReasons.push(
      "You recently moved to a new area, which qualifies you for a Special Enrollment Period."
    );
  }
  if (input.lostEmployerCoverage) {
    sepReasons.push(
      "Losing employer coverage qualifies you for a Special Enrollment Period to enroll in Medicare plans."
    );
  }
  if (input.isInstitutionalized) {
    sepReasons.push(
      "Living in a nursing facility gives you a continuous Special Enrollment Period."
    );
  }

  const sep = {
    eligible: sepReasons.length > 0,
    reasons: sepReasons,
  };

  // Dual/LIS SEP (monthly enrollment for dual-eligible)
  const dualSep = {
    eligible: input.hasMedicaid && hasPartAB,
    reason:
      input.hasMedicaid && hasPartAB
        ? "As a dual-eligible beneficiary (Medicare + Medicaid), you can switch plans once every month throughout the year."
        : "The monthly Dual/LIS Special Enrollment Period is available to those with both Medicare and Medicaid.",
  };

  // ── Recommendations ──
  const recommendations: string[] = [];

  if (eligible.dsnp) {
    recommendations.push(
      "You qualify for D-SNP (Dual Special Needs) plans, which offer extra benefits designed for people with both Medicare and Medicaid — often including dental, vision, OTC allowances, and transportation at no extra cost."
    );
  }

  if (eligible.csnp) {
    const conditions = (input.chronicConditions ?? []).join(", ");
    recommendations.push(
      `Based on your health conditions (${conditions}), you may qualify for C-SNP plans that provide specialized care coordination and tailored benefits for chronic conditions.`
    );
  }

  if (eligible.isnp) {
    recommendations.push(
      "You qualify for I-SNP plans designed specifically for people in nursing facilities or receiving long-term care, with benefits tailored to institutional settings."
    );
  }

  if (eligible.ma && !eligible.dsnp && !eligible.csnp && !eligible.isnp) {
    recommendations.push(
      "You qualify for Medicare Advantage (MA) and Medicare Advantage with Part D (MA-PD) plans. These all-in-one plans often include dental, vision, hearing, and other extra benefits."
    );
  }

  if (eligible.pdp && !eligible.mapd) {
    recommendations.push(
      "You may want to look into standalone Part D (prescription drug) plans to add drug coverage to Original Medicare."
    );
  }

  if (eligible.medigap && input.currentCoverage === "original_medicare") {
    recommendations.push(
      "With Original Medicare, you may also want to consider a Medigap (Medicare Supplement) policy to help cover out-of-pocket costs like copays and deductibles."
    );
  }

  if (dualSep.eligible) {
    recommendations.push(
      "Since you have both Medicare and Medicaid, you can change plans once every month — giving you flexibility to find the best fit anytime."
    );
  }

  // ── Warnings ──
  const warnings: string[] = [];

  if (!input.hasPartB && (input.age >= 65 || input.hasPartA)) {
    warnings.push(
      "You don't currently have Medicare Part B. You need both Part A and Part B to enroll in most Medicare Advantage plans. You may face a late enrollment penalty if you don't sign up during your initial eligibility window."
    );
  }

  if (!input.hasPartA && input.age >= 65) {
    warnings.push(
      "You don't have Medicare Part A. Most people get Part A automatically at 65. Contact Social Security to check your eligibility."
    );
  }

  if (
    input.currentCoverage === "employer" &&
    !input.lostEmployerCoverage
  ) {
    warnings.push(
      "If you're still covered by an employer plan, you generally don't need to enroll in Medicare Advantage yet. However, make sure to enroll within 8 months of losing that coverage to avoid penalties."
    );
  }

  if (
    input.currentCoverage === "none" &&
    input.age >= 65 &&
    !input.hasPartA &&
    !input.hasPartB
  ) {
    warnings.push(
      "You don't appear to have any Medicare coverage. You may be subject to late enrollment penalties. Contact Social Security (1-800-772-1213) to discuss your options."
    );
  }

  // ── Next Steps ──
  const nextSteps: string[] = [];

  const canEnrollNow =
    iep.eligible || aep.eligible || oep.eligible || sep.eligible || dualSep.eligible;

  if (canEnrollNow) {
    nextSteps.push(
      "You can enroll in a plan right now! Enter your ZIP code to see available plans in your area."
    );
  } else {
    nextSteps.push(
      `The next enrollment window is the Annual Enrollment Period (October 15 - December 7). You can browse plans now and be ready to enroll.`
    );
  }

  if (eligible.dsnp || eligible.csnp || eligible.isnp) {
    nextSteps.push(
      "Use Smart Match to find plans tailored to your specific needs with one click."
    );
  }

  if (warnings.length > 0) {
    nextSteps.push(
      "Consider speaking with a licensed Medicare agent who can walk you through your options at no cost to you."
    );
  }

  nextSteps.push(
    "Compare plans side-by-side to find the best value for your needs."
  );

  return {
    eligible,
    enrollmentPeriods: { iep, aep, oep, sep, dualSep },
    recommendations,
    warnings,
    nextSteps,
  };
}
