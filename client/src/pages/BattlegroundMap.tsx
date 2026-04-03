import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Map,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  Crown,
  Target,
} from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

// US states TopoJSON
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// State name to abbreviation map
const STATE_NAME_TO_ABBR: Record<string, string> = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
  "Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC",
  "Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL",
  "Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
  "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
  "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
  "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
  "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR",
  "Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
  "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA",
  "Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
  "Puerto Rico":"PR",
};

// Carrier color palette — visually distinct
const CARRIER_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#a855f7",
  "#6366f1", "#84cc16", "#e11d48", "#0ea5e9", "#d946ef",
  "#10b981", "#f43f5e", "#7c3aed", "#eab308", "#64748b",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

// ── Types ──

interface CarrierStats {
  name: string;
  share: number;
  planCount: number;
  avgDental: number;
  avgOtc: number;
  avgPremium: number;
  avgStarRating: number;
}

interface CountyBattleground {
  county: string;
  state: string;
  fips: string;
  totalPlans: number;
  dominantCarrier: { name: string; share: number; planCount: number };
  topCarriers: CarrierStats[];
  vulnerabilities: string[];
  opportunities: string[];
}

interface StateOverview {
  state: string;
  stateName: string;
  counties: CountyBattleground[];
  carrierTerritories: Array<{
    carrier: string;
    countiesWon: number;
    totalCounties: number;
    avgShare: number;
  }>;
}

interface StatesOverviewItem {
  state: string;
  stateName: string;
  counties: number;
  totalPlans: number;
  topCarrier: string;
}

// ── Component ──

