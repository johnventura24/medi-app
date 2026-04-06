import { pool } from "../db";

export interface OpportunityFilters {
  enrollmentPeriod?: "aep" | "oep" | "sep" | "all";
  demographic?: "turning_65" | "dual_eligible" | "chronic" | "low_income" | "rural" | "all";
}

export interface OpportunityResult {
  // Geography
  state: string;
  county?: string;
  fips?: string;

  // Volume
  totalBeneficiaries: number;
  maPenetration: number;
  ffsAddressable: number;

  // Scores (0-100)
  opportunityScore: number;
  volumeScore: number;
  penetrationGapScore: number;
  benefitGapScore: number;
  competitionScore: number;

  // Plan landscape
  planCount: number;
  carrierCount: number;
  avgPremium: number | null;
  avgStarRating: number | null;
  zeroPremiumPlans: number;

  // Health demographics
  diabetesRate: number | null;
  uninsuredRate: number | null;
  medianIncome: number | null;

  // Top opportunity reasons
  reasons: string[];

  // Enrollment period extras
  switchableMembers?: number;
  fiveStarPlans?: number;
  dsnpPlans?: number;

  // Demographic extras
  population65Plus?: number | null;
  dualEligiblePct?: number | null;
  obesityRate?: number | null;
  erVisitsPer1000?: number | null;
  csnpPlans?: number;
}

// ── National averages (cached per request batch) ──

interface NationalAvgs {
  avgDental: number;
  avgOtcPct: number;
}

async function getNationalAverages(): Promise<NationalAvgs> {
  try {
    const res = await pool.query(`
      SELECT
        COALESCE(AVG(dental_coverage_limit) FILTER (WHERE dental_coverage_limit > 0), 0) AS avg_dental,
        COALESCE(
          COUNT(*) FILTER (WHERE has_otc = true)::float / NULLIF(COUNT(*), 0),
          0
        ) AS avg_otc_pct
      FROM plans
    `);
    const row = res.rows[0];
    return {
      avgDental: parseFloat(row.avg_dental) || 0,
      avgOtcPct: parseFloat(row.avg_otc_pct) || 0,
    };
  } catch {
    return { avgDental: 1000, avgOtcPct: 0.5 };
  }
}

// ── Scoring weights by enrollment period and demographic ──

interface ScoringWeights {
  volume: number;
  penetrationGap: number;
  benefitGap: number;
  competition: number;
}

function getWeights(filters: OpportunityFilters): ScoringWeights {
  const period = filters.enrollmentPeriod || "all";
  const demo = filters.demographic || "all";

  // Base weights (AEP / all)
  let weights: ScoringWeights = { volume: 25, penetrationGap: 25, benefitGap: 25, competition: 25 };

  // Enrollment period adjustments
  if (period === "oep") {
    // OEP: current MA members switching. High penetration = more switchable members
    weights = { volume: 30, penetrationGap: 5, benefitGap: 20, competition: 20 };
    // penetrationGap is inverted for OEP (high penetration = good), handled in scoring
  } else if (period === "sep") {
    // SEP: special populations — dual-eligible, 5-star SEP
    weights = { volume: 20, penetrationGap: 10, benefitGap: 15, competition: 15 };
    // remaining 40 pts come from SEP-specific bonuses added in scoring
  }

  // Demographic adjustments (additive shifts on top of period weights)
  if (demo === "turning_65") {
    weights.volume += 5;
    weights.penetrationGap += 5;
    weights.benefitGap -= 5;
    weights.competition -= 5;
  } else if (demo === "dual_eligible") {
    weights.penetrationGap -= 5;
    weights.benefitGap -= 5;
    weights.volume += 5;
    weights.competition += 5;
  } else if (demo === "chronic") {
    weights.benefitGap += 5;
    weights.competition += 5;
    weights.volume -= 5;
    weights.penetrationGap -= 5;
  } else if (demo === "low_income") {
    weights.penetrationGap += 5;
    weights.benefitGap += 5;
    weights.volume -= 5;
    weights.competition -= 5;
  } else if (demo === "rural") {
    weights.competition += 10;
    weights.volume -= 5;
    weights.benefitGap -= 5;
  }

  return weights;
}

// ── Reasons generator ──

