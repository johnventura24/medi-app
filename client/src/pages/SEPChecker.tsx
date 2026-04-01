import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Shield,
  ArrowRight,
  MessageSquare,
  Star,
  MapPin,
} from "lucide-react";

interface SEPCheckInput {
  hasMedicare: boolean;
  hasPartA: boolean;
  hasPartB: boolean;
  currentCoverage: "original_medicare" | "medicare_advantage" | "none";
  currentPlanName?: string;
  hasMedicaid: boolean;
  hasExtraHelp: boolean;
  recentlyMoved: boolean;
  moveDate?: string;
  lostEmployerCoverage: boolean;
  lostCoverageDate?: string;
  turningAge65: boolean;
  age65Date?: string;
  inNursingFacility: boolean;
  planTerminated: boolean;
  planSanctioned: boolean;
  hasChronicCondition: boolean;
  zipCode: string;
}

interface SEPPlanRec {
  planId: number;
  name: string;
  carrier: string;
  premium: number;
  whyItsGood: string;
}

interface ActiveSEP {
  sepName: string;
  sepCode: string;
  eligible: boolean;
  window: { start: string; end: string; daysRemaining: number | null };
  whatYouCanDo: string[];
  bestPlans: SEPPlanRec[];
  urgency: "high" | "medium" | "low";
  agentScript: string;
}

interface SEPCheckResult {
  activeSEPs: ActiveSEP[];
  noSEPAvailable: boolean;
  nextOpportunity: { period: string; date: string; description: string } | null;
  recommendation: string;
}

const defaultInput: SEPCheckInput = {
  hasMedicare: true,
  hasPartA: true,
  hasPartB: true,
  currentCoverage: "original_medicare",
  hasMedicaid: false,
  hasExtraHelp: false,
  recentlyMoved: false,
  lostEmployerCoverage: false,
  turningAge65: false,
  inNursingFacility: false,
  planTerminated: false,
  planSanctioned: false,
  hasChronicCondition: false,
  zipCode: "",
};

