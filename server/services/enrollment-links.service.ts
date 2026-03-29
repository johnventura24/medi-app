/**
 * Carrier Enrollment Deep-Links Service
 *
 * Maps carriers to their enrollment page URLs, phone numbers,
 * and enrollment types. Includes fuzzy matching for carrier names.
 */

export interface CarrierEnrollmentInfo {
  carrierName: string;
  enrollUrl: string;
  searchUrl: string;
  phoneNumber: string;
  enrollmentType: "online" | "phone" | "both";
}

const CARRIER_ENROLLMENT_URLS: Record<string, Omit<CarrierEnrollmentInfo, "carrierName">> = {
  "UnitedHealthcare": {
    enrollUrl: "https://www.uhc.com/medicare/medicare-advantage-plans",
    searchUrl: "https://www.uhc.com/medicare/medicare-advantage-plans/shop-plans",
    phoneNumber: "1-844-364-5765",
    enrollmentType: "both",
  },
  "Humana": {
    enrollUrl: "https://www.humana.com/medicare/medicare-advantage-plans",
    searchUrl: "https://www.humana.com/medicare/medicare-advantage-plans/shop-plans",
    phoneNumber: "1-800-457-4708",
    enrollmentType: "both",
  },
  "Aetna": {
    enrollUrl: "https://www.aetnamedicare.com/en/find-plans",
    searchUrl: "https://www.aetnamedicare.com/en/find-plans",
    phoneNumber: "1-855-338-7027",
    enrollmentType: "both",
  },
  "Cigna": {
    enrollUrl: "https://www.cigna.com/medicare/",
    searchUrl: "https://www.cigna.com/medicare/find-a-plan",
    phoneNumber: "1-800-934-2459",
    enrollmentType: "both",
  },
  "Anthem": {
    enrollUrl: "https://www.anthem.com/medicare",
    searchUrl: "https://www.anthem.com/medicare/find-a-plan",
    phoneNumber: "1-855-513-5758",
    enrollmentType: "both",
  },
  "Blue Cross Blue Shield": {
    enrollUrl: "https://www.bcbs.com/medicare",
    searchUrl: "https://www.bcbs.com/find-a-doctor",
    phoneNumber: "varies by state",
    enrollmentType: "both",
  },
  "Kaiser Permanente": {
    enrollUrl: "https://healthy.kaiserpermanente.org/medicare",
    searchUrl: "https://healthy.kaiserpermanente.org/medicare/plans",
    phoneNumber: "1-800-443-0815",
    enrollmentType: "both",
  },
  "Centene": {
    enrollUrl: "https://www.centene.com/products-and-services.html",
    searchUrl: "https://www.centene.com/products-and-services.html",
    phoneNumber: "varies by state",
    enrollmentType: "phone",
  },
  "Molina": {
    enrollUrl: "https://www.molinahealthcare.com/medicare",
    searchUrl: "https://www.molinahealthcare.com/medicare",
    phoneNumber: "1-800-665-4621",
    enrollmentType: "both",
  },
  "WellCare": {
    enrollUrl: "https://www.wellcare.com/medicare",
    searchUrl: "https://www.wellcare.com/medicare/plans",
    phoneNumber: "1-888-550-5252",
    enrollmentType: "both",
  },
  "CVS Health": {
    enrollUrl: "https://www.aetnamedicare.com/en/find-plans",
    searchUrl: "https://www.aetnamedicare.com/en/find-plans",
    phoneNumber: "1-855-338-7027",
    enrollmentType: "both",
  },
  "Elevance Health": {
    enrollUrl: "https://www.anthem.com/medicare",
    searchUrl: "https://www.anthem.com/medicare/find-a-plan",
    phoneNumber: "1-855-513-5758",
    enrollmentType: "both",
  },
  "Devoted Health": {
    enrollUrl: "https://www.devoted.com/plans",
    searchUrl: "https://www.devoted.com/plans",
    phoneNumber: "1-800-338-6833",
    enrollmentType: "both",
  },
  "Alignment Health": {
    enrollUrl: "https://www.alignmenthealthcare.com/plans",
    searchUrl: "https://www.alignmenthealthcare.com/plans",
    phoneNumber: "1-844-310-2247",
    enrollmentType: "both",
  },
  "Clover Health": {
    enrollUrl: "https://www.cloverhealth.com/en/plans",
    searchUrl: "https://www.cloverhealth.com/en/plans",
    phoneNumber: "1-888-778-1478",
    enrollmentType: "both",
  },
  "Oscar Health": {
    enrollUrl: "https://www.hioscar.com/medicare",
    searchUrl: "https://www.hioscar.com/medicare",
    phoneNumber: "1-855-672-2755",
    enrollmentType: "both",
  },
};

