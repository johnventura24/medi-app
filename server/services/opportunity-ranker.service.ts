import { pool } from "../db";

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

// ── Reasons generator ──

function generateReasons(r: OpportunityResult): string[] {
  const reasons: string[] = [];

  if (r.penetrationGapScore >= 15) {
    const ffsK = Math.round(r.ffsAddressable / 1000);
    reasons.push(`High FFS population -- ${ffsK}K beneficiaries not yet on MA`);
  }

  if (r.competitionScore >= 18) {
    reasons.push(`Only ${r.carrierCount} carriers competing in this market`);
  }

  if (r.benefitGapScore >= 18) {
    reasons.push("Below-average dental coverage -- opportunity to differentiate");
  }

  if (r.diabetesRate !== null && r.diabetesRate > 12) {
    reasons.push(
      `High diabetes rate (${r.diabetesRate.toFixed(1)}%) -- D-SNP and chronic care opportunity`
    );
  }

  if (r.zeroPremiumPlans > 0) {
    reasons.push(
      `${r.zeroPremiumPlans} zero-premium plans available for easy enrollment`
    );
  }

  if (r.uninsuredRate !== null && r.uninsuredRate > 10) {
    reasons.push(
      `High uninsured rate (${r.uninsuredRate.toFixed(1)}%) -- outreach opportunity`
    );
  }

  if (r.volumeScore >= 20) {
    const beneK = Math.round(r.totalBeneficiaries / 1000);
    reasons.push(`Large beneficiary pool -- ${beneK}K total Medicare beneficiaries`);
  }

  // Return top 3
  return reasons.slice(0, 3);
}

// ── Scoring helpers ──

function calcVolumeScore(totalBeneficiaries: number, isState: boolean): number {
  const divisor = isState ? 200000 : 50000;
  return Math.min(totalBeneficiaries / divisor, 1) * 25;
}

function calcPenetrationGapScore(maPenetration: number): number {
  return (1 - maPenetration) * 25;
}

function calcBenefitGapScore(
  avgDental: number | null,
  otcPct: number | null,
  natl: NationalAvgs
): number {
  let score = 0;
  let factors = 0;

  // Dental gap
  if (avgDental !== null) {
    const dentalRatio = natl.avgDental > 0 ? avgDental / natl.avgDental : 1;
    // Below avg = higher score
    score += Math.max(0, 1 - dentalRatio);
    factors++;
  }

  // OTC gap
  if (otcPct !== null) {
    const otcRatio = natl.avgOtcPct > 0 ? otcPct / natl.avgOtcPct : 1;
    score += Math.max(0, 1 - otcRatio);
    factors++;
  }

  if (factors === 0) return 12.5; // neutral if no data
  return (score / factors) * 25;
}

function calcCompetitionScore(carrierCount: number): number {
  return Math.max(0, (1 - carrierCount / 15)) * 25;
}

// ── State-level ranking ──

export async function getRankedStates(
  limit: number = 20
): Promise<OpportunityResult[]> {
  const natl = await getNationalAverages();

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
        ) AS otc_pct
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
        AVG(uninsured_rate) AS uninsured_rate,
        AVG(median_income) AS median_income
      FROM county_health_data
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
      h.diabetes_rate,
      h.uninsured_rate,
      h.median_income
    FROM plan_stats ps
    LEFT JOIN penetration_stats pen ON UPPER(pen.state) = UPPER(ps.state)
    LEFT JOIN health_stats h ON UPPER(h.state) = UPPER(ps.state)
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

      const volumeScore = calcVolumeScore(totalBeneficiaries, true);
      const penetrationGapScore = calcPenetrationGapScore(maPenetration);
      const benefitGapScore = calcBenefitGapScore(avgDental, otcPct, natl);
      const competitionScore = calcCompetitionScore(carrierCount);
      const opportunityScore = Math.round(
        volumeScore + penetrationGapScore + benefitGapScore + competitionScore
      );

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
      };

      result.reasons = generateReasons(result);
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
  limit: number = 50
): Promise<OpportunityResult[]> {
  const natl = await getNationalAverages();
  const stateFilter = state ? state.toUpperCase() : undefined;

  const stateConditionPlan = stateFilter ? `WHERE UPPER(p.state) = $1` : "";
  const stateConditionMa = stateFilter ? `WHERE UPPER(state) = $1` : "";
  const stateConditionHealth = stateFilter ? `WHERE UPPER(state) = $1` : "";
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
        ) AS otc_pct
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
        uninsured_rate,
        median_income
      FROM county_health_data
      ${stateConditionHealth}
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
      h.diabetes_rate,
      h.uninsured_rate,
      h.median_income
    FROM plan_stats ps
    LEFT JOIN penetration_stats pen
      ON UPPER(pen.state) = UPPER(ps.state)
      AND UPPER(pen.county) = UPPER(ps.county)
    LEFT JOIN health_stats h
      ON UPPER(h.state) = UPPER(ps.state)
      AND UPPER(h.county_name) = UPPER(ps.county)
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

      const volumeScore = calcVolumeScore(totalBeneficiaries, false);
      const penetrationGapScore = calcPenetrationGapScore(maPenetration);
      const benefitGapScore = calcBenefitGapScore(avgDental, otcPct, natl);
      const competitionScore = calcCompetitionScore(carrierCount);
      const opportunityScore = Math.round(
        volumeScore + penetrationGapScore + benefitGapScore + competitionScore
      );

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
      };

      result.reasons = generateReasons(result);
      return result;
    });

    results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return results.slice(0, limit);
  } catch (err: any) {
    console.error("Error in getRankedCounties:", err.message);
    return [];
  }
}
