import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

export interface DrugCostMedication {
  rxcui: string;
  name: string;
}

export interface DrugCostPerPlan {
  planId: number;
  planName: string;
  carrier: string;
  annualCost: number;
  drugs: Array<{
    rxcui: string;
    name: string;
    tier: number | null;
    tierLabel: string;
    annualCost: number;
    covered: boolean;
    priorAuth: boolean;
    stepTherapy: boolean;
    quantityLimit: boolean;
  }>;
  phases: {
    deductible: number;
    initialCoverage: number;
    coverageGap: number;
    catastrophic: number;
  };
}

export interface DrugCostEstimateResult {
  clientId: number;
  medications: DrugCostMedication[];
  estimates: DrugCostPerPlan[];
  iraCap: number;
}

export interface FormularyCheckResult {
  rxcui: string;
  drugName: string;
  plans: Array<{
    planId: number;
    contractId: string;
    covered: boolean;
    tier: number | null;
    tierLabel: string;
    priorAuth: boolean;
    stepTherapy: boolean;
    quantityLimit: boolean;
  }>;
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

export function useDrugCosts(clientId: number) {
  const { token } = useAuth();

  const estimateMutation = useMutation<
    DrugCostEstimateResult,
    Error,
    { planIds: number[]; medications: DrugCostMedication[] }
  >({
    mutationFn: async ({ planIds, medications }) => {
      const res = await fetch(`/api/clients/${clientId}/drug-costs`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ planIds, medications }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to estimate drug costs");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["/api/clients", clientId, "drug-costs"],
        data
      );
    },
  });

  return {
    estimate: estimateMutation.mutate,
    estimateAsync: estimateMutation.mutateAsync,
    data: estimateMutation.data ?? null,
    isEstimating: estimateMutation.isPending,
    error: estimateMutation.error,
  };
}

export function useFormularyCheck(
  contractIds: string[],
  rxcuis: string[],
  enabled = true
) {
  const { token } = useAuth();

  return useQuery<{ results: FormularyCheckResult[] }>({
    queryKey: ["/api/formulary/check", contractIds.join(","), rxcuis.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("contractIds", contractIds.join(","));
      params.set("rxcuis", rxcuis.join(","));
      const res = await fetch(`/api/formulary/check?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Formulary check failed");
      return res.json();
    },
    enabled: enabled && !!token && contractIds.length > 0 && rxcuis.length > 0,
  });
}