function generateReasons(r: OpportunityResult, filters: OpportunityFilters): string[] {
  const reasons: string[] = [];
  const period = filters.enrollmentPeriod || "all";
  const demo = filters.demographic || "all";

  // Period-specific reasons
  if (period === "oep" && r.switchableMembers) {
    const switchK = Math.round(r.switchableMembers / 1000);
    if (switchK > 0) {
      reasons.push(`${switchK}K current MA members eligible to switch during OEP`);
    }
    if (r.avgStarRating !== null && r.avgStarRating < 3.5) {
      reasons.push(`Low avg star rating (${r.avgStarRating.toFixed(1)}) -- dissatisfied members likely to switch`);
    }
  }

  if (period === "sep") {
    if (r.fiveStarPlans && r.fiveStarPlans > 0) {
      reasons.push(`${r.fiveStarPlans} five-star plans available -- 5-star SEP year-round enrollment`);
    }
    if (r.dsnpPlans && r.dsnpPlans > 0) {
      reasons.push(`${r.dsnpPlans} D-SNP plans -- dual-eligible can switch monthly`);
    }
    if (r.dualEligiblePct != null && r.dualEligiblePct > 20) {
      reasons.push(`${r.dualEligiblePct.toFixed(0)}% dual-eligible population -- strong D-SNP market`);
    }
  }

  // Demographic-specific reasons
  if (demo === "turning_65" && r.population65Plus != null && r.population65Plus > 15) {
    reasons.push(`${r.population65Plus.toFixed(1)}% population 65+ -- large aging-in cohort`);
  }

  if (demo === "dual_eligible") {
    if (r.dualEligiblePct != null && r.dualEligiblePct > 20) {
      reasons.push(`${r.dualEligiblePct.toFixed(0)}% dual-eligible population -- strong D-SNP market`);
    }
    if (r.dsnpPlans && r.dsnpPlans > 0) {
      reasons.push(`${r.dsnpPlans} D-SNP plans available for dual-eligible enrollment`);
    }
  }

  if (demo === "chronic") {
    if (r.diabetesRate !== null && r.diabetesRate > 12) {
      reasons.push(`High diabetes rate (${r.diabetesRate.toFixed(1)}%) -- C-SNP and chronic care opportunity`);
    }
    if (r.obesityRate != null && r.obesityRate > 35) {
      reasons.push(`High obesity rate (${r.obesityRate.toFixed(1)}%) -- chronic condition management need`);
    }
    if (r.erVisitsPer1000 != null && r.erVisitsPer1000 > 600) {
      reasons.push(`High ER utilization (${Math.round(r.erVisitsPer1000)}/1,000) -- care management opportunity`);
    }
    if (r.csnpPlans && r.csnpPlans > 0) {
      reasons.push(`${r.csnpPlans} C-SNP plans targeting chronic conditions`);
    }
  }

  if (demo === "low_income") {
    if (r.medianIncome !== null && r.medianIncome < 45000) {
      reasons.push(`Low median income ($${r.medianIncome.toLocaleString()}) -- cost-sensitive beneficiaries`);
    }
    if (r.zeroPremiumPlans > 0) {
      reasons.push(`${r.zeroPremiumPlans} zero-premium plans available for low-income enrollment`);
    }
    if (r.uninsuredRate !== null && r.uninsuredRate > 10) {
      reasons.push(`High uninsured rate (${r.uninsuredRate.toFixed(1)}%) -- outreach opportunity`);
    }
  }

  if (demo === "rural") {
    if (r.carrierCount <= 5) {
      reasons.push(`Only ${r.carrierCount} carriers -- underserved rural market`);
    }
    if (r.planCount < 15) {
      reasons.push(`Only ${r.planCount} plans -- limited choice, room for new options`);
    }
  }

  // Generic reasons (fill up to 3 if period/demo-specific didn't provide enough)
  if (r.penetrationGapScore >= 15 && period !== "oep") {
    const ffsK = Math.round(r.ffsAddressable / 1000);
    reasons.push(`High FFS population -- ${ffsK}K beneficiaries not yet on MA`);
  }

  if (r.competitionScore >= 18 && demo !== "rural") {
    reasons.push(`Only ${r.carrierCount} carriers competing in this market`);
  }

  if (r.benefitGapScore >= 18) {
    reasons.push("Below-average dental coverage -- opportunity to differentiate");
  }

  if (r.diabetesRate !== null && r.diabetesRate > 12 && demo !== "chronic") {
    reasons.push(
      `High diabetes rate (${r.diabetesRate.toFixed(1)}%) -- D-SNP and chronic care opportunity`
    );
  }

  if (r.zeroPremiumPlans > 0 && demo !== "low_income") {
    reasons.push(
      `${r.zeroPremiumPlans} zero-premium plans available for easy enrollment`
    );
  }

  if (r.uninsuredRate !== null && r.uninsuredRate > 10 && demo !== "low_income") {
    reasons.push(
      `High uninsured rate (${r.uninsuredRate.toFixed(1)}%) -- outreach opportunity`
    );
  }

  if (r.volumeScore >= 20) {
    const beneK = Math.round(r.totalBeneficiaries / 1000);
    reasons.push(`Large beneficiary pool -- ${beneK}K total Medicare beneficiaries`);
  }

  // Deduplicate and return top 3
  const unique = [...new Set(reasons)];
  return unique.slice(0, 3);
}

