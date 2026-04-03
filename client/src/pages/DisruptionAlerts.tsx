import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import {
  AlertTriangle,
  ShieldAlert,
  Users,
  MapPin,
  Star,
  ChevronDown,
  ChevronRight,
  Download,
  ArrowRight,
  TrendingDown,
} from "lucide-react";

interface AlternativePlan {
  name: string;
  carrier: string;
  premium: number;
  whyBetter: string;
}

interface AffectedPlan {
  contractId: string;
  planId: string;
  planName: string;
  carrier: string;
  state: string;
  starRating: number;
  estimatedMembers: number;
  issue: string;
  recommendation: string;
  alternativePlans: AlternativePlan[];
}

interface DisruptionAlert {
  alertType: string;
  severity: "critical" | "warning" | "info";
  affectedPlans: AffectedPlan[];
  totalAffected: number;
  agentOpportunity: string;
}

interface DisruptionSummary {
  totalAlertsCount: number;
  criticalCount: number;
  warningCount: number;
  totalAffectedMembers: number;
  topState: string;
  topStateCount: number;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR",
];

export default function DisruptionAlerts() {
  const [, navigate] = useLocation();
  const [stateFilter, setStateFilter] = useState<string>("all");

  const stateParam = stateFilter === "all" ? "" : `?state=${stateFilter}`;

  const { data: alerts, isLoading: alertsLoading } = useQuery<DisruptionAlert[]>({
    queryKey: ["disruption-alerts", stateFilter],
    queryFn: () => fetch(`/api/disruption/alerts${stateParam}`).then((r) => r.json()),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<DisruptionSummary>({
    queryKey: ["disruption-summary", stateFilter],
    queryFn: () => fetch(`/api/disruption/summary${stateParam}`).then((r) => r.json()),
  });

  const insights: InsightItem[] = [
    { icon: "alert", text: "Plans with 2.0 or fewer stars are at high risk of CMS termination. Members on these plans must switch.", priority: "high" },
    { icon: "opportunity", text: "Disrupted members are highly motivated prospects. Reaching out before competitors is critical.", priority: "high" },
    { icon: "trend", text: "Use state filters to focus your outreach on specific markets.", priority: "medium" },
  ];

  function exportCSV() {
    if (!alerts) return;
    const rows: string[] = ["Plan Name,Carrier,State,Star Rating,Est. Members,Issue,Severity"];
    for (const alert of alerts) {
      for (const plan of alert.affectedPlans) {
        rows.push(
          `"${plan.planName}","${plan.carrier}","${plan.state}",${plan.starRating},${plan.estimatedMembers},"${plan.issue}","${alert.severity}"`
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disruption-alerts-${stateFilter || "all"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Member Disruption Alerts"
        description="Find members who need your help. Identify plans at risk of termination and connect affected beneficiaries with better options."
        badge="Intelligence"
        helpText="This tool scans plan data for low star ratings and CMS sanctions to identify plans that may be terminated. Estimated member counts are based on plan footprint. Use the CSV export for outreach campaigns."
        dataSource="Data: CMS CY2026 PBP files cross-referenced with Star Ratings and CMS sanction lists. Member impact estimated from plan service area population data. Alternative plans identified from same-county PBP data."
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={!alerts || alerts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      <InsightBox title="Disruption Intelligence" insights={insights} />

      {/* Summary Stats */}
      {summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Plans at Risk</p>
                  <p className="text-2xl font-bold mt-1">{summary.totalAlertsCount}</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">{summary.criticalCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Est. Members Affected</p>
                  <p className="text-2xl font-bold mt-1">{summary.totalAffectedMembers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Top Disrupted State</p>
                  <p className="text-2xl font-bold mt-1">{summary.topState}</p>
                  <p className="text-xs text-muted-foreground">{summary.topStateCount.toLocaleString()} members</p>
                </div>
                <MapPin className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* State Filter */}
      <div className="flex items-center gap-3">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stateFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setStateFilter("all")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Alert List */}
      {alertsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-6">
          {alerts.map((alert, idx) => (
            <AlertSection key={idx} alert={alert} navigate={navigate} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="mt-3 text-muted-foreground">No disruption alerts found{stateFilter !== "all" ? ` for ${stateFilter}` : ""}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AlertSection({ alert, navigate }: { alert: DisruptionAlert; navigate: (path: string) => void }) {
  const severityConfig = {
    critical: {
      border: "border-red-300 dark:border-red-800",
      bg: "bg-red-50/50 dark:bg-red-950/10",
      badge: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      label: "Critical",
    },
    warning: {
      border: "border-amber-300 dark:border-amber-800",
      bg: "bg-amber-50/50 dark:bg-amber-950/10",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      icon: <ShieldAlert className="h-5 w-5 text-amber-500" />,
      label: "Warning",
    },
    info: {
      border: "border-blue-200 dark:border-blue-800",
      bg: "bg-blue-50/50 dark:bg-blue-950/10",
      badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      icon: <TrendingDown className="h-5 w-5 text-blue-500" />,
      label: "Info",
    },
  };

  const config = severityConfig[alert.severity];
  const alertTypeLabels: Record<string, string> = {
    plan_exit: "Plan Exit Risk",
    benefit_cut: "Low-Performing Plans",
    star_drop: "Below-Average Star Ratings",
    premium_increase: "Premium Increase Risk",
    network_change: "Network Change Risk",
  };

  return (
    <Card className={config.border}>
      <CardHeader className={`${config.bg} rounded-t-lg pb-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {config.icon}
            <div>
              <CardTitle className="text-base">
                {alertTypeLabels[alert.alertType] || alert.alertType}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alert.affectedPlans.length} plan{alert.affectedPlans.length !== 1 ? "s" : ""} | {alert.totalAffected.toLocaleString()} est. members
              </p>
            </div>
          </div>
          <Badge className={`text-[10px] ${config.badge}`}>{config.label}</Badge>
        </div>
        <p className="text-sm font-medium mt-2">{alert.agentOpportunity}</p>
      </CardHeader>
      <CardContent className="p-0 divide-y">
        {alert.affectedPlans.slice(0, 10).map((plan, idx) => (
          <PlanRow key={idx} plan={plan} navigate={navigate} />
        ))}
        {alert.affectedPlans.length > 10 && (
          <div className="p-3 text-center text-sm text-muted-foreground">
            + {alert.affectedPlans.length - 10} more plans
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanRow({ plan, navigate }: { plan: AffectedPlan; navigate: (path: string) => void }) {
  const [altOpen, setAltOpen] = useState(false);

  const starColor = plan.starRating <= 2 ? "text-red-500" : plan.starRating <= 3 ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold">{plan.planName}</h4>
            <Badge variant="outline" className="text-[10px]">{plan.state}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{plan.carrier}</p>
          <p className="text-xs mt-1">{plan.issue}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className={`flex items-center gap-1 ${starColor}`}>
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-sm font-bold">{plan.starRating}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <Users className="h-3 w-3 inline mr-1" />
            {plan.estimatedMembers.toLocaleString()}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">{plan.recommendation}</p>

      {/* Alternative Plans */}
      {plan.alternativePlans.length > 0 && (
        <Collapsible open={altOpen} onOpenChange={setAltOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Alternative Plans ({plan.alternativePlans.length})
              {altOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2">
              {plan.alternativePlans.map((alt, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{alt.name}</p>
                    <p className="text-[10px] text-muted-foreground">{alt.carrier}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{alt.whyBetter}</p>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="text-xs font-bold">${alt.premium}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
