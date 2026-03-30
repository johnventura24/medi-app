/**
 * ACA Enrollment Links Service
 *
 * Maps states to their correct ACA exchange enrollment URLs.
 * Some states run their own exchanges (SBE), others use the
 * Federal exchange (HealthCare.gov).
 */

const ACA_ENROLLMENT_URLS: Record<string, string> = {
  // State-based exchanges
  CA: "https://www.coveredca.com/",
  CO: "https://connectforhealthco.com/",
  CT: "https://www.accesshealthct.com/",
  DC: "https://dchealthlink.com/",
  ID: "https://www.yourhealthidaho.org/",
  KY: "https://kynect.ky.gov/",
  ME: "https://www.coverme.gov/",
  MD: "https://www.marylandhealthconnection.gov/",
  MA: "https://www.mahealthconnector.org/",
  MN: "https://www.mnsure.org/",
  NV: "https://www.nevadahealthlink.com/",
  NJ: "https://www.nj.gov/getcovered/",
  NM: "https://www.bewellnm.com/",
  NY: "https://nystateofhealth.ny.gov/",
  PA: "https://www.pennie.com/",
  RI: "https://healthsourceri.com/",
  VT: "https://portal.healthconnect.vermont.gov/",
  VA: "https://www.healthcarevirginia.com/",
  WA: "https://www.wahealthplanfinder.org/",
};

// Federal exchange URL (used for all states not listed above)
const FEDERAL_EXCHANGE_URL = "https://www.healthcare.gov/see-plans/";

/**
 * Returns the enrollment URL for a given state.
 * States with their own exchange get a direct link;
 * all others go to HealthCare.gov.
 */
export function getACAEnrollmentUrl(state: string): string {
  const stateUpper = state.toUpperCase();
  return ACA_ENROLLMENT_URLS[stateUpper] || FEDERAL_EXCHANGE_URL;
}

/**
 * Check whether a state uses a state-based exchange.
 */
export function isStateBased(state: string): boolean {
  return state.toUpperCase() in ACA_ENROLLMENT_URLS;
}

/**
 * Get all state exchange URLs for reference.
 */
export function getAllACAEnrollmentUrls(): Record<string, string> {
  return { ...ACA_ENROLLMENT_URLS };
}
