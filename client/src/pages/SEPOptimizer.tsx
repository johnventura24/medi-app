import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Star,
  Calendar,
  Users,
  AlertTriangle,
  TrendingUp,
  MapPin,
  ExternalLink,
  Clock,
  Shield,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Bus,
  UtensilsCrossed,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
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

// ── State Options ──

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP",
];

// ── SEP Calendar Data ──

interface SEPPeriod {
  name: string;
  abbreviation: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  yearRound: boolean;
  color: string;
  description: string;
}

const SEP_PERIODS: SEPPeriod[] = [
  { name: "Annual Enrollment Period", abbreviation: "AEP", startMonth: 10, startDay: 15, endMonth: 12, endDay: 7, yearRound: false, color: "bg-blue-500", description: "Everyone can enroll or switch MA/PDP plans" },
  { name: "Open Enrollment Period", abbreviation: "OEP", startMonth: 1, startDay: 1, endMonth: 3, endDay: 31, yearRound: false, color: "bg-indigo-500", description: "MA enrollees can switch to another MA plan or return to Original Medicare" },
  { name: "5-Star SEP", abbreviation: "5-Star", startMonth: 12, startDay: 8, endMonth: 11, endDay: 30, yearRound: true, color: "bg-amber-500", description: "Anyone can enroll in a 5-star rated plan year-round" },
  { name: "Dual/LIS SEP", abbreviation: "Dual/LIS", startMonth: 1, startDay: 1, endMonth: 12, endDay: 31, yearRound: true, color: "bg-emerald-500", description: "Dual-eligible & LIS beneficiaries can switch every month" },
  { name: "Initial Enrollment Period", abbreviation: "IEP", startMonth: 1, startDay: 1, endMonth: 12, endDay: 31, yearRound: true, color: "bg-violet-500", description: "People turning 65 — always new beneficiaries entering the system" },
];

function isActiveSEP(sep: SEPPeriod, now: Date): boolean {
  if (sep.yearRound) return true;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (sep.startMonth <= sep.endMonth) {
    return (month > sep.startMonth || (month === sep.startMonth && day >= sep.startDay)) &&
           (month < sep.endMonth || (month === sep.endMonth && day <= sep.endDay));
  }
  // Wraps across year boundary (e.g. Dec 8 - Nov 30)
  return (month > sep.startMonth || (month === sep.startMonth && day >= sep.startDay)) ||
         (month < sep.endMonth || (month === sep.endMonth && day <= sep.endDay));
}

function formatWindow(sep: SEPPeriod): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (sep.yearRound && sep.startMonth === 1 && sep.endMonth === 12) return "Year-round";
  return `${months[sep.startMonth - 1]} ${sep.startDay} - ${months[sep.endMonth - 1]} ${sep.endDay}`;
}

// ── SEP Reference Data ──

