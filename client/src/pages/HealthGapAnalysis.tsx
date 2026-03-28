import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle,
  Minus,
  Lightbulb,
  Target,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

// ── Types ──

interface HealthGap {
  condition: string;
  conditionLabel: string;
  estimatedRate: number;
  relevantBenefit: string;
  benefitLabel: string;
  coverageRate: number;
  gapSeverity: "critical" | "moderate" | "low";
  recommendation: string;
}

interface HealthGapAnalysis {
  county: string;
  state: string;
  stateName: string;
  planCount: number;
  gaps: HealthGap[];
  overallGapScore: number;
  topRecommendation: string;
}

// ── Component ──

export default function HealthGapAnalysisPage() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounty, setSelectedCounty] = useState<HealthGapAnalysis | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const stateParam = selectedState ? `?state=${selectedState}&limit=50` : "?limit=50";

  const { data: analyses, isLoading } = useQuery<HealthGapAnalysis[]>({
    queryKey: ["/api/health-gaps" + stateParam],
  });

  const handleCountyClick = (analysis: HealthGapAnalysis) => {
    setSelectedCounty(analysis);
    setSheetOpen(true);
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="text-[10px]">Critical</Badge>;
      case "moderate":
        return <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Moderate</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">Low</Badge>;
    }
  };

  const gapScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600 dark:text-red-400";
    if (score >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const gapScoreBarColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-green-500";
  };

  // Build the heatmap-style matrix data for the deep dive
  const buildHeatmapData = (gaps: HealthGap[]) => {
    const conditions = Array.from(new Set(gaps.map(g => g.conditionLabel)));
    const benefits = Array.from(new Set(gaps.map(g => g.benefitLabel)));

    return { conditions, benefits, gaps };
  };

  const heatmapCellColor = (gap: HealthGap | undefined) => {
    if (!gap) return "bg-muted/30";
    switch (gap.gapSeverity) {
      case "critical": return "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-200";
      case "moderate": return "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200";
      default: return "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Health x Benefits Gap Analysis"
        description="Where chronic conditions meet coverage gaps. Find the marketing angles nobody else sees."
        helpText="Red cells = high condition rate but low benefit coverage. These gaps represent opportunities for carriers and marketing messaging."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div />
        <Select value={selectedState} onValueChange={(v) => {
          setSelectedState(v === "all" ? "" : v);
          setSelectedCounty(null);
          setSheetOpen(false);
        }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(st => (
              <SelectItem key={st} value={st}>{st}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          {analyses && analyses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Critical Gap Counties</span>
                  </div>
                  <p className="text-3xl font-bold font-mono text-red-600">
                    {analyses.filter(a => a.overallGapScore >= 70).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Minus className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Moderate Gap Counties</span>
                  </div>
                  <p className="text-3xl font-bold font-mono text-amber-600">
                    {analyses.filter(a => a.overallGapScore >= 40 && a.overallGapScore < 70).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Low Gap Counties</span>
                  </div>
                  <p className="text-3xl font-bold font-mono text-green-600">
                    {analyses.filter(a => a.overallGapScore < 40).length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* County List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Counties Ranked by Gap Score</CardTitle>
              <CardDescription>
                Higher score = more health-benefit mismatches. Click for deep dive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {analyses && analyses.length > 0 ? analyses.map((analysis) => {
                    const topGaps = analysis.gaps.filter(g => g.gapSeverity === "critical").slice(0, 3);
                    if (topGaps.length === 0) {
                      // Show moderate gaps if no critical
                      const modGaps = analysis.gaps.filter(g => g.gapSeverity === "moderate").slice(0, 3);
                      topGaps.push(...modGaps);
                    }

                    return (
                      <div
                        key={`${analysis.county}-${analysis.state}`}
                        className="flex items-center gap-4 p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleCountyClick(analysis)}
                      >
                        {/* Gap Score Gauge */}
                        <div className="shrink-0 text-center w-16">
                          <div className={`text-2xl font-bold font-mono ${gapScoreColor(analysis.overallGapScore)}`}>
                            {analysis.overallGapScore}
                          </div>
                          <div className={`h-1.5 rounded-full mt-1 ${gapScoreBarColor(analysis.overallGapScore)}`}
                            style={{ width: `${Math.min(100, analysis.overallGapScore)}%` }}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">gap score</p>
                        </div>

                        {/* County Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{analysis.county}, {analysis.state}</p>
                            <Badge variant="outline" className="text-[10px]">{analysis.planCount} plans</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {analysis.topRecommendation}
                          </p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {topGaps.slice(0, 3).map((gap, i) => (
                              <span key={i}>
                                {severityBadge(gap.gapSeverity)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No health gap data found. Try selecting a state.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── County Deep Dive Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCounty && (() => {
            const { conditions, benefits, gaps } = buildHeatmapData(selectedCounty.gaps);
            const criticalGaps = selectedCounty.gaps.filter(g => g.gapSeverity === "critical");
            const moderateGaps = selectedCounty.gaps.filter(g => g.gapSeverity === "moderate");

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-xl flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-rose-500" />
                    {selectedCounty.county}, {selectedCounty.state}
                  </SheetTitle>
                  <SheetDescription>
                    {selectedCounty.planCount} plans analyzed | Gap Score: {selectedCounty.overallGapScore}/100
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Overall Score */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
                    <div className={`text-4xl font-bold font-mono ${gapScoreColor(selectedCounty.overallGapScore)}`}>
                      {selectedCounty.overallGapScore}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Overall Gap Score</p>
                      <p className="text-xs text-muted-foreground">
                        {criticalGaps.length} critical gaps, {moderateGaps.length} moderate gaps
                      </p>
                    </div>
                  </div>

                  {/* Top Recommendation */}
                  <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold">Top Recommendation</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedCounty.topRecommendation}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Heatmap Matrix */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Condition x Benefit Matrix
                    </h3>
                    <div className="rounded-lg border overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 z-10">Condition</th>
                            {benefits.map(b => (
                              <th key={b} className="text-center p-2 font-medium whitespace-nowrap">{b}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {conditions.map(condition => (
                            <tr key={condition} className="border-t">
                              <td className="p-2 font-medium sticky left-0 bg-background z-10 whitespace-nowrap">
                                {condition}
                              </td>
                              {benefits.map(benefit => {
                                const gap = gaps.find(
                                  g => g.conditionLabel === condition && g.benefitLabel === benefit
                                );
                                return (
                                  <td key={benefit} className={`p-2 text-center ${heatmapCellColor(gap)}`}>
                                    {gap ? (
                                      <div>
                                        <span className="font-mono font-semibold">{gap.coverageRate}%</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">--</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/40 border" />
                        Critical gap
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/40 border" />
                        Moderate gap
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-950/40 border" />
                        Good coverage
                      </div>
                    </div>
                  </div>

                  {/* Coverage Rate Chart */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Benefit Coverage Rates</h3>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(() => {
                            const benefitMap = new Map<string, { label: string; rate: number; severity: string }>();
                            for (const g of selectedCounty.gaps) {
                              if (!benefitMap.has(g.benefitLabel) || g.gapSeverity === "critical") {
                                benefitMap.set(g.benefitLabel, {
                                  label: g.benefitLabel,
                                  rate: g.coverageRate,
                                  severity: g.gapSeverity,
                                });
                              }
                            }
                            return [...benefitMap.values()].sort((a, b) => a.rate - b.rate);
                          })()}
                          layout="vertical"
                          margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                          <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                          <RechartsTooltip
                            formatter={(value: number) => [`${value}%`, "Coverage Rate"]}
                          />
                          <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                            {(() => {
                              const benefitMap = new Map<string, { label: string; rate: number; severity: string }>();
                              for (const g of selectedCounty.gaps) {
                                if (!benefitMap.has(g.benefitLabel) || g.gapSeverity === "critical") {
                                  benefitMap.set(g.benefitLabel, {
                                    label: g.benefitLabel,
                                    rate: g.coverageRate,
                                    severity: g.gapSeverity,
                                  });
                                }
                              }
                              return [...benefitMap.values()].sort((a, b) => a.rate - b.rate).map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    entry.severity === "critical" ? "#ef4444" :
                                    entry.severity === "moderate" ? "#f59e0b" : "#22c55e"
                                  }
                                />
                              ));
                            })()}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Specific Recommendations */}
                  {criticalGaps.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Marketing Angles
                      </h3>
                      <div className="space-y-2">
                        {criticalGaps.slice(0, 6).map((gap, i) => (
                          <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                            <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                              Marketing Angle: {gap.conditionLabel} x {gap.benefitLabel}
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                              Lead with {gap.benefitLabel.toLowerCase()} messaging — {Math.round(gap.estimatedRate * 100)}% estimated {gap.conditionLabel.toLowerCase()} rate but only {gap.coverageRate}% of plans offer {gap.benefitLabel.toLowerCase()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
