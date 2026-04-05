import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──

interface EligibilityInput {
  age: number;
  hasPartA: boolean;
  hasPartB: boolean;
  hasMedicaid: boolean;
  hasChronicCondition: boolean;
  chronicConditions: string[];
  isInstitutionalized: boolean;
  currentCoverage: "none" | "original_medicare" | "medicare_advantage" | "employer" | "medicaid";
  currentPlanName: string;
  partAEffectiveDate: string;
  turningAge65Date: string;
  recentlyMoved: boolean;
  lostEmployerCoverage: boolean;
}

interface EligibilityResult {
  eligible: {
    ma: boolean;
    mapd: boolean;
    pdp: boolean;
    medigap: boolean;
    dsnp: boolean;
    csnp: boolean;
    isnp: boolean;
  };
  enrollmentPeriods: {
    iep: { eligible: boolean; reason: string; window?: string };
    aep: { eligible: boolean; reason: string; window: string };
    oep: { eligible: boolean; reason: string; window: string };
    sep: { eligible: boolean; reasons: string[] };
    dualSep: { eligible: boolean; reason: string };
  };
  recommendations: string[];
  warnings: string[];
  nextSteps: string[];
}

const CHRONIC_CONDITIONS = [
  { id: "diabetes", label: "Diabetes" },
  { id: "copd", label: "COPD" },
  { id: "heart_failure", label: "Heart Failure" },
  { id: "esrd", label: "End-Stage Renal Disease (ESRD)" },
  { id: "chronic_lung", label: "Chronic Lung Disease" },
  { id: "cardiovascular", label: "Cardiovascular Disease" },
];

const defaultInput: EligibilityInput = {
  age: 65,
  hasPartA: false,
  hasPartB: false,
  hasMedicaid: false,
  hasChronicCondition: false,
  chronicConditions: [],
  isInstitutionalized: false,
  currentCoverage: "none",
  currentPlanName: "",
  partAEffectiveDate: "",
  turningAge65Date: "",
  recentlyMoved: false,
  lostEmployerCoverage: false,
};

// ── Yes/No Radio Helper ──

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

// ── Step Components ──

