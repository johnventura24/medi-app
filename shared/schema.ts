import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, serial, index, uniqueIndex, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users table ──

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default("agent"), // admin | compliance | agent | viewer
  organization: text("organization"),
  npn: text("npn"), // National Producer Number for agents
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  passwordHash: true,
  fullName: true,
  role: true,
  organization: true,
  npn: true,
  phone: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  role: z.enum(["admin", "compliance", "agent", "viewer"]).optional(),
  organization: z.string().optional(),
  npn: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ── Saved Searches table ──

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(), // { zip, maxPremium, minDental, ... }
  resultCount: integer("result_count"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_saved_searches_user").on(table.userId),
]);

export const insertSavedSearchSchema = createInsertSchema(savedSearches).pick({
  name: true,
  criteria: true,
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;

// ── Favorite Plans table ──

export const favoritePlans = pgTable("favorite_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_favorite_user_plan").on(table.userId, table.planId),
  index("idx_favorites_user").on(table.userId),
]);

export const insertFavoritePlanSchema = createInsertSchema(favoritePlans).pick({
  planId: true,
  notes: true,
});

export type FavoritePlan = typeof favoritePlans.$inferSelect;
export type InsertFavoritePlan = z.infer<typeof insertFavoritePlanSchema>;

// ── Plans table (one row per plan-per-county from NDJSON) ──

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  externalId: integer("external_id"),
  name: text("name").notNull(),
  contractYear: text("contract_year"),
  contractId: text("contract_id"),
  planId: text("plan_id"),
  segmentId: text("segment_id"),
  planType: text("plan_type"),
  category: text("category"),
  organizationName: text("organization_name").notNull(),
  state: text("state").notNull(),
  county: text("county").notNull(),
  fips: text("fips"),
  city: text("city"),
  zipcode: text("zipcode"),
  annualDeductible: text("annual_deductible"),
  maximumOopc: text("maximum_oopc"),
  calculatedMonthlyPremium: real("calculated_monthly_premium").default(0),
  partcPremium: real("partc_premium").default(0),
  partdPremium: real("partd_premium").default(0),
  pcpCopayMin: real("pcp_copay_min"),
  pcpCopayMax: real("pcp_copay_max"),
  specialistCopayMin: real("specialist_copay_min"),
  specialistCopayMax: real("specialist_copay_max"),
  emergencyCopay: real("emergency_copay"),
  urgentCareCopay: real("urgent_care_copay"),
  inpatientCopay: real("inpatient_copay"),
  outpatientCopayMin: real("outpatient_copay_min"),
  outpatientCopayMax: real("outpatient_copay_max"),
  dentalCoverageLimit: real("dental_coverage_limit"),
  visionAllowance: real("vision_allowance"),
  hearingCopayMin: real("hearing_copay_min"),
  hearingCopayMax: real("hearing_copay_max"),
  hasOtc: boolean("has_otc").default(false),
  hasTransportation: boolean("has_transportation").default(false),
  hasMealBenefit: boolean("has_meal_benefit").default(false),
  hasTelehealth: boolean("has_telehealth").default(false),
  hasSilverSneakers: boolean("has_silver_sneakers").default(false),
  hasFitnessBenefit: boolean("has_fitness_benefit").default(false),
  hasInHomeSupport: boolean("has_in_home_support").default(false),
  snpType: text("snp_type"),
  enrollmentStatus: text("enrollment_status"),
  overallStarRating: real("overall_star_rating"),
  lowPerforming: boolean("low_performing").default(false),
  highPerforming: boolean("high_performing").default(false),

  // Part B Giveback
  partbGiveback: real("partb_giveback"),

  // Drug Tier Cost Sharing (Part D)
  drugDeductible: real("drug_deductible"),
  tier1CopayPreferred: real("tier1_copay_preferred"),
  tier1CopayStandard: real("tier1_copay_standard"),
  tier2CopayPreferred: real("tier2_copay_preferred"),
  tier2CopayStandard: real("tier2_copay_standard"),
  tier3CopayPreferred: real("tier3_copay_preferred"),
  tier3CopayStandard: real("tier3_copay_standard"),
  tier4CoinsurancePreferred: real("tier4_coinsurance_preferred"),
  tier4CoinsuranceStandard: real("tier4_coinsurance_standard"),
  tier5CoinsurancePreferred: real("tier5_coinsurance_preferred"),
  tier5CoinsuranceStandard: real("tier5_coinsurance_standard"),
  tier6CopayPreferred: real("tier6_copay_preferred"),
  tier6CopayStandard: real("tier6_copay_standard"),

  // Coverage Gap / Catastrophic
  coverageGapTier1: text("coverage_gap_tier1"),
  coverageGapTier2: text("coverage_gap_tier2"),
  catastrophicCopayGeneric: real("catastrophic_copay_generic"),
  catastrophicCopayBrand: real("catastrophic_copay_brand"),
  catastrophicCoinsurance: real("catastrophic_coinsurance"),

  // Supplemental Benefit Dollar Amounts
  otcAmountPerQuarter: real("otc_amount_per_quarter"),
  transportationTripsPerYear: integer("transportation_trips_per_year"),
  transportationAmountPerYear: real("transportation_amount_per_year"),
  mealBenefitAmount: real("meal_benefit_amount"),
  mealBenefitMealsPerEvent: integer("meal_benefit_meals_per_event"),
  mealBenefitEventsPerYear: integer("meal_benefit_events_per_year"),
  flexCardAmount: real("flex_card_amount"),
  flexCardFrequency: text("flex_card_frequency"),
  groceryAllowanceAmount: real("grocery_allowance_amount"),
  groceryAllowanceFrequency: text("grocery_allowance_frequency"),

  // Additional Medical Copays
  diagnosticCopay: real("diagnostic_copay"),
  labCopay: real("lab_copay"),
  imagingCopayMin: real("imaging_copay_min"),
  imagingCopayMax: real("imaging_copay_max"),
  dmeCopayMin: real("dme_copay_min"),
  dmeCopayMax: real("dme_copay_max"),
  mentalHealthInpatientCopay: real("mental_health_inpatient_copay"),
  mentalHealthOutpatientCopay: real("mental_health_outpatient_copay"),
  snfCopayDays1to20: real("snf_copay_days1to20"),
  snfCopayDays21to100: real("snf_copay_days21to100"),
  homeHealthCopay: real("home_health_copay"),
  ambulanceCopay: real("ambulance_copay"),

  // Dental/Vision/Hearing Detail
  dentalPreventiveCovered: boolean("dental_preventive_covered"),
  dentalComprehensiveCovered: boolean("dental_comprehensive_covered"),
  visionExamCopay: real("vision_exam_copay"),
  hearingAidAllowance: real("hearing_aid_allowance"),

  // Telehealth/Fitness/In-Home Detail
  telehealthCopay: real("telehealth_copay"),
  inHomeSupportHoursPerYear: integer("in_home_support_hours_per_year"),
  fitnessBenefitName: text("fitness_benefit_name"),

  // Prior Auth & Referral
  requiresPcpReferral: boolean("requires_pcp_referral"),
  priorAuthNotes: text("prior_auth_notes"),
}, (table) => [
  index("idx_plans_state").on(table.state),
  index("idx_plans_county").on(table.county),
  index("idx_plans_org").on(table.organizationName),
  index("idx_plans_category").on(table.category),
  index("idx_plans_zipcode").on(table.zipcode),
]);

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

