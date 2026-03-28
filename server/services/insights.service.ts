import { db, pool } from "../db";
import { plans } from "@shared/schema";
import { sql, eq, count, avg, max, min, countDistinct, desc } from "drizzle-orm";

export interface Insight {
  icon: "target" | "alert" | "opportunity" | "trend" | "warning";
  text: string;
  priority: "high" | "medium" | "low";
}

// ── New dataset-powered insights (Medicare Spending, HPSA, MA Penetration) ──

async function getSpendingInsights(state: string, county?: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  try {
    if (county) {
      const res = await pool.query(
        `SELECT per_capita_total_spending, standardized_per_capita, ma_penetration_rate, total_beneficiaries, avg_risk_score, er_visits_per_1000, year
         FROM medicare_spending WHERE state = $1 AND county = $2 ORDER BY year DESC LIMIT 1`,
        [state, county]
      );
      if (res.rows.length > 0) {
        const r = res.rows[0];
        if (r.per_capita_total_spending && r.per_capita_total_spending > 12000) {
          insights.push({
            icon: "opportunity",
            text: `Medicare spends $${Math.round(r.per_capita_total_spending).toLocaleString()}/beneficiary in ${county} — MA plans save beneficiaries $3K+ annually vs Original Medicare here.`,
            priority: "high",
          });
        }
        if (r.er_visits_per_1000 && r.er_visits_per_1000 > 700) {
          insights.push({
            icon: "warning",
            text: `High ER utilization in ${county} (${Math.round(r.er_visits_per_1000)} visits/1,000 benes) — plans with urgent care and nurse hotlines reduce costs here.`,
            priority: "medium",
          });
        }
        if (r.avg_risk_score && r.avg_risk_score > 1.1) {
          insights.push({
            icon: "alert",
            text: `${county} has above-average risk scores (${r.avg_risk_score.toFixed(2)}) — chronic care management and care coordination plans are essential.`,
            priority: "medium",
          });
        }
      }
    } else {
      // State-level: find highest spending county
      const res = await pool.query(
        `SELECT county, per_capita_total_spending, total_beneficiaries
         FROM medicare_spending WHERE state = $1 AND per_capita_total_spending IS NOT NULL
         ORDER BY per_capita_total_spending DESC LIMIT 1`,
        [state]
      );
      if (res.rows.length > 0) {
        const r = res.rows[0];
        insights.push({
          icon: "opportunity",
          text: `${r.county} has the highest Medicare spending in ${state} at $${Math.round(r.per_capita_total_spending).toLocaleString()}/beneficiary — prime territory for MA enrollment.`,
          priority: "high",
        });
      }
    }
  } catch (err) {
    // Table may not exist yet — fail silently
  }
  return insights;
}

