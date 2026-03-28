import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  Building2,
  DollarSign,
  Heart,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  Users,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──

interface ACAPlan {
  id: number;
  planId: string;
  planName: string;
  issuerName: string;
  metalLevel: string | null;
  planType: string | null;
  state: string;
  county: string | null;
  premiumAge27: number | null;
  premiumAge40: number | null;
  premiumAge60: number | null;
  deductibleIndividual: number | null;
  deductibleFamily: number | null;
  moopIndividual: number | null;
  moopFamily: number | null;
  ehbPct: number | null;
  hsaEligible: boolean | null;
  planYear: number | null;
}

interface ACAMarketSummary {
  totalPlans: number;
  issuers: number;
  avgPremiums: { bronze: number; silver: number; gold: number; platinum: number };
  metalDistribution: Record<string, number>;
  topIssuers: Array<{ name: string; planCount: number }>;
  avgDeductible: number;
  avgMoop: number;
  planTypeDistribution: Record<string, number>;
}

interface ACAvsMAComparison {
  acaPlans: number;
  maPlans: number;
  avgAcaPremium: number;
  avgMaPremium: number;
  avgAcaDeductible: number;
  acaIssuers: number;
  maCarriers: number;
  insight: string;
}

// Metal level colors
const METAL_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  Platinum: "#E5E4E2",
  Catastrophic: "#6B7280",
};

const METAL_BG: Record<string, string> = {
  Bronze: "bg-[#CD7F32]/15 text-[#8B5A2B] border-[#CD7F32]/30",
  Silver: "bg-gray-200/60 text-gray-700 border-gray-300",
  Gold: "bg-[#FFD700]/15 text-[#B8860B] border-[#FFD700]/30",
  Platinum: "bg-[#E5E4E2]/30 text-gray-600 border-[#E5E4E2]/50",
  Catastrophic: "bg-gray-100 text-gray-500 border-gray-200",
};