// ── Plan History table (year-over-year snapshots) ──

export const planHistory = pgTable("plan_history", {
  id: serial("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  planId: text("plan_id").notNull(),
  segmentId: text("segment_id").notNull(),
  fips: text("fips").notNull(),
  contractYear: integer("contract_year").notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_plan_history_key").on(table.contractId, table.planId, table.segmentId, table.fips, table.contractYear),
  index("idx_plan_history_plan").on(table.contractId, table.planId, table.segmentId, table.fips),
  index("idx_plan_history_year").on(table.contractYear),
]);

export type PlanHistory = typeof planHistory.$inferSelect;
export type InsertPlanHistory = typeof planHistory.$inferInsert;

// ── Data Validation Logs table ──

export const dataValidationLogs = pgTable("data_validation_logs", {
  id: serial("id").primaryKey(),
  planIdRef: integer("plan_id_ref").references(() => plans.id),
  ruleName: text("rule_name").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  fieldName: text("field_name"),
  fieldValue: text("field_value"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_validation_plan").on(table.planIdRef),
  index("idx_validation_severity").on(table.severity),
]);

export type DataValidationLog = typeof dataValidationLogs.$inferSelect;
export type InsertDataValidationLog = typeof dataValidationLogs.$inferInsert;

// ── Export Logs table ──

export const exportLogs = pgTable("export_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  exportType: text("export_type").notNull(),
  exportScope: text("export_scope").notNull(),
  filters: jsonb("filters"),
  rowCount: integer("row_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ExportLog = typeof exportLogs.$inferSelect;
export type InsertExportLog = typeof exportLogs.$inferInsert;

// ── Clients table (agent-managed beneficiary profiles) ──

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  agentUserId: integer("agent_user_id").notNull().references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD
  gender: text("gender"),
  zipCode: text("zip_code").notNull(),
  county: text("county"),
  fips: text("fips"),
  currentCoverage: text("current_coverage"), // "original_medicare" | "ma" | "medicaid" | "employer"
  currentPlanName: text("current_plan_name"),
  maxMonthlyPremium: real("max_monthly_premium"),
  maxAnnualOop: real("max_annual_oop"),
  chronicConditions: jsonb("chronic_conditions"), // ["diabetes", "copd", ...]
  mobilityLevel: text("mobility_level"), // "independent" | "limited" | "homebound"
  hospitalizedLastYear: boolean("hospitalized_last_year"),
  medications: jsonb("medications"), // [{ name, dosage, frequency }]
  preferredDoctors: jsonb("preferred_doctors"), // [{ name, npi }]
  mustHaveBenefits: jsonb("must_have_benefits"), // ["dental", "otc", "transportation", ...]
  benefitWeights: jsonb("benefit_weights"), // { lowPremium: 5, lowCopays: 3, ... }
  notes: text("notes"),
  status: text("status").notNull().default("intake"), // intake | plans_reviewed | enrolled | archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_clients_agent").on(table.agentUserId),
  index("idx_clients_zip").on(table.zipCode),
  index("idx_clients_status").on(table.status),
]);

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  agentUserId: true,
  createdAt: true,
  updatedAt: true,
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

// ── Client Recommendations table ──

export const clientRecommendations = pgTable("client_recommendations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  score: real("score").notNull(),
  scoreBreakdown: jsonb("score_breakdown").notNull(), // { premiumScore, copayScore, dentalScore, drugScore, supplementalScore, starScore }
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_recommendations_client").on(table.clientId),
]);

export const insertClientRecommendationSchema = createInsertSchema(clientRecommendations).omit({
  id: true,
  createdAt: true,
});

export type ClientRecommendation = typeof clientRecommendations.$inferSelect;
export type InsertClientRecommendation = z.infer<typeof insertClientRecommendationSchema>;

// ── Interaction Logs table ──

export const interactionLogs = pgTable("interaction_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clientId: integer("client_id").references(() => clients.id),
  action: text("action").notNull(), // "view_plans" | "compare" | "export" | "discuss" | "recommend"
  details: jsonb("details"), // { planIds: [...], ... }
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_interactions_client").on(table.clientId),
  index("idx_interactions_user").on(table.userId),
  index("idx_interactions_created").on(table.createdAt),
]);