// Aliases for fuzzy matching
const CARRIER_ALIASES: Record<string, string> = {
  "uhc": "UnitedHealthcare",
  "united": "UnitedHealthcare",
  "united healthcare": "UnitedHealthcare",
  "unitedhealthcare": "UnitedHealthcare",
  "humana": "Humana",
  "aetna": "Aetna",
  "aetna medicare": "Aetna",
  "cigna": "Cigna",
  "cigna healthcare": "Cigna",
  "anthem": "Anthem",
  "anthem blue cross": "Anthem",
  "bcbs": "Blue Cross Blue Shield",
  "blue cross": "Blue Cross Blue Shield",
  "bluecross": "Blue Cross Blue Shield",
  "blue shield": "Blue Cross Blue Shield",
  "kaiser": "Kaiser Permanente",
  "kaiser permanente": "Kaiser Permanente",
  "centene": "Centene",
  "molina": "Molina",
  "molina healthcare": "Molina",
  "wellcare": "WellCare",
  "well care": "WellCare",
  "cvs": "CVS Health",
  "cvs health": "CVS Health",
  "elevance": "Elevance Health",
  "elevance health": "Elevance Health",
  "devoted": "Devoted Health",
  "devoted health": "Devoted Health",
  "alignment": "Alignment Health",
  "alignment health": "Alignment Health",
  "clover": "Clover Health",
  "clover health": "Clover Health",
  "oscar": "Oscar Health",
  "oscar health": "Oscar Health",
};

/**
 * Fuzzy match a carrier name to a known carrier.
 * Tries exact match first, then alias lookup, then substring.
 */
export function getEnrollmentInfo(carrierName: string): CarrierEnrollmentInfo | null {
  if (!carrierName) return null;

  const normalized = carrierName.trim();

  // Exact match
  if (CARRIER_ENROLLMENT_URLS[normalized]) {
    return { carrierName: normalized, ...CARRIER_ENROLLMENT_URLS[normalized] };
  }

  // Alias match (case-insensitive)
  const lowerName = normalized.toLowerCase();
  const aliasKey = Object.keys(CARRIER_ALIASES).find(
    (alias) => lowerName === alias || lowerName.includes(alias)
  );
  if (aliasKey) {
    const canonical = CARRIER_ALIASES[aliasKey];
    return { carrierName: canonical, ...CARRIER_ENROLLMENT_URLS[canonical] };
  }

  // Substring match against known carrier names
  const knownCarrier = Object.keys(CARRIER_ENROLLMENT_URLS).find(
    (name) =>
      lowerName.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(lowerName)
  );
  if (knownCarrier) {
    return { carrierName: knownCarrier, ...CARRIER_ENROLLMENT_URLS[knownCarrier] };
  }

  return null;
}

/**
 * Generate an enrollment link with plan context.
 */
export function generateEnrollmentLink(
  carrierName: string,
  _state?: string,
  _zip?: string
): {
  url: string | null;
  phone: string | null;
  type: "online" | "phone" | "both" | "unknown";
  carrierName: string;
} {
  const info = getEnrollmentInfo(carrierName);

  if (!info) {
    return {
      url: null,
      phone: null,
      type: "unknown",
      carrierName,
    };
  }

  return {
    url: info.enrollUrl,
    phone: info.phoneNumber,
    type: info.enrollmentType,
    carrierName: info.carrierName,
  };
}

/**
 * Get all known carriers and their enrollment info.
 */
export function getAllCarrierEnrollmentInfo(): CarrierEnrollmentInfo[] {
  return Object.entries(CARRIER_ENROLLMENT_URLS).map(([name, info]) => ({
    carrierName: name,
    ...info,
  }));
}
