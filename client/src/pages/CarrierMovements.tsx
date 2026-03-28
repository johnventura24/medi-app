import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  MapPin,
  TrendingUp,
  TrendingDown,
  Building2,
  Star,
  Users,
  FileText,
  Target,
  Download,
  Search,
  Expand,
  ChevronUp,
  ChevronDown,
  Minus,
  Globe,
  Crosshair,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──

interface CarrierFootprint {
  carrier: string;
  states: number;
  counties: number;
  totalPlans: number;
  totalEnrollment: number;
  avgStarRating: number;
  topCounties: Array<{ county: string; state: string; plans: number; enrollment: number }>;
  stateBreakdown: Array<{ state: string; plans: number; counties: number }>;
  concentrationNote: string;
}

interface StateCarrierDynamic {
  carrier: string;
  countiesPresent: number;
  planCount: number;
  enrollment: number;
  isExpanding: boolean;
  strength: "strong" | "moderate" | "weak";
}

interface MarketForecast {
  county: string;
  state: string;
  currentPlans: number;
  currentCarriers: number;
  maPercentage: number;
  perCapitaSpending: number;
  hpsaScore: number;
  opportunityScore: number;
  predictedGrowth: "high" | "medium" | "low";
  reasoning: string[];
  likelyEntrants: string[];
}

interface ExpansionMapData {
  present: Array<{ county: string; fips: string; plans: number; enrollment: number }>;
  opportunities: Array<{
    county: string;
    state: string;
    fips: string;
    currentCarriers: number;
    currentPlans: number;
    forecastScore: number;
    reasoning: string;
  }>;
}

// ── Helpers ──

const fmt = (n: number) => n.toLocaleString();
const fmtDollar = (n: number) => `$${n.toLocaleString()}`;

const growthColors: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const strengthColors: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  weak: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const scatterColors: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#94a3b8",
};

// ── Component ──

