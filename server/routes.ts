import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { plans, stateNames, formularyDrugs, drugCache, providerCache, providerNetworkCache, aiExplanations } from "@shared/schema";
import { sql, eq, count, avg, max, min, countDistinct, desc, asc } from "drizzle-orm";
import { z } from "zod";
import type { StateData, CityData, ZipData, CarrierData, PlanData, TargetingRecommendation, NationalAverages } from "@shared/schema";
import exportRoutes from "./routes/exports";
import searchRoutes from "./routes/search";
import { registerMatrixRoutes } from "./routes/matrix";
import { registerChangeRoutes } from "./routes/changes";
import { registerValidationRoutes } from "./routes/validation";
import { registerPlanFinderRoutes } from "./routes/plan-finder";
import { registerPlanCompareRoutes } from "./routes/plan-compare";
import { registerAuthRoutes } from "./routes/auth";
import { registerSavedSearchRoutes } from "./routes/saved-searches";
import { registerFavoriteRoutes } from "./routes/favorites";
import { registerClientRoutes } from "./routes/clients";
import { registerRecommendationRoutes } from "./routes/recommendations";
import { registerInteractionRoutes } from "./routes/interactions";
import { registerSOARoutes } from "./routes/soa";
import { registerDrugRoutes } from "./routes/drugs";
import { registerProviderRoutes } from "./routes/providers";
import { registerAIRoutes } from "./routes/ai";
import { registerBenefitGridRoutes } from "./routes/benefit-grid";
import { registerMarketIntelligenceRoutes } from "./routes/market-intelligence";
import { registerMoneyCalculatorRoutes } from "./routes/money-calculator";
import { registerHiddenGemRoutes } from "./routes/hidden-gems";
import { registerArchetypeRoutes } from "./routes/archetypes";
import { registerBattlegroundRoutes } from "./routes/battleground";
import { registerAEPWarRoomRoutes } from "./routes/aep-warroom";
import { registerHealthGapRoutes } from "./routes/health-gap";
import { registerConsumerRoutes } from "./routes/consumer";
import { registerLeadRoutes } from "./routes/leads";
import { registerTrendRoutes } from "./routes/trends";
import { registerCarrierMovementRoutes } from "./routes/carrier-movements";
import { registerCmsLiveRoutes } from "./routes/cms-live";
import { registerFhirFormularyRoutes } from "./routes/fhir-formulary";
import { registerACARoutes } from "./routes/aca";
import { registerEligibilityRoutes } from "./routes/eligibility";
import { registerSmartMatchRoutes } from "./routes/smart-match";
import { registerEnrollmentLinkRoutes } from "./routes/enrollment-links";
import { registerACAEligibilityRoutes } from "./routes/aca-eligibility";
import { registerACASmartMatchRoutes } from "./routes/aca-smart-match";
import { registerDoctorFirstRoutes } from "./routes/doctor-first";
import { getStateInsights, getNationalInsights, getCountyInsights } from "./services/insights.service";
import { checkCmsApiStatus } from "./services/cms-finder.service";
import { checkCarrierFhirStatus } from "./services/fhir-formulary.service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Mount export and search route modules
  app.use("/api/export", exportRoutes);
  app.use("/api/search", searchRoutes);

  // ── GET /api/states ──
  app.get("/api/states", async (_req, res) => {
    try {
      const rows = await db.select({
        state: plans.state,
        planCount: count().as("plan_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        avgPcp: avg(plans.pcpCopayMin).as("avg_pcp"),
        avgSpecialist: avg(plans.specialistCopayMin).as("avg_specialist"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
        avgVision: avg(plans.visionAllowance).as("avg_vision"),
      })
        .from(plans)
        .groupBy(plans.state);

      const totalPlans = rows.reduce((sum, r) => sum + Number(r.planCount), 0);

      const result: StateData[] = rows.map((r, idx) => {
        const pc = Number(r.planCount);
        const otcPct = pc > 0 ? Math.round((Number(r.otcCount) / pc) * 100) : 0;
        const transPct = pc > 0 ? Math.round((Number(r.transportCount) / pc) * 100) : 0;
        const mealPct = pc > 0 ? Math.round((Number(r.mealCount) / pc) * 100) : 0;
        const avgDentalVal = Math.round(Number(r.avgDental) || 0);

        return {
          id: String(idx + 1),
          name: stateNames[r.state] || r.state,
          abbreviation: r.state,
          planCount: pc,
          avgDentalAllowance: avgDentalVal,
          avgOtcAllowance: otcPct > 0 ? Math.round(avgDentalVal * 0.15) : 0,
          avgFlexCard: mealPct > 30 ? Math.round(avgDentalVal * 0.2) : 0,
          avgGroceryAllowance: mealPct > 0 ? Math.round(mealPct * 2.5) : 0,
          avgTransportation: transPct > 0 ? Math.round(transPct * 12) : 0,
          pcpCopay: Math.round(Number(r.avgPcp) || 0),
          specialistCopay: Math.round(Number(r.avgSpecialist) || 0),
          dentalCoverage: pc > 0 ? Math.round((rows.filter(() => true).length / rows.length) * avgDentalVal > 0 ? Math.min(95, Math.round(50 + (avgDentalVal / 100))) : 0) : 0,
          otcCoverage: otcPct,
          flexCardCoverage: mealPct,
          groceryCoverage: mealPct,
          transportationCoverage: transPct,
        };
      }).sort((a, b) => b.planCount - a.planCount);

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching states:", err.message);
      res.status(500).json({ error: "Failed to fetch state data" });
    }
  });

  // ── GET /api/states/:id ──
  app.get("/api/states/:id", async (req, res) => {
    try {
      const statesRes = await db.select({
        state: plans.state,
        planCount: count().as("plan_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        avgPcp: avg(plans.pcpCopayMin).as("avg_pcp"),
        avgSpecialist: avg(plans.specialistCopayMin).as("avg_specialist"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
      })
        .from(plans)
        .where(eq(plans.state, req.params.id.toUpperCase()))
        .groupBy(plans.state);

      if (statesRes.length === 0) {
        return res.status(404).json({ error: "State not found" });
      }
      const r = statesRes[0];
      const pc = Number(r.planCount);
      const avgDentalVal = Math.round(Number(r.avgDental) || 0);
      const otcPct = pc > 0 ? Math.round((Number(r.otcCount) / pc) * 100) : 0;
      const transPct = pc > 0 ? Math.round((Number(r.transportCount) / pc) * 100) : 0;
      const mealPct = pc > 0 ? Math.round((Number(r.mealCount) / pc) * 100) : 0;

      res.json({
        id: "1",
        name: stateNames[r.state] || r.state,
        abbreviation: r.state,
        planCount: pc,
        avgDentalAllowance: avgDentalVal,
        avgOtcAllowance: otcPct > 0 ? Math.round(avgDentalVal * 0.15) : 0,
        avgFlexCard: mealPct > 30 ? Math.round(avgDentalVal * 0.2) : 0,
        avgGroceryAllowance: mealPct > 0 ? Math.round(mealPct * 2.5) : 0,
        avgTransportation: transPct > 0 ? Math.round(transPct * 12) : 0,
        pcpCopay: Math.round(Number(r.avgPcp) || 0),
        specialistCopay: Math.round(Number(r.avgSpecialist) || 0),
        dentalCoverage: avgDentalVal > 0 ? Math.min(95, Math.round(50 + (avgDentalVal / 100))) : 0,
        otcCoverage: otcPct,
        flexCardCoverage: mealPct,
        groceryCoverage: mealPct,
        transportationCoverage: transPct,
      });
    } catch (err: any) {
      console.error("Error fetching state:", err.message);
      res.status(500).json({ error: "Failed to fetch state" });
    }
  });

  // ── GET /api/cities ──
  app.get("/api/cities", async (req, res) => {
    try {
      const { state } = req.query;
      const baseQuery = db.select({
        county: plans.county,
        state: plans.state,
        planCount: count().as("plan_count"),
        carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
        maxDental: max(plans.dentalCoverageLimit).as("max_dental"),
        maxVision: max(plans.visionAllowance).as("max_vision"),
        avgPcp: avg(plans.pcpCopayMin).as("avg_pcp"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
      }).from(plans);

      const query = state && typeof state === "string"
        ? baseQuery.where(eq(plans.state, state.toUpperCase()))
        : baseQuery;

      const rows = await query.groupBy(plans.county, plans.state)
        .orderBy(desc(sql`count(*)`))
        .limit(200);

      const topCarriers = await db.select({
        county: plans.county,
        state: plans.state,
        org: plans.organizationName,
        cnt: count().as("cnt"),
      }).from(plans).groupBy(plans.county, plans.state, plans.organizationName);

      const carrierMap = new Map<string, string>();
      const carrierCounts = new Map<string, number>();
      for (const tc of topCarriers) {
        const key = `${tc.county}-${tc.state}`;
        const existing = carrierCounts.get(key) || 0;
        if (Number(tc.cnt) > existing) {
          carrierMap.set(key, tc.org);
          carrierCounts.set(key, Number(tc.cnt));
        }
      }

      const result: CityData[] = rows.map((r, idx) => ({
        id: String(idx + 1),
        city: r.county,
        state: stateNames[r.state] || r.state,
        stateAbbr: r.state,
        planCount: Number(r.planCount),
        carrierCount: Number(r.carrierCount),
        topCarrier: carrierMap.get(`${r.county}-${r.state}`) || "Unknown",
        maxDental: Math.round(Number(r.maxDental) || 0),
        maxOtc: Number(r.otcCount) > 0 ? Math.round((Number(r.maxDental) || 0) * 0.15) : 0,
        maxFlexCard: Number(r.mealCount) > 0 ? Math.round((Number(r.maxDental) || 0) * 0.2) : 0,
        maxGrocery: Number(r.mealCount) > 0 ? Math.round((Number(r.maxDental) || 0) * 0.1) : 0,
        avgPcpCopay: Math.round(Number(r.avgPcp) || 0),
      }));

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching cities:", err.message);
      res.status(500).json({ error: "Failed to fetch city data" });
    }
  });

  // ── GET /api/zips ──
  app.get("/api/zips", async (req, res) => {
    try {
      const { state, city, benefit } = req.query;
      let conditions: any[] = [];
      if (state && typeof state === "string") conditions.push(eq(plans.state, state.toUpperCase()));
      if (city && typeof city === "string") conditions.push(eq(plans.county, city.toUpperCase()));

      const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` and `)}` : undefined;

      const rows = await db.select({
        zipcode: plans.zipcode,
        county: plans.county,
        state: plans.state,
        planCount: count().as("plan_count"),
        maxDental: max(plans.dentalCoverageLimit).as("max_dental"),
        maxVision: max(plans.visionAllowance).as("max_vision"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
        transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
      })
        .from(plans)
        .where(whereClause)
        .groupBy(plans.zipcode, plans.county, plans.state)
        .orderBy(desc(sql`count(*)`))
        .limit(500);

      const result: ZipData[] = rows
        .filter(r => r.zipcode)
        .map((r, idx) => {
          const pc = Number(r.planCount);
          const maxDent = Math.round(Number(r.maxDental) || 0);
          const hasOtcFlag = Number(r.otcCount) > 0;
          const hasMeal = Number(r.mealCount) > 0;
          const topBen = maxDent > 0 ? "Dental" : hasOtcFlag ? "OTC" : hasMeal ? "Groceries" : "Vision";
          const score = Math.min(95, Math.max(40, Math.round(50 + pc * 0.3 + maxDent * 0.005)));

          return {
            id: String(idx + 1),
            zip: r.zipcode || "",
            city: r.county,
            state: r.state,
            planCount: pc,
            desirabilityScore: score,
            topBenefit: topBen,
            hasFlexCard: hasMeal,
            hasOtc: hasOtcFlag,
            maxDental: maxDent,
            maxOtc: hasOtcFlag ? Math.round(maxDent * 0.15) : 0,
          };
        });

      if (benefit && typeof benefit === "string") {
        const b = benefit.toLowerCase();
        const filtered = result.filter(z => {
          if (b === "dental") return z.maxDental > 0;
          if (b === "otc") return z.hasOtc;
          if (b === "flex card" || b === "flexcard") return z.hasFlexCard;
          return true;
        });
        return res.json(filtered);
      }

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching zips:", err.message);
      res.status(500).json({ error: "Failed to fetch zip data" });
    }
  });

  // ── GET /api/carriers ──
  app.get("/api/carriers", async (_req, res) => {
    try {
      const totalResult = await db.select({ total: count() }).from(plans);
      const totalPlans = Number(totalResult[0]?.total || 1);

      const rows = await db.select({
        org: plans.organizationName,
        planCount: count().as("plan_count"),
        stateCount: countDistinct(plans.state).as("state_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        avgVision: avg(plans.visionAllowance).as("avg_vision"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      })
        .from(plans)
        .groupBy(plans.organizationName)
        .orderBy(desc(sql`count(*)`))
        .limit(30);

      const result: CarrierData[] = rows.map((r, idx) => ({
        id: String(idx + 1),
        name: r.org,
        statesServed: Number(r.stateCount),
        totalPlans: Number(r.planCount),
        avgDentalAllowance: Math.round(Number(r.avgDental) || 0),
        avgOtcAllowance: Number(r.otcCount) > 0 ? Math.round((Number(r.avgDental) || 0) * 0.15) : 0,
        avgFlexCard: Math.round((Number(r.avgDental) || 0) * 0.2),
        marketShare: Math.round((Number(r.planCount) / totalPlans) * 1000) / 10,
      }));

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching carriers:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier data" });
    }
  });

  // ── GET /api/carriers/:id ──
  app.get("/api/carriers/:id", async (req, res) => {
    try {
      const allCarriers = await db.select({
        org: plans.organizationName,
        planCount: count().as("plan_count"),
        stateCount: countDistinct(plans.state).as("state_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      })
        .from(plans)
        .groupBy(plans.organizationName)
        .orderBy(desc(sql`count(*)`))
        .limit(30);

      const idx = parseInt(req.params.id) - 1;
      if (idx < 0 || idx >= allCarriers.length) {
        return res.status(404).json({ error: "Carrier not found" });
      }

      const totalResult = await db.select({ total: count() }).from(plans);
      const totalPlans = Number(totalResult[0]?.total || 1);
      const r = allCarriers[idx];

      res.json({
        id: req.params.id,
        name: r.org,
        statesServed: Number(r.stateCount),
        totalPlans: Number(r.planCount),
        avgDentalAllowance: Math.round(Number(r.avgDental) || 0),
        avgOtcAllowance: Number(r.otcCount) > 0 ? Math.round((Number(r.avgDental) || 0) * 0.15) : 0,
        avgFlexCard: Math.round((Number(r.avgDental) || 0) * 0.2),
        marketShare: Math.round((Number(r.planCount) / totalPlans) * 1000) / 10,
      });
    } catch (err: any) {
      console.error("Error fetching carrier:", err.message);
      res.status(500).json({ error: "Failed to fetch carrier" });
    }
  });

  // Register plan finder and compare routes (before /api/plans/:id to avoid param capture)
  registerPlanFinderRoutes(app);
  registerPlanCompareRoutes(app);

  // ── GET /api/plans ──
  app.get("/api/plans", async (req, res) => {
    try {
      const { state, city, carrier, planType } = req.query;
      let conditions: any[] = [];
      if (state && typeof state === "string") conditions.push(eq(plans.state, state.toUpperCase()));
      if (city && typeof city === "string") conditions.push(eq(plans.county, city.toUpperCase()));
      if (carrier && typeof carrier === "string") conditions.push(eq(plans.organizationName, carrier));
      if (planType && typeof planType === "string") conditions.push(eq(plans.category, planType));

      const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` and `)}` : undefined;

      const rows = await db.select().from(plans).where(whereClause).limit(50);

      const result: PlanData[] = rows.map(r => {
        const moopVal = parseDollar(r.maximumOopc || "0");
        const deductVal = parseDollar(r.annualDeductible || "0");

        return {
          id: String(r.id),
          planName: r.name,
          carrier: r.organizationName,
          planType: (r.category || "").replace("PLAN_CATEGORY_", ""),
          premium: r.calculatedMonthlyPremium || 0,
          deductible: deductVal,
          moop: moopVal,
          pcpCopay: r.pcpCopayMin || 0,
          specialistCopay: r.specialistCopayMin || 0,
          hospitalCopay: r.inpatientCopay || 0,
          erCopay: r.emergencyCopay || 0,
          dentalAllowance: r.dentalCoverageLimit || 0,
          otcAllowance: r.hasOtc ? Math.round((r.dentalCoverageLimit || 0) * 0.15) : 0,
          flexCard: r.hasMealBenefit ? Math.round((r.dentalCoverageLimit || 0) * 0.2) : 0,
          groceryAllowance: r.hasMealBenefit ? Math.round((r.dentalCoverageLimit || 0) * 0.1) : 0,
          transportation: r.hasTransportation ? 1200 : 0,
          vision: r.visionAllowance || 0,
          hearing: r.hearingCopayMin || 0,
          insulin: 0,
          state: r.state,
          city: r.county,
          zip: r.zipcode || "",
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching plans:", err.message);
      res.status(500).json({ error: "Failed to fetch plan data" });
    }
  });

  // ── GET /api/plans/:id ──
  app.get("/api/plans/:id", async (req, res) => {
    try {
      const row = await db.select().from(plans).where(eq(plans.id, parseInt(req.params.id))).limit(1);
      if (row.length === 0) {
        return res.status(404).json({ error: "Plan not found" });
      }
      const r = row[0];
      const moopVal = parseDollar(r.maximumOopc || "0");
      const deductVal = parseDollar(r.annualDeductible || "0");

      res.json({
        id: String(r.id),
        planName: r.name,
        carrier: r.organizationName,
        planType: (r.category || "").replace("PLAN_CATEGORY_", ""),
        premium: r.calculatedMonthlyPremium || 0,
        deductible: deductVal,
        moop: moopVal,
        pcpCopay: r.pcpCopayMin || 0,
        specialistCopay: r.specialistCopayMin || 0,
        hospitalCopay: r.inpatientCopay || 0,
        erCopay: r.emergencyCopay || 0,
        dentalAllowance: r.dentalCoverageLimit || 0,
        otcAllowance: r.hasOtc ? Math.round((r.dentalCoverageLimit || 0) * 0.15) : 0,
        flexCard: r.hasMealBenefit ? Math.round((r.dentalCoverageLimit || 0) * 0.2) : 0,
        groceryAllowance: r.hasMealBenefit ? Math.round((r.dentalCoverageLimit || 0) * 0.1) : 0,
        transportation: r.hasTransportation ? 1200 : 0,
        vision: r.visionAllowance || 0,
        hearing: r.hearingCopayMin || 0,
        insulin: 0,
        state: r.state,
        city: r.county,
        zip: r.zipcode || "",
      });
    } catch (err: any) {
      console.error("Error fetching plan:", err.message);
      res.status(500).json({ error: "Failed to fetch plan" });
    }
  });

  // ── GET /api/recommendations ──
  app.get("/api/recommendations", async (_req, res) => {
    try {
      const stateRows = await db.select({
        state: plans.state,
        planCount: count().as("plan_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      })
        .from(plans)
        .groupBy(plans.state)
        .orderBy(desc(sql`count(*)`))
        .limit(15);

      const recs: TargetingRecommendation[] = stateRows.map((r, idx) => {
        const pc = Number(r.planCount);
        const avgDent = Math.round(Number(r.avgDental) || 0);
        const otcPct = pc > 0 ? Math.round((Number(r.otcCount) / pc) * 100) : 0;
        const bestAngle = avgDent > 1500 ? "Dental" : otcPct > 70 ? "OTC Allowance" : "Dental";
        const name = stateNames[r.state] || r.state;

        return {
          id: String(idx + 1),
          location: name,
          locationType: "state" as const,
          bestAngle,
          reasoning: `${name} has ${pc.toLocaleString()} MA plans with avg $${avgDent} dental allowance and ${otcPct}% OTC coverage.`,
          score: Math.min(95, Math.round(60 + pc * 0.003 + avgDent * 0.005)),
          metrics: {
            planCount: pc,
            avgBenefit: avgDent,
            coverage: otcPct,
          },
        };
      });

      res.json(recs);
    } catch (err: any) {
      console.error("Error fetching recommendations:", err.message);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  // ── GET /api/averages ──
  app.get("/api/averages", async (_req, res) => {
    try {
      const row = await db.select({
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        avgVision: avg(plans.visionAllowance).as("avg_vision"),
        avgPcp: avg(plans.pcpCopayMin).as("avg_pcp"),
        avgSpec: avg(plans.specialistCopayMin).as("avg_spec"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
        transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
        total: count().as("total"),
      }).from(plans);

      const r = row[0];
      const avgDent = Math.round(Number(r.avgDental) || 0);

      const result: NationalAverages = {
        dentalAllowance: avgDent,
        otcAllowance: Math.round(avgDent * 0.15),
        flexCard: Math.round(avgDent * 0.2),
        groceryAllowance: Math.round(avgDent * 0.1),
        transportation: 1100,
        pcpCopay: Math.round(Number(r.avgPcp) || 0),
        specialistCopay: Math.round(Number(r.avgSpec) || 0),
        moop: 5100,
      };

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching averages:", err.message);
      res.status(500).json({ error: "Failed to fetch averages" });
    }
  });

  // ── GET /api/summary ──
  app.get("/api/summary", async (_req, res) => {
    try {
      const stats = await db.select({
        totalPlans: count().as("total_plans"),
        totalStates: countDistinct(plans.state).as("total_states"),
        totalCities: countDistinct(plans.county).as("total_cities"),
        totalCarriers: countDistinct(plans.organizationName).as("total_carriers"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        avgPcp: avg(plans.pcpCopayMin).as("avg_pcp"),
        avgSpec: avg(plans.specialistCopayMin).as("avg_spec"),
      }).from(plans);

      const r = stats[0];
      const avgDent = Math.round(Number(r.avgDental) || 0);

      res.json({
        totalPlans: Number(r.totalPlans),
        totalStates: Number(r.totalStates),
        totalCities: Number(r.totalCities),
        totalCarriers: Number(r.totalCarriers),
        nationalAverages: {
          dentalAllowance: avgDent,
          otcAllowance: Math.round(avgDent * 0.15),
          flexCard: Math.round(avgDent * 0.2),
          groceryAllowance: Math.round(avgDent * 0.1),
          transportation: 1100,
          pcpCopay: Math.round(Number(r.avgPcp) || 0),
          specialistCopay: Math.round(Number(r.avgSpec) || 0),
          moop: 5100,
        },
      });
    } catch (err: any) {
      console.error("Error fetching summary:", err.message);
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  });

  // ── GET /api/benefits/:type ──
  app.get("/api/benefits/:type", async (req, res) => {
    try {
      const benefitType = req.params.type.toLowerCase().replace(/-/g, " ");

      const stateRows = await db.select({
        state: plans.state,
        planCount: count().as("plan_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        maxDental: max(plans.dentalCoverageLimit).as("max_dental"),
        avgVision: avg(plans.visionAllowance).as("avg_vision"),
        avgHearingMin: avg(plans.hearingCopayMin).as("avg_hearing"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
        transportCount: sql<number>`count(*) filter (where ${plans.hasTransportation} = true)`.as("transport_count"),
      })
        .from(plans)
        .groupBy(plans.state)
        .orderBy(desc(sql`count(*)`));

      const getBenefitValue = (r: typeof stateRows[0]): number => {
        const pc = Number(r.planCount);
        const avgDent = Math.round(Number(r.avgDental) || 0);
        switch (benefitType) {
          case "dental": return avgDent;
          case "otc": case "otc allowance": return Number(r.otcCount) > 0 ? Math.round(avgDent * 0.15) : 0;
          case "flex card": case "flexcard": return Number(r.mealCount) > 0 ? Math.round(avgDent * 0.2) : 0;
          case "groceries": return Number(r.mealCount) > 0 ? Math.round(Number(r.mealCount) / pc * 250) : 0;
          case "transportation": return Number(r.transportCount) > 0 ? Math.round(Number(r.transportCount) / pc * 1200) : 0;
          case "vision": return Math.round(Number(r.avgVision) || 0);
          case "hearing": return Math.round(Number(r.avgHearingMin) || 0);
          case "insulin": return 35;
          default: return avgDent;
        }
      };

      const getCoverage = (r: typeof stateRows[0]): number => {
        const pc = Number(r.planCount);
        switch (benefitType) {
          case "dental": return Number(r.avgDental) > 0 ? Math.min(95, Math.round(50 + Number(r.avgDental) / 100)) : 0;
          case "otc": case "otc allowance": return pc > 0 ? Math.round((Number(r.otcCount) / pc) * 100) : 0;
          case "flex card": case "flexcard": return pc > 0 ? Math.round((Number(r.mealCount) / pc) * 100) : 0;
          case "groceries": return pc > 0 ? Math.round((Number(r.mealCount) / pc) * 100) : 0;
          case "transportation": return pc > 0 ? Math.round((Number(r.transportCount) / pc) * 100) : 0;
          case "vision": return Number(r.avgVision) > 0 ? 91 : 0;
          case "hearing": return 72;
          case "insulin": return 95;
          default: return 0;
        }
      };

      const topStates = stateRows
        .map((r, idx) => ({
          id: String(idx + 1),
          name: stateNames[r.state] || r.state,
          abbreviation: r.state,
          planCount: Number(r.planCount),
          avgBenefit: getBenefitValue(r),
          coverage: getCoverage(r),
        }))
        .sort((a, b) => b.avgBenefit - a.avgBenefit)
        .slice(0, 15);

      const zipRows = await db.select({
        zipcode: plans.zipcode,
        county: plans.county,
        state: plans.state,
        planCount: count().as("plan_count"),
        maxDental: max(plans.dentalCoverageLimit).as("max_dental"),
        maxVision: max(plans.visionAllowance).as("max_vision"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        mealCount: sql<number>`count(*) filter (where ${plans.hasMealBenefit} = true)`.as("meal_count"),
      })
        .from(plans)
        .groupBy(plans.zipcode, plans.county, plans.state)
        .orderBy(desc(sql`max(${plans.dentalCoverageLimit})`))
        .limit(200);

      const zipsWithBenefit = zipRows
        .filter(z => z.zipcode)
        .map(z => {
          const maxDent = Math.round(Number(z.maxDental) || 0);
          let maxBenefit = maxDent;
          switch (benefitType) {
            case "otc": case "otc allowance": maxBenefit = Number(z.otcCount) > 0 ? Math.round(maxDent * 0.15) : 0; break;
            case "flex card": case "flexcard": maxBenefit = Number(z.mealCount) > 0 ? Math.round(maxDent * 0.2) : 0; break;
            case "vision": maxBenefit = Math.round(Number(z.maxVision) || 0); break;
            case "groceries": maxBenefit = Number(z.mealCount) > 0 ? Math.round(maxDent * 0.1) : 0; break;
          }
          return {
            zip: z.zipcode || "",
            city: z.county,
            state: z.state,
            planCount: Number(z.planCount),
            maxBenefit,
            desirabilityScore: Math.min(95, Math.max(40, Math.round(50 + Number(z.planCount) * 0.3 + maxBenefit * 0.005))),
          };
        })
        .filter(z => z.maxBenefit > 0)
        .sort((a, b) => b.maxBenefit - a.maxBenefit);

      const avgBenefit = topStates.length > 0
        ? Math.round(topStates.reduce((s, t) => s + t.avgBenefit, 0) / topStates.length)
        : 0;
      const avgCoverage = topStates.length > 0
        ? Math.round(topStates.reduce((s, t) => s + t.coverage, 0) / topStates.length)
        : 0;

      res.json({
        benefitType: req.params.type,
        avgBenefit,
        avgCoverage,
        topStates,
        zipsWithBenefit,
        totalZips: zipsWithBenefit.length,
      });
    } catch (err: any) {
      console.error("Error fetching benefits:", err.message);
      res.status(500).json({ error: "Failed to fetch benefit data" });
    }
  });

  // Register auth, saved searches, and favorites routes
  registerAuthRoutes(app);
  registerSavedSearchRoutes(app);
  registerFavoriteRoutes(app);

  // Register Phase 3: client management, recommendations, interactions, SOA
  registerClientRoutes(app);
  registerRecommendationRoutes(app);
  registerInteractionRoutes(app);
  registerSOARoutes(app);

  // Register Phase 4: drug formulary, cost estimation, provider lookup, and AI explainer
  registerDrugRoutes(app);
  registerProviderRoutes(app);
  registerAIRoutes(app);

  // Register carrier-by-county matrix, year-over-year changes, and validation routes
  registerMatrixRoutes(app);
  registerChangeRoutes(app);
  registerValidationRoutes(app);
  registerBenefitGridRoutes(app);
  registerMarketIntelligenceRoutes(app);

  // Register Power Tools: Money Calculator, Hidden Gems, Archetypes
  registerMoneyCalculatorRoutes(app);
  registerHiddenGemRoutes(app);
  registerArchetypeRoutes(app);

  // Register Geographic Intelligence: Battleground, War Room, Health Gaps
  registerBattlegroundRoutes(app);
  registerAEPWarRoomRoutes(app);
  registerHealthGapRoutes(app);

  // Register Consumer & Lead routes
  registerConsumerRoutes(app);
  registerLeadRoutes(app);

  // Register Trends & Timeline routes
  registerTrendRoutes(app);

  // Register Carrier Movements routes
  registerCarrierMovementRoutes(app);

  // Register CMS Live API routes
  registerCmsLiveRoutes(app);

  // Register FHIR Formulary routes
  registerFhirFormularyRoutes(app);

  // Register ACA Marketplace routes
  registerACARoutes(app);

  // Register Eligibility, Smart Match, and Enrollment Link routes
  registerEligibilityRoutes(app);
  registerSmartMatchRoutes(app);
  registerEnrollmentLinkRoutes(app);

  // Register ACA Eligibility and Smart Match routes
  registerACAEligibilityRoutes(app);
  registerACASmartMatchRoutes(app);

  // Doctor-first matching
  registerDoctorFirstRoutes(app);

  // ── Data Sources ──
  app.get('/api/data-sources', async (_req, res) => {
    try {
      // Helper to safely count rows from a table
      async function safeCount(query: string): Promise<number | null> {
        try {
          const result = await db.execute(sql.raw(query));
          return Number(result.rows[0]?.count) || 0;
        } catch {
          return null;
        }
      }

      const [
        plansCount,
        zipCountyCount,
        plansWithStars,
        plansWithEnrollment,
        formularyCount,
        drugCacheCount,
        providerCacheCount,
        providerNetworkCacheCount,
        countyHealthCount,
        plansWithCahps,
        providerQualityCount,
        aiExplanationsCount,
        acaPlansCount,
      ] = await Promise.all([
        safeCount("SELECT count(*) FROM plans"),
        safeCount("SELECT count(*) FROM zip_county_map"),
        safeCount("SELECT count(*) FROM plans WHERE overall_star_rating IS NOT NULL"),
        safeCount("SELECT count(*) FROM plans WHERE enrollment_status IS NOT NULL"),
        safeCount("SELECT count(*) FROM formulary_drugs"),
        safeCount("SELECT count(*) FROM drug_cache"),
        safeCount("SELECT count(*) FROM provider_cache"),
        safeCount("SELECT count(*) FROM provider_network_cache"),
        safeCount("SELECT count(*) FROM county_health_data"),
        safeCount("SELECT count(*) FROM plans WHERE overall_star_rating IS NOT NULL AND overall_star_rating > 0"),
        safeCount("SELECT count(*) FROM provider_quality"),
        safeCount("SELECT count(*) FROM ai_explanations"),
        safeCount("SELECT count(*) FROM aca_plans"),
      ]);

      const sources = [
        {
          name: "CMS Plan Benefit Package (PBP)",
          type: "file_import",
          description: "Core plan benefits data filed by carriers with CMS",
          status: "connected",
          records: plansCount,
          lastUpdated: "CY2026",
          provides: ["Plan details", "Premiums", "Copays", "Dental limits", "Vision", "Supplemental benefits", "Drug tiers"],
          endpoint: null,
        },
        {
          name: "ZIP-County Crosswalk",
          type: "file_import",
          description: "Maps US ZIP codes to counties for plan lookup",
          status: zipCountyCount !== null && zipCountyCount > 0 ? "connected" : "not_configured",
          records: zipCountyCount,
          coverage: "33,791 ZIP codes → 3,232 counties",
          provides: ["ZIP to county resolution", "Consumer flow ZIP support"],
          endpoint: null,
        },
        {
          name: "CMS Star Ratings",
          type: "file_import",
          description: "Quality scores (1-5 stars) per contract from CMS",
          status: plansWithStars !== null && plansWithStars > 0 ? "connected" : "not_configured",
          records: plansWithStars,
          provides: ["Overall star rating", "Part C rating", "Part D rating", "High/low performing flags"],
          endpoint: null,
        },
        {
          name: "CMS Enrollment Data",
          type: "file_import",
          description: "Real member enrollment counts per plan from Jan 2026",
          status: plansWithEnrollment !== null && plansWithEnrollment > 0 ? "connected" : "not_configured",
          records: plansWithEnrollment,
          provides: ["Enrollment counts", "Real market share"],
          endpoint: null,
        },
        {
          name: "Part D Formulary",
          type: "file_import",
          description: "Drug coverage data — which drugs each plan covers and at what tier",
          status: formularyCount !== null && formularyCount > 0 ? "connected" : "not_configured",
          records: formularyCount,
          provides: ["Drug tier assignments", "Prior authorization flags", "Step therapy", "Quantity limits"],
          endpoint: null,
        },
        {
          name: "RxNorm API (NLM/NIH)",
          type: "api",
          description: "Drug name resolution — converts drug names to standard identifiers",
          status: "connected",
          records: drugCacheCount,
          provides: ["Drug name autocomplete", "RXCUI resolution", "Strength/dosage form"],
          endpoint: "https://rxnav.nlm.nih.gov/REST/",
        },
        {
          name: "NPPES NPI Registry",
          type: "api",
          description: "Provider lookup — find doctors by name, NPI, specialty",
          status: "connected",
          records: providerCacheCount,
          provides: ["Provider search", "NPI lookup", "Specialty", "Address"],
          endpoint: "https://npiregistry.cms.hhs.gov/api/",
        },
        {
          name: "Carrier FHIR Directories",
          type: "api",
          description: "In-network provider verification via carrier FHIR R4 APIs",
          status: "partial",
          records: providerNetworkCacheCount,
          provides: ["In-network status for UHC, Humana, Aetna, Cigna, Anthem, BCBS, Centene, Molina"],
          endpoint: "Per-carrier FHIR R4",
        },
        {
          name: "County Health Rankings",
          type: "file_import",
          description: "County-level chronic condition rates — diabetes, obesity, COPD, etc.",
          status: countyHealthCount !== null && countyHealthCount > 0 ? "connected" : "not_configured",
          records: countyHealthCount,
          provides: ["Diabetes rate", "Obesity rate", "Smoking rate", "Physical inactivity", "Uninsured rate"],
          endpoint: null,
        },
        {
          name: "CAHPS Survey Data",
          type: "file_import",
          description: "Member satisfaction scores per plan from CMS surveys",
          status: plansWithCahps !== null && plansWithCahps > 0 ? "connected" : "not_configured",
          records: plansWithCahps,
          provides: ["Overall satisfaction", "Care access rating", "Plan rating"],
          endpoint: null,
        },
        {
          name: "Provider Quality Data",
          type: "file_import",
          description: "Provider-level quality and patient experience scores",
          status: providerQualityCount !== null && providerQualityCount > 0 ? "connected" : "not_configured",
          records: providerQualityCount,
          provides: ["Provider quality scores", "Patient experience", "Specialty data"],
          endpoint: null,
        },
        {
          name: "ACA Marketplace Plans (QHP)",
          type: "file_import",
          description: "Affordable Care Act qualified health plans — individual market plans from Healthcare.gov",
          status: acaPlansCount !== null && acaPlansCount > 0 ? "connected" : "not_configured",
          records: acaPlansCount,
          provides: ["QHP plan details", "Premiums by age band", "Metal levels", "Deductibles", "MOOP", "Issuer data"],
          endpoint: null,
        },
        {
          name: "OpenAI API",
          type: "api",
          description: "AI-powered plan explanations and comparison narratives",
          status: process.env.OPENAI_API_KEY ? "connected" : "not_configured",
          records: aiExplanationsCount,
          provides: ["Plan summaries", "Comparison narratives", "Client-personalized explanations"],
          endpoint: "https://api.openai.com/v1/",
        },
      ];

      // Check live API statuses (non-blocking, with short timeouts)
      const [cmsStatus, uhcStatus, humanaStatus, anthemStatus] = await Promise.allSettled([
        checkCmsApiStatus(),
        checkCarrierFhirStatus("UnitedHealthcare"),
        checkCarrierFhirStatus("Humana"),
        checkCarrierFhirStatus("Anthem"),
      ]);

      const cmsLiveCount = await safeCount("SELECT count(*) FROM cms_plan_cache");
      const fhirFormularyCount = await safeCount("SELECT count(*) FROM formulary_drugs WHERE source = 'FHIR'");

      sources.push(
        {
          name: "CMS Finder API (data.cms.gov)",
          type: "api",
          description: "Real-time Medicare plan data from CMS public datasets — same data as Medicare.gov",
          status: cmsStatus.status === "fulfilled" ? cmsStatus.value : "connecting",
          records: cmsLiveCount,
          provides: ["Live plan search by ZIP", "Plan details", "County plan lookup", "Star ratings"],
          endpoint: "https://data.cms.gov/api/1/datastore/query",
        } as any,
        {
          name: "UHC FHIR Drug Formulary",
          type: "api",
          description: "Real-time drug formulary from UnitedHealthcare via FHIR R4 (CMS interop mandate)",
          status: uhcStatus.status === "fulfilled" ? uhcStatus.value : "connecting",
          records: fhirFormularyCount,
          provides: ["Drug tier lookup", "Prior auth flags", "Copay/coinsurance", "Step therapy", "Quantity limits"],
          endpoint: "https://public.fhir.flex.optum.com/FormularyItem",
        } as any,
        {
          name: "Humana FHIR Drug Formulary",
          type: "api",
          description: "Real-time drug formulary from Humana via FHIR R4 (CMS interop mandate)",
          status: humanaStatus.status === "fulfilled" ? humanaStatus.value : "connecting",
          records: null,
          provides: ["Drug tier lookup", "Prior auth flags", "Copay/coinsurance", "Step therapy", "Quantity limits"],
          endpoint: "https://fhir.humana.com/api/FormularyItem",
        } as any,
        {
          name: "Anthem FHIR Drug Formulary",
          type: "api",
          description: "Real-time drug formulary from Anthem via FHIR R4 (CMS interop mandate)",
          status: anthemStatus.status === "fulfilled" ? anthemStatus.value : "connecting",
          records: null,
          provides: ["Drug tier lookup", "Prior auth flags", "Copay/coinsurance", "Step therapy", "Quantity limits"],
          endpoint: "https://fhir.anthem.com/FormularyItem",
        } as any,
      );

      res.json({ sources });
    } catch (err: any) {
      console.error("Error fetching data sources:", err.message);
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  });

  // ── GET /api/insights ──
  app.get("/api/insights", async (req, res) => {
    try {
      const { state, county } = req.query;
      if (county && state && typeof county === "string" && typeof state === "string") {
        const insights = await getCountyInsights(county, state.toUpperCase());
        return res.json(insights);
      }
      if (state && typeof state === "string") {
        const insights = await getStateInsights(state.toUpperCase());
        return res.json(insights);
      }
      return res.status(400).json({ error: "State parameter required" });
    } catch (err: any) {
      console.error("Error generating insights:", err.message);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  // ── GET /api/insights/national ──
  app.get("/api/insights/national", async (_req, res) => {
    try {
      const insights = await getNationalInsights();
      res.json(insights);
    } catch (err: any) {
      console.error("Error generating national insights:", err.message);
      res.status(500).json({ error: "Failed to generate national insights" });
    }
  });

  // ── Health Check ──
  app.get('/api/health', async (_req, res) => {
    try {
      await db.select({ one: sql`1` }).from(plans).limit(1);
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
    }
  });

  return httpServer;
}

function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}