function StepBasicInfo({
  input,
  setInput,
}: {
  input: EligibilityInput;
  setInput: (fn: (prev: EligibilityInput) => EligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Let's start with the basics</h2>
        <p className="text-sm text-muted-foreground">
          This helps us understand which Medicare plans you might be eligible for.
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
          placeholder="65"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you have Medicare Part A (Hospital Insurance)?</Label>
        <p className="text-xs text-muted-foreground">
          🏥 Part A covers inpatient hospital stays, skilled nursing, and hospice. Most people get it automatically at 65 — <strong>look at your red, white & blue Medicare card for "HOSPITAL (PART A)"</strong>.
        </p>
        <YesNo
          label=""
          value={input.hasPartA}
          onChange={(v) => setInput((prev) => ({ ...prev, hasPartA: v }))}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Do you have Medicare Part B (Medical Insurance)?</Label>
        <p className="text-xs text-muted-foreground">
          👨‍⚕️ Part B covers doctor visits, outpatient care, and preventive services. You pay a monthly premium (~$185/month in 2026). <strong>Look at your Medicare card for "MEDICAL (PART B)"</strong>.
        </p>
        <YesNo
          label=""
          value={input.hasPartB}
          onChange={(v) => setInput((prev) => ({ ...prev, hasPartB: v }))}
        />
      </div>
    </div>
  );
}

function StepCoverage({
  input,
  setInput,
}: {
  input: EligibilityInput;
  setInput: (fn: (prev: EligibilityInput) => EligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Your current coverage</h2>
        <p className="text-sm text-muted-foreground">
          Tell us about any health coverage you have right now.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">What coverage do you currently have?</Label>
        <p className="text-xs text-muted-foreground">Tap the option that matches your situation. Not sure? Look at your Medicare card.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              value: "original_medicare",
              title: "Original Medicare",
              description: "Red, white & blue Medicare card. You have Part A (hospital) and Part B (medical) from the government.",
              hint: "Your card says 'Medicare Health Insurance' with a red and blue stripe",
              emoji: "🏛️",
            },
            {
              value: "medicare_advantage",
              title: "Medicare Advantage Plan",
              description: "A private plan (like Humana, UHC, Aetna) that covers everything Medicare covers, plus extras.",
              hint: "Your card has a private insurance company name on it, not just 'Medicare'",
              emoji: "⭐",
            },
            {
              value: "employer",
              title: "Employer / Union Coverage",
              description: "Health insurance through your job, your spouse's job, or a retiree plan.",
              hint: "You get this through work or a pension/retirement package",
              emoji: "💼",
            },
            {
              value: "medicaid",
              title: "Medicaid Only",
              description: "State-funded health coverage for people with limited income. Different from Medicare.",
              hint: "Your card has your state's Medicaid program name on it",
              emoji: "🏥",
            },
            {
              value: "none",
              title: "No Coverage / Not Sure",
              description: "I don't have any health coverage right now, or I'm not sure what I have.",
              hint: "That's okay — we'll help you figure out what you qualify for",
              emoji: "❓",
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setInput((prev) => ({
                  ...prev,
                  currentCoverage: option.value as EligibilityInput["currentCoverage"],
                }))
              }
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                input.currentCoverage === option.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{option.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{option.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  <p className="text-xs text-primary/70 mt-1 italic">{option.hint}</p>
                </div>
                {input.currentCoverage === option.value && (
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {input.currentCoverage === "medicare_advantage" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">What plan are you currently on?</Label>
          <Input
            placeholder="e.g. Humana Gold Plus"
            value={input.currentPlanName}
            onChange={(e) =>
              setInput((prev) => ({ ...prev, currentPlanName: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            This helps us understand your starting point (optional).
          </p>
        </div>
      )}

      <YesNo
        label="Are you also enrolled in Medicaid?"
        value={input.hasMedicaid}
        onChange={(v) => setInput((prev) => ({ ...prev, hasMedicaid: v }))}
        helpText="If you have both Medicare and Medicaid, you may qualify for special plans with extra benefits."
      />
    </div>
  );
}

function StepHealth({
  input,
  setInput,
}: {
  input: EligibilityInput;
  setInput: (fn: (prev: EligibilityInput) => EligibilityInput) => void;
}) {
  const toggleCondition = (id: string) => {
    setInput((prev) => {
      const conditions = prev.chronicConditions.includes(id)
        ? prev.chronicConditions.filter((c) => c !== id)
        : [...prev.chronicConditions, id];
      return {
        ...prev,
        chronicConditions: conditions,
        hasChronicCondition: conditions.length > 0,
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Your health needs</h2>
        <p className="text-sm text-muted-foreground">
          Some plans are designed specifically for people with certain health conditions.
          This is completely optional.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Do you have any of these chronic conditions?
        </Label>
        <p className="text-xs text-muted-foreground">
          Select all that apply. This helps us find specialized plans.
        </p>
        <div className="space-y-2">
          {CHRONIC_CONDITIONS.map((condition) => (
            <div key={condition.id} className="flex items-center space-x-2">
              <Checkbox
                checked={input.chronicConditions.includes(condition.id)}
                onCheckedChange={() => toggleCondition(condition.id)}
              />
              <Label className="text-sm cursor-pointer">{condition.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <YesNo
        label="Do you live in a nursing facility or receive long-term care?"
        value={input.isInstitutionalized}
        onChange={(v) => setInput((prev) => ({ ...prev, isInstitutionalized: v }))}
        helpText="This includes nursing homes, assisted living with skilled nursing, or long-term care facilities."
      />
    </div>
  );
}

function StepLifeChanges({
  input,
  setInput,
}: {
  input: EligibilityInput;
  setInput: (fn: (prev: EligibilityInput) => EligibilityInput) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Recent life changes</h2>
        <p className="text-sm text-muted-foreground">
          Certain life events can open up special enrollment opportunities outside the normal enrollment window.
        </p>
      </div>

      <YesNo
        label="Have you recently moved to a new area?"
        value={input.recentlyMoved}
        onChange={(v) => setInput((prev) => ({ ...prev, recentlyMoved: v }))}
        helpText="Moving can give you a chance to change your plan, since different plans are available in different areas."
      />

      <YesNo
        label="Have you recently lost employer health coverage?"
        value={input.lostEmployerCoverage}
        onChange={(v) => setInput((prev) => ({ ...prev, lostEmployerCoverage: v }))}
        helpText="Losing employer coverage opens a special enrollment window."
      />

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Are you turning 65 in the next 7 months?
        </Label>
        <p className="text-xs text-muted-foreground">
          If so, enter the month you turn 65 to check your Initial Enrollment Period.
        </p>
        <Input
          type="month"
          value={input.turningAge65Date}
          onChange={(e) =>
            setInput((prev) => ({ ...prev, turningAge65Date: e.target.value }))
          }
          className="w-48"
        />
      </div>
    </div>
  );
}

// ── Results Components ──

function EligibilityCard({
  label,
  eligible,
  description,
}: {
  label: string;
  eligible: boolean;
  description: string;
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
      <div>
        <p className={cn("font-medium text-sm", !eligible && "text-muted-foreground")}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
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
  result: EligibilityResult;
  onStartOver: () => void;
}) {
  const [, navigate] = useLocation();

  const anyEligible = Object.values(result.eligible).some((v) => v);
  const canEnrollNow =
    result.enrollmentPeriods.iep.eligible ||
    result.enrollmentPeriods.aep.eligible ||
    result.enrollmentPeriods.oep.eligible ||
    result.enrollmentPeriods.sep.eligible ||
    result.enrollmentPeriods.dualSep.eligible;

  // Build query params for Plan Finder based on eligibility
  const buildFinderParams = () => {
    const params = new URLSearchParams();
    if (result.eligible.dsnp) {
      params.set("snpType", "D-SNP");
    }
    return params.toString();
  };

  return (
    <div className="space-y-6">
      {/* Eligibility Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Eligibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <EligibilityCard
            label="Medicare Advantage (MA)"
            eligible={result.eligible.ma}
            description="All-in-one plans that replace Original Medicare, often with extra benefits"
          />
          <EligibilityCard
            label="MA with Part D (MAPD)"
            eligible={result.eligible.mapd}
            description="Medicare Advantage with built-in prescription drug coverage"
          />
          <EligibilityCard
            label="Standalone Part D (PDP)"
            eligible={result.eligible.pdp}
            description="Prescription drug plans to add to Original Medicare"
          />
          <EligibilityCard
            label="Medigap (Medicare Supplement)"
            eligible={result.eligible.medigap}
            description="Supplemental insurance to cover gaps in Original Medicare"
          />
          <EligibilityCard
            label="D-SNP (Dual Special Needs)"
            eligible={result.eligible.dsnp}
            description="Plans for people with both Medicare and Medicaid, with extra benefits"
          />
          <EligibilityCard
            label="C-SNP (Chronic Condition SNP)"
            eligible={result.eligible.csnp}
            description="Specialized plans for managing chronic health conditions"
          />
          <EligibilityCard
            label="I-SNP (Institutional SNP)"
            eligible={result.eligible.isnp}
            description="Plans designed for people in nursing facilities or long-term care"
          />
        </CardContent>
      </Card>

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

          <EnrollmentPeriodRow
            label="Initial Enrollment Period (IEP)"
            eligible={result.enrollmentPeriods.iep.eligible}
            reason={result.enrollmentPeriods.iep.reason}
            window={result.enrollmentPeriods.iep.window}
          />
          <EnrollmentPeriodRow
            label="Annual Enrollment Period (AEP)"
            eligible={result.enrollmentPeriods.aep.eligible}
            reason={result.enrollmentPeriods.aep.reason}
            window={result.enrollmentPeriods.aep.window}
          />
          <EnrollmentPeriodRow
            label="Open Enrollment Period (OEP)"
            eligible={result.enrollmentPeriods.oep.eligible}
            reason={result.enrollmentPeriods.oep.reason}
            window={result.enrollmentPeriods.oep.window}
          />
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
          <EnrollmentPeriodRow
            label="Dual/LIS Monthly SEP"
            eligible={result.enrollmentPeriods.dualSep.eligible}
            reason={result.enrollmentPeriods.dualSep.reason}
          />
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
        {anyEligible && (
          <>
            <Button
              size="lg"
              onClick={() => navigate(`/find?${buildFinderParams()}`)}
              className="flex-1"
            >
              <Search className="h-4 w-4 mr-2" />
              Find Plans in My Area
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/smart-match")}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              Smart Match
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

function EnrollmentPeriodRow({
  label,
  eligible,
  reason,
  window,
}: {
  label: string;
  eligible: boolean;
  reason: string;
  window?: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="flex items-center gap-2">
        {eligible ? (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        <p className={cn("font-medium text-sm", !eligible && "text-muted-foreground")}>
          {label}
        </p>
        {eligible && (
          <Badge className="ml-auto bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
            Active Now
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground ml-6">{reason}</p>
      {window && !eligible && (
        <p className="text-xs text-muted-foreground ml-6">Window: {window}</p>
      )}
    </div>
  );
}

// ── Main Page ──

const STEPS = ["basics", "coverage", "health", "life-changes"] as const;
type Step = (typeof STEPS)[number];

export default function EligibilityCheck() {
  const [step, setStep] = useState<Step>("basics");
  const [input, setInput] = useState<EligibilityInput>(defaultInput);
  const [result, setResult] = useState<EligibilityResult | null>(null);
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
    setStep("basics");
  };

  const submitEligibility = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to check eligibility");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      // error handled silently — loading state resets via finally block
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <PageHeader
        title="Eligibility Check"
        description="Find out which Medicare plans you qualify for and when you can enroll."
        helpText="Answer a few simple questions about your current coverage and we'll show you exactly which plan types you're eligible for and whether you can enroll right now. Covers MA, MA-PD, PDP, Medigap, D-SNP, and C-SNP eligibility."
        dataSource="Data: Medicare eligibility rules from CMS Medicare & You handbook and 42 CFR Part 422/423. Enrollment period logic based on official CMS enrollment calendar. Always confirm eligibility with 1-800-MEDICARE."
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
            {step === "basics" && <StepBasicInfo input={input} setInput={setInput} />}
            {step === "coverage" && <StepCoverage input={input} setInput={setInput} />}
            {step === "health" && <StepHealth input={input} setInput={setInput} />}
            {step === "life-changes" && (
              <StepLifeChanges input={input} setInput={setInput} />
            )}

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