export const insertInteractionLogSchema = createInsertSchema(interactionLogs).omit({
  id: true,
  createdAt: true,
});

export type InteractionLog = typeof interactionLogs.$inferSelect;
export type InsertInteractionLog = z.infer<typeof insertInteractionLogSchema>;

// ── Scope of Appointments table ──

export const scopeOfAppointments = pgTable("scope_of_appointments", {
  id: serial("id").primaryKey(),
  agentUserId: integer("agent_user_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  beneficiaryName: text("beneficiary_name").notNull(),
  soaDate: timestamp("soa_date").notNull(),
  planTypesDiscussed: jsonb("plan_types_discussed").notNull(), // ["MA", "MAPD", "PDP"]
  beneficiaryInitiated: boolean("beneficiary_initiated").notNull().default(false),
  method: text("method").notNull(), // "in_person" | "telephonic" | "online"
  signatureName: text("signature_name").notNull(),
  signatureTimestamp: timestamp("signature_timestamp").notNull(),
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default("active"), // active | expired | superseded
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_soa_agent").on(table.agentUserId),
  index("idx_soa_client").on(table.clientId),
  index("idx_soa_expires").on(table.expiresAt),
]);

export const insertSOASchema = createInsertSchema(scopeOfAppointments).omit({
  id: true,
  agentUserId: true,
  signatureTimestamp: true,
  expiresAt: true,
  status: true,
  createdAt: true,
});

export type ScopeOfAppointment = typeof scopeOfAppointments.$inferSelect;
export type InsertSOA = z.infer<typeof insertSOASchema>;

// ── Formulary Drugs table (Part D formulary data) ──

export const formularyDrugs = pgTable("formulary_drugs", {
  id: serial("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  formularyId: text("formulary_id").notNull(),
  rxcui: text("rxcui").notNull(),
  drugName: text("drug_name").notNull(),
  tier: integer("tier").notNull(), // 1-6
  priorAuthorization: boolean("prior_authorization").default(false),
  stepTherapy: boolean("step_therapy").default(false),
  quantityLimit: boolean("quantity_limit").default(false),
  quantityLimitAmount: real("quantity_limit_amount"),
  quantityLimitDays: integer("quantity_limit_days"),
  contractYear: integer("contract_year").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_formulary_contract").on(table.contractId),
  index("idx_formulary_contract_rxcui").on(table.contractId, table.rxcui),
  index("idx_formulary_rxcui").on(table.rxcui),
  index("idx_formulary_drug_name").on(table.drugName),
]);

export const insertFormularyDrugSchema = createInsertSchema(formularyDrugs).omit({
  id: true,
  createdAt: true,
});

export type FormularyDrug = typeof formularyDrugs.$inferSelect;
export type InsertFormularyDrug = z.infer<typeof insertFormularyDrugSchema>;

// ── Drug Cache table (RxNorm resolution cache) ──

export const drugCache = pgTable("drug_cache", {
  id: serial("id").primaryKey(),
  inputName: text("input_name").notNull().unique(),
  rxcui: text("rxcui"),
  resolvedName: text("resolved_name"),
  strength: text("strength"),
  dosageForm: text("dosage_form"),
  resolvedAt: timestamp("resolved_at").defaultNow(),
}, (table) => [
  index("idx_drug_cache_input").on(table.inputName),
  index("idx_drug_cache_rxcui").on(table.rxcui),
]);

export type DrugCacheEntry = typeof drugCache.$inferSelect;
export type InsertDrugCacheEntry = typeof drugCache.$inferInsert;

// ── Drug Cost Estimates table (cached cost calculations per client) ──

export const drugCostEstimates = pgTable("drug_cost_estimates", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  planId: integer("plan_id").notNull().references(() => plans.id),
  medications: jsonb("medications").notNull(), // input medications list
  estimatedAnnualCost: real("estimated_annual_cost").notNull(),
  costBreakdown: jsonb("cost_breakdown").notNull(), // per-drug and per-phase breakdown
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  index("idx_drug_cost_estimates_client").on(table.clientId),
]);

export const insertDrugCostEstimateSchema = createInsertSchema(drugCostEstimates).omit({
  id: true,
  calculatedAt: true,
});

export type DrugCostEstimate = typeof drugCostEstimates.$inferSelect;
export type InsertDrugCostEstimate = z.infer<typeof insertDrugCostEstimateSchema>;

// ── Provider Cache table (NPPES resolution cache) ──

export const providerCache = pgTable("provider_cache", {
  id: serial("id").primaryKey(),
  npi: text("npi").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  organizationName: text("organization_name"),
  specialty: text("specialty"),
  addressLine1: text("address_line1"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  phone: text("phone"),
  resolvedAt: timestamp("resolved_at").defaultNow(),
}, (table) => [
  index("idx_provider_cache_npi").on(table.npi),
  index("idx_provider_cache_name").on(table.lastName, table.firstName),
]);

export type ProviderCacheEntry = typeof providerCache.$inferSelect;
export type InsertProviderCacheEntry = typeof providerCache.$inferInsert;

// ── AI Explanations table (cached AI-generated plan summaries) ──

export const aiExplanations = pgTable("ai_explanations", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  clientId: integer("client_id").references(() => clients.id),
  explanationType: text("explanation_type").notNull(), // "plan_summary" | "comparison"
  content: text("content").notNull(),
  model: text("model").notNull(), // e.g., "gpt-4o-mini"
  tokensUsed: integer("tokens_used"),
  planDataHash: text("plan_data_hash").notNull(), // SHA256 for cache invalidation
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_explanations_plan").on(table.planId),
  index("idx_ai_explanations_hash").on(table.planDataHash),
]);

export type AIExplanation = typeof aiExplanations.$inferSelect;
export type InsertAIExplanation = typeof aiExplanations.$inferInsert;

// ── TypeScript interfaces for API responses (kept compatible with frontend) ──

export interface StateData {
  id: string;
  name: string;
  abbreviation: string;
  planCount: number;
  avgDentalAllowance: number;
  avgOtcAllowance: number;
  avgFlexCard: number;
  avgGroceryAllowance: number;
  avgTransportation: number;
  pcpCopay: number;
  specialistCopay: number;
  dentalCoverage: number;
  otcCoverage: number;
  flexCardCoverage: number;
  groceryCoverage: number;
  transportationCoverage: number;
}

export interface CityData {
  id: string;
  city: string;
  state: string;
  stateAbbr: string;
  planCount: number;
  carrierCount: number;
  topCarrier: string;
  maxDental: number;
  maxOtc: number;
  maxFlexCard: number;
  maxGrocery: number;
  avgPcpCopay: number;
}

export interface ZipData {
  id: string;
  zip: string;
  city: string;
  state: string;
  planCount: number;
  desirabilityScore: number;
  topBenefit: string;
  hasFlexCard: boolean;
  hasOtc: boolean;
  maxDental: number;
  maxOtc: number;
}

export interface CarrierData {
  id: string;
  name: string;
  statesServed: number;
  totalPlans: number;
  avgDentalAllowance: number;
  avgOtcAllowance: number;
  avgFlexCard: number;
  marketShare: number;
}

export interface PlanData {
  id: string;
  planName: string;
  carrier: string;
  planType: string;
  premium: number;
  deductible: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  hospitalCopay: number;
  erCopay: number;
  dentalAllowance: number;
  otcAllowance: number;
  flexCard: number;
  groceryAllowance: number;
  transportation: number;
  vision: number;
  hearing: number;
  insulin: number;
  state: string;
  city: string;
  zip: string;
  // Phase 1 additions (optional to preserve backward compatibility)
  drugDeductible?: number | null;
  tier1CopayPreferred?: number | null;
  tier2CopayPreferred?: number | null;
  tier3CopayPreferred?: number | null;
  tier4CoinsurancePreferred?: number | null;
  tier5CoinsurancePreferred?: number | null;
  tier6CopayPreferred?: number | null;
  partbGiveback?: number | null;
  otcAmountPerQuarter?: number | null;
  flexCardAmount?: number | null;
  groceryAllowanceAmount?: number | null;
  transportationAmountPerYear?: number | null;
  mealBenefitAmount?: number | null;
  dentalPreventiveCovered?: boolean | null;
  dentalComprehensiveCovered?: boolean | null;
  visionExamCopay?: number | null;
  hearingAidAllowance?: number | null;
  telehealthCopay?: number | null;
  overallStarRating?: number | null;
}

export interface TargetingRecommendation {
  id: string;
  location: string;
  locationType: 'state' | 'city' | 'zip';
  bestAngle: string;
  reasoning: string;
  score: number;
  metrics: {
    planCount: number;
    avgBenefit: number;
    coverage: number;
  };
}

export interface NationalAverages {
  dentalAllowance: number;
  otcAllowance: number;
  flexCard: number;
  groceryAllowance: number;
  transportation: number;
  pcpCopay: number;
  specialistCopay: number;
  moop: number;
}

export const benefitTypes = ['Dental', 'OTC', 'Flex Card', 'Groceries', 'Transportation', 'Vision', 'Hearing', 'Insulin'] as const;
export type BenefitType = typeof benefitTypes[number];

export const stateAbbreviations: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC', 'Puerto Rico': 'PR',
};