// ── Scoring helpers ──

function calcVolumeScore(totalBeneficiaries: number, isState: boolean, maxWeight: number): number {
  const divisor = isState ? 200000 : 50000;
  return Math.min(totalBeneficiaries / divisor, 1) * maxWeight;
}

function calcPenetrationGapScore(maPenetration: number, maxWeight: number, invertForOep: boolean): number {
  if (invertForOep) {
    // For OEP: high penetration = more switchable members = higher score
    return maPenetration * maxWeight;
  }
  return (1 - maPenetration) * maxWeight;
}

function calcBenefitGapScore(
  avgDental: number | null,
  otcPct: number | null,
  natl: NationalAvgs,
  maxWeight: number
): number {
  let score = 0;
  let factors = 0;

  if (avgDental !== null) {
    const dentalRatio = natl.avgDental > 0 ? avgDental / natl.avgDental : 1;
    score += Math.max(0, 1 - dentalRatio);
    factors++;
  }

  if (otcPct !== null) {
    const otcRatio = natl.avgOtcPct > 0 ? otcPct / natl.avgOtcPct : 1;
    score += Math.max(0, 1 - otcRatio);
    factors++;
  }

  if (factors === 0) return maxWeight / 2;
  return (score / factors) * maxWeight;
}

function calcCompetitionScore(carrierCount: number, maxWeight: number): number {
  return Math.max(0, (1 - carrierCount / 15)) * maxWeight;
}

// ── SEP bonus scoring (up to 40 pts when SEP selected) ──

function calcSepBonus(
  dualEligiblePct: number | null,
  fiveStarPlans: number,
  dsnpPlans: number,
  totalBeneficiaries: number
): number {
  let bonus = 0;

  // Dual eligible pct (up to 12 pts)
  if (dualEligiblePct !== null) {
    bonus += Math.min(dualEligiblePct / 40, 1) * 12;
  }

  // 5-star plans (up to 10 pts)
  bonus += Math.min(fiveStarPlans / 5, 1) * 10;

  // D-SNP plans (up to 10 pts)
  bonus += Math.min(dsnpPlans / 10, 1) * 10;

  // Volume (up to 8 pts)
  bonus += Math.min(totalBeneficiaries / 100000, 1) * 8;

  return bonus;
}

// ── Demographic bonus scoring (up to 15 pts) ──

