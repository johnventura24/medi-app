import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column, Badge } from "@/components/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationSummary {
  totalPlans: number;
  validPlans: number;
  warnings: number;
  errors: number;
}

interface ValidationIssue {
  severity: "error" | "warning" | "info";
  ruleName: string;
  planName: string;
  planId?: string;
  field: string;
  value: string;
  message: string;
}

interface ValidationDetailsResponse {
  issues: ValidationIssue[];
  total: number;
  page: number;
  limit: number;
}

export default function ValidationDashboard() {
  const [severity, setSeverity] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useQuery<ValidationSummary>({
    queryKey: ["/api/validation/summary"],
    queryFn: async () => {
      const res = await fetch("/api/validation/summary");
      return res.json();
    },
  });

  const { data: detailsData, isLoading: detailsLoading } = useQuery<ValidationDetailsResponse>({
    queryKey: ["/api/validation/details", severity, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (severity && severity !== "all") params.set("severity", severity);
      const res = await fetch(`/api/validation/details?${params}`);
      return res.json();
    },
  });

  const runValidation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/validation/run", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/validation/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/validation/details"] });
      setPage(1);
    },
  });

  const issues = detailsData?.issues ?? [];
  const totalIssues = detailsData?.total ?? 0;
  const summaryData = summary ?? { totalPlans: 0, validPlans: 0, warnings: 0, errors: 0 };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (value) => {
        const sev = value as string;
        return (
          <Badge
            className={cn(
              sev === "error" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
              sev === "warning" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
              sev === "info" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            )}
          >
            {sev === "error" && <XCircle className="h-3 w-3 mr-1" />}
            {sev === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
            {sev === "info" && <CheckCircle className="h-3 w-3 mr-1" />}
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
          </Badge>
        );
      },
    },
    { key: "ruleName", header: "Rule Name", sortable: true },
    {
      key: "planName",
      header: "Plan Name",
      sortable: true,
      render: (value, row) => (
        <button
          className="text-primary hover:underline font-medium text-left"
          onClick={(e) => {
            e.stopPropagation();
            const planId = (row as unknown as ValidationIssue).planId;
            if (planId) navigate(`/plans?id=${planId}`);
          }}
        >
          {value as string}
        </button>
      ),
    },
    { key: "field", header: "Field", sortable: true },
    {
      key: "value",
      header: "Value",
      sortable: false,
      render: (value) => <span className="font-mono text-sm">{value as string}</span>,
    },
    { key: "message", header: "Message", sortable: false },
  ];

  const totalPages = Math.ceil(totalIssues / 50);

  if (summaryLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Data Validation</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Plans"
          value={summaryData.totalPlans}
          icon={<ShieldCheck className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Valid Plans"
          value={summaryData.validPlans}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          className="border-green-200 dark:border-green-900"
        />
        <StatCard
          label="Warnings"
          value={summaryData.warnings}
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
          className="border-yellow-200 dark:border-yellow-900"
        />
        <StatCard
          label="Errors"
          value={summaryData.errors}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          className="border-red-200 dark:border-red-900"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <Button
              onClick={() => runValidation.mutate()}
              disabled={runValidation.isPending}
            >
              {runValidation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Run Validation
            </Button>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Severity</Label>
              <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="warning">Warnings</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {totalIssues > 0 && (
              <p className="text-sm text-muted-foreground ml-auto">
                {totalIssues} issue{totalIssues !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {detailsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <>
              <DataTable
                data={issues as unknown as Record<string, unknown>[]}
                columns={columns}
                searchPlaceholder="Search validation issues..."
                pageSize={50}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
