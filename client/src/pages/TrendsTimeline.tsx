import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import { TrendSparkline } from "@/components/charts/TrendSparkline";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Search,
  Clock,
  Building,
  DollarSign,
  Star,
  FileText,
  MapPin,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Types ──

interface CarrierTrendDataPoint {
  period: string;
  planCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
  enrollment: number;
  marketShare: number;
  counties: number;
}

interface CarrierTrend {
  carrier: string;
  dataPoints: CarrierTrendDataPoint[];
  trend: "growing" | "stable" | "declining";
}

interface BenefitTrend {
  benefit: string;
  dataPoints: Array<{
    period: string;
    avgAmount: number;
    coverageRate: number;
    planCount: number;
  }>;
  direction: "up" | "flat" | "down";
  changePercent: number;
}

interface MarketTrend {
  state: string;
  dataPoints: Array<{
    period: string;
    totalPlans: number;
    carriers: number;
    avgPremium: number;
    zeroPremiumPct: number;
    avgDental: number;
    avgStarRating: number;
  }>;
}

interface TopMover {
  carrier: string;
  metric: string;
  change: number;
  direction: "up" | "down";
}

interface LeaderboardEntry {
  carrier: string;
  planCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
  counties: number;
  marketShare: number;
  trend: "growing" | "stable" | "declining";
}

interface StateComparison {
  state: string;
  planCount: number;
  carriers: number;
  avgPremium: number;
  avgDental: number;
  avgOtc: number;
  avgStarRating: number;
  zeroPremiumPct: number;
}

interface PlanHistoryEntry {
  year: string;
  changes: Record<string, { old: any; new: any }>;
}

// ── Constants ──

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY","DC",
];

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const BENEFIT_COLORS: Record<string, string> = {
  "Dental": "#3b82f6",
  "OTC Allowance": "#10b981",
  "Vision": "#f59e0b",
  "Transportation": "#ef4444",
  "Flex Card": "#8b5cf6",
  "Grocery Allowance": "#ec4899",
  "Meal Benefit": "#06b6d4",
};

// ── Helpers ──

function TrendIcon({ direction }: { direction: "up" | "flat" | "down" | "growing" | "stable" | "declining" }) {
  if (direction === "up" || direction === "growing")
    return <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (direction === "down" || direction === "declining")
    return <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
}

function TrendBadge({ direction }: { direction: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    up: { label: "Rising", variant: "default" },
    growing: { label: "Growing", variant: "default" },
    flat: { label: "Stable", variant: "secondary" },
    stable: { label: "Baseline", variant: "secondary" },
    down: { label: "Declining", variant: "destructive" },
    declining: { label: "Declining", variant: "destructive" },
  };
  const c = config[direction] || config.flat;
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}

