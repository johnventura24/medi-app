import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Clock,
  Search,
  Zap,
  Shield,
  Info,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──

interface ACAEligibilityInput {
  age: number;
  income: number;
  householdSize: number;
  state: string;
  employerOffersInsurance: boolean;
  employerPlanAffordable: boolean;
  hasMedicare: boolean;
  hasMedicaid: boolean;
  isPregnant: boolean;
  isImmigrant: boolean;
  currentCoverage: "none" | "employer" | "individual" | "medicaid" | "medicare" | "uninsured";
  lostCoverageRecently: boolean;
  marriedOrDivorced: boolean;
  hadBaby: boolean;
  movedState: boolean;
  incomeChangedSignificantly: boolean;
}

interface ACAEligibilityResult {
  eligible: {
    marketplace: boolean;
    subsidy: boolean;
    csr: boolean;
    medicaid: boolean;
    chip: boolean;
  };
  subsidyEstimate: {
    fplPercent: number;
    monthlySubsidy: number;
    annualSubsidy: number;
    expectedContribution: number;
  } | null;
  csrLevel: string | null;
  enrollmentPeriods: {
    oep: { eligible: boolean; window: string };
    sep: { eligible: boolean; reasons: string[] };
  };
  recommendations: string[];
  warnings: string[];
  nextSteps: string[];
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

const FPL_2026: Record<number, number> = {
  1: 15650, 2: 21150, 3: 26650, 4: 32150,
  5: 37650, 6: 43150, 7: 48650, 8: 54150,
};

const defaultInput: ACAEligibilityInput = {
  age: 35,
  income: 0,
  householdSize: 1,
  state: "",
  employerOffersInsurance: false,
  employerPlanAffordable: false,
  hasMedicare: false,
  hasMedicaid: false,
  isPregnant: false,
  isImmigrant: false,
  currentCoverage: "none",
  lostCoverageRecently: false,
  marriedOrDivorced: false,
  hadBaby: false,
  movedState: false,
  incomeChangedSignificantly: false,
};

// ── Yes/No Helper ──

function YesNo({
  label,
  value,
  onChange,
  helpText,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  helpText?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          size="sm"
          variant={value ? "default" : "outline"}
          onClick={() => onChange(true)}
          className="min-w-[60px]"
        >
          Yes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!value ? "default" : "outline"}
          onClick={() => onChange(false)}
          className="min-w-[60px]"
        >
          No
        </Button>
      </div>
    </div>
  );
}

// ── FPL Indicator ──

