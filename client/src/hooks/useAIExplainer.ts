import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

export interface AIExplanation {
  content: string;
  cached: boolean;
  generatedAt: string;
}

export interface AIComparison {
  content: string;
  cached: boolean;
  generatedAt: string;
}

function authHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function useAIPlanExplainer(planId: number, clientId?: number) {
  const { token } = useAuth();

  const mutation = useMutation<AIExplanation, Error, { forceRefresh?: boolean }>({
    mutationFn: async ({ forceRefresh = false }) => {
      const res = await fetch("/api/ai/explain-plan", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ planId, clientId, forceRefresh }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate AI explanation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["/api/ai/explain-plan", planId, clientId],
        data
      );
    },
  });

  return {
    generate: (forceRefresh = false) => mutation.mutate({ forceRefresh }),
    data: mutation.data ?? null,
    isGenerating: mutation.isPending,
    error: mutation.error,
  };
}

export function useAICompareNarrative(planIds: number[], clientId?: number) {
  const { token } = useAuth();

  const mutation = useMutation<AIComparison, Error, { forceRefresh?: boolean }>({
    mutationFn: async ({ forceRefresh = false }) => {
      const res = await fetch("/api/ai/compare-plans", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ planIds, clientId, forceRefresh }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate AI comparison");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["/api/ai/compare-plans", planIds.join(","), clientId],
        data
      );
    },
  });

  return {
    generate: (forceRefresh = false) => mutation.mutate({ forceRefresh }),
    data: mutation.data ?? null,
    isGenerating: mutation.isPending,
    error: mutation.error,
  };
}
