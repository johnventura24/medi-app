import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Clock,
  Flame,
  AlertTriangle,
  TrendingUp,
  Star,
  DollarSign,
  Stethoscope,
  Users,
  MapPin,
  Zap,
  CheckCircle,
  Shield,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

// ── Types ──

interface CountdownInfo {
  daysUntilAEP: number;
  daysUntilOEP: number;
  currentPeriod: "Pre-AEP" | "AEP" | "OEP" | "Off-Season";
  aepStart: string;
  aepEnd: string;
  oepStart: string;
  oepEnd: string;
}

interface MarketSnapshot {
  totalPlans: number;
  avgPremium: number;
  avgDental: number;
  plansWithZeroPremium: number;
  plansWithOtc: number;
  plansWithTransportation: number;
  plansWithMeals: number;
  avgStarRating: number;
  carrierCount: number;
  countyCount: number;
}

interface HotPlan {
  id: number;
  name: string;
  carrier: string;
  state: string;
  county: string;
  premium: number;
  dental: number;
  starRating: number;
  reason: string;
}

interface CountyAlert {
  county: string;
  state: string;
  alert: string;
  severity: "critical" | "warning" | "info";
  planCount: number;
  detail: string;
}

interface TopOpportunity {
  location: string;
  state: string;
  opportunity: string;
  score: number;
  category: string;
}

interface WarRoomData {
  countdown: CountdownInfo;
  marketSnapshot: MarketSnapshot;
  hotPlans: HotPlan[];
  countyAlerts: CountyAlert[];
  topOpportunities: TopOpportunity[];
}

// ── Component ──

