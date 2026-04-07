import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, serial, index, uniqueIndex, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users table ──

export const users = pgTable("app_users", {
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
  deletedAt: timestamp("deleted_at"),
  // Stripe billing
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionTier: text("subscription_tier").default("free"), // free | agent | team | enterprise
  subscriptionStatus: text("subscription_status").default("inactive"), // active | inactive | past_due | canceled
  subscriptionId: text("subscription_id"),
  trialEndsAt: timestamp("trial_ends_at"),
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
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  fullName: z.string().optional(),
  role: z.enum(["admin", "compliance", "agent", "viewer"]).optional(),
  organization: z.string().optional(),
  npn: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ── Password Reset Tokens table ──

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_password_reset_tokens_token").on(table.token),
  index("idx_password_reset_tokens_user").on(table.userId),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

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

  // CMS Star Rating detail columns (added by import scripts)
  cahpsOverall: real("cahps_overall"),
  cahpsCareAccess: real("cahps_care_access"),
  cahpsPlanRating: real("cahps_plan_rating"),
  partcStarRating: real("partc_star_rating"),
  partdStarRating: real("partd_star_rating"),

  // Enrollment (added by import-enrollment script)
  enrollmentCount: integer("enrollment_count"),
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

// ── Plan Crosswalk table (CMS 2025→2026 crosswalk data) ──

export const planCrosswalk = pgTable("plan_crosswalk", {
  id: serial("id").primaryKey(),
  previousContractId: text("previous_contract_id"),
  previousPlanId: text("previous_plan_id"),
  previousPlanName: text("previous_plan_name"),
  previousSnpType: text("previous_snp_type"),
  currentContractId: text("current_contract_id"),
  currentPlanId: text("current_plan_id"),
  currentPlanName: text("current_plan_name"),
  currentSnpType: text("current_snp_type"),
  status: text("status").notNull(),
  previousEnrollment: integer("previous_enrollment"),
  previousCarrier: text("previous_carrier"),
  previousStates: text("previous_states"),
  previousCounties: integer("previous_counties"),
  currentCarrier: text("current_carrier"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cw_status").on(table.status),
  index("idx_cw_prev").on(table.previousContractId, table.previousPlanId),
  index("idx_cw_curr").on(table.currentContractId, table.currentPlanId),
]);

export type PlanCrosswalk = typeof planCrosswalk.$inferSelect;

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
  deletedAt: timestamp("deleted_at"),
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
  source: text("source").default("PBP"), // "PBP" | "FHIR" | "Cache"
  carrier: text("carrier"),
  copay: real("copay"),
  coinsurance: real("coinsurance"),
  lastFhirCheck: timestamp("last_fhir_check"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_formulary_contract").on(table.contractId),
  index("idx_formulary_contract_rxcui").on(table.contractId, table.rxcui),
  index("idx_formulary_rxcui").on(table.rxcui),
  index("idx_formulary_drug_name").on(table.drugName),
]);

// ── CMS Plan Cache table (caches CMS Finder API results) ──

export const cmsPlanCache = pgTable("cms_plan_cache", {
  id: serial("id").primaryKey(),
  zipCode: text("zip_code"),
  state: text("state"),
  county: text("county"),
  contractId: text("contract_id"),
  planId: text("plan_id"),
  planName: text("plan_name"),
  organizationName: text("organization_name"),
  planType: text("plan_type"),
  monthlyPremium: real("monthly_premium"),
  starRating: real("star_rating"),
  snpType: text("snp_type"),
  rawData: jsonb("raw_data"),
  fetchedAt: timestamp("fetched_at").defaultNow(),
}, (table) => [
  index("idx_cms_cache_zip").on(table.zipCode),
  index("idx_cms_cache_contract").on(table.contractId, table.planId),
  index("idx_cms_cache_state_county").on(table.state, table.county),
]);

export const insertFormularyDrugSchema = createInsertSchema(formularyDrugs).omit({
  id: true,
  createdAt: true,
});

export type FormularyDrug = typeof formularyDrugs.$inferSelect;
export type InsertFormularyDrug = z.infer<typeof insertFormularyDrugSchema>;

export type CMSPlanCacheEntry = typeof cmsPlanCache.$inferSelect;

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

// ── Provider Network Cache table (FHIR / carrier network verification cache) ──

export const providerNetworkCache = pgTable("provider_network_cache", {
  id: serial("id").primaryKey(),
  npi: text("npi").notNull(),
  carrier: text("carrier").notNull(),
  contractId: text("contract_id"),
  inNetwork: boolean("in_network"),
  source: text("source").notNull(), // "FHIR API" | "Cache" | "Unknown"
  verifiedAt: timestamp("verified_at").defaultNow(),
}, (table) => [
  index("idx_pnc_npi").on(table.npi),
  uniqueIndex("uq_pnc_npi_carrier_contract").on(table.npi, table.carrier, table.contractId),
]);

export type ProviderNetworkCacheEntry = typeof providerNetworkCache.$inferSelect;
export type InsertProviderNetworkCacheEntry = typeof providerNetworkCache.$inferInsert;

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

// ── Consumer Leads table (consumer plan discovery lead capture) ──

export const consumerLeads = pgTable("consumer_leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  zipCode: text("zip_code").notNull(),
  county: text("county"),
  state: text("state"),
  quizAnswers: jsonb("quiz_answers"), // { priority, seesSpecialist, medications, wantsExtras }
  topPlanIds: jsonb("top_plan_ids"), // [planId1, planId2, planId3]
  moneyOnTable: real("money_on_table"), // calculated savings amount
  assignedAgentId: integer("assigned_agent_id").references(() => users.id),
  status: text("status").notNull().default("new"), // new | contacted | enrolled | lost
  source: text("source"), // 'organic' | 'referral' | 'ad'
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  createdAt: timestamp("created_at").defaultNow(),
  contactedAt: timestamp("contacted_at"),
}, (table) => [
  index("idx_consumer_leads_zip").on(table.zipCode),
  index("idx_consumer_leads_status").on(table.status),
  index("idx_consumer_leads_agent").on(table.assignedAgentId),
  index("idx_consumer_leads_created").on(table.createdAt),
]);

export const insertConsumerLeadSchema = createInsertSchema(consumerLeads).omit({
  id: true,
  createdAt: true,
  contactedAt: true,
});

export type ConsumerLead = typeof consumerLeads.$inferSelect;
export type InsertConsumerLead = z.infer<typeof insertConsumerLeadSchema>;

// ── Lead Activity table (tracking actions on leads) ──

export const leadActivity = pgTable("lead_activity", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => consumerLeads.id),
  action: text("action").notNull(), // 'viewed_plans' | 'requested_agent' | 'agent_contacted' | 'enrolled'
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_lead_activity_lead").on(table.leadId),
  index("idx_lead_activity_created").on(table.createdAt),
]);

