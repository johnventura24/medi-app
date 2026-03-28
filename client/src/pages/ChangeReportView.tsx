import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeftRight,
  FilePlus,
  FileX,
  FileText,
  RefreshCw,
  Download,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

interface FieldChange {
  field: string;
  oldValue: string | number;
  newValue: string | number;
  direction: "better" | "worse" | "neutral";
}

interface ChangedPlan {
  planName: string;
  contractId: string;
  county: string;
  changeCount: number;
  changes: FieldChange[];
}

interface NewPlan {
  planName: string;
  contractId: string;
  county: string;
  carrier: string;
  premium: number;
}

interface TerminatedPlan {
  planName: string;
  contractId: string;
  county: string;
  carrier: string;
  premium: number;
}

interface ChangeResponse {
  changedPlans: ChangedPlan[];
  newPlans: NewPlan[];
  terminatedPlans: TerminatedPlan[];
  summary: {
    plansCompared: number;
    newPlans: number;
    terminatedPlans: number;
    plansWithChanges: number;
  };
}

const YEARS = ["2023", "2024", "2025", "2026"];

export default function ChangeReportView() {
  const [year1, setYear1] = useState("2025");
  const [year2, setYear2] = useState("2026");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [submitted, setSubmitted] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: carriers = [] } = useQuery<any[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: changeData, isLoading } = useQuery<ChangeResponse>({
    queryKey: ["/api/changes", year1, year2, carrierFilter, stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ year1, year2 });
      if (carrierFilter && carrierFilter !== "all") params.set("carrier", carrierFilter);
      if (stateFilter && stateFilter !== "all") params.set("state", stateFilter);
      const res = await fetch(`/api/changes?${params}`);
      return res.json();
    },
    enabled: submitted,
  });

  const summary = changeData?.summary ?? { plansCompared: 0, newPlans: 0, terminatedPlans: 0, plansWithChanges: 0 };
  const changedPlans = changeData?.changedPlans ?? [];
  const newPlans = changeData?.newPlans ?? [];
  const terminatedPlans = changeData?.terminatedPlans ?? [];

  const changeInsights = useMemo((): InsightItem[] => {
    if (!changeData) return [];
    const items: InsightItem[] = [];

    // Improved vs worsened
    let improvedCount = 0;
    let worsenedCount = 0;
    changedPlans.forEach((p) => {
      const better = p.changes.filter((c) => c.direction === "better").length;
      const worse = p.changes.filter((c) => c.direction === "worse").length;
      if (better > worse) improvedCount++;
      else if (worse > better) worsenedCount++;
    });
    if (changedPlans.length > 0) {
      items.push({
        icon: improvedCount >= worsenedCount ? "trend" : "warning",
        text: `${improvedCount} plans improved benefits this year, ${worsenedCount} got worse — ${improvedCount > worsenedCount ? "market is getting more competitive" : "watch for client attrition"}`,
        priority: worsenedCount > improvedCount ? "high" : "medium",
      });
    }

    // Biggest improvement
    let bestChange: { plan: string; field: string; oldVal: string | number; newVal: string | number } | null = null;
    changedPlans.forEach((p) => {
      p.changes.forEach((c) => {
        if (c.direction === "better" && (c.field.toLowerCase().includes("dental") || c.field.toLowerCase().includes("otc") || c.field.toLowerCase().includes("premium"))) {
          bestChange = { plan: p.planName, field: c.field, oldVal: c.oldValue, newVal: c.newValue };
        }
      });
    });
    if (bestChange) {
      items.push({
        icon: "opportunity",
        text: `Biggest improvement: ${(bestChange as { plan: string; field: string; oldVal: string | number; newVal: string | number }).plan} changed ${(bestChange as { plan: string; field: string }).field} from ${(bestChange as { oldVal: string | number }).oldVal} to ${(bestChange as { newVal: string | number }).newVal}`,
        priority: "medium",
      });
    }

    // Terminated plans warning
    if (terminatedPlans.length > 0) {
      items.push({
        icon: "alert",
        text: `Warning: ${terminatedPlans.length} plans terminated — beneficiaries on these plans need new coverage. Proactively reach out.`,
        priority: "high",
      });
    }

    // New plans opportunity
    if (newPlans.length > 0) {
      items.push({
        icon: "opportunity",
        text: `${newPlans.length} new plans entered the market — review for competitive advantages and new client options`,
        priority: "medium",
      });
    }

    return items.slice(0, 5);
  }, [changeData, changedPlans, newPlans, terminatedPlans]);

  const toggleRow = (contractId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };

  const newPlanColumns: Column<Record<string, unknown>>[] = [
    { key: "planName", header: "Plan Name", sortable: true },
    { key: "contractId", header: "Contract ID", sortable: true },
    { key: "county", header: "County", sortable: true },
    { key: "carrier", header: "Carrier", sortable: true },
    {
      key: "premium",
      header: "Premium",
      sortable: true,
      render: (value) => <span className="font-mono">${value as number}</span>,
    },
  ];

  const terminatedPlanColumns: Column<Record<string, unknown>>[] = [
    { key: "planName", header: "Plan Name", sortable: true },
    { key: "contractId", header: "Contract ID", sortable: true },
    { key: "county", header: "County", sortable: true },
    { key: "carrier", header: "Carrier", sortable: true },
    {
      key: "premium",
      header: "Premium",
      sortable: true,
      render: (value) => <span className="font-mono">${value as number}</span>,
    },
  ];

  const handleExport = () => {
    const params = new URLSearchParams({
      scope: "changes",
      year1,
      year2,
    });
    if (carrierFilter && carrierFilter !== "all") params.set("carrier", carrierFilter);
    if (stateFilter && stateFilter !== "all") params.set("state", stateFilter);
    window.open(`/api/export/csv?${params}`, "_blank");
  };

  if (isLoading && submitted) {
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
      <PageHeader
        title="Year-over-Year Changes"
        description="Track what changed between plan years. Essential for ANOC season and client retention."
        helpText="Green = improvement (lower cost or better benefit). Red = worse. New/terminated plans are listed separately."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Plans Compared"
          value={summary.plansCompared}
          icon={<ArrowLeftRight className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="New Plans"
          value={summary.newPlans}
          icon={<FilePlus className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Terminated Plans"
          value={summary.terminatedPlans}
          icon={<FileX className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Plans with Changes"
          value={summary.plansWithChanges}
          icon={<RefreshCw className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Year 1</Label>
              <Select value={year1} onValueChange={(v) => { setYear1(v); setSubmitted(false); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Year 2</Label>
              <Select value={year2} onValueChange={(v) => { setYear2(v); setSubmitted(false); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Carrier (optional)</Label>
              <Select value={carrierFilter} onValueChange={(v) => { setCarrierFilter(v); setSubmitted(false); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All carriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Carriers</SelectItem>
                  {carriers.map((c: any) => (
                    <SelectItem key={c.id ?? c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">State (optional)</Label>
              <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setSubmitted(false); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
                    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
                    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
                    "VA","WA","WV","WI","WY","DC"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setSubmitted(true)}>
              Compare
            </Button>

            {submitted && changeData && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {submitted && changeData && changeInsights.length > 0 && (
        <InsightBox title="Year-over-Year Action Items" insights={changeInsights} />
      )}

      {submitted && changeData && (
        <Card>
          <CardContent className="p-4">
            <Tabs defaultValue="changed">
              <TabsList>
                <TabsTrigger value="changed">
                  Changed Plans ({changedPlans.length})
                </TabsTrigger>
                <TabsTrigger value="new">
                  New Plans ({newPlans.length})
                </TabsTrigger>
                <TabsTrigger value="terminated">
                  Terminated Plans ({terminatedPlans.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="changed" className="mt-4">
                {changedPlans.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No changed plans found.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Plan Name</TableHead>
                          <TableHead>Contract ID</TableHead>
                          <TableHead>County</TableHead>
                          <TableHead className="text-center"># Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {changedPlans.map((plan) => (
                          <Collapsible key={plan.contractId} asChild>
                            <>
                              <CollapsibleTrigger asChild>
                                <TableRow
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => toggleRow(plan.contractId)}
                                >
                                  <TableCell>
                                    <ChevronRight
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        expandedRows.has(plan.contractId) && "rotate-90"
                                      )}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{plan.planName}</TableCell>
                                  <TableCell className="font-mono text-sm">{plan.contractId}</TableCell>
                                  <TableCell>{plan.county}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="secondary">{plan.changeCount}</Badge>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleTrigger>
                              {expandedRows.has(plan.contractId) && (
                                <TableRow>
                                  <TableCell colSpan={5} className="bg-muted/30 p-0">
                                    <div className="p-4">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Field</TableHead>
                                            <TableHead>Old Value ({year1})</TableHead>
                                            <TableHead>New Value ({year2})</TableHead>
                                            <TableHead>Direction</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {plan.changes.map((change, idx) => (
                                            <TableRow key={idx}>
                                              <TableCell className="font-medium">{change.field}</TableCell>
                                              <TableCell className="font-mono text-sm">
                                                {String(change.oldValue)}
                                              </TableCell>
                                              <TableCell className="font-mono text-sm">
                                                {String(change.newValue)}
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  variant={
                                                    change.direction === "better"
                                                      ? "default"
                                                      : change.direction === "worse"
                                                      ? "destructive"
                                                      : "secondary"
                                                  }
                                                  className={cn(
                                                    change.direction === "better" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                                                    change.direction === "worse" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                  )}
                                                >
                                                  {change.direction === "better" ? "Improved" : change.direction === "worse" ? "Worse" : "Changed"}
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          </Collapsible>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="new" className="mt-4">
                <DataTable
                  data={newPlans as unknown as Record<string, unknown>[]}
                  columns={newPlanColumns}
                  searchPlaceholder="Search new plans..."
                  pageSize={10}
                />
              </TabsContent>

              <TabsContent value="terminated" className="mt-4">
                <DataTable
                  data={terminatedPlans as unknown as Record<string, unknown>[]}
                  columns={terminatedPlanColumns}
                  searchPlaceholder="Search terminated plans..."
                  pageSize={10}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!submitted && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Select years and click Compare</p>
            <p className="text-sm mt-1">Compare plan benefits across different years to identify changes</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