const SEP_REFERENCE = [
  { name: "Initial Enrollment Period (IEP)", who: "People turning 65 or first eligible for Medicare", window: "3 months before to 3 months after 65th birthday (7 months total)", canDo: "Enroll in MA, MA-PD, or PDP", agentAction: "Target aging-in population. Partner with employers, financial advisors." },
  { name: "Initial Coverage Election Period (ICEP)", who: "Newly eligible Medicare Part A & B enrollees", window: "Same as IEP for most", canDo: "First chance to enroll in MA", agentAction: "Educate new beneficiaries on MA advantages over Original Medicare." },
  { name: "Annual Enrollment Period (AEP)", who: "All Medicare beneficiaries", window: "Oct 15 - Dec 7", canDo: "Enroll, switch, or drop MA/PDP plans", agentAction: "Primary selling season. Prepare marketing materials by September." },
  { name: "Open Enrollment Period (OEP)", who: "Current MA plan enrollees only", window: "Jan 1 - Mar 31", canDo: "Switch to another MA plan or disenroll to Original Medicare + PDP", agentAction: "Follow up with dissatisfied AEP enrollees. Cannot go from OM to MA." },
  { name: "5-Star Special Enrollment Period", who: "Any Medicare beneficiary", window: "Dec 8 - Nov 30 (year-round)", canDo: "Enroll in any 5-star rated plan", agentAction: "Sell 5-star plans year-round. This is your off-season bread and butter." },
  { name: "Dual/LIS SEP", who: "Dual-eligible (Medicare + Medicaid) and Low-Income Subsidy recipients", window: "Every month, year-round", canDo: "Enroll or switch to another MA-PD or PDP", agentAction: "Monthly enrollment window. D-SNP plans offer rich benefits. Target Medicaid recipients." },
  { name: "Integrated Care SEP (FIDE/HIDE)", who: "Full-benefit dual-eligible beneficiaries", window: "Every month, year-round", canDo: "Enroll in FIDE or HIDE SNP plans", agentAction: "FIDE/HIDE SNPs integrate Medicare and Medicaid. Highest value for duals." },
  { name: "Moved / New to Service Area", who: "Beneficiaries who permanently moved", window: "2 months from move date", canDo: "Enroll in plans available in new area", agentAction: "Partner with realtors, movers. Check address change records." },
  { name: "Lost Coverage / Involuntary Disenrollment", who: "Beneficiaries whose plan was terminated or left service area", window: "2 months from loss of coverage", canDo: "Enroll in a new MA or PDP plan", agentAction: "Monitor plan terminations. These beneficiaries NEED a new plan." },
  { name: "Plan Termination / Non-Renewal", who: "Members of terminated or non-renewed contracts", window: "When CMS notifies through end of next enrollment year", canDo: "Enroll in any available MA or PDP plan", agentAction: "Get termination lists early. These are the warmest leads you will ever get." },
  { name: "Institutional SEP (I-SEP)", who: "Beneficiaries in institutions (nursing homes, LTC)", window: "Monthly while institutionalized", canDo: "Enroll or disenroll from MA, enroll in I-SNP", agentAction: "Build relationships with nursing homes and LTC facilities." },
  { name: "Chronic Condition SEP (C-SNP)", who: "Beneficiaries with qualifying chronic conditions", window: "Year-round for C-SNP enrollment", canDo: "Enroll in a C-SNP plan matching their condition", agentAction: "Screen for qualifying conditions: diabetes, cardiovascular, COPD, ESRD, etc." },
  { name: "SPAP SEP", who: "Beneficiaries enrolled in a State Pharmaceutical Assistance Program", window: "Every month, year-round", canDo: "Enroll or switch PDP or MA-PD", agentAction: "Know your state's SPAP programs. These beneficiaries can switch monthly." },
  { name: "Employer/Union Group SEP", who: "Beneficiaries joining or leaving employer/union group coverage", window: "Continuous while eligible", canDo: "Enroll or disenroll from group MA/PDP", agentAction: "Work with HR departments and union representatives." },
  { name: "CMS Sanction SEP", who: "Members of plans under CMS sanctions", window: "While sanction is active", canDo: "Disenroll and join another plan", agentAction: "Monitor CMS enforcement actions. Sanctioned plan members need immediate help." },
  { name: "Incarceration SEP", who: "Formerly incarcerated individuals regaining Medicare eligibility", window: "2 months from release", canDo: "Enroll in MA or PDP", agentAction: "Partner with reentry programs and social services." },
  { name: "Lawful Presence SEP", who: "Individuals gaining lawful presence status in the US", window: "2 months from gaining status", canDo: "Enroll in MA or PDP", agentAction: "Work with immigration attorneys and community organizations." },
];

// ── Components ──

function SEPCalendarBar() {
  const now = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Active Enrollment Periods
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SEP_PERIODS.map((sep) => {
            const active = isActiveSEP(sep, now);
            return (
              <div
                key={sep.abbreviation}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  active
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30"
                    : "border-border bg-muted/30 opacity-60",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{sep.abbreviation}</span>
                  {active ? (
                    <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                      ACTIVE NOW
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      INACTIVE
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">{formatWindow(sep)}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{sep.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: "high" | "medium" }) {
  return (
    <Badge
      className={cn(
        "text-xs",
        risk === "high"
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      )}
    >
      {risk === "high" ? "HIGH RISK" : "MEDIUM"}
    </Badge>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < Math.floor(rating)
              ? "fill-amber-400 text-amber-400"
              : i < rating
                ? "fill-amber-400/50 text-amber-400"
                : "text-muted-foreground/30",
          )}
        />
      ))}
      <span className="text-xs font-medium ml-0.5">{rating}</span>
    </div>
  );
}

