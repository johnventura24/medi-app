import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  ShieldCheck,
  Building2,
  DollarSign,
  Heart,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  Calculator,
  BarChart3,
  Map,
  CheckCircle2,
  AlertCircle,
  Sparkles,
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

interface SubsidyCalculation {
  income: number;
  householdSize: number;
  fplPercent: number;
  state: string;
  county: string | null;
  benchmarkPremium: number;
  benchmarkPlanName: string | null;
  expectedContribution: number;
  monthlyContribution: number;
  monthlySubsidy: number;
  annualSubsidy: number;
  effectivePremiums: Array<{
    planId: string;
    planName: string;
    issuer: string;
    metalLevel: string;
    planType: string | null;
    fullPremium: number;
    afterSubsidy: number;
    monthlySavings: number;
    deductible: number | null;
    moop: number | null;
  }>;
  csrEligible: boolean;
  csrLevel: string | null;
  zeroPremiuPlansCount: number;
  under50Count: number;
}

interface CarrierRanking {
  carrier: string;
  planCount: number;
  avgPremium: number;
  avgDeductible: number;
  avgMoop: number;
  valueScore: number;
}

interface CarrierAnalysis {
  carrier: string;
  states: number;
  totalPlans: number;
  metalBreakdown: Record<string, number>;
  avgPremiums: { bronze: number; silver: number; gold: number; platinum: number };
  avgDeductible: number;
  avgMoop: number;
  valueScore: number;
  bestState: { state: string; avgPremium: number };
  worstState: { state: string; avgPremium: number };
}

interface SubsidyMapEntry {
  state: string;
  benchmarkSilverPremium: number;
  avgBronzePremium: number;
  subsidyAt30K: number;
  subsidyAt50K: number;
  bronzeAfterSubsidyAt30K: number;
  zeroPremiumPlansAt30K: number;
  freeOrCheapCount: number;
}

// Metal level colors
const METAL_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  "Expanded Bronze": "#B87333",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  Platinum: "#E5E4E2",
  Catastrophic: "#6B7280",
};

const METAL_BG: Record<string, string> = {
  Bronze: "bg-[#CD7F32]/15 text-[#8B5A2B] border-[#CD7F32]/30",
  "Expanded Bronze": "bg-[#CD7F32]/15 text-[#8B5A2B] border-[#CD7F32]/30",
  Silver: "bg-gray-200/60 text-gray-700 border-gray-300",
  Gold: "bg-[#FFD700]/15 text-[#B8860B] border-[#FFD700]/30",
  Platinum: "bg-[#E5E4E2]/30 text-gray-600 border-[#E5E4E2]/50",
  Catastrophic: "bg-gray-100 text-gray-500 border-gray-200",
};

const PIE_COLORS = ["#CD7F32", "#B87333", "#C0C0C0", "#FFD700", "#E5E4E2", "#6B7280"];

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

function ValueScoreBadge({ score }: { score: number }) {
  let color = "bg-red-100 text-red-700 border-red-200";
  if (score >= 70) color = "bg-emerald-100 text-emerald-700 border-emerald-200";
  else if (score >= 50) color = "bg-yellow-100 text-yellow-700 border-yellow-200";
  else if (score >= 30) color = "bg-orange-100 text-orange-700 border-orange-200";
  return <Badge className={`${color} border font-bold`}>{score}</Badge>;
}

// ══════════════════════════════════════════════════════
// SUBSIDY CALCULATOR TAB
// ══════════════════════════════════════════════════════

