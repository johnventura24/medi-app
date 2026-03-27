import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export interface ScoreBreakdown {
  premiumScore: number;
  copayScore: number;
  dentalScore: number;
  drugScore: number;
  supplementalScore: number;
  starRatingScore: number;
}

export interface RecommendedPlan {
  rank: number;
  planId: number;
  planName: string;
  carrier: string;
  planType: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
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
  warnings: string[];
}

export interface RecommendationsResponse {
  clientId: number;
  recommendations: RecommendedPlan[];
  generatedAt: string;
}

export interface Interaction {
  id: number;
  clientId: number;
  action: "view_plans" | "compare" | "export" | "discuss" | "recommend";
  details: string;
  createdAt: string;
}

export function useRecommendations(clientId: number | string | undefined) {
  const { token } = useAuth();

  const {
    data: recommendations,
    isLoading,
    error,
    refetch,
  } = useQuery<RecommendationsResponse>({
    queryKey: ["/api/clients", clientId, "recommendations"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) return { clientId: Number(clientId), recommendations: [], generatedAt: "" };
        const text = await res.text();
        throw new Error(text || "Failed to fetch recommendations");
      }
      return res.json();
    },
    enabled: !!token && !!clientId,
  });

  const generateRecommendations = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/recommend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate recommendations");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "recommendations"] });
    },
  });

  return {
    recommendations: recommendations?.recommendations ?? [],
    generatedAt: recommendations?.generatedAt ?? "",
    isLoading,
    error,
    refetch,
    generateRecommendations: generateRecommendations.mutate,
    isGenerating: generateRecommendations.isPending,
  };
}

export function useInteractions(clientId: number | string | undefined) {
  const { token } = useAuth();

  const {
    data,
    isLoading,
    refetch,
  } = useQuery<{ interactions: Interaction[] }>({
    queryKey: ["/api/clients", clientId, "interactions"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/interactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) return { interactions: [] };
        const text = await res.text();
        throw new Error(text || "Failed to fetch interactions");
      }
      return res.json();
    },
    enabled: !!token && !!clientId,
  });

  const logInteraction = useMutation({
    mutationFn: async (interaction: { action: string; details: string }) => {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: Number(clientId), ...interaction }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to log interaction");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "interactions"] });
    },
  });

  return {
    interactions: data?.interactions ?? [],
    isLoading,
    refetch,
    logInteraction: logInteraction.mutate,
  };
}

export interface SOARecord {
  id: number;
  clientId: number;
  clientName?: string;
  beneficiaryName: string;
  soaDate: string;
  planTypes: string[];
  contactMethod: "In Person" | "Telephonic" | "Online";
  beneficiaryInitiated: boolean;
  signature: string;
  status: "active" | "expired";
  expiresAt?: string;
  createdAt: string;
}

export interface SOAListResponse {
  soas: SOARecord[];
  total: number;
}

export function useSOA(clientId?: number | string) {
  const { token } = useAuth();

  const queryKey = clientId
    ? ["/api/soa", "client", clientId]
    : ["/api/soa"];

  const {
    data,
    isLoading,
    refetch,
  } = useQuery<SOAListResponse>({
    queryKey,
    queryFn: async () => {
      const url = clientId ? `/api/soa?clientId=${clientId}` : "/api/soa";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) return { soas: [], total: 0 };
        const text = await res.text();
        throw new Error(text || "Failed to fetch SOAs");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const createSOA = useMutation({
    mutationFn: async (soaData: Omit<SOARecord, "id" | "status" | "createdAt">) => {
      const res = await fetch("/api/soa", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(soaData),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create SOA");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soa"] });
    },
  });

  return {
    soas: data?.soas ?? [],
    total: data?.total ?? 0,
    isLoading,
    refetch,
    createSOA,
  };
}
