import type { Express, Request, Response } from "express";
import { db } from "../db";
import { plans, consumerLeads, leadActivity, users } from "@shared/schema";
import { sql, eq, and, or, asc, desc, count } from "drizzle-orm";
import { z } from "zod";
import { resolveZipToCounty, resolveZipToAllCounties } from "../services/zip-resolver.service";

// ── Validation schemas ──

const findPlansSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/, "ZIP code must be 5 digits"),
  priority: z.enum(["low_cost", "best_dental", "best_drugs", "everything"]),
  seesSpecialist: z.boolean(),
  medications: z.enum(["none", "few", "many"]),
  wantsExtras: z.boolean(),
});

const requestAgentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(7),
  zipCode: z.string().regex(/^\d{5}$/),
  quizAnswers: z.object({
    priority: z.string(),
    seesSpecialist: z.boolean(),
    medications: z.string(),
    wantsExtras: z.boolean(),
  }),
  topPlanIds: z.array(z.number()),
  moneyOnTable: z.number(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export function registerConsumerRoutes(app: Express) {

  // ── POST /api/consumer/find-plans ──
  app.post("/api/consumer/find-plans", async (req: Request, res: Response) => {
    try {
      const parsed = findPlansSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { zipCode, priority, seesSpecialist, medications, wantsExtras } = parsed.data;

      // Resolve ZIP to county + state using zip_county_map (33,000+ ZIPs)
      const allCounties = await resolveZipToAllCounties(zipCode);

      // If zip_county_map has no result, fall back to plans table
      let zipRows: { county: string; state: string }[];
      if (allCounties.length > 0) {
        zipRows = allCounties.map(c => ({ county: c.county, state: c.state }));
      } else {
        // Legacy fallback: try plans table
        zipRows = await db
          .selectDistinct({ county: plans.county, state: plans.state })
          .from(plans)
          .where(eq(plans.zipcode, zipCode))
          .limit(10);

        if (zipRows.length === 0) {
          const zipPrefix = zipCode.substring(0, 3);
          zipRows = await db
            .selectDistinct({ county: plans.county, state: plans.state })
            .from(plans)
            .where(sql`${plans.zipcode} LIKE ${zipPrefix + '%'}`)
            .limit(10);
        }
      }

      // If still no match, return helpful error
      if (zipRows.length === 0) {
        return res.status(404).json({ error: "No plans found for this ZIP code. Try a nearby ZIP code or check the number." });
      }

      const resolvedCounty = zipRows[0].county;
      const resolvedState = zipRows[0].state;

      // Build location condition for all matching counties
      const countyConditions = zipRows.map(r =>
        and(eq(plans.county, r.county), eq(plans.state, r.state))
      );
      const locationCondition = countyConditions.length === 1
        ? countyConditions[0]
        : or(...countyConditions);

      // Fetch all plans for this location
      const allPlans = await db
        .select()
        .from(plans)
        .where(locationCondition!);

      if (allPlans.length === 0) {
        return res.status(404).json({ error: "No plans found for this area." });
      }

      // Score and sort plans based on priority
      const scoredPlans = allPlans.map(plan => {
        let score = 0;
        const premium = plan.calculatedMonthlyPremium || 0;
        const dental = plan.dentalCoverageLimit || 0;
        const otcPerYear = (plan.otcAmountPerQuarter || 0) * 4;
        const vision = plan.visionAllowance || 0;
        const drugDeductible = plan.drugDeductible || 0;
        const tier1 = plan.tier1CopayPreferred || 0;
        const transport = plan.transportationAmountPerYear || 0;
        const flexCard = plan.flexCardAmount || 0;
        const grocery = plan.groceryAllowanceAmount || 0;
        const starRating = plan.overallStarRating || 0;

        switch (priority) {
          case "low_cost":
            // Prefer $0 premium, then lowest premium; also bonus for low copays
            score = 10000 - (premium * 120); // annual premium weight
            if (premium === 0) score += 5000;
            score -= (plan.pcpCopayMin || 0) * 10;
            score -= (plan.specialistCopayMin || 0) * 5;
            if (plan.partbGiveback && plan.partbGiveback > 0) score += plan.partbGiveback * 12;
            break;

          case "best_dental":
            // Highest dental coverage limit
            score = dental * 2;
            score += (plan.dentalPreventiveCovered ? 500 : 0);
            score += (plan.dentalComprehensiveCovered ? 1000 : 0);
            score -= premium * 12; // subtract annual premium cost
            break;

          case "best_drugs":
            // Lowest drug costs
            score = 10000 - drugDeductible * 5;
            score -= tier1 * 100;
            score -= (plan.tier2CopayPreferred || 0) * 50;
            score -= (plan.tier3CopayPreferred || 0) * 20;
            if (medications === "many") {
              score -= (plan.tier4CoinsurancePreferred || 0) * 30;
            }
            score -= premium * 12;
            break;

          case "everything":
            // Composite: dental + otc + vision + transport + extras - premium
            score = dental + otcPerYear + vision + transport + flexCard + grocery;
            score += (plan.hasSilverSneakers || plan.hasFitnessBenefit ? 300 : 0);
            score += (plan.hasMealBenefit ? 200 : 0);
            score += (plan.hasTransportation ? 200 : 0);
            score += (plan.hasTelehealth ? 100 : 0);
            score -= premium * 12;
            score += starRating * 200;
            break;
        }

        // Specialist bonus/penalty
        if (seesSpecialist) {
          score -= (plan.specialistCopayMin || 0) * 20;
        }

        // Extras bonus
        if (wantsExtras) {
          score += otcPerYear + (plan.hasSilverSneakers ? 300 : 0) + (plan.hasFitnessBenefit ? 300 : 0);
          score += (plan.hasMealBenefit ? 200 : 0) + transport;
        }

        // Star rating bonus
        score += starRating * 100;

        return { plan, score };
      });

      // Sort by score descending, take top 3
      scoredPlans.sort((a, b) => b.score - a.score);
      const topPlans = scoredPlans.slice(0, 3);

      // Calculate "Money on Table" vs Original Medicare
      // Original Medicare: no dental, no vision, no OTC, no extras, 20% coinsurance after Part B deductible
      const bestPlan = topPlans[0]?.plan;
      let moneyOnTable = 0;

      if (bestPlan) {
        const dentalValue = bestPlan.dentalCoverageLimit || 0;
        const otcValue = (bestPlan.otcAmountPerQuarter || 0) * 4;
        const visionValue = bestPlan.visionAllowance || 0;
        const transportValue = bestPlan.transportationAmountPerYear || 0;
        const flexValue = bestPlan.flexCardAmount || 0;
        const groceryValue = bestPlan.groceryAllowanceAmount || 0;
        const fitnessValue = (bestPlan.hasSilverSneakers || bestPlan.hasFitnessBenefit) ? 500 : 0;
        const mealValue = bestPlan.hasMealBenefit ? (bestPlan.mealBenefitAmount || 0) : 0;
        const givebackValue = (bestPlan.partbGiveback || 0) * 12;

        moneyOnTable = dentalValue + otcValue + visionValue + transportValue +
                       flexValue + groceryValue + fitnessValue + mealValue + givebackValue;

        // Subtract annual premium cost
        moneyOnTable -= (bestPlan.calculatedMonthlyPremium || 0) * 12;

        // Floor at 0
        moneyOnTable = Math.max(0, Math.round(moneyOnTable));
      }

      // Format plan cards
      const planCards = topPlans.map((sp, idx) => {
        const p = sp.plan;
        const otcPerYear = (p.otcAmountPerQuarter || 0) * 4;
        const highlights: string[] = [];

        if ((p.calculatedMonthlyPremium || 0) === 0) highlights.push("$0 premium");
        if ((p.pcpCopayMin || 0) === 0) highlights.push("$0 PCP copay");
        if (p.hasOtc) highlights.push("OTC allowance");
        if (p.hasSilverSneakers || p.hasFitnessBenefit) highlights.push("Fitness benefit");
        if (p.hasTransportation) highlights.push("Transportation");
        if (p.hasMealBenefit) highlights.push("Meal benefit");
        if (p.hasTelehealth) highlights.push("Telehealth");
        if (p.partbGiveback && p.partbGiveback > 0) highlights.push("Part B giveback");
        if (p.dentalComprehensiveCovered) highlights.push("Comprehensive dental");

        // Calculate individual plan savings
        const planDental = p.dentalCoverageLimit || 0;
        const planOtc = otcPerYear;
        const planVision = p.visionAllowance || 0;
        const planExtras = (p.transportationAmountPerYear || 0) + (p.flexCardAmount || 0) +
                          (p.groceryAllowanceAmount || 0) + ((p.hasSilverSneakers || p.hasFitnessBenefit) ? 500 : 0);
        const planSavings = Math.max(0, Math.round(
          planDental + planOtc + planVision + planExtras - (p.calculatedMonthlyPremium || 0) * 12
        ));

        return {
          rank: idx + 1,
          id: p.id,
          name: p.name,
          carrier: p.organizationName,
          planType: p.planType,
          premium: p.calculatedMonthlyPremium || 0,
          dental: p.dentalCoverageLimit || 0,
          otcPerYear,
          vision: p.visionAllowance || 0,
          pcpCopay: p.pcpCopayMin || 0,
          specialistCopay: p.specialistCopayMin || 0,
          drugDeductible: p.drugDeductible || 0,
          starRating: p.overallStarRating || 0,
          highlights,
          savings: planSavings,
          hasTransportation: p.hasTransportation || false,
          hasFitness: p.hasSilverSneakers || p.hasFitnessBenefit || false,
          hasMeals: p.hasMealBenefit || false,
          hasTelehealth: p.hasTelehealth || false,
        };
      });

      // Log activity
      // (No lead ID yet — this is anonymous browsing)

      res.json({
        plans: planCards,
        moneyOnTable,
        county: resolvedCounty,
        state: resolvedState,
        totalPlansAnalyzed: allPlans.length,
      });
    } catch (err: any) {
      console.error("Consumer find-plans error:", err.message);
      res.status(500).json({ error: "Failed to find plans" });
    }
  });

  // ── POST /api/consumer/request-agent ──
  app.post("/api/consumer/request-agent", async (req: Request, res: Response) => {
    try {
      const parsed = requestAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const data = parsed.data;

      // Resolve state from ZIP using zip_county_map
      const zipResolution = await resolveZipToCounty(data.zipCode);
      let resolvedState: string | null = zipResolution?.state || null;
      let resolvedCounty: string | null = zipResolution?.county || null;

      // Legacy fallback if zip_county_map has no result
      if (!resolvedState) {
        const fallbackRows = await db
          .selectDistinct({ county: plans.county, state: plans.state })
          .from(plans)
          .where(eq(plans.zipcode, data.zipCode))
          .limit(1);
        resolvedState = fallbackRows[0]?.state || null;
        resolvedCounty = fallbackRows[0]?.county || null;
      }

      // Try to find an agent in the same state (round-robin by least leads)
      let assignedAgentId: number | null = null;
      if (resolvedState) {
        // Find agents, ordered by fewest assigned leads
        const agents = await db
          .select({
            id: users.id,
            leadCount: sql<number>`coalesce((
              select count(*) from consumer_leads
              where assigned_agent_id = ${users.id}
            ), 0)`.as("lead_count"),
          })
          .from(users)
          .where(
            and(
              eq(users.role, "agent"),
              eq(users.isActive, true)
            )
          )
          .orderBy(sql`lead_count`)
          .limit(1);

        if (agents.length > 0) {
          assignedAgentId = agents[0].id;
        }
      }

      // Create lead record
      const [lead] = await db
        .insert(consumerLeads)
        .values({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone,
          zipCode: data.zipCode,
          county: resolvedCounty,
          state: resolvedState,
          quizAnswers: data.quizAnswers,
          topPlanIds: data.topPlanIds,
          moneyOnTable: data.moneyOnTable,
          assignedAgentId,
          status: "new",
          source: "organic",
          utmSource: data.utmSource || null,
          utmMedium: data.utmMedium || null,
          utmCampaign: data.utmCampaign || null,
        })
        .returning();

      // Log activity
      await db.insert(leadActivity).values({
        leadId: lead.id,
        action: "requested_agent",
        details: { topPlanIds: data.topPlanIds, moneyOnTable: data.moneyOnTable },
      });

      res.status(201).json({
        leadId: lead.id,
        message: "A licensed agent will contact you within 24 hours",
      });
    } catch (err: any) {
      console.error("Consumer request-agent error:", err.message);
      res.status(500).json({ error: "Failed to submit request" });
    }
  });

  // ── GET /api/consumer/lead/:id ──
  app.get("/api/consumer/lead/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      if (isNaN(leadId)) {
        return res.status(400).json({ error: "Invalid lead ID" });
      }

      const [lead] = await db
        .select({
          id: consumerLeads.id,
          status: consumerLeads.status,
          createdAt: consumerLeads.createdAt,
          contactedAt: consumerLeads.contactedAt,
        })
        .from(consumerLeads)
        .where(eq(consumerLeads.id, leadId))
        .limit(1);

      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(lead);
    } catch (err: any) {
      console.error("Consumer lead status error:", err.message);
      res.status(500).json({ error: "Failed to fetch lead status" });
    }
  });
}
