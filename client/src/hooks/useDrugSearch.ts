import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface DrugSearchResult {
  rxcui: string;
  name: string;
  strength: string;
  dosageForm: string;
}

export function useDrugSearch(debounceMs = 400) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
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

  const { data, isLoading } = useQuery<{ results: DrugSearchResult[] }>({
    queryKey: ["/api/drugs/search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/drugs/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) throw new Error("Drug search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  return {
    query,
    setQuery,
    results: data?.results ?? [],
    isLoading: isLoading && debouncedQuery.length >= 2,
  };
}