export const stateNames: Record<string, string> = Object.fromEntries(
  Object.entries(stateAbbreviations).map(([name, abbr]) => [abbr, name])
);

// ── Phase 1 API Response Interfaces ──

export interface SearchResult {
  plans: Array<{ id: number; name: string; carrier: string; state: string; county: string }>;
  carriers: Array<{ name: string; planCount: number }>;
  locations: Array<{ type: 'state' | 'city' | 'zip'; name: string; state: string }>;
}

export interface MatrixRow {
  field: string;
  fieldGroup: 'medical' | 'drug' | 'supplemental' | 'quality';
  values: Array<{ planId: number; value: string | number | boolean | null }>;
}

export interface MatrixResponse {
  carrier: string;
  counties: string[];
  plans: Array<{ id: number; name: string; county: string }>;
  rows: MatrixRow[];
}

export interface PlanChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface ChangeReportPlan {
  contractId: string;
  planId: string;
  segmentId: string;
  planName: string;
  county: string;
  status: 'new' | 'terminated' | 'changed' | 'unchanged';
  changes: PlanChange[];
}

export interface ChangeReportResponse {
  year1: number;
  year2: number;
  newPlans: ChangeReportPlan[];
  terminatedPlans: ChangeReportPlan[];
  changedPlans: ChangeReportPlan[];
  unchangedCount: number;
}

export interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
}

export interface ValidationDetail {
  id: number;
  planId: number;
  planName: string;
  carrier: string;
  ruleName: string;
  severity: string;
  message: string;
  fieldName: string | null;
  fieldValue: string | null;
}

// ── Phase 1 Typed Interfaces for new tables ──

export interface PlanHistoryRecord {
  contractId: string;
  planId: string;
  segmentId: string;
  fips: string;
  contractYear: number;
  snapshotData: Record<string, unknown>;
}

export interface ValidationLogEntry {
  id: number;
  planIdRef: number | null;
  ruleName: string;
  severity: "error" | "warning" | "info";
  message: string;
  fieldName: string | null;
  fieldValue: string | null;
  createdAt: Date | null;
}

export interface ExportLogEntry {
  id: number;
  userId: string | null;
  exportType: "csv" | "pdf";
  exportScope: "plan_detail" | "comparison" | "matrix" | "changes";
  filters: Record<string, unknown> | null;
  rowCount: number | null;
  createdAt: Date | null;
}

// ── Extended PlanData interface (frontend-facing, includes Phase 1 fields) ──

export interface PlanDataExtended extends PlanData {
  // Drug Tier Cost Sharing
  drugDeductible: number | null;
  tier1CopayPreferred: number | null;
  tier2CopayPreferred: number | null;
  tier3CopayPreferred: number | null;
  tier4CoinsurancePreferred: number | null;
  tier5CoinsurancePreferred: number | null;
  tier6CopayPreferred: number | null;
  // Part B Giveback
  partbGiveback: number | null;
  // Supplemental Benefit Amounts
  otcAmountPerQuarter: number | null;
  flexCardAmount: number | null;
  groceryAllowanceAmount: number | null;
  transportationAmountPerYear: number | null;
  mealBenefitAmount: number | null;
  // Dental/Vision/Hearing Detail
  dentalPreventiveCovered: boolean | null;
  dentalComprehensiveCovered: boolean | null;
  visionExamCopay: number | null;
  hearingAidAllowance: number | null;
  telehealthCopay: number | null;
  // Quality
  overallStarRating: number | null;
}

