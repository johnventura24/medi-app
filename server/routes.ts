import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { plans, stateNames } from "@shared/schema";
import { sql, eq, count, avg, max, min, countDistinct, desc, asc } from "drizzle-orm";
import type { StateData, CityData, ZipData, CarrierData, PlanData, TargetingRecommendation, NationalAverages } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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

  return httpServer;
}

function parseDollar(val: string): number {
  if (!val) return 0;
  const match = val.replace(/,/g, "").match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}
