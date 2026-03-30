/**
 * Regulatory Alert Service — Pre-populated key CMS regulatory dates and changes
 * that affect Medicare Advantage plans.
 */

export interface RegulatoryAlert {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: "enrollment" | "compliance" | "filing" | "benefits" | "quality";
  source?: string;
}

export const REGULATORY_ALERTS: RegulatoryAlert[] = [
  // Enrollment periods
  {
    id: "aep-start-2026",
    date: "2026-10-15",
    title: "Annual Enrollment Period Begins",
    description: "AEP runs Oct 15 - Dec 7. All Medicare beneficiaries can enroll in, switch, or drop MA/PDP plans. This is the primary selling season for agents.",
    impact: "high",
    category: "enrollment",
  },
  {
    id: "aep-end-2026",
    date: "2026-12-07",
    title: "Annual Enrollment Period Ends",
    description: "Last day of AEP. All MA and PDP plan changes must be submitted by 11:59 PM local time.",
    impact: "high",
    category: "enrollment",
  },
  {
    id: "oep-start-2026",
    date: "2026-01-01",
    title: "Open Enrollment Period Begins",
    description: "OEP runs Jan 1 - Mar 31. Current MA enrollees can switch to another MA plan or disenroll to Original Medicare + PDP. One change allowed.",
    impact: "medium",
    category: "enrollment",
  },
  {
    id: "oep-end-2026",
    date: "2026-03-31",
    title: "Open Enrollment Period Ends",
    description: "Last day of OEP. MA enrollees who want to make a change must do so by today.",
    impact: "medium",
    category: "enrollment",
  },
  {
    id: "sep-5star",
    date: "2026-12-08",
    title: "5-Star SEP Available Year-Round",
    description: "Beneficiaries can enroll in a 5-star rated plan at any time. The 5-Star SEP is available outside of AEP/OEP for qualifying plans.",
    impact: "low",
    category: "enrollment",
  },
  // Compliance deadlines
  {
    id: "anoc-deadline-2026",
    date: "2026-09-30",
    title: "ANOC/EOC Deadline",
    description: "Plans must send Annual Notice of Change (ANOC) and Evidence of Coverage (EOC) to all enrollees by September 30. Agents should review changes.",
    impact: "high",
    category: "compliance",
  },
  {
    id: "marketing-review-2026",
    date: "2026-09-01",
    title: "CMS Marketing Material Review Begins",
    description: "All marketing materials for the upcoming plan year must be submitted to CMS for review. TPMO compliance checks intensify.",
    impact: "high",
    category: "compliance",
  },
  {
    id: "agent-certification-2026",
    date: "2026-07-01",
    title: "Agent AHIP Certification Opens",
    description: "Annual AHIP certification testing opens. All agents must complete certification before selling AEP plans. Early completion recommended.",
    impact: "high",
    category: "compliance",
  },
  {
    id: "agent-cert-deadline-2026",
    date: "2026-09-30",
    title: "Agent Certification Deadline",
    description: "Recommended deadline to complete AHIP certification and all carrier-specific certifications before AEP selling begins October 1.",
    impact: "high",
    category: "compliance",
  },
  {
    id: "soa-reminder",
    date: "2026-10-01",
    title: "SOA Requirement Reminder",
    description: "Scope of Appointment forms must be obtained at least 48 hours before any appointment. Ensure SOA processes are in place for AEP.",
    impact: "medium",
    category: "compliance",
  },
  // Filing deadlines
  {
    id: "bid-submission-2026",
    date: "2026-06-02",
    title: "MA Plan Bid Submission Deadline",
    description: "Plans must submit bids to CMS for the upcoming contract year. Bid data determines premiums, benefits, and cost-sharing for next year.",
    impact: "high",
    category: "filing",
  },
  {
    id: "cms-approval-2026",
    date: "2026-08-15",
    title: "CMS Plan Approval Notifications",
    description: "CMS begins notifying plans of bid approval/denial. Approved plans can finalize marketing materials and begin agent training.",
    impact: "medium",
    category: "filing",
  },
  {
    id: "star-ratings-release",
    date: "2026-10-01",
    title: "CMS Star Ratings Released",
    description: "CMS releases annual Star Ratings for Medicare Advantage and Part D plans. Ratings affect bonus payments and marketing.",
    impact: "high",
    category: "quality",
  },
  {
    id: "plan-preview-2026",
    date: "2026-10-01",
    title: "Medicare Plan Finder Preview",
    description: "Updated Plan Finder goes live on Medicare.gov showing next year's plans. Beneficiaries can preview but not yet enroll.",
    impact: "medium",
    category: "enrollment",
  },
  // Benefits-related
  {
    id: "part-b-premium-2026",
    date: "2026-11-15",
    title: "Part B Premium Announcement",
    description: "CMS announces the standard Part B premium for the upcoming year. This affects beneficiary costs and Part B giveback calculations.",
    impact: "medium",
    category: "benefits",
  },
  {
    id: "donut-hole-2026",
    date: "2026-01-01",
    title: "Part D Coverage Gap Phase",
    description: "Updated cost-sharing amounts for the Part D coverage gap (donut hole) take effect. Check updated manufacturer discount programs.",
    impact: "medium",
    category: "benefits",
  },
  {
    id: "ira-drug-negotiation",
    date: "2026-09-01",
    title: "IRA Drug Price Negotiation Update",
    description: "CMS publishes negotiated prices for selected Part D drugs under the Inflation Reduction Act. Affects formulary and cost projections.",
    impact: "high",
    category: "benefits",
  },
  {
    id: "max-oop-cap-2026",
    date: "2026-01-01",
    title: "Part D Out-of-Pocket Cap in Effect",
    description: "The $2,000 annual out-of-pocket cap on Part D spending continues under the Inflation Reduction Act provisions.",
    impact: "high",
    category: "benefits",
  },
  // Quality
  {
    id: "cahps-survey",
    date: "2026-03-01",
    title: "CAHPS Survey Fielding Begins",
    description: "Consumer Assessment of Healthcare Providers and Systems survey begins. Results feed into Star Ratings calculations.",
    impact: "low",
    category: "quality",
  },
  {
    id: "hedis-deadline",
    date: "2026-06-15",
    title: "HEDIS Data Submission Deadline",
    description: "Plans submit Healthcare Effectiveness Data to NCQA. HEDIS measures are a major component of Star Ratings.",
    impact: "low",
    category: "quality",
  },
];

