import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export interface ClientMedication {
  drugName: string;
  dosage: string;
  frequency: "daily" | "twice daily" | "weekly" | "monthly";
}

export interface ClientDoctor {
  name: string;
  npi?: string;
}

export interface BenefitWeights {
  lowPremium: number;
  lowCopays: number;
  dentalGenerosity: number;
  drugCoverage: number;
  supplementalBenefits: number;
  starRating: number;
}

export interface ClientData {
  id?: number;
  // Demographics
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: "Male" | "Female" | "Other";
  zipCode: string;
  // Health Profile
  currentCoverage?: string;
  currentPlanName?: string;
  chronicConditions: string[];
  mobilityLevel?: "Independent" | "Limited Mobility" | "Homebound";
  hospitalizedLast12Months?: boolean;
  // Medications & Doctors
  medications: ClientMedication[];
  preferredDoctors: ClientDoctor[];
  // Benefits & Priorities
  maxMonthlyPremium?: number | null;
  maxAnnualOop?: number | null;
  mustHaveBenefits: string[];
  benefitWeights: BenefitWeights;
  notes?: string;
  // Meta
  status?: "intake" | "plans_reviewed" | "enrolled" | "archived";
  agentId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientListResponse {
  clients: ClientData[];
  total: number;
  page: number;
  limit: number;
}

export interface ClientFilters {
  page: number;
  limit: number;
  status?: string;
  search?: string;
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

export function useClients(filters?: ClientFilters) {
  const { token } = useAuth();
  const [page, setPage] = useState(filters?.page ?? 1);
  const [limit] = useState(filters?.limit ?? 25);
  const [status, setStatus] = useState<string>(filters?.status ?? "all");
  const [search, setSearch] = useState(filters?.search ?? "");

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (status && status !== "all") queryParams.set("status", status);
  if (search) queryParams.set("search", search);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<ClientListResponse>({
    queryKey: ["/api/clients", page, limit, status, search],
    queryFn: async () => {
      const res = await fetch(`/api/clients?${queryParams.toString()}`, {
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch clients");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const createClient = useMutation({
    mutationFn: async (clientData: Omit<ClientData, "id" | "agentId" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(clientData),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create client");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...clientData }: ClientData & { id: number }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(clientData),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update client");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete client");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  return {
    clients: data?.clients ?? [],
    total: data?.total ?? 0,
    totalPages: data ? Math.ceil(data.total / data.limit) : 0,
    isLoading,
    error,
    refetch,
    page,
    setPage,
    status,
    setStatus,
    search,
    setSearch,
    createClient,
    updateClient,
    deleteClient,
  };
}

export function useClient(id: number | string | undefined) {
  const { token } = useAuth();

  return useQuery<ClientData>({
    queryKey: ["/api/clients", id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch client");
      }
      return res.json();
    },
    enabled: !!token && !!id,
  });
}
