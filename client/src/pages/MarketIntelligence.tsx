import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Target,
  MapPin,
  BarChart3,
  Users,
  Zap,
  Download,
  Search,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Lightbulb,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

// ── Types ──

interface MarketOpportunity {
  county: string;
  state: string;
  planCount: number;
  carrierCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  gapScore: number;
  suggestedAngle: string;
}

interface CompetitiveGap {
  county: string;
  state: string;
  carrierDental: number;
  avgDental: number;
  carrierOtc: number;
  avgOtc: number;
  carrierPremium: number;
  avgPremium: number;
  carrierPlanCount: number;
  opportunity: string;
}

interface MarketingAngle {
  angle: string;
  reasoning: string;
  pctLacking: number;
  impactScore: number;
  suggestedMessaging: string;
  targetDemographic: string;
}

interface ProspectArea {
  county: string;
  state: string;
  prospectScore: number;
  topOpportunity: string;
  competitorCount: number;
  planCount: number;
  suggestedApproach: string;
}

interface CarrierMarketShare {
  carrier: string;
  planCount: number;
  marketShare: number;
  counties: number;
  states: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
}

interface BenefitDistribution {
  dental: { range: string; count: number }[];
  premium: { range: string; count: number }[];
  starRating: { range: string; count: number }[];
  otc: { label: string; value: number }[];
  transportation: { label: string; value: number }[];
  meals: { label: string; value: number }[];
  copayPcp: { range: string; count: number }[];
  copaySpecialist: { range: string; count: number }[];
  copayEr: { range: string; count: number }[];
}

interface StateData {
  abbreviation: string;
  name: string;
  planCount: number;
}

// ── Constants ──

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#d946ef",
];

const CHART_COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  accent: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
};

// ── Utility Functions ──

function getGapScoreColor(score: number): string {
  if (score >= 70) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (score >= 50) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  if (score >= 30) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
}

function getProspectScoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (score >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
}

function getOpportunityBadgeVariant(opp: string): "default" | "destructive" | "secondary" | "outline" {
  if (opp.includes("Below") || opp.includes("Gap") || opp.includes("Too High")) return "destructive";
  if (opp.includes("Advantage")) return "default";
  return "secondary";
}