// ── CMS Summary of Benefits Field Ordering ──

export const cmsSbFieldOrder = [
  // Plan Identification
  'name', 'contractId', 'planId', 'segmentId', 'planType', 'category', 'organizationName',
  'state', 'county', 'city', 'zipcode', 'fips',
  // Cost
  'calculatedMonthlyPremium', 'partbGiveback', 'annualDeductible', 'maximumOopc',
  // Medical Benefits (CMS SB order)
  'pcpCopayMin', 'pcpCopayMax', 'specialistCopayMin', 'specialistCopayMax',
  'emergencyCopay', 'urgentCareCopay', 'inpatientCopay',
  'outpatientCopayMin', 'outpatientCopayMax',
  'diagnosticCopay', 'labCopay', 'imagingCopayMin', 'imagingCopayMax',
  'mentalHealthInpatientCopay', 'mentalHealthOutpatientCopay',
  'snfCopayDays1to20', 'snfCopayDays21to100',
  'homeHealthCopay', 'ambulanceCopay',
  'dmeCopayMin', 'dmeCopayMax',
  // Drug Benefits
  'drugDeductible',
  'tier1CopayPreferred', 'tier1CopayStandard',
  'tier2CopayPreferred', 'tier2CopayStandard',
  'tier3CopayPreferred', 'tier3CopayStandard',
  'tier4CoinsurancePreferred', 'tier4CoinsuranceStandard',
  'tier5CoinsurancePreferred', 'tier5CoinsuranceStandard',
  'tier6CopayPreferred', 'tier6CopayStandard',
  'coverageGapTier1', 'coverageGapTier2',
  'catastrophicCopayGeneric', 'catastrophicCopayBrand', 'catastrophicCoinsurance',
  // Supplemental Benefits
  'dentalPreventiveCovered', 'dentalComprehensiveCovered', 'dentalCoverageLimit',
  'visionExamCopay', 'visionAllowance',
  'hearingCopayMin', 'hearingCopayMax', 'hearingAidAllowance',
  'otcAmountPerQuarter', 'hasOtc',
  'transportationTripsPerYear', 'transportationAmountPerYear', 'hasTransportation',
  'mealBenefitAmount', 'hasMealBenefit',
  'flexCardAmount', 'flexCardFrequency',
  'groceryAllowanceAmount', 'groceryAllowanceFrequency',
  'telehealthCopay', 'hasTelehealth',
  'fitnessBenefitName', 'hasSilverSneakers', 'hasFitnessBenefit',
  'inHomeSupportHoursPerYear', 'hasInHomeSupport',
  // Quality
  'overallStarRating', 'lowPerforming', 'highPerforming',
  // SNP
  'snpType', 'enrollmentStatus',
  // Referral/Auth
  'requiresPcpReferral', 'priorAuthNotes',
] as const;
