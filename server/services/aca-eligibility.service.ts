/**
 * ACA Eligibility Engine Service
 *
 * Income-based eligibility for ACA marketplace plans,
 * subsidies, cost-sharing reductions, and Medicaid.
 */

// ── 2026 Federal Poverty Level (estimated) ──

const FPL_2026: Record<number, number> = {
  1: 15650,
  2: 21150,
  3: 26650,
  4: 32150,
  5: 37650,
  6: 43150,
  7: 48650,
  8: 54150,
};

// States that expanded Medicaid under ACA (as of 2026)
const MEDICAID_EXPANSION_STATES = new Set([
  "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MO", "MT", "NE",
  "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SD", "UT", "VA", "VT", "WA", "WV", "WI",
]);

export interface ACAEligibilityInput {
  age: number;
  income: number; // annual household income
  householdSize: number;
  state: string;
  employerOffersInsurance: boolean;
  employerPlanAffordable: boolean; // <9.12% of income for 2026
  hasMedicare: boolean;
  hasMedicaid: boolean;
  isPregnant: boolean;
  isImmigrant: boolean; // lawfully present
  currentCoverage: "none" | "employer" | "individual" | "medicaid" | "medicare" | "uninsured";
  // SEP triggers
  lostCoverageRecently: boolean;
  marriedOrDivorced: boolean;
  hadBaby: boolean;
  movedState: boolean;
  incomeChangedSignificantly: boolean;
}

export interface ACAEligibilityResult {
  eligible: {
    marketplace: boolean;
    subsidy: boolean;
    csr: boolean;
    medicaid: boolean;
    chip: boolean;
  };
  subsidyEstimate: {
    fplPercent: number;
    monthlySubsidy: number;
    annualSubsidy: number;
    expectedContribution: number; // monthly
  } | null;
  csrLevel: string | null;
  enrollmentPeriods: {
    oep: { eligible: boolean; window: string };
    sep: { eligible: boolean; reasons: string[] };
  };
  recommendations: string[];
  warnings: string[];
  nextSteps: string[];
}

function getExpectedContributionRate(fplPercent: number): number {
  if (fplPercent <= 150) return 0.00;
  if (fplPercent <= 200) return 0.02;
  if (fplPercent <= 250) return 0.04;
  if (fplPercent <= 300) return 0.06;
  if (fplPercent <= 350) return 0.075;
  if (fplPercent <= 400) return 0.085;
  return 0.085; // IRA extended subsidies above 400% FPL -- capped at 8.5%
}

// Approximate benchmark Silver premium by age (national average for estimation)
function estimateBenchmarkPremium(age: number): number {
  if (age <= 20) return 280;
  if (age <= 25) return 310;
  if (age <= 30) return 335;
  if (age <= 35) return 365;
  if (age <= 40) return 400;
  if (age <= 45) return 450;
  if (age <= 50) return 520;
  if (age <= 55) return 610;
  if (age <= 60) return 720;
  return 850; // 60+
}

