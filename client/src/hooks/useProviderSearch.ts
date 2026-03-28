import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface ProviderResult {
  npi: string;
  name: string;
  specialty: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
}

export interface NetworkStatus {
  planId: number;
  planName: string;
  carrier: string;
  inNetwork: boolean | null; // null = unknown
  source: string; // "FHIR API" | "Cache" | "Unknown"
  verifiedAt: string | null;
  carrierUrl?: string;
  /** @deprecated use carrierUrl */
  carrierWebsite?: string;
}

export function useProviderSearch(debounceMs = 400) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  const { data, isLoading } = useQuery<{ results: ProviderResult[] }>({
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
    enabled: !!token && debouncedQuery.length >= 2,
  });

  return {
    query,
    setQuery,
    stateFilter,
    setStateFilter,
    results: data?.results ?? [],
    isLoading: isLoading && debouncedQuery.length >= 2,
  };
}

export function useNetworkStatus(npi: string, planIds: number[]) {
  const { token } = useAuth();

  return useQuery<{ statuses: NetworkStatus[] }>({
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