export type LeadActivity = typeof leadActivity.$inferSelect;
export type InsertLeadActivity = typeof leadActivity.$inferInsert;

// ── Waitlist table ──

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Agencies table ──

export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── ZIP-County Map table (ZCTA crosswalk) ──

export const zipCountyMap = pgTable("zip_county_map", {
  id: serial("id").primaryKey(),
  zipcode: text("zipcode").notNull(),
  countyFips: text("county_fips").notNull(),
  countyName: text("county_name"),
  state: text("state").notNull(),
  stateFips: text("state_fips"),
  residentialRatio: real("residential_ratio").default(1.0),
});

// ── Ops Runs table (pipeline execution tracking) ──

export const opsRuns = pgTable("ops_runs", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(),
  status: text("status"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  details: jsonb("details"),
});

// ── Ops Lookups table ──

export const opsLookups = pgTable("ops_lookups", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── County Health Data table (CHR health metrics) ──

export const countyHealthData = pgTable("county_health_data", {
  id: serial("id").primaryKey(),
  countyFips: text("county_fips").notNull().unique(),
  countyName: text("county_name").notNull(),
  state: text("state").notNull(),
  stateFips: text("state_fips"),
  diabetesRate: real("diabetes_rate"),
  obesityRate: real("obesity_rate"),
  smokingRate: real("smoking_rate"),
  physicalInactivityRate: real("physical_inactivity_rate"),
  poorHealthRate: real("poor_health_rate"),
  mentalHealthDays: real("mental_health_days"),
  uninsuredRate: real("uninsured_rate"),
  medianIncome: integer("median_income"),
  population65Plus: real("population_65_plus"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Provider Quality table (MIPS quality scores) ──

export const providerQuality = pgTable("provider_quality", {
  id: serial("id").primaryKey(),
  npi: text("npi").notNull().unique(),
  providerName: text("provider_name"),
  specialty: text("specialty"),
  groupPracticeId: text("group_practice_id"),
  qualityScore: real("quality_score"),
  patientExperienceScore: real("patient_experience_score"),
  state: text("state"),
  city: text("city"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Medicare Spending table (per-county spending data) ──

export const medicareSpending = pgTable("medicare_spending", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  county: text("county"),
  fips: text("fips"),
  year: integer("year"),
  totalBeneficiaries: integer("total_beneficiaries"),
  maBeneficiaries: integer("ma_beneficiaries"),
  maPenetrationRate: real("ma_penetration_rate"),
  perCapitaTotalSpending: real("per_capita_total_spending"),
  perCapitaIpSpending: real("per_capita_ip_spending"),
  perCapitaOpSpending: real("per_capita_op_spending"),
  perCapitaRxSpending: real("per_capita_rx_spending"),
  standardizedPerCapita: real("standardized_per_capita"),
  avgAge: real("avg_age"),
  avgRiskScore: real("avg_risk_score"),
  dualEligiblePct: real("dual_eligible_pct"),
  erVisitsPer1000: real("er_visits_per_1000"),
  readmissionPct: real("readmission_pct"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── HPSA Shortage Areas table (Health Professional Shortage Areas) ──

export const hpsaShortageAreas = pgTable("hpsa_shortage_areas", {
  id: serial("id").primaryKey(),
  hpsaId: text("hpsa_id"),
  hpsaName: text("hpsa_name"),
  hpsaType: text("hpsa_type"),
  hpsaScore: integer("hpsa_score"),
  designationType: text("designation_type"),
  state: text("state").notNull(),
  county: text("county"),
  fips: text("fips"),
  status: text("status"),
  designatedDate: text("designated_date"),
  population: integer("population"),
  povertyPct: real("poverty_pct"),
  ruralStatus: text("rural_status"),
  degreeOfShortage: real("degree_of_shortage"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── MA Penetration table (Medicare Advantage penetration by county) ──

export const maPenetration = pgTable("ma_penetration", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  county: text("county"),
  fips: text("fips"),
  year: integer("year"),
  totalBeneficiaries: integer("total_beneficiaries"),
  maBeneficiaries: integer("ma_beneficiaries"),
  ffsBeneficiaries: integer("ffs_beneficiaries"),
  maPenetrationRate: real("ma_penetration_rate"),
  ffsAddressablePct: real("ffs_addressable_pct"),
  perCapitaSpending: real("per_capita_spending"),
  spendingTier: text("spending_tier"),
  penetrationTier: text("penetration_tier"),
  opportunityScore: real("opportunity_score"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// ── ACA Marketplace Plans table ──

export const acaPlans = pgTable("aca_plans", {
  id: serial("id").primaryKey(),
  planId: text("plan_id").notNull(), // HIOS plan ID
  planName: text("plan_name").notNull(),
  issuerName: text("issuer_name").notNull(),
  metalLevel: text("metal_level"), // Bronze, Silver, Gold, Platinum, Catastrophic
  planType: text("plan_type"), // HMO, PPO, EPO, POS
  state: text("state").notNull(),
  county: text("county"),
  fips: text("fips"),
  premiumAge27: real("premium_age_27"),
  premiumAge40: real("premium_age_40"),
  premiumAge60: real("premium_age_60"),
  deductibleIndividual: real("deductible_individual"),
  deductibleFamily: real("deductible_family"),
  moopIndividual: real("moop_individual"),
  moopFamily: real("moop_family"),
  ehbPct: real("ehb_pct"), // essential health benefits percentage
  hsaEligible: boolean("hsa_eligible").default(false),
  childOnly: boolean("child_only").default(false),
  planYear: integer("plan_year"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_aca_state").on(table.state),
  index("idx_aca_county").on(table.county, table.state),
  index("idx_aca_issuer").on(table.issuerName),
  index("idx_aca_metal").on(table.metalLevel),
]);

export type ACAPlan = typeof acaPlans.$inferSelect;