function SubsidyCalculatorTab({ states, counties, selectedState, setSelectedState }: {
  states: string[] | undefined;
  counties: string[] | undefined;
  selectedState: string;
  setSelectedState: (s: string) => void;
}) {
  const [income, setIncome] = useState("35000");
  const [householdSize, setHouseholdSize] = useState("1");
  const [age, setAge] = useState("35");
  const [subsidyState, setSubsidyState] = useState(selectedState);
  const [subsidyCounty, setSubsidyCounty] = useState("");

  const { data: subsidyCounties } = useQuery<string[]>({
    queryKey: ["/api/aca/counties", subsidyState],
    queryFn: async () => {
      const res = await fetch(`/api/aca/counties?state=${subsidyState}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!subsidyState,
  });

  const subsidyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/aca/subsidy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income: Number(income),
          householdSize: Number(householdSize),
          age: Number(age),
          state: subsidyState,
          county: subsidyCounty || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to calculate subsidy");
      return res.json() as Promise<SubsidyCalculation>;
    },
  });

  const result = subsidyMutation.data;

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-base">ACA Premium Subsidy Calculator</CardTitle>
          </div>
          <CardDescription>
            Estimate your monthly premium tax credit (APTC) based on income, household size, and location.
            Uses 2026 Federal Poverty Level guidelines and ACA sliding-scale contribution rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="income">Annual Household Income</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="income"
                  type="number"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  className="pl-9"
                  placeholder="35000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Household Size</Label>
              <Select value={householdSize} onValueChange={setHouseholdSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? "person" : "people"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Your Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                min={0}
                max={64}
                placeholder="35"
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Select value={subsidyState} onValueChange={v => { setSubsidyState(v); setSubsidyCounty(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {(states || []).map(st => (
                    <SelectItem key={st} value={st}>
                      {STATE_NAMES[st] || st} ({st})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>County (optional)</Label>
              <Select value={subsidyCounty} onValueChange={setSubsidyCounty}>
                <SelectTrigger>
                  <SelectValue placeholder="All counties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_counties_subsidy">All Counties</SelectItem>
                  {(subsidyCounties || []).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => subsidyMutation.mutate()}
                disabled={subsidyMutation.isPending || !income || !subsidyState}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {subsidyMutation.isPending ? "Calculating..." : "Calculate My Subsidy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Big number cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Your Monthly Subsidy</p>
                <p className="text-3xl font-bold text-emerald-600">{formatPremium(result.monthlySubsidy)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDollars(result.annualSubsidy)}/year</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">FPL Percentage</p>
                <p className="text-2xl font-bold">{result.fplPercent}%</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {result.fplPercent <= 150 ? "Very Low Income" :
                   result.fplPercent <= 200 ? "Low Income" :
                   result.fplPercent <= 300 ? "Moderate Income" :
                   result.fplPercent <= 400 ? "Middle Income" : "Above 400% FPL"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Your Monthly Contribution</p>
                <p className="text-2xl font-bold">{formatPremium(result.monthlyContribution)}</p>
                <p className="text-xs text-muted-foreground mt-1">Expected for benchmark Silver</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Benchmark Silver Premium</p>
                <p className="text-2xl font-bold">{formatPremium(result.benchmarkPremium)}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate" title={result.benchmarkPlanName || ""}>
                  {result.benchmarkPlanName || "2nd lowest Silver plan"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CSR & Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.csrEligible && (
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-700 dark:text-blue-400">CSR Eligible</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        You qualify for Cost-Sharing Reductions on Silver plans.
                        Silver plans will have {result.csrLevel} actuarial value
                        (lower deductibles, copays, and out-of-pocket costs).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.zeroPremiuPlansCount > 0 && (
              <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {result.zeroPremiuPlansCount} Free Plans Available
                      </p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-300">
                        You could get {result.zeroPremiuPlansCount} plan{result.zeroPremiuPlansCount !== 1 ? "s" : ""} for
                        $0/month after your subsidy is applied.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.under50Count > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        {result.under50Count} Plans Under $50/mo
                      </p>
                      <p className="text-sm text-amber-600 dark:text-amber-300">
                        Plus {result.under50Count} additional plans available for under $50/month after subsidy.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Plan table with subsidies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plans After Subsidy</CardTitle>
              <CardDescription>
                Showing {result.effectivePremiums.length} plans sorted by post-subsidy premium.
                Green rows indicate $0 premium plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px] sticky top-0 bg-background">Plan Name</TableHead>
                      <TableHead className="sticky top-0 bg-background">Issuer</TableHead>
                      <TableHead className="sticky top-0 bg-background">Metal</TableHead>
                      <TableHead className="sticky top-0 bg-background">Type</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">Full Premium</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">After Subsidy</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">You Save</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">Deductible</TableHead>
                      <TableHead className="text-right sticky top-0 bg-background">MOOP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.effectivePremiums.map((plan) => {
                      const isFree = plan.afterSubsidy === 0;
                      const isCheap = plan.afterSubsidy > 0 && plan.afterSubsidy <= 50;
                      return (
                        <TableRow
                          key={plan.planId}
                          className={
                            isFree
                              ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                              : isCheap
                              ? "bg-green-50/50 dark:bg-green-950/10 hover:bg-green-100/50"
                              : ""
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isFree && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                              <div>
                                <p className="font-medium text-sm truncate max-w-[220px]" title={plan.planName}>
                                  {plan.planName}
                                </p>
                                <p className="text-xs text-muted-foreground">{plan.planId}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{plan.issuer}</TableCell>
                          <TableCell><MetalBadge level={plan.metalLevel} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{plan.planType || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground line-through">
                            {formatPremium(plan.fullPremium)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${isFree ? "text-emerald-600" : ""}`}>
                            {isFree ? "$0.00" : formatPremium(plan.afterSubsidy)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-emerald-600">
                            -{formatPremium(plan.monthlySavings)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatDollars(plan.deductible)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatDollars(plan.moop)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {subsidyMutation.isError && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>Error calculating subsidy. Please check your inputs and try again.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// CARRIER RANKINGS TAB
// ══════════════════════════════════════════════════════

function CarrierRankingsTab({ states }: { states: string[] | undefined }) {
  const [rankState, setRankState] = useState("all");
  const [rankMetal, setRankMetal] = useState("Silver");
  const [sortField, setSortField] = useState<keyof CarrierRanking>("valueScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: rankings, isLoading } = useQuery<CarrierRanking[]>({
    queryKey: ["/api/aca/carrier-rankings", rankState, rankMetal],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rankMetal) params.set("metalLevel", rankMetal);
      if (rankState && rankState !== "all") params.set("state", rankState);
      const res = await fetch(`/api/aca/carrier-rankings?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: carrierAnalysis } = useQuery<CarrierAnalysis[]>({
    queryKey: ["/api/aca/carrier-analysis"],
    queryFn: async () => {
      const res = await fetch("/api/aca/carrier-analysis");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const sorted = useMemo(() => {
    if (!rankings) return [];
    return [...rankings].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [rankings, sortField, sortDir]);

  function toggleSort(field: keyof CarrierRanking) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "carrier" ? "asc" : "desc");
    }
  }

  const bestCarrier = sorted.length > 0 ? sorted[0] : null;

  // Top carriers by coverage breadth
  const topMultiState = useMemo(() => {
    if (!carrierAnalysis) return null;
    return carrierAnalysis
      .filter(c => c.states >= 3)
      .sort((a, b) => b.states - a.states)
      .slice(0, 5);
  }, [carrierAnalysis]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5">
          <Label>State</Label>
          <Select value={rankState} onValueChange={setRankState}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {(states || []).map(st => (
                <SelectItem key={st} value={st}>{STATE_NAMES[st] || st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Metal Level</Label>
          <Select value={rankMetal} onValueChange={setRankMetal}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bronze">Bronze</SelectItem>
              <SelectItem value="Silver">Silver</SelectItem>
              <SelectItem value="Gold">Gold</SelectItem>
              <SelectItem value="Platinum">Platinum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Insight */}
      {bestCarrier && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Best value{rankState !== "all" ? ` in ${STATE_NAMES[rankState] || rankState}` : " nationally"}:{" "}
                  {bestCarrier.carrier}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-300">
                  Average {rankMetal} premium of {formatDollars(bestCarrier.avgPremium)}/mo with{" "}
                  {formatDollars(bestCarrier.avgDeductible)} deductible across {bestCarrier.planCount} plans.
                  Value score: {bestCarrier.valueScore}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-state carriers */}
      {topMultiState && topMultiState.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Multi-State Carriers</CardTitle>
            <CardDescription>Carriers offering plans across the most states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {topMultiState.map(c => (
                <div key={c.carrier} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{c.carrier}</span>
                  <Badge variant="secondary" className="text-xs">{c.states} states</Badge>
                  <Badge variant="outline" className="text-xs">{c.totalPlans.toLocaleString()} plans</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carrier Rankings — {rankMetal} Plans</CardTitle>
          <CardDescription>Click column headers to sort. Value score combines premium and deductible.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : sorted.length > 0 ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50 min-w-[200px]" onClick={() => toggleSort("carrier")}>
                      Carrier {sortField === "carrier" ? (sortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => toggleSort("planCount")}>
                      Plans {sortField === "planCount" ? (sortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => toggleSort("avgPremium")}>
                      Avg Premium {sortField === "avgPremium" ? (sortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => toggleSort("avgDeductible")}>
                      Avg Deductible {sortField === "avgDeductible" ? (sortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => toggleSort("avgMoop")}>
                      Avg MOOP {sortField === "avgMoop" ? (sortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-center" onClick={() => toggleSort("valueScore")}>
                      Value Score {sortField === "valueScore" ? (sortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.carrier}>
                      <TableCell className="font-medium text-sm">{r.carrier}</TableCell>
                      <TableCell className="text-right text-sm">{r.planCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{formatDollars(r.avgPremium)}/mo</TableCell>
                      <TableCell className="text-right text-sm">{formatDollars(r.avgDeductible)}</TableCell>
                      <TableCell className="text-right text-sm">{formatDollars(r.avgMoop)}</TableCell>
                      <TableCell className="text-center"><ValueScoreBadge score={r.valueScore} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No carrier data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SUBSIDY MAP TAB
// ══════════════════════════════════════════════════════

function SubsidyMapTab() {
  const [mapSort, setMapSort] = useState<keyof SubsidyMapEntry>("subsidyAt30K");
  const [mapSortDir, setMapSortDir] = useState<"asc" | "desc">("desc");

  const { data: subsidyMap, isLoading } = useQuery<SubsidyMapEntry[]>({
    queryKey: ["/api/aca/subsidy-map"],
    queryFn: async () => {
      const res = await fetch("/api/aca/subsidy-map");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const sorted = useMemo(() => {
    if (!subsidyMap) return [];
    return [...subsidyMap].sort((a, b) => {
      const aVal = a[mapSort];
      const bVal = b[mapSort];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return mapSortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return mapSortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [subsidyMap, mapSort, mapSortDir]);

  function toggleMapSort(field: keyof SubsidyMapEntry) {
    if (mapSort === field) {
      setMapSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setMapSort(field);
      setMapSortDir(field === "state" ? "asc" : "desc");
    }
  }

  const top10 = useMemo(() => {
    if (!subsidyMap) return [];
    return [...subsidyMap]
      .sort((a, b) => b.subsidyAt30K - a.subsidyAt30K)
      .slice(0, 10)
      .map(s => ({
        state: s.state,
        name: STATE_NAMES[s.state] || s.state,
        subsidy30K: Math.round(s.subsidyAt30K),
        subsidy50K: Math.round(s.subsidyAt50K),
      }));
  }, [subsidyMap]);

  const bestState = sorted.length > 0 ? sorted[0] : null;

  return (
    <div className="space-y-6">
      {/* Insight */}
      {bestState && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Map className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Most generous subsidies: {STATE_NAMES[bestState.state] || bestState.state}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-300">
                  {formatPremium(bestState.subsidyAt30K)}/month subsidy at $30K income.{" "}
                  {bestState.zeroPremiumPlansAt30K > 0
                    ? `${bestState.zeroPremiumPlansAt30K} free plans and ${bestState.freeOrCheapCount} plans under $50/mo.`
                    : `${bestState.freeOrCheapCount} plans under $50/mo.`}
                  {" "}Benchmark Silver: {formatPremium(bestState.benchmarkSilverPremium)}/mo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 10 bar chart */}
      {top10.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 States by Subsidy Value</CardTitle>
            <CardDescription>Monthly subsidy amount at $30K and $50K income (household of 1)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value}/mo`, ""]} />
                <Legend />
                <Bar dataKey="subsidy30K" name="Subsidy at $30K" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="subsidy50K" name="Subsidy at $50K" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* State table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">State-by-State Subsidy Analysis</CardTitle>
          <CardDescription>Click column headers to sort. Shows subsidy values for a single person.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : sorted.length > 0 ? (
            <div className="rounded-md border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50 sticky top-0 bg-background" onClick={() => toggleMapSort("state")}>
                      State {mapSort === "state" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("benchmarkSilverPremium")}>
                      Benchmark Silver {mapSort === "benchmarkSilverPremium" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("avgBronzePremium")}>
                      Avg Bronze {mapSort === "avgBronzePremium" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("subsidyAt30K")}>
                      Subsidy @$30K {mapSort === "subsidyAt30K" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("subsidyAt50K")}>
                      Subsidy @$50K {mapSort === "subsidyAt50K" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("bronzeAfterSubsidyAt30K")}>
                      Bronze @$30K {mapSort === "bronzeAfterSubsidyAt30K" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("zeroPremiumPlansAt30K")}>
                      $0 Plans {mapSort === "zeroPremiumPlansAt30K" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-right sticky top-0 bg-background" onClick={() => toggleMapSort("freeOrCheapCount")}>
                      Under $50 {mapSort === "freeOrCheapCount" ? (mapSortDir === "asc" ? "^" : "v") : ""}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(s => (
                    <TableRow key={s.state}>
                      <TableCell className="font-medium">
                        {STATE_NAMES[s.state] || s.state} ({s.state})
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatPremium(s.benchmarkSilverPremium)}</TableCell>
                      <TableCell className="text-right text-sm">{formatDollars(s.avgBronzePremium)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatPremium(s.subsidyAt30K)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-indigo-600">
                        {formatPremium(s.subsidyAt50K)}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${s.bronzeAfterSubsidyAt30K === 0 ? "text-emerald-600 font-bold" : ""}`}>
                        {s.bronzeAfterSubsidyAt30K === 0 ? "$0.00" : formatPremium(s.bronzeAfterSubsidyAt30K)}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${s.zeroPremiumPlansAt30K > 0 ? "text-emerald-600 font-bold" : ""}`}>
                        {s.zeroPremiumPlansAt30K.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">{s.freeOrCheapCount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No subsidy data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════

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
  if (selectedCounty && selectedCounty !== "all_counties") planParams.set("county", selectedCounty);
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
    enabled: !!selectedState && !!selectedCounty && selectedCounty !== "all_counties",
  });

  // Prepare chart data
  const metalPieData = useMemo(() => {
    if (!summary?.metalDistribution) return [];
    const order = ["Bronze", "Expanded Bronze", "Silver", "Gold", "Platinum", "Catastrophic"];
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
        description="Real QHP PY2026 landscape data from CMS — individual market plans across all federally-facilitated exchange states"
        badge="ACA / QHP PY2026"
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="subsidy" className="gap-1.5">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Subsidy Calculator</span>
          </TabsTrigger>
          <TabsTrigger value="carriers" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Carrier Rankings</span>
          </TabsTrigger>
          <TabsTrigger value="subsidymap" className="gap-1.5">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Subsidy Map</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        <TabsContent value="overview" className="space-y-6">
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
                  <SelectItem value="Bronze">Bronze (incl. Expanded)</SelectItem>
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
        </TabsContent>

        {/* ══════════ SUBSIDY CALCULATOR TAB ══════════ */}
        <TabsContent value="subsidy">
          <SubsidyCalculatorTab
            states={states}
            counties={counties}
            selectedState={selectedState}
            setSelectedState={setSelectedState}
          />
        </TabsContent>

        {/* ══════════ CARRIER RANKINGS TAB ══════════ */}
        <TabsContent value="carriers">
          <CarrierRankingsTab states={states} />
        </TabsContent>

        {/* ══════════ SUBSIDY MAP TAB ══════════ */}
        <TabsContent value="subsidymap">
          <SubsidyMapTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