function FPLIndicator({ income, householdSize }: { income: number; householdSize: number }) {
  const fplBase = FPL_2026[householdSize] || FPL_2026[1];
  const fplPercent = income > 0 ? Math.round((income / fplBase) * 100) : 0;

  if (income <= 0) return null;

  let color = "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950 dark:border-orange-800";
  let label = "Above 400% FPL";
  let detail = "Premium capped at 8.5% of income";

  if (fplPercent <= 138) {
    color = "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950 dark:border-blue-800";
    label = "May qualify for Medicaid";
    detail = "Very low cost or free coverage";
  } else if (fplPercent <= 250) {
    color = "text-green-600 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950 dark:border-green-800";
    label = "Subsidy + Cost Sharing Reductions";
    detail = "Biggest savings on Silver plans";
  } else if (fplPercent <= 400) {
    color = "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-950 dark:border-yellow-800";
    label = "Subsidy eligible";
    detail = "Premium Tax Credits available";
  }

  return (
    <div className={cn("rounded-lg border p-3 space-y-1", color)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {fplPercent}% of the Federal Poverty Level
        </span>
        <Badge variant="outline" className={cn("text-xs", color)}>
          {label}
        </Badge>
      </div>
      <p className="text-xs opacity-80">{detail}</p>
      {/* Visual bar */}
      <div className="relative h-2 rounded-full bg-muted mt-2 overflow-hidden">
        <div
          className={cn(
            "absolute h-full rounded-full transition-all duration-500",
            fplPercent <= 138 ? "bg-blue-500" :
            fplPercent <= 250 ? "bg-green-500" :
            fplPercent <= 400 ? "bg-yellow-500" :
            "bg-orange-500"
          )}
          style={{ width: `${Math.min(100, fplPercent / 5)}%` }}
        />
        {/* Markers */}
        <div className="absolute top-0 h-full w-px bg-muted-foreground/30" style={{ left: `${138 / 5}%` }} title="138% FPL" />
        <div className="absolute top-0 h-full w-px bg-muted-foreground/30" style={{ left: `${250 / 5}%` }} title="250% FPL" />
        <div className="absolute top-0 h-full w-px bg-muted-foreground/30" style={{ left: `${400 / 5}%` }} title="400% FPL" />
      </div>
      <div className="flex justify-between text-[10px] opacity-60">
        <span>0%</span>
        <span>138%</span>
        <span>250%</span>
        <span>400%</span>
        <span>500%+</span>
      </div>
    </div>
  );
}

// ── Step Components ──

function StepAboutYou({
  input,
  setInput,
}: {
  input: ACAEligibilityInput;
  setInput: (fn: (prev: ACAEligibilityInput) => ACAEligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">About You</h2>
        <p className="text-sm text-muted-foreground">
          Let's start with some basic information to determine your ACA marketplace eligibility.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">How old are you?</Label>
        <Input
          type="number"
          min={0}
          max={150}
          value={input.age || ""}
          onChange={(e) =>
            setInput((prev) => ({ ...prev, age: parseInt(e.target.value) || 0 }))
          }
          className="w-32"
          placeholder="35"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">What state do you live in?</Label>
        <Select
          value={input.state}
          onValueChange={(v) => setInput((prev) => ({ ...prev, state: v }))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.map((st) => (
              <SelectItem key={st} value={st}>
                {st}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">How many people are in your household?</Label>
        <p className="text-xs text-muted-foreground">
          Include yourself, your spouse, and anyone you claim as a tax dependent.
        </p>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={input.householdSize === n ? "default" : "outline"}
              onClick={() => setInput((prev) => ({ ...prev, householdSize: n }))}
              className="min-w-[40px]"
            >
              {n}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepIncome({
  input,
  setInput,
}: {
  input: ACAEligibilityInput;
  setInput: (fn: (prev: ACAEligibilityInput) => ACAEligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Your Household Income</h2>
        <p className="text-sm text-muted-foreground">
          Your income determines your subsidy amount. ACA subsidies are based on the Federal Poverty Level (FPL).
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Annual household income (before taxes)</Label>
        <p className="text-xs text-muted-foreground">
          Include wages, salary, self-employment income, Social Security, and other taxable income for everyone in your household.
        </p>
        <div className="relative w-64">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={0}
            value={input.income || ""}
            onChange={(e) =>
              setInput((prev) => ({ ...prev, income: parseInt(e.target.value) || 0 }))
            }
            className="pl-9 text-lg"
            placeholder="45000"
          />
        </div>
      </div>

      <FPLIndicator income={input.income} householdSize={input.householdSize} />
    </div>
  );
}

function StepCoverage({
  input,
  setInput,
}: {
  input: ACAEligibilityInput;
  setInput: (fn: (prev: ACAEligibilityInput) => ACAEligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Your Current Coverage</h2>
        <p className="text-sm text-muted-foreground">
          Tell us about your current health insurance situation.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">What coverage do you currently have?</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              value: "employer",
              title: "Employer Insurance",
              description: "My job offers health insurance",
              emoji: "\uD83C\uDFE2",
            },
            {
              value: "medicaid",
              title: "Medicaid",
              description: "I'm on my state's Medicaid program",
              emoji: "\uD83C\uDFE5",
            },
            {
              value: "medicare",
              title: "Medicare",
              description: "I have Medicare",
              emoji: "\uD83C\uDFDB\uFE0F",
            },
            {
              value: "individual",
              title: "Individual Plan",
              description: "I bought my own plan on the marketplace or privately",
              emoji: "\uD83D\uDCCB",
            },
            {
              value: "none",
              title: "No Coverage / Not Sure",
              description: "I don't have insurance right now",
              emoji: "\u274C",
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setInput((prev) => ({
                  ...prev,
                  currentCoverage: option.value as ACAEligibilityInput["currentCoverage"],
                  hasMedicare: option.value === "medicare",
                  hasMedicaid: option.value === "medicaid",
                  employerOffersInsurance: option.value === "employer",
                }))
              }
              className={cn(
                "text-left p-4 rounded-lg border-2 transition-all",
                input.currentCoverage === option.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{option.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{option.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </div>
                {input.currentCoverage === option.value && (
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {input.currentCoverage === "employer" && (
        <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
          <YesNo
            label="Is your employer plan considered affordable?"
            value={input.employerPlanAffordable}
            onChange={(v) => setInput((prev) => ({ ...prev, employerPlanAffordable: v }))}
            helpText="A plan is 'affordable' if the employee-only premium costs less than 9.12% of your household income. For example, if you make $50,000/year, an affordable plan would cost less than $380/month."
          />
        </div>
      )}

      <YesNo
        label="Are you pregnant?"
        value={input.isPregnant}
        onChange={(v) => setInput((prev) => ({ ...prev, isPregnant: v }))}
        helpText="Pregnancy may qualify you for Medicaid even at higher income levels."
      />

      <YesNo
        label="Are you a lawfully present immigrant?"
        value={input.isImmigrant}
        onChange={(v) => setInput((prev) => ({ ...prev, isImmigrant: v }))}
        helpText="Lawfully present immigrants can buy marketplace plans. Some may qualify for Medicaid depending on state and immigration status."
      />
    </div>
  );
}

function StepLifeChanges({
  input,
  setInput,
}: {
  input: ACAEligibilityInput;
  setInput: (fn: (prev: ACAEligibilityInput) => ACAEligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Recent Life Changes</h2>
        <p className="text-sm text-muted-foreground">
          Certain life events give you a Special Enrollment Period so you can sign up outside Open Enrollment.
        </p>
      </div>

      <YesNo
        label="Have you lost health coverage recently?"
        value={input.lostCoverageRecently}
        onChange={(v) => setInput((prev) => ({ ...prev, lostCoverageRecently: v }))}
        helpText="Losing job-based coverage, aging off a parent's plan, or losing Medicaid qualifies you for a 60-day SEP."
      />

      <YesNo
        label="Did you recently get married or divorced?"
        value={input.marriedOrDivorced}
        onChange={(v) => setInput((prev) => ({ ...prev, marriedOrDivorced: v }))}
        helpText="Marriage or divorce qualifies you for a Special Enrollment Period."
      />

      <YesNo
        label="Did you have a baby or adopt a child?"
        value={input.hadBaby}
        onChange={(v) => setInput((prev) => ({ ...prev, hadBaby: v }))}
        helpText="Adding a new dependent qualifies you for a Special Enrollment Period."
      />

      <YesNo
        label="Did you move to a new state?"
        value={input.movedState}
        onChange={(v) => setInput((prev) => ({ ...prev, movedState: v }))}
        helpText="Moving to a new coverage area qualifies you for a Special Enrollment Period."
      />

      <YesNo
        label="Has your income changed significantly?"
        value={input.incomeChangedSignificantly}
        onChange={(v) => setInput((prev) => ({ ...prev, incomeChangedSignificantly: v }))}
        helpText="A significant income change may affect your subsidy. You can update your application anytime."
      />
    </div>
  );
}

// ── Results Components ──

function EligibilityCard({
  label,
  eligible,
  description,
  highlight,
}: {
  label: string;
  eligible: boolean;
  description: string;
  highlight?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors",
        eligible
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : "border-muted bg-muted/30"
      )}
    >
      {eligible ? (
        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <p className={cn("font-medium text-sm", !eligible && "text-muted-foreground")}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {eligible && highlight && (
          <p className="text-xs font-semibold text-green-700 dark:text-green-300 mt-1">{highlight}</p>
        )}
      </div>
      {eligible && (
        <Badge className="ml-auto shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Eligible
        </Badge>
      )}
    </div>
  );
}

function ResultsView({
  result,
  onStartOver,
}: {
  result: ACAEligibilityResult;
  onStartOver: () => void;
}) {
  const [, navigate] = useLocation();

  const anyEligible = result.eligible.marketplace || result.eligible.medicaid || result.eligible.chip;
  const canEnrollNow =
    result.enrollmentPeriods.oep.eligible ||
    result.enrollmentPeriods.sep.eligible ||
    result.eligible.medicaid;

  return (
    <div className="space-y-6">
      {/* Eligibility Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your ACA Eligibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EligibilityCard
            label="ACA Marketplace"
            eligible={result.eligible.marketplace}
            description="You can purchase health insurance on the ACA marketplace exchange"
          />
          <EligibilityCard
            label="Premium Tax Credit (Subsidy)"
            eligible={result.eligible.subsidy}
            description="Financial help to lower your monthly premium"
            highlight={
              result.subsidyEstimate
                ? `Estimated $${result.subsidyEstimate.monthlySubsidy}/month savings`
                : undefined
            }
          />
          <EligibilityCard
            label="Cost Sharing Reductions (CSR)"
            eligible={result.eligible.csr}
            description="Lower deductibles and copays on Silver plans"
            highlight={result.csrLevel ? `${result.csrLevel} actuarial value` : undefined}
          />
          <EligibilityCard
            label="Medicaid"
            eligible={result.eligible.medicaid}
            description="State-funded health coverage with little to no cost"
          />
          <EligibilityCard
            label="CHIP (Children's Health Insurance)"
            eligible={result.eligible.chip}
            description="Low-cost health coverage for children under 19"
          />
        </CardContent>
      </Card>

      {/* Subsidy Estimate */}
      {result.subsidyEstimate && result.subsidyEstimate.monthlySubsidy > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
              <DollarSign className="h-5 w-5" />
              Your Estimated Subsidy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${result.subsidyEstimate.monthlySubsidy}
                </p>
                <p className="text-xs text-muted-foreground">Monthly savings</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${result.subsidyEstimate.annualSubsidy.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Annual savings</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  ${result.subsidyEstimate.expectedContribution}
                </p>
                <p className="text-xs text-muted-foreground">Your monthly cost</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  {result.subsidyEstimate.fplPercent}%
                </p>
                <p className="text-xs text-muted-foreground">of FPL</p>
              </div>
            </div>
            {result.csrLevel && (
              <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  You also qualify for <strong>Cost Sharing Reductions ({result.csrLevel})</strong> on Silver plans.
                  This means lower deductibles, copays, and out-of-pocket maximums compared to standard Silver plans.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enrollment Periods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Enrollment Periods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEnrollNow && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                You can enroll in a plan right now!
              </p>
            </div>
          )}

          <div className="rounded-lg border p-4 space-y-1">
            <div className="flex items-center gap-2">
              {result.enrollmentPeriods.oep.eligible ? (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <p className={cn("font-medium text-sm", !result.enrollmentPeriods.oep.eligible && "text-muted-foreground")}>
                Open Enrollment Period (OEP)
              </p>
              {result.enrollmentPeriods.oep.eligible && (
                <Badge className="ml-auto bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                  Active Now
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              {result.enrollmentPeriods.oep.eligible
                ? "Open Enrollment is active! You can sign up or change your marketplace plan."
                : `The Open Enrollment Period is ${result.enrollmentPeriods.oep.window}.`}
            </p>
          </div>

          {result.enrollmentPeriods.sep.reasons.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="font-medium text-sm">Special Enrollment Period (SEP)</p>
              </div>
              {result.enrollmentPeriods.sep.reasons.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground ml-6">
                  {r}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p>{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Important to Know
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p>{warning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Your Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.nextSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">
                {i + 1}
              </span>
              <p>{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {result.eligible.marketplace && (
          <>
            <Button
              size="lg"
              onClick={() => navigate("/aca")}
              className="flex-1"
            >
              <Search className="h-4 w-4 mr-2" />
              Find ACA Plans
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/aca/smart-match")}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              ACA Smart Match
            </Button>
          </>
        )}
        <Button
          size="lg"
          variant="ghost"
          onClick={onStartOver}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ──

const STEPS = ["about-you", "income", "coverage", "life-changes"] as const;
type Step = (typeof STEPS)[number];

export default function ACAEligibility() {
  const [step, setStep] = useState<Step>("about-you");
  const [input, setInput] = useState<ACAEligibilityInput>(defaultInput);
  const [result, setResult] = useState<ACAEligibilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const isLastStep = stepIndex === STEPS.length - 1;

  const goNext = () => {
    if (isLastStep) {
      submitEligibility();
    } else {
      setStep(STEPS[stepIndex + 1]);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1]);
    }
  };

  const startOver = () => {
    setInput(defaultInput);
    setResult(null);
    setStep("about-you");
  };

  const submitEligibility = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/aca/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to check eligibility");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("ACA eligibility check failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <PageHeader
        title="ACA Eligibility Check"
        description="Find out if you qualify for ACA marketplace plans, subsidies, and cost-sharing reductions."
        helpText="Answer a few questions about your income, household, and coverage to see what ACA benefits you qualify for and how much you could save. Results include Premium Tax Credit estimates, CSR eligibility, and Medicaid screening."
        dataSource="Data: Federal Poverty Level (FPL) guidelines from HHS, ACA subsidy thresholds from IRS, and Medicaid expansion status by state. Income calculations follow ACA Modified Adjusted Gross Income (MAGI) rules."
      />

      {/* Show results */}
      {result && <ResultsView result={result} onStartOver={startOver} />}

      {/* Show questionnaire */}
      {!result && (
        <Card>
          <CardHeader>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      i === stepIndex
                        ? "bg-primary text-primary-foreground"
                        : i < stepIndex
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i < stepIndex ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 w-8 rounded",
                        i < stepIndex ? "bg-green-400" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <CardTitle className="text-sm text-muted-foreground">
              Step {stepIndex + 1} of {STEPS.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === "about-you" && <StepAboutYou input={input} setInput={setInput} />}
            {step === "income" && <StepIncome input={input} setInput={setInput} />}
            {step === "coverage" && <StepCoverage input={input} setInput={setInput} />}
            {step === "life-changes" && <StepLifeChanges input={input} setInput={setInput} />}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={stepIndex === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={goNext} disabled={isLoading}>
                {isLoading ? (
                  "Checking..."
                ) : isLastStep ? (
                  <>
                    See My Results
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