function downloadCsv(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = String(val ?? "");
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ── Custom Tooltip ──

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ──

export default function MarketIntelligence() {
  const [stateFilter, setStateFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState("underserved");
  const [sortField, setSortField] = useState<string>("gapScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Competitive analysis state
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [carrierSearch, setCarrierSearch] = useState("");

  // Marketing angles state
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedCountyState, setSelectedCountyState] = useState("");

  // Agent prospecting state
  const [prospectCarrier, setProspectCarrier] = useState("");

  // Benefit distribution state
  const [distCounty, setDistCounty] = useState("");
  const [distState, setDistState] = useState("");

  // ── Queries ──

  const { data: states = [] } = useQuery<StateData[]>({
    queryKey: ["/api/states"],
  });

  const stateParam = stateFilter && stateFilter !== "all" ? `&state=${stateFilter}` : "";

  const { data: underserved = [], isLoading: loadingUnderserved } = useQuery<MarketOpportunity[]>({
    queryKey: [`/api/intelligence/underserved?limit=100${stateParam}`],
  });

  const { data: marketShare = [], isLoading: loadingMarketShare } = useQuery<CarrierMarketShare[]>({
    queryKey: [`/api/intelligence/market-share?${stateFilter && stateFilter !== "all" ? `state=${stateFilter}` : ""}`],
  });

  const { data: competitiveGaps = [], isLoading: loadingGaps } = useQuery<CompetitiveGap[]>({
    queryKey: [`/api/intelligence/competitive-gaps?carrier=${encodeURIComponent(selectedCarrier)}${stateParam}`],
    enabled: !!selectedCarrier,
  });

  const { data: marketingAngles = [], isLoading: loadingAngles } = useQuery<MarketingAngle[]>({
    queryKey: [`/api/intelligence/marketing-angles?county=${encodeURIComponent(selectedCounty)}&state=${selectedCountyState}`],
    enabled: !!selectedCounty && !!selectedCountyState,
  });

  const { data: prospects = [], isLoading: loadingProspects } = useQuery<ProspectArea[]>({
    queryKey: [`/api/intelligence/prospects?limit=100${stateParam}${prospectCarrier ? `&carrier=${encodeURIComponent(prospectCarrier)}` : ""}`],
  });

  const distParams = [
    distCounty ? `county=${encodeURIComponent(distCounty)}` : "",
    distState && distState !== "all" ? `state=${distState}` : "",
  ].filter(Boolean).join("&");

  const { data: benefitDist, isLoading: loadingDist } = useQuery<BenefitDistribution>({
    queryKey: [`/api/intelligence/benefit-distribution?${distParams}`],
    enabled: !!distState || !!distCounty,
  });

  // ── Derived Data ──

  const sortedUnderserved = useMemo(() => {
    const sorted = [...underserved];
    sorted.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? 0;
      const bVal = (b as any)[sortField] ?? 0;
      return sortDir === "desc" ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    });
    return sorted;
  }, [underserved, sortField, sortDir]);

  const avgGapScore = underserved.length > 0
    ? Math.round(underserved.reduce((s, m) => s + m.gapScore, 0) / underserved.length)
    : 0;

  const topAngle = useMemo(() => {
    const angles = underserved.reduce<Record<string, number>>((acc, m) => {
      acc[m.suggestedAngle] = (acc[m.suggestedAngle] || 0) + 1;
      return acc;
    }, {});
    const sorted = Object.entries(angles).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "N/A";
  }, [underserved]);

  const highGapCount = underserved.filter((m) => m.gapScore >= 60).length;

  const topCarriers = useMemo(() => {
    return marketShare.slice(0, 10);
  }, [marketShare]);

  const pieData = useMemo(() => {
    const top8 = marketShare.slice(0, 8);
    const otherShare = marketShare.slice(8).reduce((s, c) => s + c.marketShare, 0);
    const data = top8.map((c) => ({ name: c.carrier.length > 25 ? c.carrier.slice(0, 25) + "..." : c.carrier, value: c.marketShare }));
    if (otherShare > 0) data.push({ name: "Others", value: Math.round(otherShare * 100) / 100 });
    return data;
  }, [marketShare]);

  // Unique counties from underserved for selector
  const countyOptions = useMemo(() => {
    return underserved.map((m) => ({ county: m.county, state: m.state })).slice(0, 50);
  }, [underserved]);

  // Carrier list for selector
  const carrierOptions = useMemo(() => {
    const filtered = carrierSearch
      ? marketShare.filter((c) => c.carrier.toLowerCase().includes(carrierSearch.toLowerCase()))
      : marketShare;
    return filtered.slice(0, 20);
  }, [marketShare, carrierSearch]);

  // Competitive gaps summary
  const gapsSummary = useMemo(() => {
    if (competitiveGaps.length === 0) return { vulnerabilities: 0, advantages: 0, neutral: 0 };
    return {
      vulnerabilities: competitiveGaps.filter((g) => g.opportunity.includes("Below") || g.opportunity.includes("Gap") || g.opportunity.includes("Too High")).length,
      advantages: competitiveGaps.filter((g) => g.opportunity.includes("Advantage")).length,
      neutral: competitiveGaps.filter((g) => g.opportunity === "On Par").length,
    };
  }, [competitiveGaps]);

  // Radar chart data for competitive analysis
  const radarData = useMemo(() => {
    if (competitiveGaps.length === 0) return [];
    const avgCarrierDental = competitiveGaps.reduce((s, g) => s + g.carrierDental, 0) / competitiveGaps.length;
    const avgAreaDental = competitiveGaps.reduce((s, g) => s + g.avgDental, 0) / competitiveGaps.length;
    const avgCarrierOtc = competitiveGaps.reduce((s, g) => s + g.carrierOtc, 0) / competitiveGaps.length;
    const avgAreaOtc = competitiveGaps.reduce((s, g) => s + g.avgOtc, 0) / competitiveGaps.length;
    const avgCarrierPremium = competitiveGaps.reduce((s, g) => s + g.carrierPremium, 0) / competitiveGaps.length;
    const avgAreaPremium = competitiveGaps.reduce((s, g) => s + g.avgPremium, 0) / competitiveGaps.length;
    // Normalize to 0-100 scale
    const maxDental = Math.max(avgCarrierDental, avgAreaDental, 1);
    const maxOtc = Math.max(avgCarrierOtc, avgAreaOtc, 1);
    const maxPremium = Math.max(avgCarrierPremium, avgAreaPremium, 1);
    return [
      { metric: "Dental", carrier: Math.round((avgCarrierDental / maxDental) * 100), average: Math.round((avgAreaDental / maxDental) * 100) },
      { metric: "OTC %", carrier: Math.round(avgCarrierOtc), average: Math.round(avgAreaOtc) },
      { metric: "Premium", carrier: Math.round(100 - (avgCarrierPremium / maxPremium) * 100), average: Math.round(100 - (avgAreaPremium / maxPremium) * 100) },
      { metric: "Counties", carrier: Math.min(100, competitiveGaps.length * 2), average: 50 },
    ];
  }, [competitiveGaps]);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const handleCountySelect = useCallback((value: string) => {
    const [county, st] = value.split("|");
    setSelectedCounty(county);
    setSelectedCountyState(st);
  }, []);

  // ── Loading State ──

  if (loadingUnderserved && loadingMarketShare) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Market Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Identify underserved markets, competitive gaps, and sales opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states
                .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
                .map((s) => (
                  <SelectItem key={s.abbreviation} value={s.abbreviation}>
                    {s.abbreviation} - {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Markets Analyzed"
          value={underserved.length}
          icon={<MapPin className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          label="Underserved Counties"
          value={highGapCount}
          suffix=" high-gap"
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
        />
        <StatCard
          label="Avg Opportunity Score"
          value={avgGapScore}
          suffix="/100"
          icon={<Target className="h-5 w-5 text-purple-500" />}
        />
        <StatCard
          label="Top Marketing Angle"
          value={topAngle}
          icon={<Lightbulb className="h-5 w-5 text-yellow-500" />}
        />
      </div>

      {/* ── Market Share Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Carrier Market Share
            </CardTitle>
            <CardDescription>Top carriers by plan count{stateFilter && stateFilter !== "all" ? ` in ${stateFilter}` : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMarketShare ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Carriers by Benefits
            </CardTitle>
            <CardDescription>Average dental coverage and OTC rate</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMarketShare ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topCarriers.slice(0, 8).map((c) => ({
                  name: c.carrier.length > 15 ? c.carrier.slice(0, 15) + "..." : c.carrier,
                  dental: c.avgDental,
                  otcRate: c.avgOtc,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="dental" name="Avg Dental ($)" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="otcRate" name="OTC Rate (%)" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="underserved" className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Underserved</span>
          </TabsTrigger>
          <TabsTrigger value="angles" className="flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Angles</span>
          </TabsTrigger>
          <TabsTrigger value="competitive" className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Competitive</span>
          </TabsTrigger>
          <TabsTrigger value="prospects" className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Prospects</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Distribution</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Underserved Markets ── */}
        <TabsContent value="underserved" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Counties ranked by opportunity gap score. Higher scores indicate more underserved markets.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(sortedUnderserved, "underserved-markets.csv")}
              disabled={sortedUnderserved.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {[
                        { key: "county", label: "County" },
                        { key: "state", label: "State" },
                        { key: "planCount", label: "Plans" },
                        { key: "carrierCount", label: "Carriers" },
                        { key: "avgDental", label: "Avg Dental" },
                        { key: "avgOtc", label: "OTC Rate" },
                        { key: "avgPremium", label: "Avg Premium" },
                        { key: "gapScore", label: "Gap Score" },
                        { key: "suggestedAngle", label: "Suggested Angle" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {sortField === col.key && (
                              <ArrowUpDown className="h-3 w-3" />
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUnderserved.slice(0, 50).map((m, i) => (
                      <tr key={`${m.county}-${m.state}-${i}`} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">{m.county}</td>
                        <td className="p-3">{m.state}</td>
                        <td className="p-3 font-mono">{m.planCount}</td>
                        <td className="p-3 font-mono">{m.carrierCount}</td>
                        <td className="p-3 font-mono">${m.avgDental.toLocaleString()}</td>
                        <td className="p-3 font-mono">{m.avgOtc}%</td>
                        <td className="p-3 font-mono">${m.avgPremium.toFixed(0)}</td>
                        <td className="p-3">
                          <Badge className={getGapScoreColor(m.gapScore)}>{m.gapScore}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{m.suggestedAngle}</Badge>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCounty(m.county);
                              setSelectedCountyState(m.state);
                              setActiveTab("angles");
                            }}
                          >
                            <Zap className="h-3.5 w-3.5 mr-1" />
                            Angles
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDistCounty(m.county);
                              setDistState(m.state);
                              setActiveTab("distribution");
                            }}
                          >
                            <BarChart3 className="h-3.5 w-3.5 mr-1" />
                            Drill
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedUnderserved.length === 0 && !loadingUnderserved && (
                <div className="p-8 text-center text-muted-foreground">
                  No underserved markets found. Try adjusting your state filter.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Marketing Angles ── */}
        <TabsContent value="angles" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Select a county to analyze benefit landscape and generate marketing angles.
            </p>
            <Select
              value={selectedCounty ? `${selectedCounty}|${selectedCountyState}` : ""}
              onValueChange={handleCountySelect}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select a county..." />
              </SelectTrigger>
              <SelectContent>
                {countyOptions.map((c) => (
                  <SelectItem key={`${c.county}-${c.state}`} value={`${c.county}|${c.state}`}>
                    {c.county}, {c.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedCounty && (
            <Card>
              <CardContent className="p-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a county to get started</p>
                <p className="text-sm text-muted-foreground mt-1">Choose from the dropdown above or click "Angles" on an underserved market row</p>
              </CardContent>
            </Card>
          )}

          {loadingAngles && selectedCounty && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
              ))}
            </div>
          )}

          {selectedCounty && !loadingAngles && marketingAngles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketingAngles.map((angle, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        {angle.angle}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Impact</span>
                        <Badge className={
                          angle.impactScore >= 80 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                          angle.impactScore >= 60 ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                          "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }>
                          {angle.impactScore}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Impact bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{angle.pctLacking}% of plans lacking this benefit</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${angle.pctLacking}%`,
                            backgroundColor: angle.pctLacking >= 70 ? CHART_COLORS.danger :
                              angle.pctLacking >= 50 ? CHART_COLORS.accent : CHART_COLORS.primary,
                          }}
                        />
                      </div>
                    </div>

                    {/* Reasoning */}
                    <p className="text-sm text-muted-foreground">{angle.reasoning}</p>

                    {/* Suggested messaging */}
                    <div className="bg-muted/50 rounded-lg p-3 border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Messaging</p>
                      <p className="text-sm">{angle.suggestedMessaging}</p>
                    </div>

                    {/* Target demographic */}
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Target Demographic</p>
                        <p className="text-sm">{angle.targetDemographic}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedCounty && !loadingAngles && marketingAngles.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No significant marketing angles found for {selectedCounty}, {selectedCountyState}. The market may already be well-served.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 3: Competitive Analysis ── */}
        <TabsContent value="competitive" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Select a carrier to analyze their competitive position across markets.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Search carriers..."
                value={carrierSearch}
                onChange={(e) => setCarrierSearch(e.target.value)}
                className="w-[200px]"
              />
              <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a carrier..." />
                </SelectTrigger>
                <SelectContent>
                  {carrierOptions.map((c) => (
                    <SelectItem key={c.carrier} value={c.carrier}>
                      {c.carrier} ({c.planCount} plans)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedCarrier && (
            <Card>
              <CardContent className="p-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a carrier to analyze</p>
                <p className="text-sm text-muted-foreground mt-1">Use the search box and dropdown above to find a carrier</p>
              </CardContent>
            </Card>
          )}

          {selectedCarrier && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-red-200 dark:border-red-900">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{gapsSummary.vulnerabilities}</p>
                      <p className="text-xs text-muted-foreground">Vulnerabilities</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 dark:border-green-900">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{gapsSummary.advantages}</p>
                      <p className="text-xs text-muted-foreground">Advantages</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{gapsSummary.neutral}</p>
                      <p className="text-xs text-muted-foreground">On Par</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar chart */}
                {radarData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Carrier vs Market Average</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Radar name="Carrier" dataKey="carrier" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.3} />
                          <Radar name="Market Avg" dataKey="average" stroke={CHART_COLORS.danger} fill={CHART_COLORS.danger} fillOpacity={0.1} />
                          <Legend />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Comparison bar chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Dental: Carrier vs County Average</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingGaps ? (
                      <Skeleton className="h-[280px] w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={competitiveGaps.slice(0, 10).map((g) => ({
                          name: g.county.length > 12 ? g.county.slice(0, 12) + "..." : g.county,
                          carrier: g.carrierDental,
                          average: g.avgDental,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend />
                          <Bar dataKey="carrier" name="Carrier Dental ($)" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="average" name="County Avg ($)" fill={CHART_COLORS.muted} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Gaps table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">County-Level Analysis</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium text-muted-foreground">County</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">State</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Plans</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Dental (Carrier)</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Dental (Avg)</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">OTC (Carrier)</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">OTC (Avg)</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitiveGaps.slice(0, 30).map((g, i) => (
                          <tr key={`${g.county}-${g.state}-${i}`} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium">{g.county}</td>
                            <td className="p-3">{g.state}</td>
                            <td className="p-3 font-mono">{g.carrierPlanCount}</td>
                            <td className="p-3 font-mono">${g.carrierDental.toLocaleString()}</td>
                            <td className="p-3 font-mono">${g.avgDental.toLocaleString()}</td>
                            <td className="p-3 font-mono">{g.carrierOtc}%</td>
                            <td className="p-3 font-mono">{g.avgOtc}%</td>
                            <td className="p-3">
                              <Badge variant={getOpportunityBadgeVariant(g.opportunity)}>
                                {g.opportunity}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {competitiveGaps.length === 0 && !loadingGaps && selectedCarrier && (
                    <div className="p-8 text-center text-muted-foreground">
                      No competitive data found for this carrier. Try a different name or check spelling.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Tab 4: Agent Prospecting ── */}
        <TabsContent value="prospects" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Best counties for agent outreach, ranked by prospect score.
              </p>
              <Select value={prospectCarrier} onValueChange={setProspectCarrier}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Filter by carrier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Carriers</SelectItem>
                  {marketShare.slice(0, 20).map((c) => (
                    <SelectItem key={c.carrier} value={c.carrier}>
                      {c.carrier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(prospects, "prospect-list.csv")}
              disabled={prospects.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Prospect List
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Rank</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">County</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">State</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Prospect Score</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Plans</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Competitors</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Top Opportunity</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Suggested Approach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.slice(0, 50).map((p, i) => (
                      <tr key={`${p.county}-${p.state}-${i}`} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-medium">{p.county}</td>
                        <td className="p-3">{p.state}</td>
                        <td className="p-3">
                          <Badge className={getProspectScoreColor(p.prospectScore)}>
                            {p.prospectScore}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono">{p.planCount}</td>
                        <td className="p-3 font-mono">{p.competitorCount}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{p.topOpportunity}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-xs truncate" title={p.suggestedApproach}>
                          {p.suggestedApproach}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prospects.length === 0 && !loadingProspects && (
                <div className="p-8 text-center text-muted-foreground">
                  No prospect areas found. Try adjusting filters.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 5: Benefit Distribution ── */}
        <TabsContent value="distribution" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Analyze benefit distributions across a specific market area.
            </p>
            <div className="flex gap-2">
              <Select value={distState} onValueChange={(v) => { setDistState(v); if (!distCounty) setDistCounty(""); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select state..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation)).map((s) => (
                    <SelectItem key={s.abbreviation} value={s.abbreviation}>
                      {s.abbreviation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="County name (optional)"
                value={distCounty}
                onChange={(e) => setDistCounty(e.target.value.toUpperCase())}
                className="w-[200px]"
              />
            </div>
          </div>

          {!distState && !distCounty && (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a state or county to view distributions</p>
                <p className="text-sm text-muted-foreground mt-1">Use the dropdowns above or click "Drill" on an underserved market row</p>
              </CardContent>
            </Card>
          )}

          {loadingDist && (distState || distCounty) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
              ))}
            </div>
          )}

          {benefitDist && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dental Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dental Coverage Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benefitDist.dental}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Plans" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Premium Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly Premium Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benefitDist.premium}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Plans" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Star Rating Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Star Rating Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benefitDist.starRating}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Plans" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* OTC/Transportation/Meals Pie Charts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Supplemental Benefits Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { title: "OTC", data: benefitDist.otc },
                      { title: "Transport", data: benefitDist.transportation },
                      { title: "Meals", data: benefitDist.meals },
                    ].map((item) => (
                      <div key={item.title} className="text-center">
                        <p className="text-xs font-medium mb-1">{item.title}</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <PieChart>
                            <Pie
                              data={item.data}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={45}
                              dataKey="value"
                              nameKey="label"
                            >
                              <Cell fill={CHART_COLORS.primary} />
                              <Cell fill="#e2e8f0" />
                            </Pie>
                            <Tooltip formatter={(v: number) => v.toLocaleString()} />
                          </PieChart>
                        </ResponsiveContainer>
                        {item.data.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {Math.round((item.data[0].value / (item.data[0].value + (item.data[1]?.value || 0))) * 100)}% covered
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* PCP Copay Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">PCP Copay Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benefitDist.copayPcp}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Plans" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Specialist Copay Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Specialist Copay Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benefitDist.copaySpecialist}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Plans" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* ER Copay Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Emergency Room Copay Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={benefitDist.copayEr}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Plans" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