// ── Tab: 5-Star Plans ──

function FiveStarTab({ stateFilter }: { stateFilter?: string }) {
  const { data: plans, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sep/five-star", stateFilter ? `?state=${stateFilter}` : ""],
  });

  const totalPlans = plans?.length || 0;
  const uniqueStates = new Set(plans?.map((p) => p.state) || []).size;
  const carrierCounts: Record<string, number> = {};
  plans?.forEach((p) => {
    carrierCounts[p.carrier] = (carrierCounts[p.carrier] || 0) + 1;
  });
  const topCarrier = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
        <div className="flex items-start gap-2">
          <Star className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Year-Round Sales Opportunity</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              5-star plans qualify for the Special Enrollment Period from Dec 8 through Nov 30. Any Medicare beneficiary can enroll at any time.
              {plans && plans.length > 0 && stateFilter
                ? ` ${stateFilter} has ${totalPlans} five-star plans — agents can sell here 365 days/year.`
                : ` ${totalPlans} five-star plans are available nationwide across ${uniqueStates} states.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="5-Star Plans" value={totalPlans.toLocaleString()} subtitle="Nationwide" icon={Star} />
        <StatCard title="States with 5-Star Plans" value={uniqueStates} subtitle="Coverage" icon={MapPin} />
        <StatCard title="Top Carrier" value={topCarrier} subtitle="Most 5-star plans" icon={Shield} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Counties</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Dental</TableHead>
                  <TableHead className="text-right">OTC/Qtr</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans && plans.length > 0 ? (
                  plans.slice(0, 100).map((plan: any, i: number) => (
                    <TableRow key={`${plan.contractId}-${plan.planId}-${i}`}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={plan.planName}>
                        {plan.planName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={plan.carrier}>
                        {plan.carrier}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{plan.state}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{plan.counties}</TableCell>
                      <TableCell className="text-right font-medium">
                        {plan.premium === 0 ? (
                          <span className="text-emerald-600">$0</span>
                        ) : (
                          `$${plan.premium.toFixed(0)}`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {plan.dental > 0 ? `$${plan.dental.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {plan.otcPerQuarter > 0 ? `$${plan.otcPerQuarter}` : "-"}
                      </TableCell>
                      <TableCell><StarDisplay rating={plan.starRating} /></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <a href={plan.enrollmentUrl} target="_blank" rel="noopener noreferrer">
                            Enroll <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No 5-star plans found{stateFilter ? ` in ${stateFilter}` : ""}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {plans && plans.length > 100 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t">
              Showing 100 of {plans.length} plans. Use state filter to narrow results.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: D-SNP / Dual/LIS ──

function DSNPTab({ stateFilter }: { stateFilter?: string }) {
  const { data: plans, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sep/dsnp", stateFilter ? `?state=${stateFilter}` : ""],
  });

  const totalPlans = plans?.length || 0;
  const uniqueStates = new Set(plans?.map((p) => p.state) || []).size;
  const fideHide = plans?.filter((p) => p.snpType === "FIDE SNP" || p.snpType === "HIDE SNP") || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
        <div className="flex items-start gap-2">
          <Heart className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Monthly Enrollment Opportunity</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              12M+ dual-eligible beneficiaries can switch EVERY MONTH. D-SNP plans offer the richest benefits and often the highest agent commissions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="D-SNP Plans" value={totalPlans.toLocaleString()} subtitle="Nationwide" icon={Users} />
        <StatCard title="States with D-SNPs" value={uniqueStates} subtitle="Coverage" icon={MapPin} />
        <StatCard title="FIDE/HIDE SNP Plans" value={fideHide.length} subtitle="Integrated care" icon={Shield} />
      </div>

      {fideHide.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />
              Integrated Care SEP — FIDE/HIDE SNP Plans
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Fully Integrated Dual Eligible (FIDE) and Highly Integrated Dual Eligible (HIDE) SNPs provide the most comprehensive coverage for dual-eligible beneficiaries.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fideHide.slice(0, 20).map((plan: any, i: number) => (
                    <TableRow key={`fide-${i}`}>
                      <TableCell className="font-medium max-w-[200px] truncate">{plan.planName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{plan.carrier}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{plan.snpType}</Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{plan.state}</Badge></TableCell>
                      <TableCell className="text-right font-medium">
                        {plan.premium === 0 ? <span className="text-emerald-600">$0</span> : `$${plan.premium.toFixed(0)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All D-SNP Plans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>SNP Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Counties</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead className="text-right">Dental</TableHead>
                  <TableHead className="text-right">OTC/Qtr</TableHead>
                  <TableHead className="text-center">Transport</TableHead>
                  <TableHead className="text-center">Meals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans && plans.length > 0 ? (
                  plans.slice(0, 100).map((plan: any, i: number) => (
                    <TableRow key={`dsnp-${plan.contractId}-${plan.planId}-${i}`}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={plan.planName}>
                        {plan.planName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {plan.carrier}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{plan.snpType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{plan.state}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{plan.counties}</TableCell>
                      <TableCell className="text-right font-medium">
                        {plan.premium === 0 ? <span className="text-emerald-600">$0</span> : `$${plan.premium.toFixed(0)}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {plan.dental > 0 ? `$${plan.dental.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {plan.otcPerQuarter > 0 ? `$${plan.otcPerQuarter}` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.hasTransportation ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.hasMeals ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No D-SNP plans found{stateFilter ? ` in ${stateFilter}` : ""}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {plans && plans.length > 100 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t">
              Showing 100 of {plans.length} plans. Use state filter to narrow results.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: At-Risk Plans ──

function AtRiskTab({ stateFilter }: { stateFilter?: string }) {
  const { data: plans, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sep/at-risk", stateFilter ? `?state=${stateFilter}` : ""],
  });

  const totalPlans = plans?.length || 0;
  const highRiskCount = plans?.filter((p) => p.risk === "high").length || 0;
  const totalEnrollment = plans?.reduce((sum, p) => sum + (p.enrollmentCount || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Plan Termination Opportunity</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These members WILL need a new plan — be the agent who contacts them first. Plans with 2.0 stars or below face the highest probability of CMS sanctions or termination.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="At-Risk Plans" value={totalPlans.toLocaleString()} subtitle="2.5 stars or below" icon={AlertTriangle} />
        <StatCard title="High Risk" value={highRiskCount} subtitle="2.0 stars or below" icon={XCircle} />
        <StatCard title="Est. Affected Members" value={totalEnrollment.toLocaleString()} subtitle="Need new coverage" icon={Users} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-center">Star Rating</TableHead>
                  <TableHead className="text-right">Est. Enrollment</TableHead>
                  <TableHead className="text-right">Counties</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans && plans.length > 0 ? (
                  plans.slice(0, 100).map((plan: any, i: number) => (
                    <TableRow
                      key={`risk-${plan.contractId}-${plan.planId}-${i}`}
                      className={plan.risk === "high" ? "bg-red-50/30 dark:bg-red-950/10" : ""}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate" title={plan.planName}>
                        {plan.planName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {plan.carrier}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{plan.state}</Badge>
                      </TableCell>
                      <TableCell className="text-center"><StarDisplay rating={plan.starRating} /></TableCell>
                      <TableCell className="text-right">{plan.enrollmentCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{plan.counties}</TableCell>
                      <TableCell><RiskBadge risk={plan.risk} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={plan.reason}>
                        {plan.reason}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No at-risk plans found{stateFilter ? ` in ${stateFilter}` : ""}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Conversion Opportunity ──

function ConversionTab({ stateFilter }: { stateFilter?: string }) {
  const { data: opportunities, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sep/conversion", stateFilter ? `?state=${stateFilter}&limit=30` : "?limit=30"],
  });

  const belowThirty = opportunities?.filter((o) => o.maPenetration < 30) || [];
  const totalAddressable = opportunities?.reduce((sum, o) => sum + (o.originalMedicareEstimate || 0), 0) || 0;

  const chartData = useMemo(() => {
    if (!opportunities) return [];
    return opportunities.slice(0, 15).map((o) => ({
      name: `${o.county}, ${o.state}`,
      penetration: o.maPenetration,
      original: o.originalMedicareEstimate,
    }));
  }, [opportunities]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">IEP / Conversion Opportunity</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Counties with the lowest MA penetration have the most beneficiaries still on Original Medicare. These are your untapped markets for IEP conversions and general enrollment.
              {belowThirty.length > 0 && ` ${belowThirty.length} counties have below 30% MA penetration.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Low Penetration Counties" value={belowThirty.length} subtitle="Below 30% MA penetration" icon={MapPin} />
        <StatCard title="Est. Addressable Market" value={totalAddressable.toLocaleString()} subtitle="Original Medicare beneficiaries" icon={Users} />
        <StatCard title="Top Opportunity" value={opportunities?.[0]?.county || "N/A"} subtitle={opportunities?.[0] ? `${opportunities[0].maPenetration}% penetration` : ""} icon={TrendingUp} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lowest MA Penetration Counties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 70]} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={115} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "MA Penetration"]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="penetration" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.penetration < 20 ? "#ef4444" : entry.penetration < 30 ? "#f59e0b" : "#8b5cf6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>County</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">MA Penetration</TableHead>
                  <TableHead className="text-right">Est. Original Medicare</TableHead>
                  <TableHead>Top Plans Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities && opportunities.length > 0 ? (
                  opportunities.map((opp: any, i: number) => (
                    <TableRow key={`conv-${i}`}>
                      <TableCell className="font-medium">{opp.county}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{opp.state}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-medium",
                          opp.maPenetration < 20 ? "text-red-600" : opp.maPenetration < 30 ? "text-amber-600" : "text-foreground",
                        )}>
                          {opp.maPenetration}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {opp.originalMedicareEstimate.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {opp.topPlans.slice(0, 2).map((p: any, j: number) => (
                            <span key={j} className="text-xs text-muted-foreground truncate max-w-[250px]" title={`${p.name} - ${p.carrier}`}>
                              {p.name} ({p.premium === 0 ? "$0" : `$${p.premium}`}/mo)
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No conversion opportunities found{stateFilter ? ` in ${stateFilter}` : ""}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Reference Guide ──

function ReferenceGuideTab() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3">
        <div className="flex items-start gap-2">
          <BookOpen className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Complete SEP Reference Guide</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All Special Enrollment Periods with eligibility criteria, windows, and agent action items. Print-friendly reference card.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">SEP Name</TableHead>
                  <TableHead className="w-[200px]">Who Qualifies</TableHead>
                  <TableHead className="w-[180px]">Window</TableHead>
                  <TableHead className="w-[200px]">What They Can Do</TableHead>
                  <TableHead>Agent Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SEP_REFERENCE.map((sep, i) => (
                  <TableRow
                    key={i}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      expanded === i && "bg-muted/30",
                    )}
                    onClick={() => setExpanded(expanded === i ? null : i)}
                  >
                    <TableCell className="font-medium text-sm align-top">
                      <div className="flex items-start gap-1.5">
                        {expanded === i ? (
                          <ChevronUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        )}
                        {sep.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top">{sep.who}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">{sep.window}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground align-top">{sep.canDo}</TableCell>
                    <TableCell className="text-sm align-top">
                      <span className={cn(
                        expanded === i ? "font-medium text-primary" : "text-muted-foreground",
                      )}>
                        {sep.agentAction}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ──

export default function SEPOptimizer() {
  const [stateFilter, setStateFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState("five-star");

  const { data: opportunities } = useQuery<any[]>({
    queryKey: ["/api/sep/opportunities", stateFilter ? `?state=${stateFilter}` : ""],
  });

  // Build dynamic insights based on current date and data
  const now = new Date();
  const insights = useMemo(() => {
    const items: InsightItem[] = [];
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // Current period insights
    if (month >= 10 && (month < 12 || (month === 12 && day <= 7))) {
      items.push({ icon: "target", text: "AEP is ACTIVE. This is the primary selling season — every Medicare beneficiary can enroll or switch plans.", priority: "high" });
    } else if (month >= 1 && month <= 3) {
      if (month === 3 && day === 31) {
        items.push({ icon: "alert", text: "OEP ends TODAY! Last chance for current MA enrollees to switch plans until next AEP.", priority: "high" });
      } else {
        items.push({ icon: "target", text: `OEP is active (ends Mar 31). Current MA enrollees can switch to another MA plan or return to Original Medicare.`, priority: "high" });
      }
    } else {
      items.push({ icon: "opportunity", text: "Outside AEP/OEP. Focus on year-round opportunities: 5-Star SEP, Dual/LIS monthly enrollment, and IEP for people turning 65.", priority: "medium" });
    }

    // Data-driven insights
    if (opportunities) {
      const fiveStar = opportunities.find((o) => o.sepType === "5_star");
      const dualLis = opportunities.find((o) => o.sepType === "dual_lis");
      const termination = opportunities.find((o) => o.sepType === "plan_termination");

      if (fiveStar && fiveStar.totalNational > 0) {
        items.push({
          icon: "opportunity",
          text: `${fiveStar.totalNational} five-star plans available for year-round enrollment across ${fiveStar.states.length} states.`,
          priority: "medium",
        });
      }
      if (dualLis && dualLis.totalNational > 0) {
        items.push({
          icon: "trend",
          text: `${dualLis.totalNational} D-SNP plans nationwide. Dual/LIS beneficiaries can switch every month — your most consistent revenue stream.`,
          priority: "medium",
        });
      }
      if (termination && termination.totalNational > 0) {
        items.push({
          icon: "warning",
          text: `${termination.totalNational} plans at risk of termination. Their members will need a new plan — be the first agent they hear from.`,
          priority: "high",
        });
      }
    }

    return items;
  }, [now, opportunities]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="SEP Optimizer"
        description="Know exactly where and when you can sell. Actionable data on every Special Enrollment Period."
        badge="Sales Intelligence"
        helpText="This tool shows every Special Enrollment Period (SEP) with real plan data. Use it to find year-round sales opportunities outside of AEP: 5-star plans, D-SNP for dual-eligible beneficiaries, at-risk plans whose members will need new coverage, and low-penetration counties where most beneficiaries are still on Original Medicare."
        actions={
          <Select value={stateFilter} onValueChange={setStateFilter}>
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

      <InsightBox
        title="SEP Briefing"
        insights={insights}
        variant="briefing"
      />

      <SEPCalendarBar />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-[700px]">
          <TabsTrigger value="five-star" className="text-xs sm:text-sm">
            <Star className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            5-Star
          </TabsTrigger>
          <TabsTrigger value="dsnp" className="text-xs sm:text-sm">
            <Heart className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Dual/LIS
          </TabsTrigger>
          <TabsTrigger value="at-risk" className="text-xs sm:text-sm">
            <AlertTriangle className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            At-Risk
          </TabsTrigger>
          <TabsTrigger value="conversion" className="text-xs sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            IEP/Convert
          </TabsTrigger>
          <TabsTrigger value="reference" className="text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Reference
          </TabsTrigger>
        </TabsList>

        <TabsContent value="five-star">
          <FiveStarTab stateFilter={stateFilter === "all" ? undefined : stateFilter || undefined} />
        </TabsContent>

        <TabsContent value="dsnp">
          <DSNPTab stateFilter={stateFilter === "all" ? undefined : stateFilter || undefined} />
        </TabsContent>

        <TabsContent value="at-risk">
          <AtRiskTab stateFilter={stateFilter === "all" ? undefined : stateFilter || undefined} />
        </TabsContent>

        <TabsContent value="conversion">
          <ConversionTab stateFilter={stateFilter === "all" ? undefined : stateFilter || undefined} />
        </TabsContent>

        <TabsContent value="reference">
          <ReferenceGuideTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
