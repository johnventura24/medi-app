import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import {
  AlertTriangle,
  XCircle,
  MapPinOff,
  MapPinPlus,
  GitMerge,
  Sparkles,
  Download,
  ExternalLink,
  Star,
  Users,
  TrendingUp,
  ArrowRight,
  Building2,
  Search,
} from "lucide-react";

// ── Types ──

interface CrosswalkEntry {
  previousContractId: string;
  previousPlanId: string;
  previousPlanName: string;
  currentContractId: string;
  currentPlanId: string;
  currentPlanName: string;
  status: string;
  previousSnpType: string;
  currentSnpType: string;
  previousEnrollment?: number;
  previousStarRating?: number;
  previousCarrier?: string;
  currentCarrier?: string;
  affectedStates?: string[];
  affectedCounties?: number;
  previousPremium?: number;
}

interface CrosswalkSummary {
  totalPlans: number;
  terminated: number;
  serviceAreaReduction: number;
  serviceAreaExpansion: number;
  consolidated: number;
  newPlans: number;
  initialContracts: number;
  renewals: number;
  estimatedAffectedMembers: number;
  topAffectedStates: Array<{ state: string; affected: number }>;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR",
];

// ── CSV Export helper ──

function downloadCSV(data: CrosswalkEntry[], filename: string) {
  const headers = [
    "Previous Contract ID",
    "Previous Plan ID",
    "Previous Plan Name",
    "Carrier",
    "Status",
    "Current Contract ID",
    "Current Plan ID",
    "Current Plan Name",
    "Star Rating",
    "Est. Enrollment",
    "States",
    "Counties",
    "SNP Type",
  ];

  const rows = data.map((e) => [
    e.previousContractId,
    e.previousPlanId,
    `"${(e.previousPlanName || "").replace(/"/g, '""')}"`,
    `"${(e.previousCarrier || e.currentCarrier || "").replace(/"/g, '""')}"`,
    `"${e.status}"`,
    e.currentContractId,
    e.currentPlanId,
    `"${(e.currentPlanName || "").replace(/"/g, '""')}"`,
    e.previousStarRating ?? "",
    e.previousEnrollment ?? "",
    (e.affectedStates || []).join(";"),
    e.affectedCounties ?? "",
    e.previousSnpType || e.currentSnpType || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Stat Card Component ──

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={`p-3 rounded-full bg-muted`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Star display ──

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-muted-foreground text-sm">--</span>;
  const color =
    rating >= 4 ? "text-emerald-600" : rating >= 3 ? "text-amber-500" : "text-red-500";
  return (
    <span className={`flex items-center gap-1 font-medium ${color}`}>
      <Star className="h-3.5 w-3.5 fill-current" />
      {rating.toFixed(1)}
    </span>
  );
}

// ── Main Component ──

export default function CrosswalkTracker() {
  const [, navigate] = useLocation();
  const [selectedState, setSelectedState] = useState<string>("");
  const [activeTab, setActiveTab] = useState("terminated");

  const stateParam = selectedState || undefined;

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery<CrosswalkSummary>({
    queryKey: ["/api/crosswalk/summary", stateParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/crosswalk/summary?${params}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: terminated, isLoading: terminatedLoading } = useQuery<CrosswalkEntry[]>({
    queryKey: ["/api/crosswalk/terminated", stateParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/crosswalk/terminated?${params}`);
      if (!res.ok) throw new Error("Failed to fetch terminated");
      return res.json();
    },
    enabled: activeTab === "terminated",
  });

  const { data: sarPlans, isLoading: sarLoading } = useQuery<CrosswalkEntry[]>({
    queryKey: ["/api/crosswalk/sar", stateParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/crosswalk/sar?${params}`);
      if (!res.ok) throw new Error("Failed to fetch SAR");
      return res.json();
    },
    enabled: activeTab === "sar",
  });

  const { data: newPlans, isLoading: newLoading } = useQuery<CrosswalkEntry[]>({
    queryKey: ["/api/crosswalk/new", stateParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/crosswalk/new?${params}`);
      if (!res.ok) throw new Error("Failed to fetch new plans");
      return res.json();
    },
    enabled: activeTab === "new",
  });

  const { data: saePlans, isLoading: saeLoading } = useQuery<CrosswalkEntry[]>({
    queryKey: ["/api/crosswalk/sae", stateParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/crosswalk/sae?${params}`);
      if (!res.ok) throw new Error("Failed to fetch SAE");
      return res.json();
    },
    enabled: activeTab === "sae",
  });

  const { data: consolidated, isLoading: consolidatedLoading } = useQuery<CrosswalkEntry[]>({
    queryKey: ["/api/crosswalk/consolidated", stateParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/crosswalk/consolidated?${params}`);
      if (!res.ok) throw new Error("Failed to fetch consolidated");
      return res.json();
    },
    enabled: activeTab === "consolidated",
  });

  // Insights
  const terminatedInsights: InsightItem[] = summary
    ? [
        {
          icon: "alert",
          text: `${summary.terminated.toLocaleString()} plans terminated for 2026. ~${summary.estimatedAffectedMembers.toLocaleString()} members need new plans. Contact them before auto-enrollment kicks in.`,
          priority: "high",
        },
        {
          icon: "opportunity",
          text: `Every terminated plan member gets a Special Enrollment Period. These are warm leads — they MUST choose a new plan.`,
          priority: "high",
        },
        {
          icon: "target",
          text: summary.topAffectedStates.length > 0
            ? `Most affected: ${summary.topAffectedStates.slice(0, 3).map((s) => `${s.state} (~${s.affected.toLocaleString()} members)`).join(", ")}`
            : "Use the state filter to focus on your market.",
          priority: "medium",
        },
      ]
    : [];

  const sarInsights: InsightItem[] = [
    {
      icon: "warning",
      text: `${summary?.serviceAreaReduction.toLocaleString() ?? "733"} plans reduced their service area. Members in dropped counties get a SEP.`,
      priority: "high",
    },
    {
      icon: "opportunity",
      text: "Check which counties were dropped. Members there are actively looking for alternatives — reach them first.",
      priority: "medium",
    },
  ];

  const newPlanInsights: InsightItem[] = [
    {
      icon: "opportunity",
      text: `${summary?.newPlans.toLocaleString() ?? "868"} new plans and ${summary?.initialContracts.toLocaleString() ?? "127"} new carrier contracts for 2026. New competition = better benefits for your clients.`,
      priority: "medium",
    },
    {
      icon: "trend",
      text: "New market entrants often launch with aggressive benefits to build enrollment. Compare these against incumbents.",
      priority: "low",
    },
  ];

  const saeInsights: InsightItem[] = [
    {
      icon: "opportunity",
      text: `${summary?.serviceAreaExpansion.toLocaleString() ?? "515"} plans expanded into new counties. Clients who couldn't access them before now can.`,
      priority: "medium",
    },
    {
      icon: "target",
      text: "Cross-reference expanded plans with your client locations to find new matches.",
      priority: "low",
    },
  ];

  const consolidatedInsights: InsightItem[] = [
    {
      icon: "warning",
      text: `${summary?.consolidated.toLocaleString() ?? "746"} plans merged into other plans. Members are auto-moved but may want alternatives.`,
      priority: "medium",
    },
    {
      icon: "opportunity",
      text: "Consolidated members may see benefit changes. Review the new plan details and proactively reach out.",
      priority: "medium",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Crosswalk Tracker"
        description="CMS Plan Crosswalk 2026 — Track every plan termination, service area change, and new market entrant. The data Medicare Market Insights charges $100/month for."
        badge="2025 to 2026"
        helpText="The CMS Crosswalk file maps every Medicare Advantage plan from the previous year to the current year. It shows which plans were terminated, which reduced or expanded their service areas, and which are brand new. This is the single most important dataset for identifying disrupted members who need new coverage."
        actions={
          <Select
            value={selectedState}
            onValueChange={(v) => setSelectedState(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {US_STATES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Summary Stats */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Terminated Plans"
            value={summary.terminated}
            description="Plans gone for 2026. Members must switch."
            icon={XCircle}
            color="text-red-600"
          />
          <StatCard
            title="Area Reductions"
            value={summary.serviceAreaReduction}
            description="Plans that left some counties"
            icon={MapPinOff}
            color="text-amber-600"
          />
          <StatCard
            title="New Plans"
            value={summary.newPlans + summary.initialContracts}
            description={`${summary.newPlans} new plans + ${summary.initialContracts} new carriers`}
            icon={Sparkles}
            color="text-emerald-600"
          />
          <StatCard
            title="Est. Affected Members"
            value={summary.estimatedAffectedMembers}
            description="From terminated + SAR plans"
            icon={Users}
            color="text-blue-600"
          />
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="terminated" className="gap-1.5">
            <XCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Terminated</span>
            <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
              {summary?.terminated ?? "..."}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sar" className="gap-1.5">
            <MapPinOff className="h-4 w-4" />
            <span className="hidden sm:inline">Area Reductions</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {summary?.serviceAreaReduction ?? "..."}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">New Entrants</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {(summary?.newPlans ?? 0) + (summary?.initialContracts ?? 0) || "..."}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sae" className="gap-1.5">
            <MapPinPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Expansions</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {summary?.serviceAreaExpansion ?? "..."}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="consolidated" className="gap-1.5">
            <GitMerge className="h-4 w-4" />
            <span className="hidden sm:inline">Consolidated</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {summary?.consolidated ?? "..."}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Terminated Plans ── */}
        <TabsContent value="terminated" className="space-y-4">
          <InsightBox
            title="Agent Intelligence: Terminated Plans"
            insights={terminatedInsights}
            variant="briefing"
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {terminated?.length ?? 0} terminated plans
              {selectedState ? ` in ${selectedState}` : ""} sorted by estimated enrollment
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => terminated && downloadCSV(terminated, "terminated-plans")}
              disabled={!terminated || terminated.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {terminatedLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Previous Plan</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Est. Members</TableHead>
                      <TableHead>Stars</TableHead>
                      <TableHead>States</TableHead>
                      <TableHead>Crosswalked To</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(terminated || []).slice(0, 100).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[250px]">
                              {entry.previousPlanName || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.previousContractId}-{entry.previousPlanId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[180px] block">
                            {entry.previousCarrier || entry.currentCarrier || "--"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {entry.previousEnrollment
                            ? entry.previousEnrollment.toLocaleString()
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <StarRating rating={entry.previousStarRating} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(entry.affectedStates || []).map((st) => (
                              <Badge key={st} variant="outline" className="text-xs">
                                {st}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.currentPlanName ? (
                            <div>
                              <p className="text-sm truncate max-w-[200px]">
                                {entry.currentPlanName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.currentContractId}-{entry.currentPlanId}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              No crosswalk
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/find?contractId=${entry.previousContractId}`
                              )
                            }
                          >
                            <Search className="h-3.5 w-3.5 mr-1" />
                            Alternatives
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!terminated || terminated.length === 0) && !terminatedLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No terminated plans found{selectedState ? ` in ${selectedState}` : ""}.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {terminated && terminated.length > 100 && (
                <div className="p-4 border-t text-center text-sm text-muted-foreground">
                  Showing 100 of {terminated.length} plans. Export CSV for the full list.
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: Service Area Reductions ── */}
        <TabsContent value="sar" className="space-y-4">
          <InsightBox
            title="Agent Intelligence: Service Area Reductions"
            insights={sarInsights}
            variant="briefing"
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {sarPlans?.length ?? 0} plans with service area reductions
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sarPlans && downloadCSV(sarPlans, "service-area-reductions")}
              disabled={!sarPlans || sarPlans.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {sarLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan Name</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Stars</TableHead>
                      <TableHead className="text-right">Est. Members</TableHead>
                      <TableHead>States</TableHead>
                      <TableHead>Counties</TableHead>
                      <TableHead>SNP Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sarPlans || []).slice(0, 100).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[250px]">
                              {entry.previousPlanName || entry.currentPlanName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.previousContractId}-{entry.previousPlanId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.previousCarrier || entry.currentCarrier || "--"}
                        </TableCell>
                        <TableCell>
                          <StarRating rating={entry.previousStarRating} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {entry.previousEnrollment?.toLocaleString() ?? "--"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(entry.affectedStates || []).map((st) => (
                              <Badge key={st} variant="outline" className="text-xs">
                                {st}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{entry.affectedCounties ?? "--"}</TableCell>
                        <TableCell>
                          {entry.previousSnpType ? (
                            <Badge variant="secondary" className="text-xs">
                              {entry.previousSnpType}
                            </Badge>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!sarPlans || sarPlans.length === 0) && !sarLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No service area reductions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {sarPlans && sarPlans.length > 100 && (
                <div className="p-4 border-t text-center text-sm text-muted-foreground">
                  Showing 100 of {sarPlans.length} plans. Export CSV for the full list.
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 3: New Market Entrants ── */}
        <TabsContent value="new" className="space-y-4">
          <InsightBox
            title="Agent Intelligence: New Market Entrants"
            insights={newPlanInsights}
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {newPlans?.length ?? 0} new plans and carrier contracts
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => newPlans && downloadCSV(newPlans, "new-plans-2026")}
              disabled={!newPlans || newPlans.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {newLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>New Plan Name</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>States</TableHead>
                      <TableHead>SNP Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(newPlans || []).slice(0, 100).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[280px]">
                              {entry.currentPlanName || "TBD"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.currentContractId}-{entry.currentPlanId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.currentCarrier || "--"}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {entry.currentContractId}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.status === "Initial Contract" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {entry.status === "Initial Contract"
                              ? "New Carrier"
                              : "New Plan"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(entry.affectedStates || []).map((st) => (
                              <Badge key={st} variant="outline" className="text-xs">
                                {st}
                              </Badge>
                            ))}
                            {(!entry.affectedStates || entry.affectedStates.length === 0) && (
                              <span className="text-muted-foreground text-xs">--</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.currentSnpType ? (
                            <Badge variant="secondary" className="text-xs">
                              {entry.currentSnpType}
                            </Badge>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!newPlans || newPlans.length === 0) && !newLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No new plans found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {newPlans && newPlans.length > 100 && (
                <div className="p-4 border-t text-center text-sm text-muted-foreground">
                  Showing 100 of {newPlans.length} plans. Export CSV for the full list.
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 4: Service Area Expansions ── */}
        <TabsContent value="sae" className="space-y-4">
          <InsightBox
            title="Agent Intelligence: Service Area Expansions"
            insights={saeInsights}
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {saePlans?.length ?? 0} plans with service area expansions
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => saePlans && downloadCSV(saePlans, "service-area-expansions")}
              disabled={!saePlans || saePlans.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {saeLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan Name</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Stars</TableHead>
                      <TableHead>States</TableHead>
                      <TableHead>Counties</TableHead>
                      <TableHead>SNP Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(saePlans || []).slice(0, 100).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[280px]">
                              {entry.currentPlanName || entry.previousPlanName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.currentContractId}-{entry.currentPlanId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.currentCarrier || entry.previousCarrier || "--"}
                        </TableCell>
                        <TableCell>
                          <StarRating rating={entry.previousStarRating} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(entry.affectedStates || []).map((st) => (
                              <Badge key={st} variant="outline" className="text-xs">
                                {st}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{entry.affectedCounties ?? "--"}</TableCell>
                        <TableCell>
                          {entry.currentSnpType ? (
                            <Badge variant="secondary" className="text-xs">
                              {entry.currentSnpType}
                            </Badge>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!saePlans || saePlans.length === 0) && !saeLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No service area expansions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {saePlans && saePlans.length > 100 && (
                <div className="p-4 border-t text-center text-sm text-muted-foreground">
                  Showing 100 of {saePlans.length} plans. Export CSV for the full list.
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 5: Consolidated Plans ── */}
        <TabsContent value="consolidated" className="space-y-4">
          <InsightBox
            title="Agent Intelligence: Plan Consolidations"
            insights={consolidatedInsights}
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {consolidated?.length ?? 0} consolidated plans
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                consolidated && downloadCSV(consolidated, "consolidated-plans")
              }
              disabled={!consolidated || consolidated.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {consolidatedLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Previous Plan</TableHead>
                      <TableHead className="text-center">
                        <ArrowRight className="h-4 w-4 mx-auto" />
                      </TableHead>
                      <TableHead>Current Plan</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Est. Members</TableHead>
                      <TableHead>States</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(consolidated || []).slice(0, 100).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[220px]">
                              {entry.previousPlanName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.previousContractId}-{entry.previousPlanId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[220px]">
                              {entry.currentPlanName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.currentContractId}-{entry.currentPlanId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.previousCarrier || entry.currentCarrier || "--"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {entry.previousEnrollment?.toLocaleString() ?? "--"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(entry.affectedStates || []).map((st) => (
                              <Badge key={st} variant="outline" className="text-xs">
                                {st}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!consolidated || consolidated.length === 0) && !consolidatedLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No consolidated plans found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {consolidated && consolidated.length > 100 && (
                <div className="p-4 border-t text-center text-sm text-muted-foreground">
                  Showing 100 of {consolidated.length} plans. Export CSV for the full list.
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