export default function AEPWarRoom() {
  const [selectedState, setSelectedState] = useState<string>("");

  const stateParam = selectedState ? `?state=${selectedState}` : "";

  const { data, isLoading } = useQuery<WarRoomData>({
    queryKey: ["/api/warroom" + stateParam],
  });

  const countdown = data?.countdown;
  const snapshot = data?.marketSnapshot;
  const hotPlans = data?.hotPlans || [];
  const alerts = data?.countyAlerts || [];
  const opportunities = data?.topOpportunities || [];

  const isAEPLive = countdown?.currentPeriod === "AEP";
  const isOEPLive = countdown?.currentPeriod === "OEP";

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
      case "warning": return <Shield className="h-3.5 w-3.5 text-amber-500" />;
      default: return <CheckCircle className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30";
      case "warning": return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30";
      default: return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="AEP War Room"
        description="Real-time command center for Medicare enrollment periods. Know what's happening in your market."
        helpText="Hot plans are the best-value plans in your state. Alerts flag counties with limited options or changing benefits."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div />
        <Select value={selectedState} onValueChange={(v) => setSelectedState(v === "all" ? "" : v)}>
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Countdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* AEP Card */}
            <Card className={`${isAEPLive ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className={`h-5 w-5 ${isAEPLive ? "text-green-600" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium text-muted-foreground">Annual Enrollment</span>
                </div>
                {isAEPLive ? (
                  <div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">AEP IS LIVE</p>
                    <p className="text-sm text-muted-foreground mt-1">Oct 15 - Dec 7</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl font-bold font-mono">{countdown?.daysUntilAEP || "--"}</p>
                    <p className="text-sm text-muted-foreground mt-1">days until AEP starts</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OEP Card */}
            <Card className={`${isOEPLive ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className={`h-5 w-5 ${isOEPLive ? "text-blue-600" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium text-muted-foreground">Open Enrollment</span>
                </div>
                {isOEPLive ? (
                  <div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">OEP IS LIVE</p>
                    <p className="text-sm text-muted-foreground mt-1">Jan 1 - Mar 31</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl font-bold font-mono">{countdown?.daysUntilOEP || "--"}</p>
                    <p className="text-sm text-muted-foreground mt-1">days until OEP starts</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Period Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Current Period</span>
                </div>
                <Badge className="text-lg px-3 py-1 font-semibold" variant={
                  isAEPLive ? "default" : isOEPLive ? "default" : "secondary"
                }>
                  {countdown?.currentPeriod || "Loading..."}
                </Badge>
                <p className="text-xs text-muted-foreground mt-3">
                  {selectedState ? `Showing ${selectedState} data` : "National overview"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 4-Quadrant Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Left: Market Snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Market Snapshot
                </CardTitle>
                <CardDescription>Key metrics at a glance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <StatBlock
                    icon={<Users className="h-4 w-4 text-blue-500" />}
                    label="Total Plans"
                    value={snapshot?.totalPlans.toLocaleString() || "0"}
                  />
                  <StatBlock
                    icon={<DollarSign className="h-4 w-4 text-green-500" />}
                    label="Avg Premium"
                    value={`$${snapshot?.avgPremium || 0}/mo`}
                  />
                  <StatBlock
                    icon={<Stethoscope className="h-4 w-4 text-purple-500" />}
                    label="Avg Dental"
                    value={`$${snapshot?.avgDental?.toLocaleString() || 0}`}
                  />
                  <StatBlock
                    icon={<Star className="h-4 w-4 text-amber-500" />}
                    label="Avg Star Rating"
                    value={`${snapshot?.avgStarRating || 0}`}
                  />
                  <StatBlock
                    icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
                    label="$0 Premium Plans"
                    value={snapshot?.plansWithZeroPremium?.toLocaleString() || "0"}
                  />
                  <StatBlock
                    icon={<MapPin className="h-4 w-4 text-rose-500" />}
                    label="Counties"
                    value={snapshot?.countyCount?.toLocaleString() || "0"}
                  />
                  <StatBlock
                    icon={<Zap className="h-4 w-4 text-orange-500" />}
                    label="Plans w/ OTC"
                    value={snapshot?.plansWithOtc?.toLocaleString() || "0"}
                  />
                  <StatBlock
                    icon={<Shield className="h-4 w-4 text-indigo-500" />}
                    label="Carriers"
                    value={snapshot?.carrierCount?.toLocaleString() || "0"}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Top Right: Hot Plans */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Hot Plans
                </CardTitle>
                <CardDescription>Best value plans right now</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {hotPlans.length > 0 ? hotPlans.map(plan => (
                      <div key={plan.id} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">{plan.carrier}</p>
                          </div>
                          {plan.starRating > 0 && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {plan.starRating} <Star className="h-2.5 w-2.5 ml-0.5 inline" />
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            ${plan.premium}/mo
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            ${plan.dental.toLocaleString()} dental
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {plan.county}, {plan.state}
                          </Badge>
                        </div>
                        <p className="text-xs text-primary font-medium mt-2">{plan.reason}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No hot plans found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Bottom Left: County Alerts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  County Alerts
                </CardTitle>
                <CardDescription>Markets requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {alerts.length > 0 ? alerts.map((alert, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${severityColor(alert.severity)}`}>
                        <div className="flex items-start gap-2">
                          {severityIcon(alert.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{alert.county}, {alert.state}</p>
                              <Badge variant={
                                alert.severity === "critical" ? "destructive" : "secondary"
                              } className="text-[10px]">
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium mt-0.5">{alert.alert}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No alerts found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Bottom Right: Top Opportunities */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Top Opportunities
                </CardTitle>
                <CardDescription>Ranked by opportunity score</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {opportunities.length > 0 ? opportunities.map((opp, i) => (
                      <div key={i} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{opp.location}, {opp.state}</p>
                              <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                {opp.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{opp.opportunity}</p>
                          </div>
                          <div className="shrink-0 text-center">
                            <div className={`text-lg font-bold font-mono ${
                              opp.score >= 70 ? "text-green-600" :
                              opp.score >= 40 ? "text-amber-600" : "text-muted-foreground"
                            }`}>
                              {opp.score}
                            </div>
                            <p className="text-[10px] text-muted-foreground">score</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No opportunities found</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground py-4 border-t">
            Data source: CMS CY2026 PBP | Last updated: {new Date().toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric"
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Stat Block Subcomponent ──

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold font-mono">{value}</p>
    </div>
  );
}