export function determineACAEligibility(input: ACAEligibilityInput): ACAEligibilityResult {
  const now = new Date();
  const currentYear = now.getFullYear();
  const stateUpper = input.state.toUpperCase();

  // Calculate FPL
  const fplBase = FPL_2026[input.householdSize] || FPL_2026[1];
  const fplPercent = Math.round((input.income / fplBase) * 100);
  const isExpansionState = MEDICAID_EXPANSION_STATES.has(stateUpper);

  // ── Eligibility Determination ──

  // Cannot use marketplace if on Medicare
  const blockedByMedicare = input.hasMedicare || input.currentCoverage === "medicare";

  // Employer coverage blocks marketplace only if affordable
  const blockedByEmployer =
    input.employerOffersInsurance && input.employerPlanAffordable;

  // Medicaid eligibility
  const medicaidEligible =
    !blockedByMedicare &&
    ((isExpansionState && fplPercent <= 138) ||
     (!isExpansionState && fplPercent <= 100) ||
     (input.isPregnant && fplPercent <= 200));

  // CHIP eligibility (children)
  const chipEligible = input.age < 19 && fplPercent <= 300;

  // Marketplace eligibility
  const marketplaceEligible =
    !blockedByMedicare &&
    !blockedByEmployer &&
    !medicaidEligible &&
    (isExpansionState ? fplPercent > 138 : fplPercent > 100);

  // Subsidy eligibility (Premium Tax Credit)
  // IRA extended: subsidies available at any income above 100% FPL, capped at 8.5%
  const subsidyEligible =
    marketplaceEligible &&
    fplPercent >= 100 &&
    !blockedByEmployer;

  // CSR eligibility (100-250% FPL on Silver plans)
  const csrEligible = subsidyEligible && fplPercent >= 100 && fplPercent <= 250;

  let csrLevel: string | null = null;
  if (csrEligible) {
    if (fplPercent <= 150) csrLevel = "94%";
    else if (fplPercent <= 200) csrLevel = "87%";
    else if (fplPercent <= 250) csrLevel = "73%";
  }

  // ── Subsidy Estimate ──

  let subsidyEstimate: ACAEligibilityResult["subsidyEstimate"] = null;

  if (subsidyEligible) {
    const benchmarkPremium = estimateBenchmarkPremium(input.age);
    const contributionRate = getExpectedContributionRate(fplPercent);
    const annualContribution = contributionRate * input.income;
    const monthlyContribution = Math.round((annualContribution / 12) * 100) / 100;
    const monthlySubsidy = Math.max(0, Math.round((benchmarkPremium - monthlyContribution) * 100) / 100);

    subsidyEstimate = {
      fplPercent,
      monthlySubsidy,
      annualSubsidy: Math.round(monthlySubsidy * 12 * 100) / 100,
      expectedContribution: monthlyContribution,
    };
  }

  // ── Enrollment Periods ──

  // OEP: November 1 - January 15
  const oepStart = new Date(currentYear, 10, 1); // Nov 1
  const oepEnd = new Date(currentYear + 1, 0, 15); // Jan 15
  // Also check if we're in Jan 1-15 of current year (tail end of previous OEP)
  const oepStartPrev = new Date(currentYear - 1, 10, 1);
  const oepEndCurrent = new Date(currentYear, 0, 15);
  const inOep =
    (now >= oepStart && now <= oepEnd) ||
    (now >= oepStartPrev && now <= oepEndCurrent);

  const oep = {
    eligible: inOep,
    window: `November 1, ${currentYear} - January 15, ${currentYear + 1}`,
  };

  // SEP triggers
  const sepReasons: string[] = [];
  if (input.lostCoverageRecently) {
    sepReasons.push(
      "You recently lost health coverage, which qualifies you for a 60-day Special Enrollment Period."
    );
  }
  if (input.marriedOrDivorced) {
    sepReasons.push(
      "A recent marriage or divorce qualifies you for a Special Enrollment Period."
    );
  }
  if (input.hadBaby) {
    sepReasons.push(
      "Having a baby or adopting a child qualifies you for a Special Enrollment Period."
    );
  }
  if (input.movedState) {
    sepReasons.push(
      "Moving to a new state qualifies you for a Special Enrollment Period to enroll in plans available in your new area."
    );
  }
  if (input.incomeChangedSignificantly) {
    sepReasons.push(
      "A significant income change may affect your subsidy amount. You can update your application to adjust your Premium Tax Credit."
    );
  }
  if (medicaidEligible) {
    sepReasons.push(
      "You may qualify for Medicaid, which allows enrollment at any time throughout the year."
    );
  }

  const sep = {
    eligible: sepReasons.length > 0,
    reasons: sepReasons,
  };

  // ── Recommendations ──
  const recommendations: string[] = [];

  if (medicaidEligible) {
    recommendations.push(
      `Based on your income (${fplPercent}% of the Federal Poverty Level), you likely qualify for Medicaid in ${stateUpper}. Medicaid provides comprehensive coverage with little to no cost to you.`
    );
  }

  if (chipEligible && !medicaidEligible) {
    recommendations.push(
      "Your household may qualify for the Children's Health Insurance Program (CHIP), which provides low-cost health coverage for children under 19."
    );
  }

  if (marketplaceEligible && subsidyEligible && subsidyEstimate) {
    if (csrEligible) {
      recommendations.push(
        `You qualify for Cost Sharing Reductions (${csrLevel} actuarial value) on Silver plans. This means lower deductibles, copays, and out-of-pocket maximums. Silver plans are your best value.`
      );
    }

    if (subsidyEstimate.monthlySubsidy > 0) {
      recommendations.push(
        `You're estimated to receive about $${subsidyEstimate.monthlySubsidy}/month ($${subsidyEstimate.annualSubsidy}/year) in Premium Tax Credits to lower your monthly premium.`
      );
    }

    if (fplPercent <= 150 && subsidyEstimate.monthlySubsidy > 0) {
      recommendations.push(
        "At your income level, you may qualify for $0 premium Bronze or Silver plans after subsidies are applied."
      );
    }
  }

  if (marketplaceEligible && !subsidyEligible && fplPercent > 400) {
    recommendations.push(
      "Under the IRA extended subsidies, your premium contribution is capped at 8.5% of your income, even above 400% FPL. You still benefit from marketplace tax credits."
    );
  }

  // ── Warnings ──
  const warnings: string[] = [];

  if (blockedByMedicare) {
    warnings.push(
      "You are enrolled in Medicare. Medicare beneficiaries cannot purchase ACA marketplace plans. You should explore Medicare Advantage or Medigap options instead."
    );
  }

  if (blockedByEmployer) {
    warnings.push(
      "Your employer offers affordable health insurance (less than 9.12% of your income). You can still buy a marketplace plan, but you won't qualify for Premium Tax Credits."
    );
  }

  if (!isExpansionState && fplPercent > 0 && fplPercent < 100) {
    warnings.push(
      `Your state (${stateUpper}) has not expanded Medicaid. With income below 100% FPL, you may fall into the "coverage gap" where you don't qualify for either Medicaid or marketplace subsidies. Contact your state's Medicaid office for options.`
    );
  }

  if (input.isImmigrant) {
    warnings.push(
      "Lawfully present immigrants can purchase marketplace plans and may qualify for subsidies. Some immigration statuses have a 5-year waiting period for Medicaid. Check with your state for specific rules."
    );
  }

  if (input.currentCoverage === "none" || input.currentCoverage === "uninsured") {
    if (!oep.eligible && sep.reasons.length === 0 && !medicaidEligible) {
      warnings.push(
        "You currently don't have coverage and are outside the Open Enrollment Period. Unless you have a qualifying life event, you may need to wait until the next Open Enrollment (November 1) to sign up."
      );
    }
  }

  // ── Next Steps ──
  const nextSteps: string[] = [];

  const canEnrollNow = oep.eligible || sep.eligible || medicaidEligible;

  if (canEnrollNow && marketplaceEligible) {
    nextSteps.push(
      "You can enroll in a marketplace plan right now! Use our ACA plan finder to see available plans and your estimated costs after subsidies."
    );
  } else if (canEnrollNow && medicaidEligible) {
    nextSteps.push(
      "You may qualify for Medicaid. You can apply any time through your state's Medicaid website or HealthCare.gov."
    );
  } else if (marketplaceEligible) {
    nextSteps.push(
      `The next Open Enrollment Period is November 1 - January 15. You can browse plans now and be ready to enroll.`
    );
  }

  if (marketplaceEligible && subsidyEligible) {
    nextSteps.push(
      "Use Smart Match to find the best ACA plan for your situation, with your subsidy automatically applied."
    );
  }

  if (blockedByMedicare) {
    nextSteps.push(
      "Explore Medicare plan options instead. Use our Medicare Eligibility Check to see what Medicare plans you qualify for."
    );
  }

  nextSteps.push(
    "Compare plans side-by-side to find the best value for your needs and budget."
  );

  return {
    eligible: {
      marketplace: marketplaceEligible,
      subsidy: subsidyEligible,
      csr: csrEligible,
      medicaid: medicaidEligible,
      chip: chipEligible,
    },
    subsidyEstimate,
    csrLevel,
    enrollmentPeriods: { oep, sep },
    recommendations,
    warnings,
    nextSteps,
  };
}