export default function CarrierMovements() {
  const [activeTab, setActiveTab] = useState("footprint");
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [carrierSearch, setCarrierSearch] = useState("");
  const [forecastFilter, setForecastFilter] = useState<"all" | "high">("all");

  // Expansion map state
  const [expansionCarrier, setExpansionCarrier] = useState("");
  const [expansionState, setExpansionState] = useState("");

  // Fetch carriers and states
  const { data: carriers = [] } = useQuery<string[]>({
    queryKey: ["/api/carrier-movements/carriers"],
  });

  const { data: states = [] } = useQuery<string[]>({
    queryKey: ["/api/carrier-movements/states"],
  });

  const filteredCarriers = useMemo(() => {
    if (!carrierSearch) return carriers.slice(0, 50);
    const lower = carrierSearch.toLowerCase();
    return carriers.filter(c => c.toLowerCase().includes(lower)).slice(0, 50);
  }, [carriers, carrierSearch]);

  // Tab 1: Footprint
  const { data: footprint, isLoading: footprintLoading } = useQuery<CarrierFootprint>({
    queryKey: ["/api/carrier-movements/footprint", selectedCarrier],
    queryFn: () => fetch(`/api/carrier-movements/footprint?carrier=${encodeURIComponent(selectedCarrier)}`).then(r => r.json()),
    enabled: !!selectedCarrier && activeTab === "footprint",
  });

  // Tab 2: Dynamics
  const { data: dynamics, isLoading: dynamicsLoading } = useQuery<StateCarrierDynamic[]>({
    queryKey: ["/api/carrier-movements/dynamics", selectedState],
    queryFn: () => fetch(`/api/carrier-movements/dynamics?state=${encodeURIComponent(selectedState)}`).then(r => r.json()),
    enabled: !!selectedState && activeTab === "dynamics",
  });

  // Tab 3: Forecast
  const forecastState = activeTab === "forecast" ? selectedState : "";
  const { data: forecasts = [], isLoading: forecastLoading } = useQuery<MarketForecast[]>({
    queryKey: ["/api/carrier-movements/forecast", forecastState],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "40" });
      if (forecastState) params.set("state", forecastState);
      return fetch(`/api/carrier-movements/forecast?${params}`).then(r => r.json());
    },
    enabled: activeTab === "forecast",
  });

  // Tab 4: Expansion Map
  const { data: expansionData, isLoading: expansionLoading } = useQuery<ExpansionMapData>({
    queryKey: ["/api/carrier-movements/expansion-map", expansionCarrier, expansionState],
    queryFn: () =>
      fetch(`/api/carrier-movements/expansion-map?carrier=${encodeURIComponent(expansionCarrier)}&state=${encodeURIComponent(expansionState)}`).then(r => r.json()),
    enabled: !!expansionCarrier && !!expansionState && activeTab === "expansion",
  });

  const filteredForecasts = useMemo(() => {
    if (forecastFilter === "high") return forecasts.filter(f => f.predictedGrowth === "high");
    return forecasts;
  }, [forecasts, forecastFilter]);

  // Scatter plot data
  const scatterData = useMemo(() => {
    return filteredForecasts
      .filter(f => f.maPercentage > 0 || f.perCapitaSpending > 0)
      .map(f => ({
        name: `${f.county}, ${f.state}`,
        x: f.maPercentage,
        y: f.perCapitaSpending,
        z: Math.max(f.opportunityScore, 10),
        growth: f.predictedGrowth,
        carriers: f.currentCarriers,
        plans: f.currentPlans,
      }));
  }, [filteredForecasts]);

  // CSV export
  const exportForecastCSV = () => {
    const headers = ["County", "State", "Plans", "Carriers", "MA Penetration %", "Per Capita Spending", "Opportunity Score", "Predicted Growth", "Reasoning", "Likely Entrants"];
    const rows = filteredForecasts.map(f => [
      f.county, f.state, f.currentPlans, f.currentCarriers, f.maPercentage,
      f.perCapitaSpending, f.opportunityScore, f.predictedGrowth,
      f.reasoning.join("; "), f.likelyEntrants.join("; "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `market-forecast${forecastState ? `-${forecastState}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Dynamics computed insights ──
  const dynamicsInsight = useMemo(() => {
    if (!dynamics || dynamics.length === 0) return "";
    const sorted = [...dynamics].sort((a, b) => b.planCount - a.planCount);
    const strongest = sorted[0];
    const expanding = dynamics.filter(d => d.isExpanding);
    const fastestGrower = expanding.length > 0 ? expanding.sort((a, b) => b.countiesPresent - a.countiesPresent)[0] : null;

    let insight = `${strongest.carrier} is the strongest in ${selectedState} with ${strongest.countiesPresent} counties.`;
    if (fastestGrower && fastestGrower.carrier !== strongest.carrier) {
      insight += ` ${fastestGrower.carrier} is expanding with presence in ${fastestGrower.countiesPresent} counties.`;
    }
    return insight;
  }, [dynamics, selectedState]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Carrier Expansion & Exit Tracker"
        description="Track where carriers are entering new markets, leaving existing ones, and predict where they'll go next."
        badge="Intelligence"
        helpText="This dashboard analyzes carrier geographic footprints, market dynamics by state, and uses Medicare spending, MA penetration, HPSA data, and competitive density to forecast which counties are most likely to attract new carriers. The 'Likely Entrants' feature identifies carriers present in neighboring counties that could expand."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="footprint" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Carrier Footprint
          </TabsTrigger>
          <TabsTrigger value="dynamics" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Market Dynamics
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Market Forecast
          </TabsTrigger>
          <TabsTrigger value="expansion" className="flex items-center gap-2">
            <Expand className="h-4 w-4" />
            Expansion Map
          </TabsTrigger>
        </TabsList>

        {/* ────────────────── Tab 1: Carrier Footprint ────────────────── */}
        <TabsContent value="footprint" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search carriers..."
                      value={carrierSearch}
                      onChange={e => setCarrierSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                  <SelectTrigger className="w-[360px]">
                    <SelectValue placeholder="Select a carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCarriers.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {footprintLoading && selectedCarrier && (
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          )}

          {footprint && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">States Present</div>
                    <div className="text-2xl font-bold">{footprint.states}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Counties</div>
                    <div className="text-2xl font-bold">{fmt(footprint.counties)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Total Plans</div>
                    <div className="text-2xl font-bold">{fmt(footprint.totalPlans)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Total Enrollment</div>
                    <div className="text-2xl font-bold">{fmt(footprint.totalEnrollment)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Avg Star Rating</div>
                    <div className="text-2xl font-bold flex items-center gap-1">
                      {footprint.avgStarRating > 0 ? footprint.avgStarRating.toFixed(1) : "N/A"}
                      {footprint.avgStarRating > 0 && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Concentration Note */}
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {footprint.concentrationNote}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* State Breakdown Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plans per State</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(300, footprint.stateBreakdown.length * 28)}>
                      <BarChart
                        data={footprint.stateBreakdown.slice(0, 20)}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 40, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="state" type="category" width={35} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number) => [fmt(value), "Plans"]}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="plans" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Counties Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top 20 Counties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>County</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead className="text-right">Plans</TableHead>
                            <TableHead className="text-right">Enrollment</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {footprint.topCounties.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{c.county}</TableCell>
                              <TableCell>{c.state}</TableCell>
                              <TableCell className="text-right">{fmt(c.plans)}</TableCell>
                              <TableCell className="text-right">{fmt(c.enrollment)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!selectedCarrier && !footprintLoading && (
            <Card className="py-16">
              <CardContent className="text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a carrier to view their geographic footprint</p>
                <p className="text-sm mt-1">Search and select from the dropdown above</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ────────────────── Tab 2: Market Dynamics ────────────────── */}
        <TabsContent value="dynamics" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {states.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {dynamicsLoading && selectedState && (
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          )}

          {dynamics && dynamics.length > 0 && (
            <>
              {/* Insight */}
              {dynamicsInsight && (
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300">{dynamicsInsight}</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expanding Carriers */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    Expanding Carriers
                  </h3>
                  {dynamics.filter(d => d.isExpanding).length === 0 && (
                    <p className="text-sm text-muted-foreground">No carriers showing strong expansion signals in {selectedState}.</p>
                  )}
                  {dynamics.filter(d => d.isExpanding).map((d, i) => (
                    <Card key={i} className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{d.carrier}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {d.countiesPresent} counties -- {fmt(d.planCount)} plans -- {fmt(d.enrollment)} enrolled
                            </div>
                          </div>
                          <Badge className={strengthColors[d.strength]}>{d.strength}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Watch List */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <TrendingDown className="h-4 w-4" />
                    Watch List
                  </h3>
                  {dynamics.filter(d => !d.isExpanding).length === 0 && (
                    <p className="text-sm text-muted-foreground">All carriers are expanding in {selectedState}.</p>
                  )}
                  {dynamics.filter(d => !d.isExpanding).slice(0, 15).map((d, i) => (
                    <Card key={i} className={
                      d.strength === "weak"
                        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                        : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                    }>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{d.carrier}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {d.countiesPresent} counties -- {fmt(d.planCount)} plans -- {fmt(d.enrollment)} enrolled
                            </div>
                          </div>
                          <Badge className={strengthColors[d.strength]}>{d.strength}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* All carriers bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Carriers in {selectedState} by Plan Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(300, dynamics.length * 28)}>
                    <BarChart
                      data={[...dynamics].sort((a, b) => b.planCount - a.planCount).slice(0, 25)}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 120, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="carrier" type="category" width={115} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [fmt(value), name === "planCount" ? "Plans" : name]}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="planCount" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                        {[...dynamics].sort((a, b) => b.planCount - a.planCount).slice(0, 25).map((d, i) => (
                          <Cell key={i} fill={d.isExpanding ? "#22c55e" : d.strength === "weak" ? "#ef4444" : "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}

          {!selectedState && !dynamicsLoading && (
            <Card className="py-16">
              <CardContent className="text-center text-muted-foreground">
                <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a state to view carrier dynamics</p>
                <p className="text-sm mt-1">See which carriers are expanding or contracting</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ────────────────── Tab 3: Market Forecast ────────────────── */}
        <TabsContent value="forecast" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 flex-wrap">
                <Select value={selectedState || "all"} onValueChange={v => setSelectedState(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All states (national)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States (National)</SelectItem>
                    {states.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button
                    variant={forecastFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForecastFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={forecastFilter === "high" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForecastFilter("high")}
                  >
                    High Growth Only
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={exportForecastCSV} className="ml-auto">
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {forecastLoading && (
            <div className="space-y-4">
              <Skeleton className="h-[400px] rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          )}

          {!forecastLoading && filteredForecasts.length > 0 && (
            <>
              {/* Scatter Plot — the money visualization */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crosshair className="h-4 w-4" />
                    Where Should Carriers Go Next?
                  </CardTitle>
                  <CardDescription>
                    Each dot is a county. X = MA Penetration, Y = Per-Capita Medicare Spending, Size = Opportunity Score. Green = High growth predicted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={460}>
                    <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="MA Penetration"
                        unit="%"
                        label={{ value: "MA Penetration (%)", position: "bottom", offset: 20, style: { fontSize: 12, fill: "#888" } }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Per Capita Spending"
                        unit="$"
                        label={{ value: "Per Capita Spending ($)", angle: -90, position: "insideLeft", offset: -5, style: { fontSize: 12, fill: "#888" } }}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `$${Math.round(v / 1000)}K`}
                      />
                      <ZAxis type="number" dataKey="z" range={[40, 400]} name="Opportunity Score" />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ payload }) => {
                          if (!payload || payload.length === 0) return null;
                          const d = payload[0]?.payload;
                          if (!d) return null;
                          return (
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border shadow-lg text-sm">
                              <div className="font-semibold">{d.name}</div>
                              <div className="text-muted-foreground mt-1">MA Penetration: {d.x}%</div>
                              <div className="text-muted-foreground">Spending: ${d.y?.toLocaleString()}</div>
                              <div className="text-muted-foreground">Opportunity: {d.z}</div>
                              <div className="text-muted-foreground">Carriers: {d.carriers} | Plans: {d.plans}</div>
                              <div className="mt-1">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${growthColors[d.growth]}`}>
                                  {d.growth} growth
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterData} shape="circle">
                        {scatterData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={scatterColors[entry.growth]}
                            fillOpacity={0.7}
                            stroke={scatterColors[entry.growth]}
                            strokeWidth={1}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> High Growth
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Medium Growth
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" /> Low Growth
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Forecast Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Markets Most Likely to Attract New Carriers</CardTitle>
                  <CardDescription>{filteredForecasts.length} counties ranked by opportunity score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>County</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead className="text-right">Plans</TableHead>
                          <TableHead className="text-right">Carriers</TableHead>
                          <TableHead className="text-right">MA %</TableHead>
                          <TableHead className="text-right">Spending</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead>Growth</TableHead>
                          <TableHead>Reasoning</TableHead>
                          <TableHead>Likely Entrants</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredForecasts.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium whitespace-nowrap">{f.county}</TableCell>
                            <TableCell>{f.state}</TableCell>
                            <TableCell className="text-right">{f.currentPlans}</TableCell>
                            <TableCell className="text-right">{f.currentCarriers}</TableCell>
                            <TableCell className="text-right">{f.maPercentage > 0 ? `${f.maPercentage}%` : "--"}</TableCell>
                            <TableCell className="text-right">{f.perCapitaSpending > 0 ? fmtDollar(f.perCapitaSpending) : "--"}</TableCell>
                            <TableCell className="text-right font-semibold">{f.opportunityScore}</TableCell>
                            <TableCell>
                              <Badge className={growthColors[f.predictedGrowth]}>{f.predictedGrowth}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                              {f.reasoning.slice(0, 3).join(", ")}
                            </TableCell>
                            <TableCell className="text-xs max-w-[180px]">
                              {f.likelyEntrants.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {f.likelyEntrants.slice(0, 3).map((e, j) => (
                                    <Badge key={j} variant="outline" className="text-xs">{e}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!forecastLoading && filteredForecasts.length === 0 && (
            <Card className="py-16">
              <CardContent className="text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No forecast data available</p>
                <p className="text-sm mt-1">Try selecting a different state or adjusting filters</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ────────────────── Tab 4: Expansion Map ────────────────── */}
        <TabsContent value="expansion" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 flex-wrap">
                <Select value={expansionCarrier} onValueChange={setExpansionCarrier}>
                  <SelectTrigger className="w-[360px]">
                    <SelectValue placeholder="Select a carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.slice(0, 60).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={expansionState} onValueChange={setExpansionState}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {expansionLoading && (
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          )}

          {expansionData && (
            <>
              {/* Current Presence */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      Present Counties ({expansionData.present.length})
                    </CardTitle>
                    <CardDescription>
                      Counties where {expansionCarrier} currently offers plans in {expansionState}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>County</TableHead>
                            <TableHead className="text-right">Plans</TableHead>
                            <TableHead className="text-right">Enrollment</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expansionData.present.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{p.county}</TableCell>
                              <TableCell className="text-right">{p.plans}</TableCell>
                              <TableCell className="text-right">{fmt(p.enrollment)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-amber-400" />
                      Top Expansion Opportunities ({expansionData.opportunities.length})
                    </CardTitle>
                    <CardDescription>
                      Counties in {expansionState} where {expansionCarrier} is NOT present but could expand
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>County</TableHead>
                            <TableHead className="text-right">Carriers</TableHead>
                            <TableHead className="text-right">Plans</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead>Why</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expansionData.opportunities.map((o, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{o.county}</TableCell>
                              <TableCell className="text-right">{o.currentCarriers}</TableCell>
                              <TableCell className="text-right">{o.currentPlans}</TableCell>
                              <TableCell className="text-right">
                                <Badge className={
                                  o.forecastScore >= 60 ? growthColors.high :
                                  o.forecastScore >= 40 ? growthColors.medium : growthColors.low
                                }>
                                  {o.forecastScore}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px]">{o.reasoning}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Visual summary */}
              <Card className="bg-gradient-to-r from-blue-50 to-amber-50 dark:from-blue-950/30 dark:to-amber-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm">
                    <strong>{expansionCarrier}</strong> is present in{" "}
                    <span className="font-semibold text-blue-700 dark:text-blue-400">{expansionData.present.length} counties</span> in {expansionState}.
                    There are{" "}
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{expansionData.opportunities.length} expansion opportunities</span> in
                    counties where the carrier is not yet present.
                    {expansionData.opportunities.length > 0 && (
                      <> The top opportunity is <strong>{expansionData.opportunities[0].county}</strong> ({expansionData.opportunities[0].reasoning}).</>
                    )}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {(!expansionCarrier || !expansionState) && !expansionLoading && (
            <Card className="py-16">
              <CardContent className="text-center text-muted-foreground">
                <Expand className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a carrier and state to see expansion opportunities</p>
                <p className="text-sm mt-1">View where a carrier is present and where they could expand</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
