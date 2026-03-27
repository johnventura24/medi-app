// shared/constants.ts — Phase 1 constants for CMS export, validation, and coverage limits

/**
 * CMS_SB_COLUMN_ORDER
 * Ordered list of column names matching CMS Summary of Benefits CSV export format.
 */
export const CMS_SB_COLUMN_ORDER: string[] = [
  // Plan Identification
  "name",
  "contractId",
  "planId",
  "segmentId",
  "planType",
  "category",
  "organizationName",
  "state",
  "county",
  "city",
  "zipcode",
  "fips",
  // Cost
  "calculatedMonthlyPremium",
  "partbGiveback",
  "annualDeductible",
  "maximumOopc",
  // Medical Benefits (CMS SB order)
  "pcpCopayMin",
  "pcpCopayMax",
  "specialistCopayMin",
  "specialistCopayMax",
  "emergencyCopay",
  "urgentCareCopay",
  "inpatientCopay",
  "outpatientCopayMin",
  "outpatientCopayMax",
  "diagnosticCopay",
  "labCopay",
  "imagingCopayMin",
  "imagingCopayMax",
  "mentalHealthInpatientCopay",
  "mentalHealthOutpatientCopay",
  "snfCopayDays1to20",
  "snfCopayDays21to100",
  "homeHealthCopay",
  "ambulanceCopay",
  "dmeCopayMin",
  "dmeCopayMax",
  // Drug Benefits
  "drugDeductible",
  "tier1CopayPreferred",
  "tier1CopayStandard",
  "tier2CopayPreferred",
  "tier2CopayStandard",
  "tier3CopayPreferred",
  "tier3CopayStandard",
  "tier4CoinsurancePreferred",
  "tier4CoinsuranceStandard",
  "tier5CoinsurancePreferred",
  "tier5CoinsuranceStandard",
  "tier6CopayPreferred",
  "tier6CopayStandard",
  "coverageGapTier1",
  "coverageGapTier2",
  "catastrophicCopayGeneric",
  "catastrophicCopayBrand",
  "catastrophicCoinsurance",
  // Supplemental Benefits
  "dentalPreventiveCovered",
  "dentalComprehensiveCovered",
  "dentalCoverageLimit",
  "visionExamCopay",
  "visionAllowance",
  "hearingCopayMin",
  "hearingCopayMax",
  "hearingAidAllowance",
  "otcAmountPerQuarter",
  "hasOtc",
  "transportationTripsPerYear",
  "transportationAmountPerYear",
  "hasTransportation",
  "mealBenefitAmount",
  "mealBenefitMealsPerEvent",
  "mealBenefitEventsPerYear",
  "hasMealBenefit",
  "flexCardAmount",
  "flexCardFrequency",
  "groceryAllowanceAmount",
  "groceryAllowanceFrequency",
  "telehealthCopay",
  "hasTelehealth",
  "fitnessBenefitName",
  "hasSilverSneakers",
  "hasFitnessBenefit",
  "inHomeSupportHoursPerYear",
  "hasInHomeSupport",
  // Quality
  "overallStarRating",
  "lowPerforming",
  "highPerforming",
  // SNP
  "snpType",
  "enrollmentStatus",
  // Referral/Auth
  "requiresPcpReferral",
  "priorAuthNotes",
];

/**
 * VALIDATION_RULES
 * Rule definitions for the data validation engine.
 */