function formatCurrency(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
  return `$${val.toFixed(0)}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

// ── Main Component ──

export default function TrendsTimeline() {
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [planSearchContract, setPlanSearchContract] = useState("");
  const [planSearchPlan, setPlanSearchPlan] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const stateParam = selectedState === "all" ? undefined : selectedState;

  // ── Data Fetching ──

  const { data: marketData, isLoading: marketLoading } = useQuery<MarketTrend>({
    queryKey: ["/api/trends/market", selectedState],
    queryFn: async () => {
      if (!stateParam) {
        // Fetch state comparison as fallback for "all states"
        return { state: "all", dataPoints: [] };
      }
      const res = await fetch(`/api/trends/market?state=${stateParam}`);
      return res.json();
    },
  });

  const { data: stateComparison } = useQuery<StateComparison[]>({
    queryKey: ["/api/trends/states"],
    queryFn: async () => {
      const res = await fetch("/api/trends/states");
      return res.json();
    },
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/trends/leaderboard", selectedState],
    queryFn: async () => {
      const params = stateParam ? `?state=${stateParam}&limit=15` : "?limit=15";
      const res = await fetch(`/api/trends/leaderboard${params}`);
      return res.json();
    },
  });

  const { data: benefitTrends, isLoading: benefitLoading } = useQuery<BenefitTrend[]>({
    queryKey: ["/api/trends/benefits", selectedState],
    queryFn: async () => {
      const params = stateParam ? `?state=${stateParam}` : "";
      const res = await fetch(`/api/trends/benefits${params}`);
      return res.json();
    },
  });

  const { data: movers, isLoading: moversLoading } = useQuery<TopMover[]>({
    queryKey: ["/api/trends/movers", selectedState],
    queryFn: async () => {
      const params = stateParam ? `?state=${stateParam}&limit=10` : "?limit=10";
      const res = await fetch(`/api/trends/movers${params}`);
      return res.json();
    },
  });

  const { data: carrierDetail, isLoading: carrierDetailLoading } = useQuery<CarrierTrend>({
    queryKey: ["/api/trends/carrier", selectedCarrier, selectedState],
    queryFn: async () => {
      const params = new URLSearchParams({ carrier: selectedCarrier! });
      if (stateParam) params.set("state", stateParam);
      const res = await fetch(`/api/trends/carrier?${params}`);
      return res.json();
    },
    enabled: !!selectedCarrier,
  });

  const { data: planHistory, isLoading: planHistoryLoading } = useQuery<PlanHistoryEntry[]>({
    queryKey: ["/api/trends/plan-history", planSearchContract, planSearchPlan],
    queryFn: async () => {
      const res = await fetch(
        `/api/trends/plan-history?contractId=${encodeURIComponent(planSearchContract)}&planId=${encodeURIComponent(planSearchPlan)}`
      );
      return res.json();
    },
    enabled: searchTriggered && !!planSearchContract && !!planSearchPlan,
  });

  // ── Computed ──

  const snapshot = useMemo(() => {
    if (stateParam && marketData?.dataPoints?.length) {
      const latest = marketData.dataPoints[marketData.dataPoints.length - 1];
      return {
        totalPlans: latest.totalPlans,
        avgPremium: latest.avgPremium,
        zeroPremiumPct: latest.zeroPremiumPct,
        avgStarRating: latest.avgStarRating,
        carriers: latest.carriers,
        avgDental: latest.avgDental,
      };
    }
    if (stateComparison?.length) {
      const total = stateComparison.reduce((s, r) => s + r.planCount, 0);
      const wAvgPrem = stateComparison.reduce((s, r) => s + r.avgPremium * r.planCount, 0) / (total || 1);
      const wAvgStar = stateComparison.reduce((s, r) => s + r.avgStarRating * r.planCount, 0) / (total || 1);
      const wZeroPct = stateComparison.reduce((s, r) => s + r.zeroPremiumPct * r.planCount, 0) / (total || 1);
      const totalCarriers = new Set(stateComparison.map((s) => s.carriers)).size; // approx
      return {
        totalPlans: total,
        avgPremium: Math.round(wAvgPrem * 100) / 100,
        zeroPremiumPct: Math.round(wZeroPct * 100) / 100,
        avgStarRating: Math.round(wAvgStar * 10) / 10,
        carriers: stateComparison.reduce((s, r) => s + r.carriers, 0),
        avgDental: Math.round(stateComparison.reduce((s, r) => s + r.avgDental * r.planCount, 0) / (total || 1)),
      };
    }
    return null;
  }, [marketData, stateComparison, stateParam]);

  const trendsInsights = useMemo((): InsightItem[] => {
    const items: InsightItem[] = [];

    // Carrier leaderboard insights
    if (leaderboard && leaderboard.length > 0) {
      const leader = leaderboard[0];
      items.push({
        icon: "trend",
        text: `Market leader: ${leader.carrier} has ${leader.marketShare}% share with ${leader.planCount.toLocaleString()} plans — ${leader.trend === "growing" ? "growing" : leader.trend === "declining" ? "declining, watch for opportunity" : "stable"}`,
        priority: "medium",
      });
    }

    // Benefit evolution insights
    if (benefitTrends && benefitTrends.length > 0) {
      const growing = [...benefitTrends].filter((bt) => bt.direction === "up").sort((a, b) => b.changePercent - a.changePercent);
      if (growing.length > 0) {
        items.push({
          icon: "opportunity",
          text: `${growing[0].benefit} coverage increased ${growing[0].changePercent}% — fastest growing benefit. Highlight this in marketing.`,
          priority: "medium",
        });
      }
    }

    // Top movers insight
    if (movers && movers.length > 0) {
      const topGrower = movers.filter((m) => m.direction === "up")[0];
      if (topGrower) {
        items.push({
          icon: "target",
          text: `Biggest mover: ${topGrower.carrier} — +${topGrower.change.toLocaleString()} ${topGrower.metric}. Track this carrier's expansion strategy.`,
          priority: "high",
        });
      }
      const topDecliner = movers.filter((m) => m.direction === "down")[0];
      if (topDecliner) {
        items.push({
          icon: "warning",
          text: `${topDecliner.carrier} is declining: -${topDecliner.change.toLocaleString()} ${topDecliner.metric}. Opportunity to capture their beneficiaries.`,
          priority: "medium",
        });
      }
    }

    return items.slice(0, 5);
  }, [leaderboard, benefitTrends, movers]);

  const isSingleYear = useMemo(() => {
    if (marketData?.dataPoints?.length) return marketData.dataPoints.length <= 1;
    return true;
  }, [marketData]);

  // ── Render ──

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Trends & Timeline"
        description="Track how carriers, plans, and benefits evolve across the Medicare Advantage landscape."
        helpText="This dashboard shows historical trends when multi-year data is available. With single-year data, it displays market baselines and geographic comparisons as proxies for movement. As additional contract years are loaded, year-over-year trends will appear automatically."
        badge={isSingleYear ? "Baseline" : "Multi-Year"}
        actions={
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {US_STATES.map((st) => (
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* ── Market Pulse ── */}
      {snapshot ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Plans"
            value={snapshot.totalPlans.toLocaleString()}
            icon={<FileText className="h-5 w-5 text-muted-foreground" />}
          />
          <StatCard
            label="Avg Premium"
            value={`$${snapshot.avgPremium.toFixed(2)}`}
            icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
          />
          <StatCard
            label="$0 Premium"
            value={`${snapshot.zeroPremiumPct.toFixed(1)}%`}
            icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
          />
          <StatCard
            label="Avg Star Rating"
            value={snapshot.avgStarRating.toFixed(1)}
            icon={<Star className="h-5 w-5 text-muted-foreground" />}
          />
        </div>
      ) : marketLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : null}

      {trendsInsights.length > 0 && (
        <InsightBox title="Trends Intelligence" insights={trendsInsights} />
      )}

      {/* ── Tab Sections ── */}
      <Tabs defaultValue="carriers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="carriers" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Carrier Leaderboard</span>
            <span className="sm:hidden">Carriers</span>
          </TabsTrigger>
          <TabsTrigger value="benefits" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Benefit Evolution</span>
            <span className="sm:hidden">Benefits</span>
          </TabsTrigger>
          <TabsTrigger value="movers" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Top Movers</span>
            <span className="sm:hidden">Movers</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Plan Timeline</span>
            <span className="sm:hidden">Timeline</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Carrier Leaderboard ── */}
        <TabsContent value="carriers" className="space-y-4">
          {leaderboardLoading ? (
            <LoadingSkeleton />
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Bar Chart */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Carriers by Plan Count</CardTitle>
                    <CardDescription>
                      {stateParam ? `Plans offered in ${stateParam}` : "National plan count"}
                      {isSingleYear && " — baseline snapshot"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[500px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={leaderboard}
                          layout="vertical"
                          margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" />
                          <YAxis
                            dataKey="carrier"
                            type="category"
                            width={180}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 25) + "..." : v}
                          />
                          <Tooltip
                            formatter={(value: number) => [value.toLocaleString(), "Plans"]}
                            labelFormatter={(label: string) => label}
                          />
                          <Bar dataKey="planCount" name="Plans" radius={[0, 4, 4, 0]}>
                            {leaderboard.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                cursor="pointer"
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Carrier List */}
              <div className="space-y-2 max-h-[580px] overflow-y-auto">
                {leaderboard.map((c) => (
                  <Card
                    key={c.carrier}
                    className={`cursor-pointer transition-colors hover:border-primary/50 ${
                      selectedCarrier === c.carrier ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedCarrier(selectedCarrier === c.carrier ? null : c.carrier)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.carrier}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{c.planCount.toLocaleString()} plans</span>
                            <span>{c.marketShare}%</span>
                            <span>{c.counties} counties</span>
                          </div>
                        </div>
                        <TrendBadge direction={c.trend} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No carrier data available for the selected filter.
              </CardContent>
            </Card>
          )}

          {/* Carrier Detail Panel */}
          {selectedCarrier && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedCarrier}</CardTitle>
                    <CardDescription>Carrier Report Card</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCarrier(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {carrierDetailLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64" />
                  </div>
                ) : carrierDetail?.dataPoints?.length ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendBadge direction={carrierDetail.trend} />
                      <span className="text-sm text-muted-foreground">
                        {carrierDetail.dataPoints.length === 1
                          ? "Single year baseline"
                          : `${carrierDetail.dataPoints.length} years of data`}
                      </span>
                    </div>

                    {/* Stat Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {(() => {
                        const latest = carrierDetail.dataPoints[carrierDetail.dataPoints.length - 1];
                        return (
                          <>
                            <div className="rounded-lg border p-3 text-center">
                              <p className="text-xs text-muted-foreground">Plans</p>
                              <p className="text-xl font-bold font-mono">{latest.planCount.toLocaleString()}</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <p className="text-xs text-muted-foreground">Avg Premium</p>
                              <p className="text-xl font-bold font-mono">${latest.avgPremium.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <p className="text-xs text-muted-foreground">Avg Dental</p>
                              <p className="text-xl font-bold font-mono">{formatCurrency(latest.avgDental)}</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <p className="text-xs text-muted-foreground">Star Rating</p>
                              <p className="text-xl font-bold font-mono">{latest.avgStarRating}</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <p className="text-xs text-muted-foreground">Counties</p>
                              <p className="text-xl font-bold font-mono">{latest.counties.toLocaleString()}</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Benefit Comparison vs Market */}
                    {leaderboard && leaderboard.length > 0 && (() => {
                      const latest = carrierDetail.dataPoints[carrierDetail.dataPoints.length - 1];
                      const marketAvgDental = leaderboard.reduce((s, c) => s + c.avgDental, 0) / leaderboard.length;
                      const marketAvgOtc = leaderboard.reduce((s, c) => s + c.avgOtc, 0) / leaderboard.length;
                      const marketAvgPrem = leaderboard.reduce((s, c) => s + c.avgPremium, 0) / leaderboard.length;
                      const marketAvgStar = leaderboard.reduce((s, c) => s + c.avgStarRating, 0) / leaderboard.length;

                      const comparisonData = [
                        { metric: "Dental", carrier: latest.avgDental, market: Math.round(marketAvgDental) },
                        { metric: "OTC/Qtr", carrier: latest.avgOtc, market: Math.round(marketAvgOtc) },
                        { metric: "Premium", carrier: latest.avgPremium, market: Math.round(marketAvgPrem * 100) / 100 },
                        { metric: "Stars", carrier: latest.avgStarRating, market: Math.round(marketAvgStar * 10) / 10 },
                      ];

                      return (
                        <div>
                          <p className="text-sm font-medium mb-2">Carrier vs Market Average</p>
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="metric" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="carrier" name={selectedCarrier.split(" ").slice(0, 2).join(" ")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="market" name="Market Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data found for this carrier.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 2: Benefit Evolution ── */}
        <TabsContent value="benefits" className="space-y-4">
          {benefitLoading ? (
            <LoadingSkeleton />
          ) : benefitTrends && benefitTrends.length > 0 ? (
            <>
              {/* Benefit Amount Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {benefitTrends.map((bt) => {
                  const latest = bt.dataPoints[bt.dataPoints.length - 1];
                  if (!latest) return null;
                  return (
                    <Card key={bt.benefit}>
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground truncate">{bt.benefit}</p>
                        <p className="text-lg font-bold font-mono mt-1">
                          {latest.avgAmount > 0 ? formatCurrency(latest.avgAmount) : "--"}
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <TrendIcon direction={bt.direction} />
                          <span className="text-xs text-muted-foreground">
                            {bt.changePercent !== 0 ? `${bt.changePercent > 0 ? "+" : ""}${bt.changePercent}%` : "baseline"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Coverage Rate Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Benefit Coverage Rates</CardTitle>
                  <CardDescription>
                    Percentage of plans offering each supplemental benefit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={benefitTrends.map((bt) => {
                          const latest = bt.dataPoints[bt.dataPoints.length - 1];
                          return {
                            benefit: bt.benefit,
                            coverageRate: latest?.coverageRate || 0,
                            planCount: latest?.planCount || 0,
                          };
                        }).sort((a, b) => b.coverageRate - a.coverageRate)}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="benefit" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(value: number, name: string) => {
                          if (name === "coverageRate") return [`${value.toFixed(1)}%`, "Coverage Rate"];
                          return [value.toLocaleString(), "Plans"];
                        }} />
                        <Bar dataKey="coverageRate" name="coverageRate" radius={[4, 4, 0, 0]}>
                          {benefitTrends.map((bt, idx) => (
                            <Cell key={bt.benefit} fill={BENEFIT_COLORS[bt.benefit] || CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Average Benefit Amounts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Average Benefit Amounts</CardTitle>
                  <CardDescription>
                    {isSingleYear
                      ? "Current benefit levels across the market"
                      : "How benefit generosity is changing over time"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {isSingleYear ? (
                        <BarChart
                          data={benefitTrends
                            .map((bt) => {
                              const latest = bt.dataPoints[bt.dataPoints.length - 1];
                              return {
                                benefit: bt.benefit,
                                avgAmount: latest?.avgAmount || 0,
                              };
                            })
                            .filter((d) => d.avgAmount > 0)
                            .sort((a, b) => b.avgAmount - a.avgAmount)}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="benefit" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(v) => formatCurrency(v)} />
                          <Tooltip formatter={(value: number) => [formatCurrency(value), "Avg Amount"]} />
                          <Bar dataKey="avgAmount" name="Avg Amount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            {benefitTrends.map((bt, idx) => (
                              <Cell key={bt.benefit} fill={BENEFIT_COLORS[bt.benefit] || CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : (
                        <LineChart>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis
                            dataKey="period"
                            type="category"
                            allowDuplicatedCategory={false}
                          />
                          <YAxis tickFormatter={(v) => formatCurrency(v)} />
                          <Tooltip formatter={(value: number) => [formatCurrency(value)]} />
                          <Legend />
                          {benefitTrends
                            .filter((bt) => bt.dataPoints.some((d) => d.avgAmount > 0))
                            .map((bt) => (
                              <Line
                                key={bt.benefit}
                                data={bt.dataPoints}
                                dataKey="avgAmount"
                                name={bt.benefit}
                                stroke={BENEFIT_COLORS[bt.benefit] || "#888"}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                              />
                            ))}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* State comparison for single-year */}
              {isSingleYear && stateComparison && stateComparison.length > 0 && !stateParam && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Geographic Variation</CardTitle>
                    <CardDescription>
                      How states compare on average dental coverage — a proxy for market generosity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[...stateComparison]
                            .sort((a, b) => b.avgDental - a.avgDental)
                            .slice(0, 20)}
                          layout="vertical"
                          margin={{ left: 10, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                          <YAxis dataKey="state" type="category" width={40} tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              if (name === "avgDental") return [formatCurrency(value), "Avg Dental"];
                              return [value, name];
                            }}
                          />
                          <Bar dataKey="avgDental" name="avgDental" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                            {stateComparison.slice(0, 20).map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={idx < 5 ? "#10b981" : idx < 15 ? "#3b82f6" : "#94a3b8"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No benefit trend data available.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 3: Top Movers ── */}
        <TabsContent value="movers" className="space-y-4">
          {moversLoading ? (
            <LoadingSkeleton />
          ) : movers && movers.length > 0 ? (
            <>
              {/* Split into growers and decliners */}
              {(() => {
                const growers = movers.filter((m) => m.direction === "up");
                const decliners = movers.filter((m) => m.direction === "down");
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Growers */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          Market Leaders
                        </CardTitle>
                        <CardDescription>
                          Carriers with the strongest market position
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {growers.length > 0 ? (
                          <div className="space-y-3">
                            {growers.map((m, idx) => (
                              <div
                                key={`${m.carrier}-${idx}`}
                                className="flex items-center justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{m.carrier}</p>
                                  <p className="text-xs text-muted-foreground">{m.metric}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">
                                    +{m.change.toLocaleString()}
                                  </span>
                                  <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No significant growers detected.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Decliners / Watch List */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                          Watch List
                        </CardTitle>
                        <CardDescription>
                          Carriers trailing the market average
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {decliners.length > 0 ? (
                          <div className="space-y-3">
                            {decliners.map((m, idx) => (
                              <div
                                key={`${m.carrier}-${idx}`}
                                className="flex items-center justify-between p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{m.carrier}</p>
                                  <p className="text-xs text-muted-foreground">{m.metric}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                                    -{m.change.toLocaleString()}
                                  </span>
                                  <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No significant decliners detected.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}

              {/* Movers bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Movement Magnitude</CardTitle>
                  <CardDescription>
                    {isSingleYear
                      ? "How carriers deviate from market averages"
                      : "Year-over-year changes in plan offerings"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={movers.map((m) => ({
                          name: m.carrier.length > 20 ? m.carrier.slice(0, 20) + "..." : m.carrier,
                          value: m.direction === "up" ? m.change : -m.change,
                          metric: m.metric,
                        }))}
                        layout="vertical"
                        margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number) => [
                            value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString(),
                            "Change",
                          ]}
                        />
                        <Bar dataKey="value" name="Change" radius={[0, 4, 4, 0]}>
                          {movers.map((m, idx) => (
                            <Cell
                              key={idx}
                              fill={m.direction === "up" ? "#10b981" : "#ef4444"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No significant market movers detected for the current filter. Try selecting a specific state.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab 4: Plan Timeline ── */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plan History Lookup</CardTitle>
              <CardDescription>
                Search by contract ID and plan ID to see how a specific plan has changed over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Contract ID</label>
                  <Input
                    placeholder="e.g., H1234"
                    value={planSearchContract}
                    onChange={(e) => {
                      setPlanSearchContract(e.target.value);
                      setSearchTriggered(false);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Plan ID</label>
                  <Input
                    placeholder="e.g., 001"
                    value={planSearchPlan}
                    onChange={(e) => {
                      setPlanSearchPlan(e.target.value);
                      setSearchTriggered(false);
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setSearchTriggered(true)}
                    disabled={!planSearchContract || !planSearchPlan}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {searchTriggered && planHistoryLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          )}

          {searchTriggered && planHistory && planHistory.length > 0 && (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

              {planHistory.map((entry, idx) => {
                const changeKeys = Object.keys(entry.changes).filter((k) => k !== "_baseline");
                const isBaseline = "_baseline" in entry.changes;
                return (
                  <div key={entry.year} className="relative pl-14 pb-6">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-4 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isBaseline
                          ? "bg-blue-100 border-blue-500 dark:bg-blue-900"
                          : changeKeys.length > 0
                          ? "bg-amber-100 border-amber-500 dark:bg-amber-900"
                          : "bg-green-100 border-green-500 dark:bg-green-900"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isBaseline
                            ? "bg-blue-500"
                            : changeKeys.length > 0
                            ? "bg-amber-500"
                            : "bg-green-500"
                        }`}
                      />
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            CY {entry.year}
                          </CardTitle>
                          <Badge variant={isBaseline ? "default" : changeKeys.length > 0 ? "secondary" : "outline"}>
                            {isBaseline
                              ? "Baseline"
                              : changeKeys.length > 0
                              ? `${changeKeys.length} change${changeKeys.length > 1 ? "s" : ""}`
                              : "No changes"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isBaseline ? (
                          <p className="text-sm text-muted-foreground">Initial plan snapshot recorded.</p>
                        ) : changeKeys.length > 0 ? (
                          <div className="space-y-2">
                            {changeKeys.map((key) => {
                              const change = entry.changes[key];
                              const isIncrease =
                                typeof change.new === "number" &&
                                typeof change.old === "number" &&
                                change.new > change.old;
                              const isDecrease =
                                typeof change.new === "number" &&
                                typeof change.old === "number" &&
                                change.new < change.old;
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                                >
                                  <span className="text-muted-foreground capitalize">
                                    {key.replace(/([A-Z])/g, " $1").trim()}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground line-through text-xs">
                                      {change.old !== null && change.old !== undefined
                                        ? typeof change.old === "boolean"
                                          ? change.old ? "Yes" : "No"
                                          : String(change.old)
                                        : "--"}
                                    </span>
                                    {isIncrease && <ArrowUp className="h-3 w-3 text-green-600" />}
                                    {isDecrease && <ArrowDown className="h-3 w-3 text-red-600" />}
                                    {!isIncrease && !isDecrease && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                                    <span className="font-medium">
                                      {change.new !== null && change.new !== undefined
                                        ? typeof change.new === "boolean"
                                          ? change.new ? "Yes" : "No"
                                          : String(change.new)
                                        : "--"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No changes from previous year.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          {searchTriggered && planHistory && planHistory.length === 0 && !planHistoryLoading && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No history found for contract {planSearchContract}, plan {planSearchPlan}. Check the IDs and try again.
              </CardContent>
            </Card>
          )}

          {!searchTriggered && (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  Enter a contract ID and plan ID above to view the plan's history across contract years.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tip: Contract IDs start with H or R (e.g., H1234). Plan IDs are typically 3-digit numbers (e.g., 001).
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