export function getUpcomingAlerts(options?: {
  days?: number;
  category?: string;
}): RegulatoryAlert[] {
  const today = new Date();
  const daysAhead = options?.days || 90;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  let alerts = REGULATORY_ALERTS.filter((a) => {
    const alertDate = new Date(a.date);
    return alertDate >= today && alertDate <= cutoff;
  });

  if (options?.category) {
    alerts = alerts.filter((a) => a.category === options.category);
  }

  // Sort by date ascending
  alerts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return alerts;
}

export function getCalendar(): {
  month: string;
  alerts: (RegulatoryAlert & { daysUntil: number })[];
}[] {
  const today = new Date();
  const monthMap = new Map<string, (RegulatoryAlert & { daysUntil: number })[]>();

  for (const alert of REGULATORY_ALERTS) {
    const alertDate = new Date(alert.date);
    const monthKey = alertDate.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    const daysUntil = Math.ceil((alertDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push({ ...alert, daysUntil });
  }

  // Sort months chronologically
  const sorted = Array.from(monthMap.entries())
    .sort((a, b) => {
      const dateA = new Date(a[1][0].date);
      const dateB = new Date(b[1][0].date);
      return dateA.getTime() - dateB.getTime();
    })
    .map(([month, alerts]) => ({
      month,
      alerts: alerts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }));

  return sorted;
}

export function getAllAlerts(): RegulatoryAlert[] {
  const today = new Date();
  return REGULATORY_ALERTS.map((a) => ({
    ...a,
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
