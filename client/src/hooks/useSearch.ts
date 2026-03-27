import { useState, useEffect, useRef } from "react";

interface PlanResult {
  id: number;
  planName: string;
  carrier: string;
  state: string;
}

interface CarrierResult {
  id: number;
  name: string;
  planCount: number;
}

interface LocationResult {
  id: number;
  name: string;
  type: "State" | "City" | "ZIP";
}

export interface SearchResults {
  plans: PlanResult[];
  carriers: CarrierResult[];
  locations: LocationResult[];
}

export function useSearch(query: string) {
  const [results, setResults] = useState<SearchResults>({
    plans: [],
    carriers: [],
    locations: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.trim().length === 0) {
      setResults({ plans: [], carriers: [], locations: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          limit: "10",
        });
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Search failed");
        }
        const data = await response.json();
        setResults({
          plans: data.plans ?? [],
          carriers: data.carriers ?? [],
          locations: data.locations ?? [],
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults({ plans: [], carriers: [], locations: [] });
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  return { results, isLoading };
}
