import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  Award,
  BarChart3,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Star,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

interface CarrierScorecard {
  carrier: string;
  overallScore: number;
  metrics: {
    marketPresence: number;
    planDiversity: number;
    benefitGenerosity: number;
    qualityScore: number;
    enrollmentStrength: number;
    growthIndicator: number;
  };
  grade: string;
  strengths: string[];
  weaknesses: string[];
  stats: {
    totalPlans: number;
    statesServed: number;
    countiesServed: number;
    avgPremium: number;
    avgDental: number;
    avgStarRating: number;
    avgMoop: number;
    planTypes: string[];
    pctWithOtc: number;
    pctWithTransportation: number;
    pctWithMeals: number;
    pctWithFitness: number;
  };
}

type SortKey = "grade" | "enrollment" | "presence" | "quality" | "benefits";

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-600 bg-green-50 border-green-200";
  if (grade.startsWith("B")) return "text-blue-600 bg-blue-50 border-blue-200";
  if (grade.startsWith("C")) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (grade === "D") return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function gradeTextColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-600";
  if (grade.startsWith("B")) return "text-blue-600";
  if (grade.startsWith("C")) return "text-yellow-600";
  if (grade === "D") return "text-orange-600";
  return "text-red-600";
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/100</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export default function CarrierScorecards() {
  const [state, setState] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("grade");
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierScorecard | null>(null);

  const { data: scorecards, isLoading } = useQuery<CarrierScorecard[]>({
    queryKey: ["/api/scorecards", state],
    queryFn: async () => {
      const params = state && state !== "all" ? `?state=${state}` : "";
      const res = await fetch(`/api/scorecards${params}`);
      return res.json();
    },
  });

  const sortedScorecards = useMemo(() => {
    if (!scorecards) return [];
    const sorted = [...scorecards];
    switch (sortBy) {
      case "grade":
        sorted.sort((a, b) => b.overallScore - a.overallScore);
        break;
      case "enrollment":
        sorted.sort((a, b) => b.stats.totalPlans - a.stats.totalPlans);
        break;
      case "presence":
        sorted.sort((a, b) => b.metrics.marketPresence - a.metrics.marketPresence);
        break;
      case "quality":
        sorted.sort((a, b) => b.metrics.qualityScore - a.metrics.qualityScore);
        break;
      case "benefits":
        sorted.sort((a, b) => b.metrics.benefitGenerosity - a.metrics.benefitGenerosity);
        break;
    }
    return sorted;
  }, [scorecards, sortBy]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Carrier Scorecards"
        description="Financial health and market presence scoring for every carrier. See who's strong, who's growing, and who's falling behind."
        badge="Intelligence"
        helpText="Each carrier gets a scorecard with star ratings, benefit breadth, market share, and growth trajectory. Compare carriers head-to-head to understand competitive positioning."
        dataSource="Data: CMS CY2026 PBP files for benefit analysis, CMS Star Ratings for quality scores, and service area files for market footprint calculations."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-40">
          <label className="text-sm font-medium mb-1 block">State Filter</label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <label className="text-sm font-medium mb-1 block">Sort By</label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grade">Overall Grade</SelectItem>
              <SelectItem value="enrollment">Plan Count</SelectItem>
              <SelectItem value="presence">Market Presence</SelectItem>
              <SelectItem value="quality">Quality Score</SelectItem>
              <SelectItem value="benefits">Benefit Generosity</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scorecards && (
          <div className="flex items-end">
            <Badge variant="secondary" className="h-8">
              {scorecards.length} carriers
            </Badge>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Scorecard Grid */}
      {sortedScorecards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedScorecards.map((sc) => {
            const radarData = [
              { metric: "Market", value: sc.metrics.marketPresence },
              { metric: "Diversity", value: sc.metrics.planDiversity },
              { metric: "Benefits", value: sc.metrics.benefitGenerosity },
              { metric: "Quality", value: sc.metrics.qualityScore },
              { metric: "Enrollment", value: sc.metrics.enrollmentStrength },
              { metric: "Growth", value: sc.metrics.growthIndicator },
            ];

            return (
              <Card
                key={sc.carrier}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedCarrier(sc)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold truncate" title={sc.carrier}>
                        {sc.carrier}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {sc.stats.totalPlans} plans | {sc.stats.statesServed} states | {sc.stats.countiesServed} counties
                      </CardDescription>
                    </div>
                    <div className={`flex items-center justify-center w-12 h-12 rounded-lg border-2 text-xl font-black ${gradeColor(sc.grade)}`}>
                      {sc.grade}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Radar Chart */}
                  <div className="h-36 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          dataKey="value"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.2}
                          strokeWidth={1.5}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-[10px] font-medium text-green-600 mb-1">Strengths</p>
                      {sc.strengths.slice(0, 2).map((s, i) => (
                        <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                          <CheckCircle className="h-2.5 w-2.5 text-green-500 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{s}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-orange-600 mb-1">Weaknesses</p>
                      {sc.weaknesses.slice(0, 2).map((w, i) => (
                        <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                          <AlertTriangle className="h-2.5 w-2.5 text-orange-500 mt-0.5 shrink-0" />
                          <span className="line-clamp-1">{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Expanded Detail Dialog */}
      <Dialog open={!!selectedCarrier} onOpenChange={(open) => !open && setSelectedCarrier(null)}>
        {selectedCarrier && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-16 h-16 rounded-xl border-2 text-2xl font-black ${gradeColor(selectedCarrier.grade)}`}>
                  {selectedCarrier.grade}
                </div>
                <div>
                  <DialogTitle className="text-xl">{selectedCarrier.carrier}</DialogTitle>
                  <DialogDescription>
                    Overall Score: {selectedCarrier.overallScore}/100
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Key Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold">{selectedCarrier.stats.totalPlans}</div>
                  <div className="text-xs text-muted-foreground">Plans</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold">{selectedCarrier.stats.statesServed}</div>
                  <div className="text-xs text-muted-foreground">States</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold">{selectedCarrier.stats.countiesServed}</div>
                  <div className="text-xs text-muted-foreground">Counties</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-lg font-bold flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {selectedCarrier.stats.avgStarRating || "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Stars</div>
                </div>
              </div>

              {/* Radar Chart - larger */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scoring Dimensions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={[
                          { metric: "Market Presence", value: selectedCarrier.metrics.marketPresence },
                          { metric: "Plan Diversity", value: selectedCarrier.metrics.planDiversity },
                          { metric: "Benefit Generosity", value: selectedCarrier.metrics.benefitGenerosity },
                          { metric: "Quality Score", value: selectedCarrier.metrics.qualityScore },
                          { metric: "Enrollment Strength", value: selectedCarrier.metrics.enrollmentStrength },
                          { metric: "Growth Indicator", value: selectedCarrier.metrics.growthIndicator },
                        ]}
                        cx="50%" cy="50%" outerRadius="75%"
                      >
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                        <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Metric Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Metric Breakdown</h3>
                <MetricBar label="Market Presence (states + counties coverage)" value={selectedCarrier.metrics.marketPresence} />
                <MetricBar label="Plan Diversity (variety of plan types)" value={selectedCarrier.metrics.planDiversity} />
                <MetricBar label="Benefit Generosity (dental, OTC, supplementals)" value={selectedCarrier.metrics.benefitGenerosity} />
                <MetricBar label="Quality Score (star ratings)" value={selectedCarrier.metrics.qualityScore} />
                <MetricBar label="Enrollment Strength (plan count & reach)" value={selectedCarrier.metrics.enrollmentStrength} />
                <MetricBar label="Growth Indicator (market share trend)" value={selectedCarrier.metrics.growthIndicator} />
              </div>

              <Separator />

              {/* Supplemental Benefits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Benefit Coverage</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg Premium</span><span className="font-medium">${selectedCarrier.stats.avgPremium}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg Dental Limit</span><span className="font-medium">${selectedCarrier.stats.avgDental}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plans with OTC</span><span className="font-medium">{selectedCarrier.stats.pctWithOtc}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plans with Transport</span><span className="font-medium">{selectedCarrier.stats.pctWithTransportation}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plans with Meals</span><span className="font-medium">{selectedCarrier.stats.pctWithMeals}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plans with Fitness</span><span className="font-medium">{selectedCarrier.stats.pctWithFitness}%</span></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Plan Types</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedCarrier.stats.planTypes.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>

                  <h3 className="text-sm font-semibold mt-4 mb-2">Strengths</h3>
                  {selectedCarrier.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground mb-1">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}

                  <h3 className="text-sm font-semibold mt-4 mb-2">Weaknesses</h3>
                  {selectedCarrier.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground mb-1">
                      <AlertTriangle className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
