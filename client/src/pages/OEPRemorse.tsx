import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Download,
  Star,
  Clock,
  Users,
  TrendingDown,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import { StatCard } from "@/components/StatCard";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

interface BelowAveragePlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  state: string;
  counties: number;
  enrollmentCount: number;
  premiumVsAvg: number;
  dentalVsAvg: number;
  otcVsAvg: number;
  starRating: number;
  starVsAvg: number;
  underperformanceScore: number;
  betterAlternatives: Array<{ name: string; carrier: string; premium: number; dental: number; whyBetter: string }>;
  estimatedSwitchableMembers: number;
  agentPitch: string;
}

function getOEPStatus(): { label: string; color: string; isActive: boolean; daysText: string } {
  const now = new Date();
  const year = now.getFullYear();
  const oepStart = new Date(year, 0, 1); // Jan 1
  const oepEnd = new Date(year, 2, 31); // Mar 31

  if (now >= oepStart && now <= oepEnd) {
    const daysLeft = Math.ceil((oepEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { label: "OEP ACTIVE", color: "bg-green-500", isActive: true, daysText: `${daysLeft} days remaining` };
  }

  const nextOepStart = now > oepEnd ? new Date(year + 1, 0, 1) : oepStart;
  const daysUntil = Math.ceil((nextOepStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { label: "OEP Inactive", color: "bg-amber-500", isActive: false, daysText: `${daysUntil} days until next OEP` };
}

export default function OEPRemorse() {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const oepStatus = getOEPStatus();

  const { data, isLoading, error } = useQuery<BelowAveragePlan[]>({
    queryKey: ["/api/pipeline/oep-remorse", stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateFilter !== "all") params.set("state", stateFilter);
      params.set("limit", "30");
      const res = await fetch(`/api/pipeline/oep-remorse?${params}`);
      if (!res.ok) throw new Error("Failed to fetch OEP remorse data");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalSwitchable = data.reduce((sum, d) => sum + d.estimatedSwitchableMembers, 0);
    const stateMap = data.reduce((acc, d) => {
      acc[d.state] = (acc[d.state] || 0) + d.estimatedSwitchableMembers;
      return acc;
    }, {} as Record<string, number>);
    const topState = Object.entries(stateMap).sort((a, b) => b[1] - a[1])[0];
    return {
      planCount: data.length,
      totalSwitchable,
      topState,
    };
  }, [data]);

  const insights: InsightItem[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    const items: InsightItem[] = [];
    const totalSwitchable = data.reduce((sum, d) => sum + d.estimatedSwitchableMembers, 0);
    const totalPlans = data.length;
    items.push({
      icon: "target",
      text: `${totalSwitchable.toLocaleString()} estimated members across ${totalPlans} below-average plans are on subpar coverage. During OEP (Jan-Mar), they can switch.`,
      priority: "high",
    });

    const worstPremium = data.filter(d => d.premiumVsAvg > 10).sort((a, b) => b.premiumVsAvg - a.premiumVsAvg)[0];
    if (worstPremium) {
      items.push({
        icon: "alert",
        text: `${worstPremium.planName} (${worstPremium.carrier}) charges $${worstPremium.premiumVsAvg.toFixed(0)}/month more than county average. Members are overpaying.`,
        priority: "high",
      });
    }

    const worstDental = data.filter(d => d.dentalVsAvg < -200).sort((a, b) => a.dentalVsAvg - b.dentalVsAvg)[0];
    if (worstDental) {
      items.push({
        icon: "opportunity",
        text: `${worstDental.planName} offers $${Math.abs(worstDental.dentalVsAvg)} less dental than county average. Members are missing significant benefits.`,
        priority: "medium",
      });
    }

    return items;
  }, [data]);

  function exportCSV() {
    if (!data) return;
    const headers = ["Plan Name", "Carrier", "State", "Counties", "Premium vs Avg", "Dental vs Avg", "OTC vs Avg", "Star Rating", "Stars vs Avg", "Underperf. Score", "Est. Switchable", "Agent Pitch"];
    const rows = data.map(d => [
      `"${d.planName}"`, `"${d.carrier}"`, d.state, d.counties,
      d.premiumVsAvg, d.dentalVsAvg, d.otcVsAvg, d.starRating, d.starVsAvg,
      d.underperformanceScore, d.estimatedSwitchableMembers,
      `"${d.agentPitch.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oep-remorse-targets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="OEP Buyer's Remorse"
        description="Identify MA members on below-average plans who may want to switch during the Open Enrollment Period."
        helpText="During OEP (Jan 1 - Mar 31), MA enrollees can switch to a different MA plan. This tool compares each plan's premium, dental, OTC, and star rating against the county average to find below-average plans whose members are ripe for outreach."
        badge="OEP"
        dataSource="Data: CMS CY2026 PBP files. Plans scored against county averages for premium, dental, OTC, and star rating. Below-average plans identified as switch candidates during OEP (Jan 1 - Mar 31)."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${oepStatus.color} ${oepStatus.isActive ? "animate-pulse" : ""}`} />
              <span className="text-sm font-medium">{oepStatus.label}</span>
              <span className="text-xs text-muted-foreground">{oepStatus.daysText}</span>
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Below-Average Plans"
            value={stats.planCount}
            icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          />
          <StatCard
            label="Est. Switchable Members"
            value={stats.totalSwitchable.toLocaleString()}
            icon={<Users className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Top Target State"
            value={stats.topState ? `${stats.topState[0]} (${stats.topState[1].toLocaleString()})` : "N/A"}
            icon={<RefreshCw className="h-5 w-5 text-emerald-500" />}
          />
        </div>
      ) : null}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={stateFilter} onValueChange={setStateFilter}>
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

      {/* Insight Box */}
      {insights.length > 0 && (
        <InsightBox title="OEP Outreach Intelligence" insights={insights} />
      )}

      {/* Plan Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Failed to load OEP remorse data. Ensure plans data is loaded.
          </CardContent>
        </Card>
      ) : data && data.length > 0 ? (
        <div className="space-y-4">
          {data.map((plan, i) => (
            <Card key={`${plan.contractId}-${plan.planId}-${i}`} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{plan.planName}</CardTitle>
                    <CardDescription>{plan.carrier} | {plan.state} | {plan.counties} counties</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={plan.underperformanceScore > 40 ? "destructive" : "secondary"}>
                      Score: {plan.underperformanceScore}
                    </Badge>
                    <Badge variant="outline">
                      ~{plan.estimatedSwitchableMembers.toLocaleString()} members
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics comparison */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricBadge
                    label="Premium vs Avg"
                    value={plan.premiumVsAvg}
                    format="dollar"
                    invertColor
                  />
                  <MetricBadge
                    label="Dental vs Avg"
                    value={plan.dentalVsAvg}
                    format="dollar"
                  />
                  <MetricBadge
                    label="OTC vs Avg"
                    value={plan.otcVsAvg}
                    format="dollar"
                  />
                  <div className="flex flex-col items-center p-2 rounded-lg border bg-muted/30">
                    <span className="text-xs text-muted-foreground mb-1">Star Rating</span>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-mono font-semibold">{plan.starRating || "N/A"}</span>
                      {plan.starVsAvg !== 0 && (
                        <span className={`text-xs font-medium ${plan.starVsAvg < 0 ? "text-red-500" : "text-green-500"}`}>
                          ({plan.starVsAvg > 0 ? "+" : ""}{plan.starVsAvg})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Better alternatives */}
                {plan.betterAlternatives.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Better Alternatives:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {plan.betterAlternatives.map((alt, j) => (
                        <div key={j} className="flex items-start gap-2 p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20">
                          <ArrowRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{alt.name}</p>
                            <p className="text-xs text-muted-foreground">{alt.carrier}</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">{alt.whyBetter}</p>
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              <span>${alt.premium}/mo</span>
                              <span>${alt.dental} dental</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent pitch */}
                <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                  <p className="text-sm">
                    <span className="font-medium text-blue-700 dark:text-blue-300">Agent Pitch: </span>
                    {plan.agentPitch}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No below-average plans found. Try a different state filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricBadge({
  label,
  value,
  format,
  invertColor = false,
}: {
  label: string;
  value: number;
  format: "dollar" | "number";
  invertColor?: boolean;
}) {
  // For premium: positive = bad (more expensive). For dental/OTC: negative = bad (less benefit).
  // invertColor flips the logic for premium.
  const isGood = invertColor ? value <= 0 : value >= 0;
  const isBad = invertColor ? value > 0 : value < 0;
  const colorClass = isBad
    ? "text-red-600 dark:text-red-400"
    : isGood && value !== 0
      ? "text-green-600 dark:text-green-400"
      : "text-muted-foreground";
  const bgClass = isBad
    ? "bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800"
    : "bg-muted/30";

  const displayValue = format === "dollar"
    ? `${value >= 0 ? "+" : ""}$${Math.abs(Math.round(value))}`
    : `${value >= 0 ? "+" : ""}${Math.round(value)}`;

  return (
    <div className={`flex flex-col items-center p-2 rounded-lg border ${bgClass}`}>
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <span className={`font-mono font-semibold ${colorClass}`}>{displayValue}</span>
    </div>
  );
}