function calcDemographicBonus(
  demo: string,
  data: {
    population65Plus: number | null;
    dualEligiblePct: number | null;
    diabetesRate: number | null;
    obesityRate: number | null;
    erVisitsPer1000: number | null;
    medianIncome: number | null;
    uninsuredRate: number | null;
    zeroPremiumPlans: number;
    carrierCount: number;
    planCount: number;
    dsnpPlans: number;
    csnpPlans: number;
  }
): number {
  if (demo === "all") return 0;

  let bonus = 0;

  if (demo === "turning_65") {
    if (data.population65Plus !== null) {
      bonus += Math.min(data.population65Plus / 25, 1) * 10;
    }
    // Low penetration bonus handled by main scoring
    bonus += Math.min(5, 5); // baseline for age-in focus
  }

  if (demo === "dual_eligible") {
    if (data.dualEligiblePct !== null) {
      bonus += Math.min(data.dualEligiblePct / 35, 1) * 8;
    }
    bonus += Math.min(data.dsnpPlans / 8, 1) * 7;
  }

  if (demo === "chronic") {
    if (data.diabetesRate !== null) {
      bonus += Math.min(data.diabetesRate / 15, 1) * 5;
    }
    if (data.obesityRate !== null) {
      bonus += Math.min(data.obesityRate / 40, 1) * 5;
    }
    if (data.erVisitsPer1000 !== null) {
      bonus += Math.min(data.erVisitsPer1000 / 800, 1) * 5;
    }
  }

  if (demo === "low_income") {
    if (data.medianIncome !== null && data.medianIncome > 0) {
      // Lower income = higher bonus
      bonus += Math.max(0, 1 - data.medianIncome / 70000) * 7;
    }
    if (data.uninsuredRate !== null) {
      bonus += Math.min(data.uninsuredRate / 15, 1) * 5;
    }
    bonus += Math.min(data.zeroPremiumPlans / 20, 1) * 3;
  }

  if (demo === "rural") {
    // Fewer carriers/plans = more underserved
    bonus += Math.max(0, 1 - data.carrierCount / 10) * 8;
    bonus += Math.max(0, 1 - data.planCount / 30) * 7;
  }

  return Math.min(bonus, 15);
}

// ── OEP star-rating penalty bonus (up to 25 pts for low stars) ──

function calcOepStarPenalty(avgStarRating: number | null): number {
  if (avgStarRating === null) return 12.5;
  // Lower stars = higher score (more dissatisfied members)
  return Math.max(0, (5 - avgStarRating) / 4) * 25;
}

// ── State-level ranking ──

