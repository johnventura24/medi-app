import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export interface FinderCriteria {
  zip: string;
  maxPremium: number | null;
  maxMoop: number | null;
  maxPcpCopay: number | null;
  maxSpecialistCopay: number | null;
  minDental: number | null;
  minVision: number | null;
  minOtcPerQuarter: number | null;
  minStarRating: number | null;
  maxDrugDeductible: number | null;
  planType: string | null;
  // Supplemental boolean benefits
  transportation: boolean;
  mealBenefit: boolean;
  fitness: boolean;
  telehealth: boolean;
  inHomeSupport: boolean;
  partBGiveback: boolean;
}

export interface FinderPlanResult {
  id: number;
  name: string;
  carrier: string;
  planType: string;
  state: string;
  county: string;
  premium: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  dental: number;
  vision: number;
  otcPerQuarter: number;
  starRating: number | null;
  drugDeductible: number | null;
  transportation: boolean;
  mealBenefit: boolean;
  fitness: boolean;
  telehealth: boolean;
  inHomeSupport: boolean;
  partBGiveback: number | null;
  matchScore: number;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  // Extended fields for detail expand
  deductible?: number;
  erCopay?: number;
  dentalPreventiveCovered?: boolean;
  dentalComprehensiveCovered?: boolean;
  visionExamCopay?: number | null;
  hearingAidAllowance?: number | null;
  telehealthCopay?: number | null;
  flexCardAmount?: number | null;
  groceryAllowanceAmount?: number | null;
  transportationAmountPerYear?: number | null;
  mealBenefitAmount?: number | null;
  otcAmountPerQuarter?: number | null;
  tier1CopayPreferred?: number | null;
  tier2CopayPreferred?: number | null;
  tier3CopayPreferred?: number | null;
  overallStarRating?: number | null;
  requiresPcpReferral?: boolean | null;
}

export interface FinderResponse {
  plans: FinderPlanResult[];
  total: number;
  page: number;
  limit: number;
  location: { county: string; state: string } | null;
  totalCriteria: number;
}

const defaultCriteria: FinderCriteria = {
  zip: "",
  maxPremium: null,
  maxMoop: null,
  maxPcpCopay: null,
  maxSpecialistCopay: null,
  minDental: null,
  minVision: null,
  minOtcPerQuarter: null,
  minStarRating: null,
  maxDrugDeductible: null,
  planType: null,
  transportation: false,
  mealBenefit: false,
  fitness: false,
  telehealth: false,
  inHomeSupport: false,
  partBGiveback: false,
};

function buildQueryParams(criteria: FinderCriteria, page: number, limit: number): string {
  const params = new URLSearchParams();
  if (criteria.zip) params.set("zip", criteria.zip);
  if (criteria.maxPremium !== null) params.set("maxPremium", String(criteria.maxPremium));
  if (criteria.maxMoop !== null) params.set("maxMoop", String(criteria.maxMoop));
  if (criteria.maxPcpCopay !== null) params.set("maxPcpCopay", String(criteria.maxPcpCopay));
  if (criteria.maxSpecialistCopay !== null) params.set("maxSpecialistCopay", String(criteria.maxSpecialistCopay));
  if (criteria.minDental !== null) params.set("minDental", String(criteria.minDental));
  if (criteria.minVision !== null) params.set("minVision", String(criteria.minVision));
  if (criteria.minOtcPerQuarter !== null) params.set("minOtcPerQuarter", String(criteria.minOtcPerQuarter));
  if (criteria.minStarRating !== null) params.set("minStarRating", String(criteria.minStarRating));
  if (criteria.maxDrugDeductible !== null) params.set("maxDrugDeductible", String(criteria.maxDrugDeductible));
  if (criteria.planType) params.set("planType", criteria.planType);
  if (criteria.transportation) params.set("transportation", "true");
  if (criteria.mealBenefit) params.set("mealBenefit", "true");
  if (criteria.fitness) params.set("fitness", "true");
  if (criteria.telehealth) params.set("telehealth", "true");
  if (criteria.inHomeSupport) params.set("inHomeSupport", "true");
  if (criteria.partBGiveback) params.set("partBGiveback", "true");
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params.toString();
}

export function usePlanFinder() {
  const [criteria, setCriteria] = useState<FinderCriteria>(defaultCriteria);
  const [submittedCriteria, setSubmittedCriteria] = useState<FinderCriteria | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("matchScore");
  const limit = 25;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (criteria.zip) count++;
    if (criteria.maxPremium !== null) count++;
    if (criteria.maxMoop !== null) count++;
    if (criteria.maxPcpCopay !== null) count++;
    if (criteria.maxSpecialistCopay !== null) count++;
    if (criteria.minDental !== null) count++;
    if (criteria.minVision !== null) count++;
    if (criteria.minOtcPerQuarter !== null) count++;
    if (criteria.minStarRating !== null) count++;
    if (criteria.maxDrugDeductible !== null) count++;
    if (criteria.planType) count++;
    if (criteria.transportation) count++;
    if (criteria.mealBenefit) count++;
    if (criteria.fitness) count++;
    if (criteria.telehealth) count++;
    if (criteria.inHomeSupport) count++;
    if (criteria.partBGiveback) count++;
    return count;
  }, [criteria]);

  const queryString = useMemo(() => {
    if (!submittedCriteria) return "";
    return buildQueryParams(submittedCriteria, page, limit);
  }, [submittedCriteria, page, limit]);

  const {
    data: results,
    isLoading,
    error,
  } = useQuery<FinderResponse>({
    queryKey: ["/api/plans/find", queryString, sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/plans/find?${queryString}&sortBy=${sortBy}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to search plans");
      }
      return res.json();
    },
    enabled: !!submittedCriteria && !!submittedCriteria.zip && submittedCriteria.zip.length === 5,
  });

  const submitSearch = useCallback(() => {
    setPage(1);
    setSubmittedCriteria({ ...criteria });
  }, [criteria]);

  const resetCriteria = useCallback(() => {
    setCriteria(defaultCriteria);
    setSubmittedCriteria(null);
    setPage(1);
    setSortBy("matchScore");
  }, []);

  return {
    criteria,
    setCriteria,
    results,
    isLoading,
    error,
    activeFilterCount,
    page,
    setPage,
    sortBy,
    setSortBy,
    submitSearch,
    resetCriteria,
  };
}