export default function BattlegroundMap() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounty, setSelectedCounty] = useState<CountyBattleground | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // All states overview for the map
  const { data: statesOverview, isLoading: statesLoading } = useQuery<StatesOverviewItem[]>({
    queryKey: ["/api/battleground"],
    enabled: !selectedState,
  });

  // State detail when a state is selected
  const { data: stateDetail, isLoading: stateLoading } = useQuery<StateOverview>({
    queryKey: [`/api/battleground?state=${selectedState}`],
    enabled: !!selectedState,
  });

  // Build carrier color map from state data
  const carrierColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (stateDetail?.carrierTerritories) {
      stateDetail.carrierTerritories.forEach((ct: any, i: number) => {
        map[ct.carrier] = CARRIER_COLORS[i % CARRIER_COLORS.length];
      });
    }
    return map;
  }, [stateDetail]);

  // Build state color map from overview data
  const stateColorMap = useMemo(() => {
    const map: Record<string, { color: string; carrier: string; plans: number }> = {};
    if (statesOverview) {
      const carrierSet: Record<string, boolean> = {};
      statesOverview.forEach((s: any) => { carrierSet[s.topCarrier] = true; });
      const carriers = Object.keys(carrierSet);
      const carrierIdx: Record<string, number> = {};
      carriers.forEach((c, i) => { carrierIdx[c] = i; });
      statesOverview.forEach((s: any) => {
        const idx = carrierIdx[s.topCarrier] || 0;
        map[s.state] = {
          color: CARRIER_COLORS[idx % CARRIER_COLORS.length],
          carrier: s.topCarrier,
          plans: s.totalPlans,
        };
      });
    }
    return map;
  }, [statesOverview]);

  const handleCountyClick = (county: CountyBattleground) => {
    setSelectedCounty(county);
    setSheetOpen(true);
  };

  const handleStateClickOnMap = (stateAbbr: string) => {
    setSelectedState(stateAbbr);
    setSelectedCounty(null);
    setSheetOpen(false);
  };

  // Battleground insights when a state is selected
  const battleInsights = useMemo((): InsightItem[] => {
    if (!stateDetail) return [];
    const items: InsightItem[] = [];
    const counties = stateDetail.counties || [];
    const territories = stateDetail.carrierTerritories || [];

    // Dominant carrier
    if (territories.length > 0) {
      const top = territories[0];
      const pct = top.totalCounties > 0 ? Math.round((top.countiesWon / top.totalCounties) * 100) : 0;
      items.push({
        icon: "warning",
        text: `Dominant carrier: ${top.carrier} controls ${pct}% of counties (${top.countiesWon}/${top.totalCounties}) in ${selectedState}.`,
        priority: "high",
      });
    }

    // Vulnerability: county with most vulnerabilities
    const vulnCounty = [...counties].sort((a, b) => b.vulnerabilities.length - a.vulnerabilities.length)[0];
    if (vulnCounty && vulnCounty.vulnerabilities.length > 0) {
      items.push({
        icon: "alert",
        text: `Vulnerability: ${vulnCounty.county} — ${vulnCounty.vulnerabilities.length} weaknesses identified in ${vulnCounty.dominantCarrier.name}'s position.`,
        priority: "high",
      });
    }

    // Low-plan counties
    const lowPlan = counties.filter((c) => c.totalPlans < 5);
    if (lowPlan.length > 0) {
      items.push({
        icon: "opportunity",
        text: `${lowPlan.length} counties have fewer than 5 plans — first-mover advantage available.`,
        priority: "medium",
      });
    }

    // Opportunity counties
    const oppCounty = [...counties].sort((a, b) => b.opportunities.length - a.opportunities.length)[0];
    if (oppCounty && oppCounty.opportunities.length > 0) {
      items.push({
        icon: "target",
        text: `Best opportunity: ${oppCounty.county} has ${oppCounty.opportunities.length} actionable gaps to exploit.`,
        priority: "medium",
      });
    }

    return items.slice(0, 4);
  }, [stateDetail, selectedState]);

  const isLoading = statesLoading || stateLoading;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Carrier Battleground"
        description="Interactive map showing which carrier dominates each state and county."
        helpText="Click a state to see county-level carrier territories. Click a county for vulnerability analysis and competitive intelligence."
        dataSource="Data: CMS CY2026 PBP service area files mapped to states and counties. Carrier dominance calculated by plan count per geography. Vulnerability scores based on market concentration and benefit competitiveness."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div />
        <div className="flex items-center gap-3">
          <Select value={selectedState} onValueChange={(v) => {
            setSelectedState(v === "all" ? "" : v);
            setSelectedCounty(null);
            setSheetOpen(false);
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All States (US Map)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States (US Map)</SelectItem>
              {US_STATES.map(st => (
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Skeleton className="h-[500px] rounded-xl" /></div>
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      ) : !selectedState ? (
        /* ── National View ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* US Map */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">United States — Dominant Carrier by State</CardTitle>
              <CardDescription>Click a state to drill down into county-level data</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1000 }}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const stateName = geo.properties.name as string;
                      const stAbbr = STATE_NAME_TO_ABBR[stateName] || "";
                      const info = stateColorMap[stAbbr];
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => stAbbr && handleStateClickOnMap(stAbbr)}
                          style={{
                            default: {
                              fill: info?.color || "#e2e8f0",
                              stroke: "#ffffff",
                              strokeWidth: 0.75,
                              cursor: "pointer",
                            },
                            hover: {
                              fill: info?.color || "#cbd5e1",
                              stroke: "#1e293b",
                              strokeWidth: 1.5,
                              cursor: "pointer",
                              filter: "brightness(0.85)",
                            },
                            pressed: {
                              fill: info?.color || "#94a3b8",
                              stroke: "#1e293b",
                              strokeWidth: 1.5,
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
            </CardContent>
          </Card>

          {/* State Rankings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Territory Standings
              </CardTitle>
              <CardDescription>Top carriers by state dominance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[440px]">
                {statesOverview && statesOverview.length > 0 ? (
                  <div className="space-y-3">
                    {(() => {
                      // Aggregate carrier stats
                      const carrierObj: Record<string, { statesWon: number; totalPlans: number }> = {};
                      statesOverview.forEach((s: any) => {
                        const existing = carrierObj[s.topCarrier] || { statesWon: 0, totalPlans: 0 };
                        existing.statesWon++;
                        existing.totalPlans += s.totalPlans;
                        carrierObj[s.topCarrier] = existing;
                      });
                      const sorted = Object.entries(carrierObj).sort((a, b) => b[1].statesWon - a[1].statesWon);
                      const carrierIdxObj: Record<string, number> = {};
                      sorted.forEach(([c], i) => { carrierIdxObj[c] = i; });

                      return sorted.slice(0, 15).map(([carrier, stats], i) => {
                        const idx = carrierIdxObj[carrier] || 0;
                        return (
                          <div key={carrier} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <div
                              className="w-4 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: CARRIER_COLORS[idx % CARRIER_COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{carrier}</p>
                              <p className="text-xs text-muted-foreground">
                                {stats.statesWon} of {statesOverview.length} states
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-mono font-semibold">{stats.totalPlans.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">plans</p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── State Drilldown ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* County Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {stateDetail?.stateName || selectedState} — County Battleground
                  </CardTitle>
                  <CardDescription>
                    {stateDetail?.counties.length || 0} counties analyzed
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {stateDetail?.counties.reduce((s, c) => s + c.totalPlans, 0)?.toLocaleString() || 0} total plans
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <div className="space-y-2">
                  {stateDetail?.counties.map((county) => {
                    const color = carrierColorMap[county.dominantCarrier.name] || "#64748b";
                    return (
                      <div
                        key={county.county}
                        className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleCountyClick(county)}
                      >
                        <div className="w-3 h-full min-h-[40px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{county.county}</p>
                            <Badge variant="secondary" className="text-[10px]">{county.totalPlans} plans</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Led by <span className="font-medium">{county.dominantCarrier.name}</span> ({county.dominantCarrier.share}% share)
                          </p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {county.vulnerabilities.length > 0 && (
                              <Badge variant="destructive" className="text-[10px]">
                                {county.vulnerabilities.length} vulnerabilities
                              </Badge>
                            )}
                            {county.opportunities.length > 0 && (
                              <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                {county.opportunities.length} opportunities
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                  {(!stateDetail?.counties || stateDetail.counties.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">No county data found for this state</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Territory Standings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Territory Standings
              </CardTitle>
              <CardDescription>Carriers ranked by counties dominated in {selectedState}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <div className="space-y-3">
                  {stateDetail?.carrierTerritories.map((ct, i) => {
                    const color = carrierColorMap[ct.carrier] || CARRIER_COLORS[i % CARRIER_COLORS.length];
                    const pct = ct.totalCounties > 0 ? Math.round((ct.countiesWon / ct.totalCounties) * 100) : 0;
                    return (
                      <div key={ct.carrier} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-sm font-medium truncate flex-1">{ct.carrier}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {ct.countiesWon}/{ct.totalCounties}
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          Avg {ct.avgShare}% share in won counties
                        </p>
                      </div>
                    );
                  })}
                  {(!stateDetail?.carrierTerritories || stateDetail.carrierTerritories.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-8">No carrier territory data</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedState && battleInsights.length > 0 && (
        <InsightBox
          title={`Action Items — ${stateDetail?.stateName || selectedState}`}
          insights={battleInsights}
        />
      )}

      {/* ── County Deep Dive Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedCounty && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">
                  {selectedCounty.county}, {selectedCounty.state}
                </SheetTitle>
                <SheetDescription>
                  {selectedCounty.totalPlans} plans from {selectedCounty.topCarriers.length} carriers
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Carrier Breakdown Chart */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Carrier Market Share</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={selectedCounty.topCarriers.slice(0, 8).map(c => ({
                          name: c.name.length > 20 ? c.name.slice(0, 18) + ".." : c.name,
                          share: c.share,
                          plans: c.planCount,
                          fullName: c.name,
                        }))}
                        layout="vertical"
                        margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number, _name: string, entry: any) =>
                            [`${value}% (${entry.payload.plans} plans)`, "Market Share"]
                          }
                          labelFormatter={(label: string, payload: any[]) =>
                            payload?.[0]?.payload?.fullName || label
                          }
                        />
                        <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                          {selectedCounty.topCarriers.slice(0, 8).map((c, i) => (
                            <Cell
                              key={c.name}
                              fill={carrierColorMap[c.name] || CARRIER_COLORS[i % CARRIER_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Carrier Benefit Comparison */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Carrier Benefits Comparison</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 font-medium">Carrier</th>
                          <th className="text-right p-2 font-medium">Plans</th>
                          <th className="text-right p-2 font-medium">Dental</th>
                          <th className="text-right p-2 font-medium">Premium</th>
                          <th className="text-right p-2 font-medium">Stars</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCounty.topCarriers.slice(0, 8).map(c => (
                          <tr key={c.name} className="border-t">
                            <td className="p-2 font-medium truncate max-w-[160px]">{c.name}</td>
                            <td className="p-2 text-right font-mono">{c.planCount}</td>
                            <td className="p-2 text-right font-mono">${c.avgDental.toLocaleString()}</td>
                            <td className="p-2 text-right font-mono">${c.avgPremium}</td>
                            <td className="p-2 text-right font-mono">{c.avgStarRating || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Vulnerabilities */}
                {selectedCounty.vulnerabilities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Vulnerabilities
                    </h3>
                    <div className="space-y-2">
                      {selectedCounty.vulnerabilities.map((v, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                          <Badge variant="destructive" className="text-[10px] shrink-0 mt-0.5">VULN</Badge>
                          <p className="text-xs text-red-800 dark:text-red-200">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunities */}
                {selectedCounty.opportunities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-green-500" />
                      Opportunities
                    </h3>
                    <div className="space-y-2">
                      {selectedCounty.opportunities.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <Badge className="text-[10px] shrink-0 mt-0.5 bg-green-600 text-white">OPP</Badge>
                          <p className="text-xs text-green-800 dark:text-green-200">{o}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attack Plan */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Attack Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      To win <span className="font-bold">{selectedCounty.county}</span>, offer:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {selectedCounty.vulnerabilities.length > 0 && selectedCounty.topCarriers[0] && (
                        <li className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <ChevronRight className="h-3 w-3 text-primary" />
                          Beat {selectedCounty.dominantCarrier.name}'s dental (${selectedCounty.topCarriers[0].avgDental.toLocaleString()})
                        </li>
                      )}
                      {selectedCounty.opportunities.map((o, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <ChevronRight className="h-3 w-3 text-primary" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
