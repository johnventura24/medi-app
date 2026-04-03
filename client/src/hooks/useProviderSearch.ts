import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface ProviderResult {
  npi: string;
  name: string;
  specialty: string;
  specialtyNote?: string | null;
  address: string;
  city: string;
  state: string;
  phone?: string;
}

export interface ConfidenceFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

export interface NetworkStatus {
  planId: number;
  planName: string;
  carrier: string;
  confidence: number; // 0-100
  confidenceLevel: "high" | "medium" | "low" | "unknown";
  factors: ConfidenceFactor[];
  verificationUrl: string;
  recommendation: string;
  // Backward compatibility
  inNetwork: boolean | null;
  /** @deprecated use verificationUrl */
  carrierUrl?: string;
  /** @deprecated use verificationUrl */
  carrierWebsite?: string;
}

export interface NetworkStatusResponse {
  npi: string;
  provider: {
    name: string;
    specialty: string | null;
    specialtyNote: string | null;
    address: {
      line1: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    };
    phone: string | null;
  } | null;
  statuses: NetworkStatus[];
}

/**
 * Strip title prefixes client-side so we can evaluate the "real" query length
 * before sending to the API (backend also strips, this is for UX gating).
 */
function stripTitlePrefix(name: string): string {
  return name.replace(/^(dr\.?|doctor|md|nurse|np)\s*/i, '').trim();
}

export function useProviderSearch(debounceMs = 200) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // The actual searchable portion after stripping "Dr." etc.
  const effectiveQuery = stripTitlePrefix(query);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  const searchReady = debouncedQuery.length >= 2 && stripTitlePrefix(debouncedQuery).length >= 2;

  const { data, isLoading, isFetching } = useQuery<{ providers: ProviderResult[] }>({
    queryKey: ["/api/providers/search", debouncedQuery, stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("name", debouncedQuery);
      params.set("limit", "8");
      if (stateFilter) params.set("state", stateFilter);
      const res = await fetch(`/api/providers/search?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Provider search failed");
      return res.json();
    },
    enabled: searchReady,
    keepPreviousData: true,
  });

  return {
    query,
    setQuery,
    stateFilter,
    setStateFilter,
    results: data?.providers ?? [],
    isLoading: (isLoading || isFetching) && searchReady,
    effectiveQuery,
  };
}

export function useNetworkStatus(npi: string, planIds: number[]) {
  const { token } = useAuth();

  return useQuery<NetworkStatusResponse>({
    queryKey: ["/api/providers", npi, "network", planIds.join(",")],
    queryFn: async () => {
      const res = await fetch(
        `/api/providers/${npi}/network?planIds=${planIds.join(",")}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error("Network status check failed");
      return res.json();
    },
    enabled: !!token && !!npi && planIds.length > 0,
  });
}