export async function getRankedStates(
  limit: number = 20,
  filters: OpportunityFilters = {}
): Promise<OpportunityResult[]> {
  const natl = await getNationalAverages();
  const weights = getWeights(filters);
  const period = filters.enrollmentPeriod || "all";
  const demo = filters.demographic || "all";

  const query = `
    WITH plan_stats AS (
      SELECT
        p.state,
        COUNT(*) AS plan_count,
        COUNT(DISTINCT p.organization_name) AS carrier_count,
        AVG(p.calculated_monthly_premium) AS avg_premium,
        AVG(p.overall_star_rating) FILTER (WHERE p.overall_star_rating IS NOT NULL AND p.overall_star_rating > 0) AS avg_star,
        COUNT(*) FILTER (WHERE p.calculated_monthly_premium = 0 OR p.calculated_monthly_premium IS NULL) AS zero_premium_plans,
        COALESCE(AVG(p.dental_coverage_limit) FILTER (WHERE p.dental_coverage_limit > 0), 0) AS avg_dental,
        COALESCE(
          COUNT(*) FILTER (WHERE p.has_otc = true)::float / NULLIF(COUNT(*), 0),
          0
        ) AS otc_pct,
        COUNT(*) FILTER (WHERE p.overall_star_rating >= 5) AS five_star_plans,
        COUNT(*) FILTER (WHERE p.snp_type = 'D-SNP') AS dsnp_plans,
        COUNT(*) FILTER (WHERE p.snp_type = 'C-SNP') AS csnp_plans
      FROM plans p
      GROUP BY p.state
    ),
    penetration_stats AS (
      SELECT
        state,
        SUM(total_beneficiaries) AS total_beneficiaries,
        SUM(ffs_beneficiaries) AS ffs_beneficiaries,
        CASE WHEN SUM(total_beneficiaries) > 0
          THEN 1.0 - (SUM(ffs_beneficiaries)::float / SUM(total_beneficiaries)::float)
          ELSE 0
        END AS ma_penetration
      FROM ma_penetration
      GROUP BY state
    ),
    health_stats AS (
      SELECT
        state,
        AVG(diabetes_rate) AS diabetes_rate,
        AVG(obesity_rate) AS obesity_rate,
        AVG(uninsured_rate) AS uninsured_rate,
        AVG(median_income) AS median_income,
        AVG(population_65_plus) AS population_65_plus
      FROM county_health_data
      GROUP BY state
    ),
    spending_stats AS (
      SELECT
        state,
        AVG(dual_eligible_pct) AS dual_eligible_pct,
        AVG(er_visits_per_1000) AS er_visits_per_1000
      FROM medicare_spending
      WHERE dual_eligible_pct IS NOT NULL
      GROUP BY state
    )
    SELECT
      ps.state,
      COALESCE(pen.total_beneficiaries, 0) AS total_beneficiaries,
      COALESCE(pen.ffs_beneficiaries, 0) AS ffs_beneficiaries,
      COALESCE(pen.ma_penetration, 0) AS ma_penetration,
      ps.plan_count,
      ps.carrier_count,
      ps.avg_premium,
      ps.avg_star,
      ps.zero_premium_plans,
      ps.avg_dental,
      ps.otc_pct,
      ps.five_star_plans,
      ps.dsnp_plans,
      ps.csnp_plans,
      h.diabetes_rate,
      h.obesity_rate,
      h.uninsured_rate,
      h.median_income,
      h.population_65_plus,
      sp.dual_eligible_pct,
      sp.er_visits_per_1000
    FROM plan_stats ps
    LEFT JOIN penetration_stats pen ON UPPER(pen.state) = UPPER(ps.state)
    LEFT JOIN health_stats h ON UPPER(h.state) = UPPER(ps.state)
    LEFT JOIN spending_stats sp ON UPPER(sp.state) = UPPER(ps.state)
    ORDER BY ps.state
  `;

  try {
    const res = await pool.query(query);
    const results: OpportunityResult[] = res.rows.map((r: any) => {
      const totalBeneficiaries = parseInt(r.total_beneficiaries) || 0;
      const ffsBeneficiaries = parseInt(r.ffs_beneficiaries) || 0;
      const maPenetration = parseFloat(r.ma_penetration) || 0;
      const carrierCount = parseInt(r.carrier_count) || 0;
      const avgDental = parseFloat(r.avg_dental) || 0;
      const otcPct = parseFloat(r.otc_pct) || 0;
      const fiveStarPlans = parseInt(r.five_star_plans) || 0;
      const dsnpPlans = parseInt(r.dsnp_plans) || 0;
      const csnpPlans = parseInt(r.csnp_plans) || 0;
      const dualEligiblePct = r.dual_eligible_pct !== null ? parseFloat(r.dual_eligible_pct) : null;
      const erVisitsPer1000 = r.er_visits_per_1000 !== null ? parseFloat(r.er_visits_per_1000) : null;
      const population65Plus = r.population_65_plus !== null ? parseFloat(r.population_65_plus) : null;
      const obesityRate = r.obesity_rate !== null ? parseFloat(r.obesity_rate) : null;

      const invertPenGap = period === "oep";
      const volumeScore = calcVolumeScore(totalBeneficiaries, true, weights.volume);
      const penetrationGapScore = calcPenetrationGapScore(maPenetration, weights.penetrationGap, invertPenGap);
      const benefitGapScore = calcBenefitGapScore(avgDental, otcPct, natl, weights.benefitGap);
      const competitionScore = calcCompetitionScore(carrierCount, weights.competition);

      let baseScore = volumeScore + penetrationGapScore + benefitGapScore + competitionScore;

      // OEP: add star-rating dissatisfaction bonus
      if (period === "oep") {
        baseScore += calcOepStarPenalty(r.avg_star !== null ? parseFloat(r.avg_star) : null);
      }

      // SEP: add special population bonus
      if (period === "sep") {
        baseScore += calcSepBonus(dualEligiblePct, fiveStarPlans, dsnpPlans, totalBeneficiaries);
      }

      // Demographic bonus
      const demoBonus = calcDemographicBonus(demo, {
        population65Plus,
        dualEligiblePct,
        diabetesRate: r.diabetes_rate !== null ? parseFloat(r.diabetes_rate) : null,
        obesityRate,
        erVisitsPer1000,
        medianIncome: r.median_income !== null ? parseFloat(r.median_income) : null,
        uninsuredRate: r.uninsured_rate !== null ? parseFloat(r.uninsured_rate) : null,
        zeroPremiumPlans: parseInt(r.zero_premium_plans) || 0,
        carrierCount,
        planCount: parseInt(r.plan_count) || 0,
        dsnpPlans,
        csnpPlans,
      });
      baseScore += demoBonus;

      const opportunityScore = Math.min(100, Math.round(baseScore));
      const switchableMembers = Math.round(totalBeneficiaries * maPenetration);

      const result: OpportunityResult = {
        state: r.state,
        totalBeneficiaries,
        maPenetration: Math.round(maPenetration * 1000) / 1000,
        ffsAddressable: ffsBeneficiaries,
        opportunityScore,
        volumeScore: Math.round(volumeScore * 10) / 10,
        penetrationGapScore: Math.round(penetrationGapScore * 10) / 10,
        benefitGapScore: Math.round(benefitGapScore * 10) / 10,
        competitionScore: Math.round(competitionScore * 10) / 10,
        planCount: parseInt(r.plan_count) || 0,
        carrierCount,
        avgPremium: r.avg_premium !== null ? Math.round(parseFloat(r.avg_premium) * 100) / 100 : null,
        avgStarRating: r.avg_star !== null ? Math.round(parseFloat(r.avg_star) * 100) / 100 : null,
        zeroPremiumPlans: parseInt(r.zero_premium_plans) || 0,
        diabetesRate: r.diabetes_rate !== null ? Math.round(parseFloat(r.diabetes_rate) * 10) / 10 : null,
        uninsuredRate: r.uninsured_rate !== null ? Math.round(parseFloat(r.uninsured_rate) * 10) / 10 : null,
        medianIncome: r.median_income !== null ? Math.round(parseFloat(r.median_income)) : null,
        reasons: [],
        // Extras
        switchableMembers: period === "oep" ? switchableMembers : undefined,
        fiveStarPlans: (period === "sep" || period === "all") ? fiveStarPlans : undefined,
        dsnpPlans: (period === "sep" || demo === "dual_eligible") ? dsnpPlans : undefined,
        population65Plus: demo === "turning_65" ? (population65Plus !== null ? Math.round(population65Plus * 10) / 10 : null) : undefined,
        dualEligiblePct: (demo === "dual_eligible" || period === "sep") ? (dualEligiblePct !== null ? Math.round(dualEligiblePct * 10) / 10 : null) : undefined,
        obesityRate: demo === "chronic" ? (obesityRate !== null ? Math.round(obesityRate * 10) / 10 : null) : undefined,
        erVisitsPer1000: demo === "chronic" ? (erVisitsPer1000 !== null ? Math.round(erVisitsPer1000) : null) : undefined,
        csnpPlans: demo === "chronic" ? csnpPlans : undefined,
      };

      result.reasons = generateReasons(result, filters);
      return result;
    });

    // Sort by opportunity score descending
    results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return results.slice(0, limit);
  } catch (err: any) {
    console.error("Error in getRankedStates:", err.message);
    return [];
  }
}

