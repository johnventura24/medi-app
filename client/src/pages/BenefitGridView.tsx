import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BenefitGridExport } from "@/components/BenefitGridExport";
import {
  FileSpreadsheet,
  Stethoscope,
  CreditCard,
  Pill,
  DollarSign,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

interface ExportLog {
  id: number;
  exportType: string;
  exportScope: string;
  filters: Record<string, any> | null;
  rowCount: number | null;
  createdAt: string;
}

const SHEET_INFO = [
  {
    title: "Dental",
    icon: Stethoscope,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    description: "Dental coverage details including comprehensive and routine benefits, annual allowance amounts.",
    columns: [
      "County", "State", "Carrier", "Contract #", "PBP #", "Plan Name", "Plan Type",
      "Comprehensive Benefits", "Routine Benefits", "Annual Allowance",
      "Annual Allowance Type", "Summary of Benefits",
    ],
  },
  {
    title: "Flex",
    icon: CreditCard,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    description: "Flex benefit spending allowances, SSBCI qualifier information, and disbursement schedules.",
    columns: [
      "County", "State", "Carrier", "Contract #", "PBP #", "Plan Type", "Plan Name",
      "Flex Benefit Details", "SSBCI Qualifiers", "Amount",
      "Disbursement Parameter", "Summary of Benefits",
    ],
  },
  {
    title: "OTC",
    icon: Pill,
    color: "text-green-600",
    bgColor: "bg-green-50",
    description: "Over-the-counter health and wellness product allowances with quarterly disbursement details.",
    columns: [
      "County", "State", "Carrier", "Contract #", "PBP #", "Plan Name", "Plan Type",
      "OTC Details", "Amount", "Disbursement Parameter", "Summary of Benefits",
    ],
  },
  {
    title: "Part B Reduction",
    icon: DollarSign,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    description: "Part B premium reduction (giveback) amounts for qualifying plans.",
    columns: [
      "County", "State", "Carrier", "Contract #", "PBP #", "Plan Name", "Plan Type",
      "Monthly Reduction Amount", "Summary of Benefits",
    ],
  },
];

export default function BenefitGridView() {
  const { data: logs, isLoading: logsLoading } = useQuery<ExportLog[]>({
    queryKey: ["/api/export/benefit-grid/logs"],
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Benefit Grid Export</h1>
          </div>
          <p className="text-muted-foreground">
            Generate compliance-ready benefit grids matching carrier submission templates
          </p>
        </div>
        <BenefitGridExport />
      </div>

      {/* Sheet description cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SHEET_INFO.map((sheet) => {
          const Icon = sheet.icon;
          return (
            <Card key={sheet.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${sheet.bgColor}`}>
                    <Icon className={`h-5 w-5 ${sheet.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{sheet.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {sheet.columns.length} columns
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-sm text-muted-foreground">{sheet.description}</p>
                <div className="flex flex-wrap gap-1">
                  {sheet.columns.map((col) => (
                    <Badge key={col} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {col}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent exports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Exports</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log) => {
                const filters = log.filters || {};
                const filterParts: string[] = [];
                if (filters.carrier) filterParts.push(String(filters.carrier));
                if (filters.state) filterParts.push(String(filters.state));
                if (filters.contractId) filterParts.push(String(filters.contractId));
                const label = filterParts.length > 0 ? filterParts.join(" / ") : "All plans";

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-md border px-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium">{label}</span>
                        {log.rowCount != null && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({log.rowCount.toLocaleString()} rows)
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {log.createdAt
                        ? format(new Date(log.createdAt), "MMM d, yyyy h:mm a")
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No benefit grid exports yet. Use the Generate button above to create your first export.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
