import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users table (kept from original) ──

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
}, (table) => [
  index("idx_plans_state").on(table.state),
  index("idx_plans_county").on(table.county),
  index("idx_plans_org").on(table.organizationName),
  index("idx_plans_category").on(table.category),
  index("idx_plans_zipcode").on(table.zipcode),
]);

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

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