export default function SEPChecker() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<SEPCheckInput>(defaultInput);
  const [result, setResult] = useState<SEPCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<SEPCheckInput>) => setInput((prev) => ({ ...prev, ...patch }));

  async function handleCheck() {
    if (!input.zipCode || input.zipCode.length < 5) {
      setError("Please enter a valid 5-digit ZIP code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sep/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to check SEP eligibility");
      const data: SEPCheckResult = await res.json();
      setResult(data);
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const insights: InsightItem[] = [
    { icon: "opportunity", text: "Special Enrollment Periods let beneficiaries enroll outside AEP. Identifying them is a competitive advantage.", priority: "high" },
    { icon: "target", text: "Dual-eligible and LIS beneficiaries can switch plans every month year-round.", priority: "medium" },
    { icon: "trend", text: "5-star plans offer year-round enrollment — always check if one is available in the beneficiary's ZIP.", priority: "medium" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="SEP Eligibility Checker"
        description="Determine which Special Enrollment Periods your client qualifies for and get actionable next steps."
        badge="Competitive Edge"
        helpText="This tool checks 9 different SEP types based on the beneficiary's situation. Enter their details to see exactly which SEPs apply, what they can do, recommended plans, and word-for-word agent scripts."
      />

      <InsightBox title="SEP Intelligence" insights={insights} />

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => s < step && setStep(s)}
              className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-colors ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </button>
            <span className={`hidden sm:inline text-xs ${step >= s ? "font-medium" : "text-muted-foreground"}`}>
              {s === 1 ? "Situation" : s === 2 ? "Life Changes" : "Special Cases"}
            </span>
            {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
        {result && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-600 text-white text-xs font-bold">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline text-xs font-medium text-emerald-600">Results</span>
          </>
        )}
      </div>

      {/* Step 1: Current Situation */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Current Situation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <Input
                  placeholder="e.g. 33101"
                  value={input.zipCode}
                  onChange={(e) => update({ zipCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Coverage</Label>
                <Select
                  value={input.currentCoverage}
                  onValueChange={(v: any) => update({ currentCoverage: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original_medicare">Original Medicare</SelectItem>
                    <SelectItem value="medicare_advantage">Medicare Advantage</SelectItem>
                    <SelectItem value="none">No Medicare Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {input.currentCoverage === "medicare_advantage" && (
              <div className="space-y-2">
                <Label>Current Plan Name (optional)</Label>
                <Input
                  placeholder="e.g. Humana Gold Plus"
                  value={input.currentPlanName || ""}
                  onChange={(e) => update({ currentPlanName: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Has Medicare</Label>
                <Switch checked={input.hasMedicare} onCheckedChange={(v) => update({ hasMedicare: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Has Part A</Label>
                <Switch checked={input.hasPartA} onCheckedChange={(v) => update({ hasPartA: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Has Part B</Label>
                <Switch checked={input.hasPartB} onCheckedChange={(v) => update({ hasPartB: v })} />
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full" disabled={!input.zipCode}>
              Next: Life Changes <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Life Changes */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              Recent Life Changes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Recently Moved</Label>
                  <p className="text-xs text-muted-foreground">Moved to a new service area in the last 2 months</p>
                </div>
                <Switch checked={input.recentlyMoved} onCheckedChange={(v) => update({ recentlyMoved: v })} />
              </div>
              {input.recentlyMoved && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-300">
                  <Label>Move Date</Label>
                  <Input type="date" value={input.moveDate || ""} onChange={(e) => update({ moveDate: e.target.value })} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Lost Employer Coverage</Label>
                  <p className="text-xs text-muted-foreground">Lost or leaving group health insurance</p>
                </div>
                <Switch checked={input.lostEmployerCoverage} onCheckedChange={(v) => update({ lostEmployerCoverage: v })} />
              </div>
              {input.lostEmployerCoverage && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-300">
                  <Label>Coverage Loss Date</Label>
                  <Input type="date" value={input.lostCoverageDate || ""} onChange={(e) => update({ lostCoverageDate: e.target.value })} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Turning 65</Label>
                  <p className="text-xs text-muted-foreground">Approaching or recently turned 65</p>
                </div>
                <Switch checked={input.turningAge65} onCheckedChange={(v) => update({ turningAge65: v })} />
              </div>
              {input.turningAge65 && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-300">
                  <Label>65th Birthday Date</Label>
                  <Input type="date" value={input.age65Date || ""} onChange={(e) => update({ age65Date: e.target.value })} />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next: Special Cases <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Special Circumstances */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Special Circumstances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Has Medicaid (Dual Eligible)</Label>
                  <p className="text-xs text-muted-foreground">Qualifies for both Medicare and Medicaid</p>
                </div>
                <Switch checked={input.hasMedicaid} onCheckedChange={(v) => update({ hasMedicaid: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Receives Extra Help (LIS)</Label>
                  <p className="text-xs text-muted-foreground">Low-Income Subsidy for Part D costs</p>
                </div>
                <Switch checked={input.hasExtraHelp} onCheckedChange={(v) => update({ hasExtraHelp: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">In Nursing Facility / Institution</Label>
                  <p className="text-xs text-muted-foreground">Currently resides in a nursing home or institution</p>
                </div>
                <Switch checked={input.inNursingFacility} onCheckedChange={(v) => update({ inNursingFacility: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Plan Being Terminated</Label>
                  <p className="text-xs text-muted-foreground">Current plan is leaving the market</p>
                </div>
                <Switch checked={input.planTerminated} onCheckedChange={(v) => update({ planTerminated: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Plan Under CMS Sanction</Label>
                  <p className="text-xs text-muted-foreground">Plan has a CMS enforcement action</p>
                </div>
                <Switch checked={input.planSanctioned} onCheckedChange={(v) => update({ planSanctioned: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Has Qualifying Chronic Condition</Label>
                  <p className="text-xs text-muted-foreground">Diabetes, COPD, heart failure, ESRD, etc.</p>
                </div>
                <Switch checked={input.hasChronicCondition} onCheckedChange={(v) => update({ hasChronicCondition: v })} />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={handleCheck} className="flex-1" disabled={loading}>
                {loading ? "Checking..." : "Check SEP Eligibility"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className={result.noSEPAvailable ? "border-muted" : "border-emerald-300 dark:border-emerald-800"}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                {result.noSEPAvailable ? (
                  <Clock className="h-6 w-6 text-muted-foreground mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-emerald-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">
                    {result.noSEPAvailable
                      ? "No Active SEPs Found"
                      : `${result.activeSEPs.length} Special Enrollment Period${result.activeSEPs.length > 1 ? "s" : ""} Available`}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{result.recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active SEPs */}
          {result.activeSEPs.map((sep) => (
            <SEPCard key={sep.sepCode} sep={sep} onNavigate={navigate} />
          ))}

          {/* Next Opportunity */}
          {result.noSEPAvailable && result.nextOpportunity && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold">{result.nextOpportunity.period}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{result.nextOpportunity.description}</p>
                    <Badge variant="outline" className="mt-2 text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {result.nextOpportunity.date}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" onClick={() => { setResult(null); setStep(1); }} className="w-full">
            Check Another Beneficiary
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </div>
  );
}

function SEPCard({ sep, onNavigate }: { sep: ActiveSEP; onNavigate: (path: string) => void }) {
  const [scriptOpen, setScriptOpen] = useState(false);

  const urgencyColors = {
    high: "border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10",
    medium: "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10",
    low: "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10",
  };

  const urgencyBadge = {
    high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  };

  const daysText = sep.window.daysRemaining === null
    ? "Continuous"
    : `${sep.window.daysRemaining} days remaining`;

  return (
    <Card className={urgencyColors[sep.urgency]}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{sep.sepName}</h3>
              <Badge className={`text-[10px] ${urgencyBadge[sep.urgency]}`}>
                {sep.urgency === "high" ? "Urgent" : sep.urgency === "medium" ? "Action Needed" : "Eligible"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{daysText}</span>
              <span className="mx-1">|</span>
              <span>Until {new Date(sep.window.end).toLocaleDateString()}</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
            {sep.sepCode}
          </Badge>
        </div>

        {/* What You Can Do */}
        <div>
          <h4 className="text-sm font-medium mb-2">What You Can Do</h4>
          <ul className="space-y-1">
            {sep.whatYouCanDo.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Best Plans */}
        {sep.bestPlans.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Top Plans for This SEP</h4>
            <div className="space-y-2">
              {sep.bestPlans.map((plan) => (
                <div
                  key={plan.planId}
                  className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.carrier}</p>
                    {plan.whyItsGood && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{plan.whyItsGood}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm font-bold">${plan.premium}/mo</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-7 text-xs"
                      onClick={() => onNavigate(`/find?planId=${plan.planId}`)}
                    >
                      View Plan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Script */}
        <Collapsible open={scriptOpen} onOpenChange={setScriptOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <MessageSquare className="h-4 w-4" />
              Agent Script
              {scriptOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm italic">
              "{sep.agentScript}"
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