// ── County-level ranking ──

export async function getRankedCounties(
  state?: string,
  limit: number = 50,
  filters: OpportunityFilters = {}
): Promise<OpportunityResult[]> {
  const natl = await getNationalAverages();
  const weights = getWeights(filters);
  const period = filters.enrollmentPeriod || "all";
  const demo = filters.demographic || "all";
  const stateFilter = state ? state.toUpperCase() : undefined;

  const stateConditionPlan = stateFilter ? `WHERE UPPER(p.state) = $1` : "";
  const stateConditionMa = stateFilter ? `WHERE UPPER(state) = $1` : "";
  const stateConditionHealth = stateFilter ? `WHERE UPPER(state) = $1` : "";
  const stateConditionSpending = stateFilter ? `WHERE UPPER(state) = $1 AND dual_eligible_pct IS NOT NULL` : `WHERE dual_eligible_pct IS NOT NULL`;
  const params = stateFilter ? [stateFilter] : [];

  const query = `
    WITH plan_stats AS (
      SELECT
        p.state,
        p.county,
        p.fips,
        COUNT(*) AS plan_count,
        COUNT(DISTINCT p.organization_name) AS carrier_count,
        AVG(p.calculated_monthly_premium) AS avg_premium,
        AVG(p.overall_star_rating) FILTER (WHERE p.overall_star_rating IS NOT NULL AND p.overall_star_rating > 0) AS avg_star,
        COUNT(*) FILTER (WHERE p.calculated_monthly_premium = 0 OR p.calculated_monthly_premium IS NULL) AS zero_premium_plans,
        COALESCE(AVG(p.dental_coverage_limit) FILTER (WHERE p.dental_coverage_limit > 0), 0) AS avg_dental,
        COALESCE(
          COUNT(*) FILTER (WHERE p.has_otc = true)::float / NULLIF(COUNT(*), 0),
          0
        ) AS otc_pct,
        COUNT(*) FILTER (WHERE p.overall_star_rating >= 5) AS five_star_plans,
        COUNT(*) FILTER (WHERE p.snp_type = 'D-SNP') AS dsnp_plans,
        COUNT(*) FILTER (WHERE p.snp_type = 'C-SNP') AS csnp_plans
      FROM plans p
      ${stateConditionPlan}
      GROUP BY p.state, p.county, p.fips
    ),
    penetration_stats AS (
      SELECT
        state,
        county,
        total_beneficiaries,
        ffs_beneficiaries,
        ma_penetration_rate
      FROM ma_penetration
      ${stateConditionMa}
    ),
    health_stats AS (
      SELECT
        state,
        county_name,
        diabetes_rate,
        obesity_rate,
        uninsured_rate,
        median_income,
        population_65_plus
      FROM county_health_data
      ${stateConditionHealth}
    ),
    spending_stats AS (
      SELECT
        state,
        county,
        dual_eligible_pct,
        er_visits_per_1000
      FROM medicare_spending
      ${stateConditionSpending}
    )
    SELECT
      ps.state,
      ps.county,
      ps.fips,
      COALESCE(pen.total_beneficiaries, 0) AS total_beneficiaries,
      COALESCE(pen.ffs_beneficiaries, 0) AS ffs_beneficiaries,
      COALESCE(pen.ma_penetration_rate, 0) AS ma_penetration,
      ps.plan_count,
      ps.carrier_count,
      ps.avg_premium,
      ps.avg_star,
      ps.zero_premium_plans,
      ps.avg_dental,
      ps.otc_pct,
      ps.five_star_plans,
      ps.dsnp_plans,
      ps.csnp_plans,
      h.diabetes_rate,
      h.obesity_rate,
      h.uninsured_rate,
      h.median_income,
      h.population_65_plus,
      sp.dual_eligible_pct,
      sp.er_visits_per_1000
    FROM plan_stats ps
    LEFT JOIN penetration_stats pen
      ON UPPER(pen.state) = UPPER(ps.state)
      AND UPPER(pen.county) = UPPER(ps.county)
    LEFT JOIN health_stats h
      ON UPPER(h.state) = UPPER(ps.state)
      AND UPPER(h.county_name) = UPPER(ps.county)
    LEFT JOIN spending_stats sp
      ON UPPER(sp.state) = UPPER(ps.state)
      AND UPPER(sp.county) = UPPER(ps.county)
    ORDER BY ps.state, ps.county
  `;

  try {
    const res = await pool.query(query, params);
    const results: OpportunityResult[] = res.rows.map((r: any) => {
      const totalBeneficiaries = parseInt(r.total_beneficiaries) || 0;
      const ffsBeneficiaries = parseInt(r.ffs_beneficiaries) || 0;
      const maPenetration = parseFloat(r.ma_penetration) || 0;
      const carrierCount = parseInt(r.carrier_count) || 0;
      const avgDental = parseFloat(r.avg_dental) || 0;
      const otcPct = parseFloat(r.otc_pct) || 0;
      const fiveStarPlans = parseInt(r.five_star_plans) || 0;
      const dsnpPlans = parseInt(r.dsnp_plans) || 0;
      const csnpPlans = parseInt(r.csnp_plans) || 0;
      const dualEligiblePct = r.dual_eligible_pct !== null ? parseFloat(r.dual_eligible_pct) : null;
      const erVisitsPer1000 = r.er_visits_per_1000 !== null ? parseFloat(r.er_visits_per_1000) : null;
      const population65Plus = r.population_65_plus !== null ? parseFloat(r.population_65_plus) : null;
      const obesityRate = r.obesity_rate !== null ? parseFloat(r.obesity_rate) : null;

      const invertPenGap = period === "oep";
      const volumeScore = calcVolumeScore(totalBeneficiaries, false, weights.volume);
      const penetrationGapScore = calcPenetrationGapScore(maPenetration, weights.penetrationGap, invertPenGap);
      const benefitGapScore = calcBenefitGapScore(avgDental, otcPct, natl, weights.benefitGap);
      const competitionScore = calcCompetitionScore(carrierCount, weights.competition);

      let baseScore = volumeScore + penetrationGapScore + benefitGapScore + competitionScore;

      if (period === "oep") {
        baseScore += calcOepStarPenalty(r.avg_star !== null ? parseFloat(r.avg_star) : null);
      }

      if (period === "sep") {
        baseScore += calcSepBonus(dualEligiblePct, fiveStarPlans, dsnpPlans, totalBeneficiaries);
      }

      const demoBonus = calcDemographicBonus(demo, {
        population65Plus,
        dualEligiblePct,
        diabetesRate: r.diabetes_rate !== null ? parseFloat(r.diabetes_rate) : null,
        obesityRate,
        erVisitsPer1000,
        medianIncome: r.median_income !== null ? parseFloat(r.median_income) : null,
        uninsuredRate: r.uninsured_rate !== null ? parseFloat(r.uninsured_rate) : null,
        zeroPremiumPlans: parseInt(r.zero_premium_plans) || 0,
        carrierCount,
        planCount: parseInt(r.plan_count) || 0,
        dsnpPlans,
        csnpPlans,
      });
      baseScore += demoBonus;

      const opportunityScore = Math.min(100, Math.round(baseScore));
      const switchableMembers = Math.round(totalBeneficiaries * maPenetration);

      const result: OpportunityResult = {
        state: r.state,
        county: r.county,
        fips: r.fips || undefined,
        totalBeneficiaries,
        maPenetration: Math.round(maPenetration * 1000) / 1000,
        ffsAddressable: ffsBeneficiaries,
        opportunityScore,
        volumeScore: Math.round(volumeScore * 10) / 10,
        penetrationGapScore: Math.round(penetrationGapScore * 10) / 10,
        benefitGapScore: Math.round(benefitGapScore * 10) / 10,
        competitionScore: Math.round(competitionScore * 10) / 10,
        planCount: parseInt(r.plan_count) || 0,
        carrierCount,
        avgPremium: r.avg_premium !== null ? Math.round(parseFloat(r.avg_premium) * 100) / 100 : null,
        avgStarRating: r.avg_star !== null ? Math.round(parseFloat(r.avg_star) * 100) / 100 : null,
        zeroPremiumPlans: parseInt(r.zero_premium_plans) || 0,
        diabetesRate: r.diabetes_rate !== null ? Math.round(parseFloat(r.diabetes_rate) * 10) / 10 : null,
        uninsuredRate: r.uninsured_rate !== null ? Math.round(parseFloat(r.uninsured_rate) * 10) / 10 : null,
        medianIncome: r.median_income !== null ? Math.round(parseFloat(r.median_income)) : null,
        reasons: [],
        switchableMembers: period === "oep" ? switchableMembers : undefined,
        fiveStarPlans: (period === "sep" || period === "all") ? fiveStarPlans : undefined,
        dsnpPlans: (period === "sep" || demo === "dual_eligible") ? dsnpPlans : undefined,
        population65Plus: demo === "turning_65" ? (population65Plus !== null ? Math.round(population65Plus * 10) / 10 : null) : undefined,
        dualEligiblePct: (demo === "dual_eligible" || period === "sep") ? (dualEligiblePct !== null ? Math.round(dualEligiblePct * 10) / 10 : null) : undefined,
        obesityRate: demo === "chronic" ? (obesityRate !== null ? Math.round(obesityRate * 10) / 10 : null) : undefined,
        erVisitsPer1000: demo === "chronic" ? (erVisitsPer1000 !== null ? Math.round(erVisitsPer1000) : null) : undefined,
        csnpPlans: demo === "chronic" ? csnpPlans : undefined,
      };

      result.reasons = generateReasons(result, filters);
      return result;
    });

    results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return results.slice(0, limit);
  } catch (err: any) {
    console.error("Error in getRankedCounties:", err.message);
    return [];
  }
}
