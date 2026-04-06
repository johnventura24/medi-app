import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Target, Users, TrendingUp, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

interface OpportunityRow {
  state: string;
  county?: string;
  totalBeneficiaries: number;
  maPenetration: number;
  ffsAddressable: number;
  opportunityScore: number;
  volumeScore: number;
  penetrationGapScore: number;
  benefitGapScore: number;
  competitionScore: number;
  planCount: number;
  carrierCount: number;
  avgPremium: number;
  avgStarRating: number;
  zeroPremiumPlans: number;
  diabetesRate: number;
  uninsuredRate: number;
  medianIncome: number;
  reasons: string[];
}

function ScoreBar({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const color =
    score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const width = `${Math.min(Math.max(score, 0), 100)}%`;
  const h = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-20 rounded-full bg-muted", h)}>
        <div className={cn("rounded-full", h, color)} style={{ width }} />
      </div>
      <span className={cn("font-mono font-semibold tabular-nums", size === "sm" ? "text-xs" : "text-sm")}>
        {score}
      </span>
    </div>
  );
}

function SubScoreBreakdown({ row }: { row: OpportunityRow }) {
  const scores = [
    { label: "Volume", value: row.volumeScore, max: 25 },
    { label: "Penetration Gap", value: row.penetrationGapScore, max: 25 },
    { label: "Benefit Gap", value: row.benefitGapScore, max: 25 },
    { label: "Competition", value: row.competitionScore, max: 25 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
      {scores.map((s) => {
        const pct = Math.round((s.value / s.max) * 100);
        const color =
          pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
        return (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.label}</span>
              <span className="font-mono font-semibold">{s.value}/{s.max}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={cn("h-2 rounded-full transition-all", color)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OpportunityRanker() {
  const [activeTab, setActiveTab] = useState<string>("states");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch states
  const {
    data: stateData = [],
    isLoading: statesLoading,
    error: statesError,
  } = useQuery<OpportunityRow[]>({
    queryKey: ["/api/opportunities/states"],
    queryFn: async () => {
      const res = await fetch("/api/opportunities/states?limit=20");
      if (!res.ok) throw new Error("Failed to fetch state opportunities");
      return res.json();
    },
  });

  // Fetch counties
  const {
    data: countyData = [],
    isLoading: countiesLoading,
    error: countiesError,
  } = useQuery<OpportunityRow[]>({
    queryKey: ["/api/opportunities/counties", stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (stateFilter !== "all") params.set("state", stateFilter);
      const res = await fetch(`/api/opportunities/counties?${params}`);
      if (!res.ok) throw new Error("Failed to fetch county opportunities");
      return res.json();
    },
  });

  const isLoading = activeTab === "states" ? statesLoading : countiesLoading;
  const error = activeTab === "states" ? statesError : countiesError;

  // Stats computed from whichever dataset is active
  const stats = useMemo(() => {
    const data = activeTab === "states" ? stateData : countyData;
    if (!data || data.length === 0) return null;

    const totalMarkets = data.length;
    const highestScore = Math.max(...data.map((d) => d.opportunityScore));
    const totalAddressable = data.reduce((sum, d) => sum + d.ffsAddressable, 0);
    const avgPenetration =
      Math.round(
        (data.reduce((sum, d) => sum + d.maPenetration, 0) / data.length) * 10
      ) / 10;

    return { totalMarkets, highestScore, totalAddressable, avgPenetration };
  }, [stateData, countyData, activeTab]);

  // Insights
  const insights = useMemo((): InsightItem[] => {
    const data = activeTab === "states" ? stateData : countyData;
    if (!data || data.length === 0) return [];

    const items: InsightItem[] = [];
    const top = data[0];
    if (top) {
      const label = top.county ? `${top.county}, ${top.state}` : top.state;
      items.push({
        icon: "target",
        text: `${label} ranks #1 with a score of ${top.opportunityScore}/100 — ${top.ffsAddressable.toLocaleString()} addressable FFS beneficiaries and only ${top.maPenetration}% MA penetration.`,
        priority: "high",
      });
    }

    const lowPen = data.filter((d) => d.maPenetration < 30);
    if (lowPen.length > 0) {
      items.push({
        icon: "opportunity",
        text: `${lowPen.length} markets with <30% MA penetration — over 70% of beneficiaries are still on Original Medicare. High conversion potential.`,
        priority: "medium",
      });
    }

    const lowComp = data.filter((d) => d.carrierCount <= 5);
    if (lowComp.length > 0) {
      items.push({
        icon: "trend",
        text: `${lowComp.length} markets with 5 or fewer carriers — less competition means easier differentiation and client acquisition.`,
        priority: "medium",
      });
    }

    return items.slice(0, 4);
  }, [stateData, countyData, activeTab]);

  function handleStateClick(state: string) {
    setStateFilter(state);
    setActiveTab("counties");
    setExpandedRow(null);
  }

  function toggleRow(key: string) {
    setExpandedRow((prev) => (prev === key ? null : key));
  }

  function exportCSV() {
    const data = activeTab === "states" ? stateData : countyData;
    if (!data || data.length === 0) return;
    const headers = [
      "Rank", "State", activeTab === "counties" ? "County" : null,
      "Opportunity Score", "Volume Score", "Penetration Gap Score",
      "Benefit Gap Score", "Competition Score", "Total Beneficiaries",
      "MA Penetration %", "FFS Addressable", "Plans", "Carriers",
      "Avg Premium", "Avg Stars", "Reasons",
    ].filter(Boolean);
    const rows = data.map((d, i) => {
      const cols = [
        i + 1, d.state,
        ...(activeTab === "counties" ? [d.county ?? ""] : []),
        d.opportunityScore, d.volumeScore, d.penetrationGapScore,
        d.benefitGapScore, d.competitionScore, d.totalBeneficiaries,
        d.maPenetration, d.ffsAddressable, d.planCount, d.carrierCount,
        d.avgPremium, d.avgStarRating,
        `"${(d.reasons || []).join("; ")}"`,
      ];
      return cols.join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opportunity-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Opportunity Ranker"
        description="Find the best states and counties for Medicare enrollment and plan switches. Ranked by market size, penetration gaps, benefit gaps, and competition."
        helpText="Higher scores mean more opportunity. The score combines market volume (how many beneficiaries), penetration gap (how many are still on Original Medicare), benefit gaps (underserved markets), and competition level (fewer carriers = more room)."
        dataSource="Data: CMS MA Penetration rates, County Health Rankings 2025, CMS Medicare Spending data, and CMS CY2026 PBP plan files."
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={isLoading || (!stateData.length && !countyData.length)}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      {/* Stats */}
      {isLoading ? (
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
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Markets Analyzed"
            value={stats.totalMarkets}
            icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Highest Opportunity Score"
            value={stats.highestScore}
            suffix="/100"
            icon={<Target className="h-5 w-5 text-emerald-500" />}
          />
          <StatCard
            label="Total Addressable (FFS)"
            value={stats.totalAddressable.toLocaleString()}
            icon={<Users className="h-5 w-5 text-violet-500" />}
          />
          <StatCard
            label="Avg MA Penetration"
            value={stats.avgPenetration}
            suffix="%"
            icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
          />
        </div>
      ) : null}

      {/* Insights */}
      {insights.length > 0 && (
        <InsightBox title="Opportunity Intelligence" insights={insights} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setExpandedRow(null); }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="states">States</TabsTrigger>
            <TabsTrigger value="counties">Counties</TabsTrigger>
          </TabsList>

          {activeTab === "counties" && (
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map((st) => (
                  <SelectItem key={st} value={st}>{st}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* States Tab */}
        <TabsContent value="states" className="mt-4">
          {statesLoading ? (
            <Skeleton className="h-96" />
          ) : statesError ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Failed to load state opportunity data. Please try again.
              </CardContent>
            </Card>
          ) : stateData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">States Ranked by Opportunity Score</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Beneficiaries</TableHead>
                        <TableHead className="text-right">MA Pen.</TableHead>
                        <TableHead className="text-right">FFS Addressable</TableHead>
                        <TableHead className="text-right">Plans</TableHead>
                        <TableHead className="text-right">Carriers</TableHead>
                        <TableHead className="text-right">Avg Premium</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stateData.map((row, i) => {
                        const key = `state-${row.state}`;
                        const isExpanded = expandedRow === key;
                        return (
                          <>
                            <TableRow
                              key={key}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRow(key)}
                            >
                              <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                              <TableCell>
                                <button
                                  className="font-semibold text-primary hover:underline"
                                  onClick={(e) => { e.stopPropagation(); handleStateClick(row.state); }}
                                >
                                  {row.state}
                                </button>
                                {row.reasons && row.reasons.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {row.reasons.slice(0, 3).map((r, j) => (
                                      <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {r}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <ScoreBar score={row.opportunityScore} />
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {row.totalBeneficiaries.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={row.maPenetration < 30 ? "destructive" : row.maPenetration < 50 ? "secondary" : "default"}>
                                  {row.maPenetration}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {row.ffsAddressable.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono">{row.planCount}</TableCell>
                              <TableCell className="text-right font-mono">{row.carrierCount}</TableCell>
                              <TableCell className="text-right font-mono">
                                ${row.avgPremium.toFixed(0)}
                              </TableCell>
                              <TableCell className="w-8">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${key}-detail`}>
                                <TableCell colSpan={10} className="p-0">
                                  <SubScoreBreakdown row={row} />
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No state opportunity data available. Ensure the opportunity scoring pipeline has been run.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Counties Tab */}
        <TabsContent value="counties" className="mt-4">
          {countiesLoading ? (
            <Skeleton className="h-96" />
          ) : countiesError ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Failed to load county opportunity data. Please try again.
              </CardContent>
            </Card>
          ) : countyData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Counties Ranked by Opportunity Score
                  {stateFilter !== "all" && (
                    <Badge variant="secondary" className="ml-2 text-xs">{stateFilter}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>County</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Beneficiaries</TableHead>
                        <TableHead className="text-right">MA Pen.</TableHead>
                        <TableHead className="text-right">FFS Addressable</TableHead>
                        <TableHead className="text-right">Plans</TableHead>
                        <TableHead className="text-right">Carriers</TableHead>
                        <TableHead className="text-right">Avg Premium</TableHead>
                        <TableHead className="text-right">Diabetes</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {countyData.map((row, i) => {
                        const key = `county-${row.state}-${row.county}`;
                        const isExpanded = expandedRow === key;
                        return (
                          <>
                            <TableRow
                              key={key}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRow(key)}
                            >
                              <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                              <TableCell>
                                <span className="font-semibold">{row.county}</span>
                                {row.reasons && row.reasons.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {row.reasons.slice(0, 3).map((r, j) => (
                                      <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {r}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{row.state}</TableCell>
                              <TableCell>
                                <ScoreBar score={row.opportunityScore} />
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {row.totalBeneficiaries.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={row.maPenetration < 30 ? "destructive" : row.maPenetration < 50 ? "secondary" : "default"}>
                                  {row.maPenetration}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {row.ffsAddressable.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono">{row.planCount}</TableCell>
                              <TableCell className="text-right font-mono">{row.carrierCount}</TableCell>
                              <TableCell className="text-right font-mono">
                                ${row.avgPremium.toFixed(0)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {row.diabetesRate}%
                              </TableCell>
                              <TableCell className="w-8">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${key}-detail`}>
                                <TableCell colSpan={12} className="p-0">
                                  <SubScoreBreakdown row={row} />
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No county opportunity data available.
                {stateFilter !== "all" ? " Try selecting a different state or 'All States'." : " Ensure the opportunity scoring pipeline has been run."}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
