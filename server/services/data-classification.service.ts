/**
 * Data Classification Service — SOC2 Compliance
 *
 * All data must be classified into one of four tiers:
 *   - public: freely shareable (plan benefits, carrier info, star ratings, county data)
 *   - internal: organization-only (market intelligence, competitive analysis, insights)
 *   - confidential: restricted access (client data, lead data, interaction logs)
 *   - restricted: highest sensitivity (PHI, passwords, API keys)
 */

export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export const DATA_CLASSIFICATIONS: Record<DataClassification, string[]> = {
  public: [
    "plan benefits",
    "carrier info",
    "star ratings",
    "county data",
    "state data",
    "zip data",
    "plan types",
    "formulary drug names",
    "provider specialties",
  ],
  internal: [
    "market intelligence",
    "competitive analysis",
    "insights",
    "hidden gems",
    "battleground data",
    "carrier movements",
    "trend data",
    "archetype analysis",
    "AEP war room data",
    "health gap analysis",
  ],
  confidential: [
    "client data",
    "lead data",
    "interaction logs",
    "saved searches",
    "scope of appointments",
    "recommendations",
    "enrollment links",
    "consumer quiz answers",
    "export history",
  ],
  restricted: [
    "PHI (medications, conditions, DOB)",
    "passwords",
    "password hashes",
    "API keys",
    "JWT tokens",
    "encryption keys",
    "session tokens",
  ],
};

// Map resource types to their classification
const RESOURCE_CLASSIFICATION_MAP: Record<string, DataClassification> = {
  // Public
  plans: "public",
  states: "public",
  cities: "public",
  zips: "public",
  carriers: "public",
  "benefit-grid": "public",
  "plan-finder": "public",
  "plan-compare": "public",
  drugs: "public",
  providers: "public",
  "data-sources": "public",

  // Internal
  intelligence: "internal",
  insights: "internal",
  "hidden-gems": "internal",
  battleground: "internal",
  "carrier-movements": "internal",
  trends: "internal",
  archetypes: "internal",
  warroom: "internal",
  "health-gaps": "internal",
  "money-calculator": "internal",

  // Confidential
  clients: "confidential",
  leads: "confidential",
  interactions: "confidential",
  "saved-searches": "confidential",
  favorites: "confidential",
  soa: "confidential",
  recommendations: "confidential",
  "enrollment-links": "confidential",
  exports: "confidential",
  consumer: "confidential",

  // Restricted
  auth: "restricted",
  "api-keys": "restricted",
  sessions: "restricted",
  phi: "restricted",
};

/**
 * Get the classification level for a given resource type.
 */
export function classifyResource(resource: string): DataClassification {
  return RESOURCE_CLASSIFICATION_MAP[resource] || "internal";
}

/**
 * Check if a resource requires authentication to access.
 */
export function requiresAuth(classification: DataClassification): boolean {
  return classification !== "public";
}

/**
 * Check if a resource contains PHI and requires extra audit logging.
 */
export function containsPHI(resource: string): boolean {
  return resource === "phi" || resource === "clients"; // clients may have medications, DOB, conditions
}

/**
 * Fields that are classified as PHI within client records.
 */
export const PHI_FIELDS = [
  "dateOfBirth",
  "chronicConditions",
  "medications",
  "preferredDoctors",
  "hospitalizedLastYear",
  "mobilityLevel",
  "gender",
] as const;

/**
 * Get human-readable label for a classification level.
 */
export function classificationLabel(level: DataClassification): string {
  switch (level) {
    case "public":
      return "Public";
    case "internal":
      return "Internal Use Only";
    case "confidential":
      return "Confidential";
    case "restricted":
      return "Restricted — PHI/PII";
  }
}

/**
 * Get required access controls for a classification level (for SOC2 documentation).
 */
export function requiredControls(level: DataClassification): string[] {
  switch (level) {
    case "public":
      return ["Rate limiting"];
    case "internal":
      return ["Authentication required", "Rate limiting", "Access logging"];
    case "confidential":
      return [
        "Authentication required",
        "Role-based access control",
        "Audit logging",
        "Encryption at rest",
        "Rate limiting",
      ];
    case "restricted":
      return [
        "Authentication required",
        "Role-based access control",
        "Detailed audit logging",
        "Encryption at rest (AES-256-GCM)",
        "Encryption in transit (TLS)",
        "Access review required",
        "Data retention policy",
        "Rate limiting",
        "PHI access tracking",
      ];
  }
}