export const VALIDATION_RULES: Array<{
  ruleName: string;
  field: string;
  condition: string;
}> = [
  // Premium / Cost
  { ruleName: "premium_non_negative", field: "calculatedMonthlyPremium", condition: "Value must be >= 0" },
  { ruleName: "partb_giveback_range", field: "partbGiveback", condition: "Value must be between 0 and 185.00 (2026 Part B standard)" },
  { ruleName: "moop_within_limit", field: "maximumOopc", condition: "Numeric value must be <= COVERAGE_LIMITS.moopMax2026 (8850)" },
  { ruleName: "drug_deductible_within_limit", field: "drugDeductible", condition: "Value must be <= COVERAGE_LIMITS.drugDeductibleMax2026 (590)" },

  // Copays — non-negative
  { ruleName: "pcp_copay_non_negative", field: "pcpCopayMin", condition: "Value must be >= 0" },
  { ruleName: "specialist_copay_non_negative", field: "specialistCopayMin", condition: "Value must be >= 0" },
  { ruleName: "emergency_copay_non_negative", field: "emergencyCopay", condition: "Value must be >= 0" },
  { ruleName: "urgent_care_copay_non_negative", field: "urgentCareCopay", condition: "Value must be >= 0" },
  { ruleName: "inpatient_copay_non_negative", field: "inpatientCopay", condition: "Value must be >= 0" },

  // Min <= Max consistency
  { ruleName: "pcp_copay_min_le_max", field: "pcpCopayMin", condition: "pcpCopayMin must be <= pcpCopayMax when both are present" },
  { ruleName: "specialist_copay_min_le_max", field: "specialistCopayMin", condition: "specialistCopayMin must be <= specialistCopayMax when both are present" },
  { ruleName: "outpatient_copay_min_le_max", field: "outpatientCopayMin", condition: "outpatientCopayMin must be <= outpatientCopayMax when both are present" },
  { ruleName: "imaging_copay_min_le_max", field: "imagingCopayMin", condition: "imagingCopayMin must be <= imagingCopayMax when both are present" },
  { ruleName: "dme_copay_min_le_max", field: "dmeCopayMin", condition: "dmeCopayMin must be <= dmeCopayMax when both are present" },
  { ruleName: "hearing_copay_min_le_max", field: "hearingCopayMin", condition: "hearingCopayMin must be <= hearingCopayMax when both are present" },

  // Drug tier coinsurance range (0-1 as decimal)
  { ruleName: "tier4_coinsurance_range", field: "tier4CoinsurancePreferred", condition: "Value must be between 0 and 1 (percentage as decimal)" },
  { ruleName: "tier5_coinsurance_range", field: "tier5CoinsurancePreferred", condition: "Value must be between 0 and 1 (percentage as decimal)" },
  { ruleName: "catastrophic_coinsurance_range", field: "catastrophicCoinsurance", condition: "Value must be between 0 and 1 (percentage as decimal)" },

  // Star rating
  { ruleName: "star_rating_range", field: "overallStarRating", condition: "Value must be between 1.0 and 5.0" },

  // Boolean consistency
  { ruleName: "otc_boolean_amount_consistency", field: "hasOtc", condition: "If otcAmountPerQuarter > 0 then hasOtc should be true" },
  { ruleName: "transportation_boolean_amount_consistency", field: "hasTransportation", condition: "If transportationAmountPerYear > 0 then hasTransportation should be true" },
  { ruleName: "meal_boolean_amount_consistency", field: "hasMealBenefit", condition: "If mealBenefitAmount > 0 then hasMealBenefit should be true" },
  { ruleName: "telehealth_boolean_copay_consistency", field: "hasTelehealth", condition: "If telehealthCopay is not null then hasTelehealth should be true" },
  { ruleName: "fitness_boolean_name_consistency", field: "hasFitnessBenefit", condition: "If fitnessBenefitName is not null then hasFitnessBenefit should be true" },
  { ruleName: "in_home_boolean_hours_consistency", field: "hasInHomeSupport", condition: "If inHomeSupportHoursPerYear > 0 then hasInHomeSupport should be true" },

  // Required fields
  { ruleName: "name_required", field: "name", condition: "Plan name must not be empty" },
  { ruleName: "organization_required", field: "organizationName", condition: "Organization name must not be empty" },
  { ruleName: "state_required", field: "state", condition: "State must not be empty" },
  { ruleName: "county_required", field: "county", condition: "County must not be empty" },

  // Supplemental benefit amounts non-negative
  { ruleName: "otc_amount_non_negative", field: "otcAmountPerQuarter", condition: "Value must be >= 0" },
  { ruleName: "flex_card_non_negative", field: "flexCardAmount", condition: "Value must be >= 0" },
  { ruleName: "grocery_allowance_non_negative", field: "groceryAllowanceAmount", condition: "Value must be >= 0" },
  { ruleName: "transportation_amount_non_negative", field: "transportationAmountPerYear", condition: "Value must be >= 0" },
  { ruleName: "meal_benefit_non_negative", field: "mealBenefitAmount", condition: "Value must be >= 0" },
];

/**
 * COVERAGE_LIMITS
 * Regulatory caps for CY 2026 Medicare Advantage.
 */
export const COVERAGE_LIMITS = {
  /** Maximum Out-of-Pocket (MOOP) limit for 2026 */
  moopMax2026: 8850,
  /** Maximum Part D drug deductible for 2026 */
  drugDeductibleMax2026: 590,
  /** IRA out-of-pocket cap for Part D (effective 2025+) */
  iraOopCap: 2000,
} as const;