const PIE_COLORS = ["#CD7F32", "#C0C0C0", "#FFD700", "#E5E4E2", "#6B7280"];

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function formatDollars(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPremium(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MetalBadge({ level }: { level: string | null }) {
  if (!level) return <Badge variant="outline">Unknown</Badge>;
  const classes = METAL_BG[level] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <Badge className={`${classes} border font-medium`}>
      {level}
    </Badge>
  );
}

export default function ACAMarketplace() {
  const [selectedState, setSelectedState] = useState<string>("CA");
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [selectedMetal, setSelectedMetal] = useState<string>("all");

  // Fetch available states
  const { data: states } = useQuery<string[]>({
    queryKey: ["/api/aca/states"],
    queryFn: async () => {
      const res = await fetch("/api/aca/states");
      if (!res.ok) throw new Error("Failed to fetch states");
      return res.json();
    },
  });

  // Fetch counties for selected state
  const { data: counties } = useQuery<string[]>({
    queryKey: ["/api/aca/counties", selectedState],
    queryFn: async () => {
      const res = await fetch(`/api/aca/counties?state=${selectedState}`);
      if (!res.ok) throw new Error("Failed to fetch counties");
      return res.json();
    },
    enabled: !!selectedState,
  });

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery<ACAMarketSummary>({
    queryKey: ["/api/aca/summary", selectedState],
    queryFn: async () => {
      const res = await fetch(`/api/aca/summary?state=${selectedState}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!selectedState,
  });

  // Fetch plans
  const planParams = new URLSearchParams();
  if (selectedState) planParams.set("state", selectedState);
  if (selectedCounty) planParams.set("county", selectedCounty);
  if (selectedMetal && selectedMetal !== "all") planParams.set("metalLevel", selectedMetal);
  planParams.set("limit", "100");

  const { data: planData, isLoading: plansLoading } = useQuery<{ plans: ACAPlan[]; total: number }>({
    queryKey: ["/api/aca/plans", selectedState, selectedCounty, selectedMetal],
    queryFn: async () => {
      const res = await fetch(`/api/aca/plans?${planParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    enabled: !!selectedState,
  });

  // Fetch comparison (only when county is selected)
  const { data: comparison, isLoading: comparisonLoading } = useQuery<ACAvsMAComparison>({
    queryKey: ["/api/aca/compare", selectedState, selectedCounty],
    queryFn: async () => {
      const res = await fetch(`/api/aca/compare?state=${selectedState}&county=${selectedCounty}`);
      if (!res.ok) throw new Error("Failed to fetch comparison");
      return res.json();
    },
    enabled: !!selectedState && !!selectedCounty,
  });

  // Prepare chart data
  const metalPieData = useMemo(() => {
    if (!summary?.metalDistribution) return [];
    const order = ["Bronze", "Silver", "Gold", "Platinum", "Catastrophic"];
    return order
      .filter(m => summary.metalDistribution[m])
      .map(m => ({ name: m, value: summary.metalDistribution[m] }));
  }, [summary]);

  const premiumBarData = useMemo(() => {
    if (!summary?.avgPremiums) return [];
    return [
      { name: "Bronze", premium: summary.avgPremiums.bronze },
      { name: "Silver", premium: summary.avgPremiums.silver },
      { name: "Gold", premium: summary.avgPremiums.gold },
      { name: "Platinum", premium: summary.avgPremiums.platinum },
    ].filter(d => d.premium > 0);
  }, [summary]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="ACA Marketplace Plans"
        description="Qualified Health Plan data from the federal marketplace — covering individual and family plans across all 50 states"
        badge="ACA / QHP"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">State</label>
          <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedCounty(""); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {(states || []).map((st) => (
                <SelectItem key={st} value={st}>
                  {STATE_NAMES[st] || st} ({st})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">County</label>
          <Select value={selectedCounty} onValueChange={setSelectedCounty}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All counties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_counties">All Counties</SelectItem>
              {(counties || []).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Metal Level</label>
          <Select value={selectedMetal} onValueChange={setSelectedMetal}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="Bronze">Bronze</SelectItem>
              <SelectItem value="Silver">Silver</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
              <SelectItem value="Platinum">Platinum</SelectItem>
              <SelectItem value="Catastrophic">Catastrophic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total QHP Plans</p>
                {summaryLoading ? (
                  <Skeleton className="h-7 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{(summary?.totalPlans || 0).toLocaleString()}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Issuers</p>
                {summaryLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{summary?.issuers || 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Bronze Premium</p>
                {summaryLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{formatDollars(summary?.avgPremiums?.bronze)}/mo</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Silver Premium</p>
                {summaryLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{formatDollars(summary?.avgPremiums?.silver)}/mo</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metal Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metal Level Distribution</CardTitle>
            <CardDescription>Plan count by metal tier in {STATE_NAMES[selectedState] || selectedState}</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : metalPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={metalPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {metalPieData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={METAL_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                        stroke="rgba(0,0,0,0.1)"
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Average Premiums by Metal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average Monthly Premium (Age 40)</CardTitle>
            <CardDescription>By metal level in {STATE_NAMES[selectedState] || selectedState}</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : premiumBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={premiumBarData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [`$${value}`, "Avg Premium"]} />
                  <Bar dataKey="premium" radius={[4, 4, 0, 0]}>
                    {premiumBarData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={METAL_COLORS[entry.name] || "#8884d8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Issuers */}
      {summary && summary.topIssuers && summary.topIssuers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Issuers in {STATE_NAMES[selectedState] || selectedState}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {summary.topIssuers.map((issuer) => (
                <div key={issuer.name} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{issuer.name}</span>
                  <Badge variant="secondary" className="text-xs">{issuer.planCount} plans</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACA vs MA Comparison */}
      {selectedCounty && selectedCounty !== "all_counties" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">ACA vs Medicare Advantage in {selectedCounty}</CardTitle>
            </div>
            <CardDescription>Comparing individual market (ACA) with Medicare Advantage plans</CardDescription>
          </CardHeader>
          <CardContent>
            {comparisonLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : comparison ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">ACA Plans</p>
                    <p className="text-xl font-bold text-blue-600">{comparison.acaPlans}</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">MA Plans</p>
                    <p className="text-xl font-bold text-emerald-600">{comparison.maPlans}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Avg ACA Premium</p>
                    <p className="text-xl font-bold text-blue-600">{formatDollars(comparison.avgAcaPremium)}/mo</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Avg MA Premium</p>
                    <p className="text-xl font-bold text-emerald-600">{formatDollars(comparison.avgMaPremium)}/mo</p>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm leading-relaxed">{comparison.insight}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Select a county to see the comparison</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">ACA Marketplace Plans</CardTitle>
              <CardDescription>
                {planData
                  ? `Showing ${planData.plans.length} of ${planData.total.toLocaleString()} plans`
                  : "Loading plans..."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : planData && planData.plans.length > 0 ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Plan Name</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Metal Level</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Premium (40)</TableHead>
                    <TableHead className="text-right">Deductible</TableHead>
                    <TableHead className="text-right">MOOP</TableHead>
                    <TableHead>County</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planData.plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[280px]" title={plan.planName}>
                            {plan.planName}
                          </p>
                          <p className="text-xs text-muted-foreground">{plan.planId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{plan.issuerName}</TableCell>
                      <TableCell><MetalBadge level={plan.metalLevel} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{plan.planType || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPremium(plan.premiumAge40)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatDollars(plan.deductibleIndividual)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatDollars(plan.moopIndividual)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {plan.county || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No ACA plans found for the selected filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your state, county, or metal level filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost overview row */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Deductible (Individual)</p>
              <p className="text-2xl font-bold mt-1">{formatDollars(summary.avgDeductible)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Max Out-of-Pocket</p>
              <p className="text-2xl font-bold mt-1">{formatDollars(summary.avgMoop)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Network Types</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(summary.planTypeDistribution || {}).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}: {(count as number).toLocaleString()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