async function getHpsaInsights(state: string, county?: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  try {
    const whereClause = county
      ? `state = $1 AND county ILIKE '%' || $2 || '%' AND status = 'Designated'`
      : `state = $1 AND status = 'Designated'`;
    const params = county ? [state, county] : [state];

    const res = await pool.query(
      `SELECT designation_type, MAX(hpsa_score) as max_score, COUNT(*) as cnt
       FROM hpsa_shortage_areas WHERE ${whereClause}
       GROUP BY designation_type ORDER BY max_score DESC`,
      params
    );

    for (const r of res.rows) {
      if (r.max_score >= 15) {
        const area = county || state;
        const benefit = r.designation_type === 'Primary Care'
          ? 'telehealth and $0 PCP copay benefits are especially valuable'
          : r.designation_type === 'Mental Health'
          ? 'behavioral health and telehealth benefits are critical'
          : 'dental benefits with broad network access are essential';

        insights.push({
          icon: "alert",
          text: `${r.designation_type} shortage in ${area} (HPSA score ${r.max_score}/25) — ${benefit} here.`,
          priority: "high",
        });
      }
    }

    if (county && res.rows.length === 0) {
      // Check if there's NO shortage — that's also useful info
      const anyRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM hpsa_shortage_areas WHERE state = $1 AND county ILIKE '%' || $2 || '%'`,
        [state, county]
      );
      if (parseInt(anyRes.rows[0]?.cnt) === 0) {
        insights.push({
          icon: "trend",
          text: `${county} has no active provider shortage designations — beneficiaries here have good provider access.`,
          priority: "low",
        });
      }
    }
  } catch (err) {
    // Table may not exist yet
  }
  return insights;
}

async function getPenetrationInsights(state: string, county?: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  try {
    if (county) {
      const res = await pool.query(
        `SELECT ma_penetration_rate, ffs_addressable_pct, total_beneficiaries, ffs_beneficiaries, opportunity_score, spending_tier, penetration_tier, per_capita_spending
         FROM ma_penetration WHERE state = $1 AND county = $2 ORDER BY year DESC LIMIT 1`,
        [state, county]
      );
      if (res.rows.length > 0) {
        const r = res.rows[0];
        if (r.ma_penetration_rate !== null && r.ma_penetration_rate < 0.40) {
          const pct = Math.round(r.ma_penetration_rate * 100);
          const addressable = Math.round((1 - r.ma_penetration_rate) * 100);
          insights.push({
            icon: "opportunity",
            text: `Only ${pct}% MA penetration in ${county} — ${addressable}% of beneficiaries (${r.ffs_beneficiaries?.toLocaleString() || 'many'}) haven't switched yet. That's your addressable market.`,
            priority: "high",
          });
        } else if (r.ma_penetration_rate !== null && r.ma_penetration_rate > 0.60) {
          const pct = Math.round(r.ma_penetration_rate * 100);
          insights.push({
            icon: "warning",
            text: `${county} has ${pct}% MA penetration — highly saturated market. Focus on plan switching and retention over new enrollment.`,
            priority: "medium",
          });
        }
        if (r.opportunity_score !== null && r.opportunity_score > 80) {
          insights.push({
            icon: "target",
            text: `${county} is a top opportunity market (score: ${r.opportunity_score}/100) — ${r.spending_tier} spending with ${r.penetration_tier} penetration.`,
            priority: "high",
          });
        }
      }
    } else {
      // State level: find best opportunity counties
      const res = await pool.query(
        `SELECT county, ma_penetration_rate, ffs_beneficiaries, opportunity_score
         FROM ma_penetration WHERE state = $1 AND opportunity_score IS NOT NULL
         ORDER BY opportunity_score DESC LIMIT 3`,
        [state]
      );
      if (res.rows.length > 0) {
        const top = res.rows[0];
        const pct = Math.round((top.ma_penetration_rate || 0) * 100);
        insights.push({
          icon: "target",
          text: `Top opportunity in ${state}: ${top.county} (${pct}% MA penetration, ${top.ffs_beneficiaries?.toLocaleString() || '?'} addressable FFS beneficiaries, opportunity score ${top.opportunity_score}).`,
          priority: "high",
        });
      }
    }
  } catch (err) {
    // Table may not exist yet
  }
  return insights;
}

// Generate insights for a specific state
export async function getStateInsights(state: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  try {
    // Get county-level data for the state
    const counties = await db
      .select({
        county: plans.county,
        planCount: count().as("plan_count"),
        carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
        avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
        topCarrier: sql<string>`mode() within group (order by ${plans.organizationName})`.as("top_carrier"),
      })
      .from(plans)
      .where(eq(plans.state, state))
      .groupBy(plans.county);

    if (counties.length === 0) return insights;

    // Find county with most plans (most competitive)
    const mostCompetitive = counties.reduce((a, b) =>
      Number(a.planCount) > Number(b.planCount) ? a : b
    );
    insights.push({
      icon: "alert",
      text: `${mostCompetitive.county} is the most competitive market in ${state} with ${mostCompetitive.planCount} plans — focus on differentiation here.`,
      priority: "high",
    });

    // Find counties with few carriers (opportunity)
    const lowCarrier = counties
      .filter((c) => Number(c.carrierCount) <= 3 && Number(c.planCount) >= 2)
      .sort((a, b) => Number(a.carrierCount) - Number(b.carrierCount));
    if (lowCarrier.length > 0) {
      const county = lowCarrier[0];
      insights.push({
        icon: "opportunity",
        text: `Opportunity: ${county.county} has only ${county.carrierCount} carriers with ${county.planCount} plans — first-mover advantage for new entrants.`,
        priority: "high",
      });
    }

    // Find county with highest dental but low plan count
    const highDentalLowPlans = [...counties]
      .filter((c) => Number(c.avgDental) > 0)
      .sort((a, b) => Number(b.avgDental) - Number(a.avgDental));
    if (highDentalLowPlans.length > 0) {
      const county = highDentalLowPlans[0];
      insights.push({
        icon: "target",
        text: `Target ${county.county} — highest average dental coverage ($${Math.round(Number(county.avgDental)).toLocaleString()}) in ${state}. Lead with dental messaging.`,
        priority: "medium",
      });
    }

    // Find counties where OTC coverage is low
    const lowOtc = counties
      .filter((c) => {
        const otcPct = Number(c.planCount) > 0 ? (Number(c.otcCount) / Number(c.planCount)) * 100 : 0;
        return otcPct < 50 && Number(c.planCount) >= 3;
      })
      .sort((a, b) => Number(a.planCount) - Number(b.planCount));
    if (lowOtc.length > 0) {
      const pct = Math.round((Number(lowOtc[0].otcCount) / Number(lowOtc[0].planCount)) * 100);
      insights.push({
        icon: "trend",
        text: `${lowOtc[0].county} has low OTC coverage (${pct}% of plans) — lead with OTC benefits messaging to stand out.`,
        priority: "medium",
      });
    }

    // Dominant carrier warning
    const carrierDominance = counties.filter((c) => c.topCarrier);
    if (carrierDominance.length > 0) {
      const carrierCounts: Record<string, number> = {};
      carrierDominance.forEach((c) => {
        const carrier = c.topCarrier || "Unknown";
        carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1;
      });
      const dominant = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1])[0];
      if (dominant) {
        const pct = Math.round((dominant[1] / counties.length) * 100);
        insights.push({
          icon: "warning",
          text: `${dominant[0]} dominates ${pct}% of counties in ${state} — watch for competitive pressure and plan changes.`,
          priority: "low",
        });
      }
    }
    // Enrich with new dataset insights
    const [spendingInsights, hpsaInsights, penetrationInsights] = await Promise.all([
      getSpendingInsights(state),
      getHpsaInsights(state),
      getPenetrationInsights(state),
    ]);
    insights.push(...spendingInsights, ...hpsaInsights, ...penetrationInsights);

  } catch (err) {
    console.error("Error generating state insights:", err);
  }

  // Sort by priority, return top insights
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return insights.slice(0, 8);
}

// Generate national-level insights
export async function getNationalInsights(): Promise<Insight[]> {
  const insights: Insight[] = [];

  try {
    const stateStats = await db
      .select({
        state: plans.state,
        planCount: count().as("plan_count"),
        carrierCount: countDistinct(plans.organizationName).as("carrier_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        otcCount: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      })
      .from(plans)
      .groupBy(plans.state);

    if (stateStats.length === 0) return insights;

    // State with most plans
    const biggest = stateStats.reduce((a, b) =>
      Number(a.planCount) > Number(b.planCount) ? a : b
    );
    insights.push({
      icon: "alert",
      text: `${biggest.state} is the most competitive market with ${Number(biggest.planCount).toLocaleString()} plans — focus on differentiation over coverage breadth.`,
      priority: "high",
    });

    // State with highest dental but potentially low penetration
    const highDental = [...stateStats]
      .sort((a, b) => Number(b.avgDental) - Number(a.avgDental));
    if (highDental.length > 0 && Number(highDental[0].avgDental) > 0) {
      insights.push({
        icon: "target",
        text: `Target ${highDental[0].state} — highest average dental coverage ($${Math.round(Number(highDental[0].avgDental)).toLocaleString()}) with room to grow market share.`,
        priority: "high",
      });
    }

    // States with low OTC coverage
    const lowOtcStates = stateStats
      .filter((s) => {
        const pct = Number(s.planCount) > 0 ? (Number(s.otcCount) / Number(s.planCount)) * 100 : 0;
        return pct < 50 && Number(s.planCount) >= 10;
      })
      .sort((a, b) => {
        const aPct = Number(a.otcCount) / Number(a.planCount);
        const bPct = Number(b.otcCount) / Number(b.planCount);
        return aPct - bPct;
      });
    if (lowOtcStates.length > 0) {
      const pct = Math.round((Number(lowOtcStates[0].otcCount) / Number(lowOtcStates[0].planCount)) * 100);
      insights.push({
        icon: "opportunity",
        text: `${lowOtcStates[0].state} has only ${pct}% OTC coverage — lead with OTC messaging to capture underserved beneficiaries.`,
        priority: "medium",
      });
    }

    // States with fewest carriers
    const lowCarrier = [...stateStats]
      .filter((s) => Number(s.planCount) >= 5)
      .sort((a, b) => Number(a.carrierCount) - Number(b.carrierCount));
    if (lowCarrier.length > 0) {
      insights.push({
        icon: "opportunity",
        text: `Opportunity: ${lowCarrier[0].state} has only ${lowCarrier[0].carrierCount} carriers — less competition for new market entrants.`,
        priority: "medium",
      });
    }

    // Overall trend
    const totalPlans = stateStats.reduce((s, r) => s + Number(r.planCount), 0);
    insights.push({
      icon: "trend",
      text: `${totalPlans.toLocaleString()} total plans across ${stateStats.length} states — the market continues to expand with more choices for beneficiaries.`,
      priority: "low",
    });

    // National spending and penetration insights from new datasets
    try {
      const spendRes = await pool.query(
        `SELECT ROUND(AVG(per_capita_total_spending)::numeric, 0) as avg_spend,
                ROUND(AVG(ma_penetration_rate)::numeric, 4) as avg_pen,
                SUM(CASE WHEN ma_penetration_rate < 0.30 THEN 1 ELSE 0 END) as low_pen_counties,
                COUNT(*) as total_counties
         FROM medicare_spending WHERE year = (SELECT MAX(year) FROM medicare_spending) AND per_capita_total_spending IS NOT NULL`
      );
      if (spendRes.rows.length > 0) {
        const r = spendRes.rows[0];
        const avgPen = Math.round((r.avg_pen || 0) * 100);
        insights.push({
          icon: "opportunity",
          text: `National average MA penetration is ${avgPen}% — ${r.low_pen_counties} of ${r.total_counties} counties still below 30%. Average Medicare spending is $${Number(r.avg_spend).toLocaleString()}/beneficiary.`,
          priority: "high",
        });
      }

      const hpsaRes = await pool.query(
        `SELECT COUNT(DISTINCT state) as states_affected,
                COUNT(*) as total_areas,
                COUNT(*) FILTER (WHERE hpsa_score >= 15) as severe
         FROM hpsa_shortage_areas WHERE status = 'Designated' AND designation_type = 'Primary Care'`
      );
      if (hpsaRes.rows.length > 0 && parseInt(hpsaRes.rows[0].total_areas) > 0) {
        const r = hpsaRes.rows[0];
        insights.push({
          icon: "alert",
          text: `${r.total_areas.toLocaleString()} active primary care shortage areas across ${r.states_affected} states (${r.severe} severe) — telehealth and transportation benefits are high-value differentiators.`,
          priority: "high",
        });
      }
    } catch (err) {
      // New tables may not exist yet
    }

  } catch (err) {
    console.error("Error generating national insights:", err);
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return insights.slice(0, 8);
}

// Generate insights for a specific county
export async function getCountyInsights(county: string, state: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  try {
    const countyPlans = await db
      .select({
        carrier: plans.organizationName,
        planCount: count().as("plan_count"),
        avgDental: avg(plans.dentalCoverageLimit).as("avg_dental"),
        avgPremium: avg(plans.calculatedMonthlyPremium).as("avg_premium"),
        hasOtc: sql<number>`count(*) filter (where ${plans.hasOtc} = true)`.as("otc_count"),
      })
      .from(plans)
      .where(sql`${plans.county} = ${county} AND ${plans.state} = ${state}`)
      .groupBy(plans.organizationName);

    if (countyPlans.length === 0) return insights;

    const totalPlans = countyPlans.reduce((s, c) => s + Number(c.planCount), 0);

    // Most competitive carrier
    const dominant = countyPlans.reduce((a, b) =>
      Number(a.planCount) > Number(b.planCount) ? a : b
    );
    const dominantShare = Math.round((Number(dominant.planCount) / totalPlans) * 100);

    if (dominantShare > 40) {
      insights.push({
        icon: "warning",
        text: `${dominant.carrier} dominates ${county} at ${dominantShare}% market share — vulnerability for competitors to exploit with differentiated benefits.`,
        priority: "high",
      });
    } else {
      insights.push({
        icon: "alert",
        text: `Most competitive: ${county} has ${countyPlans.length} carriers and ${totalPlans} plans — no single carrier dominates.`,
        priority: "medium",
      });
    }

    // Carrier with highest dental
    const bestDental = countyPlans.reduce((a, b) =>
      Number(a.avgDental) > Number(b.avgDental) ? a : b
    );
    if (Number(bestDental.avgDental) > 0) {
      insights.push({
        icon: "target",
        text: `${bestDental.carrier} leads dental coverage in ${county} at $${Math.round(Number(bestDental.avgDental)).toLocaleString()} — match or beat this to win dental-focused beneficiaries.`,
        priority: "medium",
      });
    }

    // OTC gap
    const totalOtc = countyPlans.reduce((s, c) => s + Number(c.hasOtc), 0);
    const otcPct = Math.round((totalOtc / totalPlans) * 100);
    if (otcPct < 60) {
      insights.push({
        icon: "opportunity",
        text: `Only ${otcPct}% of plans in ${county} include OTC benefits — position OTC as a key differentiator.`,
        priority: "high",
      });
    }

    // Low premium opportunity
    const lowPremium = countyPlans.filter((c) => Number(c.avgPremium) === 0);
    if (lowPremium.length > 0) {
      insights.push({
        icon: "trend",
        text: `${lowPremium.length} carrier(s) offer $0 premium plans in ${county} — zero-premium plans are table stakes here.`,
        priority: "low",
      });
    }

    // Carrier count insight
    if (countyPlans.length <= 3) {
      insights.push({
        icon: "opportunity",
        text: `Only ${countyPlans.length} carriers serve ${county} — limited competition means first-mover advantage for aggressive benefit packages.`,
        priority: "high",
      });
    }

    // Enrich with new dataset insights
    const [spendingInsights, hpsaInsights, penetrationInsights] = await Promise.all([
      getSpendingInsights(state, county),
      getHpsaInsights(state, county),
      getPenetrationInsights(state, county),
    ]);
    insights.push(...spendingInsights, ...hpsaInsights, ...penetrationInsights);

  } catch (err) {
    console.error("Error generating county insights:", err);
  }

  // Sort by priority, return top insights
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return insights.slice(0, 8);
}
