import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Star,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Phone,
  Stethoscope,
  X,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Heart,
  Bus,
  UtensilsCrossed,
  Dumbbell,
  Video,
  Home,
  DollarSign,
  GitCompareArrows,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { ProviderSearchInput } from "@/components/providers/ProviderSearchInput";
import type { ProviderResult } from "@/hooks/useProviderSearch";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──

interface SelectedDoctor {
  npi: string;
  name: string;
  specialty: string;
  city?: string;
  state?: string;
}

interface DoctorConfidence {
  npi: string;
  name: string;
  confidence: number;
  level: string;
}

interface DoctorFirstPlan {
  id: number;
  name: string;
  carrier: string;
  planType: string;
  state: string;
  county: string;
  premium: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  dental: number;
  vision: number;
  otcPerQuarter: number;
  starRating: number | null;
  drugDeductible: number | null;
  transportation: boolean;
  mealBenefit: boolean;
  fitness: boolean;
  telehealth: boolean;
  inHomeSupport: boolean;
  partBGiveback: number | null;
  snpType: string | null;
  doctorConfidence: DoctorConfidence[];
  avgDoctorConfidence: number;
  allDoctorsLikely: boolean;
  highlights: string[];
  enrollmentUrl: string | null;
  enrollmentPhone: string | null;
  enrollmentType: string;
  verificationUrl: string;
}

interface DoctorFirstResult {
  doctors: Array<{ npi: string; name: string; specialty: string }>;
  location: { county: string; state: string };
  plans: DoctorFirstPlan[];
  totalPlans: number;
  plansWithAllDoctors: number;
  insight: string;
}

// ── Confidence Badge ──

function ConfidenceBadge({ confidence, level }: { confidence: number; level: string }) {
  const colors = {
    high: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    low: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    unknown: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
  };

  const labels: Record<string, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
    unknown: "Unknown",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[level as keyof typeof colors] || colors.unknown
      )}
    >
      {confidence}% - {labels[level] || "Unknown"}
    </span>
  );
}

// ── Doctor Confidence Row ──

function DoctorConfidenceRow({ doc }: { doc: DoctorConfidence }) {
  const icon =
    doc.confidence >= 60 ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
    ) : doc.confidence >= 40 ? (
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
    );

  const barColor =
    doc.confidence >= 60
      ? "bg-green-500"
      : doc.confidence >= 40
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium truncate">Dr. {doc.name}</span>
          <ConfidenceBadge confidence={doc.confidence} level={doc.level} />
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${Math.max(doc.confidence, 3)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Plan Card ──

function DoctorFirstPlanCard({
  plan,
  onCompare,
  isSelected,
}: {
  plan: DoctorFirstPlan;
  onCompare: (id: number) => void;
  isSelected: boolean;
}) {
  const starDisplay = plan.starRating
    ? Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < Math.round(plan.starRating!)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          )}
        />
      ))
    : null;

  const lowConfidenceDoctors = plan.doctorConfidence.filter(
    (d) => d.confidence < 60
  );

  const supplementalIcons = [
    { has: plan.transportation, icon: <Bus className="h-3.5 w-3.5" />, label: "Transportation" },
    { has: plan.mealBenefit, icon: <UtensilsCrossed className="h-3.5 w-3.5" />, label: "Meals" },
    { has: plan.fitness, icon: <Dumbbell className="h-3.5 w-3.5" />, label: "Fitness" },
    { has: plan.telehealth, icon: <Video className="h-3.5 w-3.5" />, label: "Telehealth" },
    { has: plan.inHomeSupport, icon: <Home className="h-3.5 w-3.5" />, label: "In-Home" },
    {
      has: plan.partBGiveback !== null && plan.partBGiveback > 0,
      icon: <DollarSign className="h-3.5 w-3.5" />,
      label: "Part B Giveback",
    },
  ];

  return (
    <Card className={cn("transition-shadow hover:shadow-md", isSelected && "ring-2 ring-primary")}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {plan.allDoctorsLikely && (
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              )}
              <h3 className="font-semibold text-sm">{plan.name}</h3>
              <Badge variant="outline" className="text-xs shrink-0">
                {plan.planType}
              </Badge>
              {plan.snpType && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {plan.snpType}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan.carrier} &middot; {plan.county}, {plan.state}
            </p>
          </div>
          {/* Avg Doctor Match */}
          <div
            className={cn(
              "text-center shrink-0 rounded-lg px-3 py-1.5",
              plan.avgDoctorConfidence >= 60
                ? "bg-green-50 dark:bg-green-950"
                : plan.avgDoctorConfidence >= 40
                  ? "bg-yellow-50 dark:bg-yellow-950"
                  : "bg-red-50 dark:bg-red-950"
            )}
          >
            <span
              className={cn(
                "text-lg font-bold",
                plan.avgDoctorConfidence >= 60
                  ? "text-green-700 dark:text-green-300"
                  : plan.avgDoctorConfidence >= 40
                    ? "text-yellow-700 dark:text-yellow-300"
                    : "text-red-700 dark:text-red-300"
              )}
            >
              {plan.avgDoctorConfidence}%
            </span>
            <p className="text-[10px] text-muted-foreground">Doctor Match</p>
          </div>
        </div>

        {/* Doctor Coverage */}
        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Doctor Coverage
          </p>
          {plan.doctorConfidence.map((doc) => (
            <DoctorConfidenceRow key={doc.npi} doc={doc} />
          ))}
        </div>

        {/* Warning for low confidence doctors */}
        {lowConfidenceDoctors.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-medium">
                {lowConfidenceDoctors.map((d) => `Dr. ${d.name}`).join(", ")}{" "}
                may not be in-network.
              </p>
              <p className="mt-0.5">
                Verify at{" "}
                <a
                  href={plan.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  the carrier's provider directory
                </a>{" "}
                before enrolling.
              </p>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Premium</span>
            <span className="font-semibold">${plan.premium}/mo</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">MOOP</span>
            <span className="font-semibold">
              ${plan.moop.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">PCP Copay</span>
            <span className="font-semibold">${plan.pcpCopay}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Star Rating
            </span>
            <div className="flex items-center gap-0.5">
              {starDisplay ?? (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
          </div>
        </div>

        {/* Benefits Row */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Dental</span>
            <span className="font-semibold">
              ${plan.dental.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Vision</span>
            <span className="font-semibold">${plan.vision}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">OTC/Qtr</span>
            <span className="font-semibold">${plan.otcPerQuarter}</span>
          </div>
        </div>

        {/* Highlights */}
        {plan.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plan.highlights.map((h, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {h}
              </Badge>
            ))}
          </div>
        )}

        {/* Supplemental Icons */}
        <div className="flex items-center gap-2 flex-wrap">
          {supplementalIcons.map((s, i) =>
            s.has ? (
              <div
                key={i}
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                title={s.label}
              >
                {s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ) : null
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t">
          {plan.enrollmentUrl && plan.enrollmentType !== "phone" ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => window.open(plan.enrollmentUrl!, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Enroll Online
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" disabled>
              Contact Carrier
            </Button>
          )}
          <Button
            size="sm"
            variant={isSelected ? "default" : "outline"}
            onClick={() => onCompare(plan.id)}
          >
            <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
            {isSelected ? "Selected" : "Compare"}
          </Button>
          {plan.enrollmentPhone && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(`tel:${plan.enrollmentPhone}`, "_self")
              }
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Call
            </Button>
          )}
        </div>

        {/* Always show verification notice */}
        <p className="text-[10px] text-muted-foreground text-center">
          Always verify network status with the carrier before enrolling.{" "}
          <a
            href={plan.verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Check provider directory
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

// ── Plan Group Section ──

function PlanGroup({
  title,
  icon,
  plans,
  defaultOpen,
  comparePlanIds,
  onCompare,
  colorClass,
}: {
  title: string;
  icon: React.ReactNode;
  plans: DoctorFirstPlan[];
  defaultOpen: boolean;
  comparePlanIds: Set<number>;
  onCompare: (id: number) => void;
  colorClass: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (plans.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full text-left rounded-lg px-4 py-3 transition-colors",
            colorClass
          )}
        >
          {icon}
          <span className="font-semibold text-sm flex-1">
            {title} ({plans.length} plan{plans.length !== 1 ? "s" : ""})
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen ? "" : "-rotate-90"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 mt-3">
          {plans.map((plan) => (
            <DoctorFirstPlanCard
              key={plan.id}
              plan={plan}
              onCompare={onCompare}
              isSelected={comparePlanIds.has(plan.id)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main Page ──

export default function KeepMyDoctor() {
  const [, navigate] = useLocation();
  const { token } = useAuth();

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Doctors
  const [selectedDoctors, setSelectedDoctors] = useState<SelectedDoctor[]>([]);

  // Step 2: Location + Preferences
  const [zip, setZip] = useState("");
  const [zeroPremium, setZeroPremium] = useState(false);
  const [wantsDental, setWantsDental] = useState(false);
  const [wantsOtc, setWantsOtc] = useState(false);

  // Step 3: Results
  const [comparePlanIds, setComparePlanIds] = useState<Set<number>>(new Set());

  const zipValid = /^\d{5}$/.test(zip);

  const handleProviderSelect = (provider: ProviderResult) => {
    // Avoid duplicates
    if (selectedDoctors.some((d) => d.npi === provider.npi)) return;
    setSelectedDoctors((prev) => [
      ...prev,
      {
        npi: provider.npi,
        name: provider.name,
        specialty: provider.specialty || "Unknown",
        city: provider.city,
        state: provider.state,
      },
    ]);
  };

  const removeDoctor = (npi: string) => {
    setSelectedDoctors((prev) => prev.filter((d) => d.npi !== npi));
  };

  const toggleCompare = (planId: number) => {
    setComparePlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else if (next.size < 3) {
        next.add(planId);
      }
      return next;
    });
  };

  // Mutation for the doctor-first match
  const {
    mutate: runMatch,
    data: result,
    isPending: isLoading,
    error,
  } = useMutation<DoctorFirstResult, Error>({
    mutationFn: async () => {
      const body = {
        doctors: selectedDoctors.map((d) => ({
          npi: d.npi,
          name: d.name,
          specialty: d.specialty,
        })),
        zip,
        additionalPreferences: {
          maxPremium: zeroPremium ? 0 : undefined,
          wantsDental,
          wantsOtc,
        },
      };

      const res = await fetch("/api/doctor-first-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to find matching plans");
      }
      return res.json();
    },
    onSuccess: () => {
      setStep(3);
    },
  });

  const handleSubmit = () => {
    if (zipValid && selectedDoctors.length > 0) {
      runMatch();
    }
  };

  const goToCompare = () => {
    if (comparePlanIds.size >= 2) {
      const ids = Array.from(comparePlanIds).join(",");
      navigate(`/compare?ids=${ids}`);
    }
  };

  const resetSearch = () => {
    setStep(1);
    setComparePlanIds(new Set());
  };

  // Categorize plans for green/yellow/red grouping
  const greenPlans = result?.plans.filter((p) => p.allDoctorsLikely) ?? [];
  const yellowPlans =
    result?.plans.filter(
      (p) =>
        !p.allDoctorsLikely &&
        p.doctorConfidence.some((d) => d.confidence >= 40)
    ) ?? [];
  const redPlans =
    result?.plans.filter(
      (p) =>
        !p.allDoctorsLikely &&
        p.doctorConfidence.every((d) => d.confidence < 40)
    ) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Keep Your Doctor"
        description="Finding a plan that includes YOUR doctors is what matters most. Add your doctors and we'll find plans that cover them."
        helpText="Step 1: Search for your doctors by last name. Step 2: Enter your ZIP code. Step 3: See plans ranked by how likely they are to include your doctors. Confidence scores (High/Medium/Low) indicate network likelihood — always verify with the carrier before enrolling."
        dataSource="Data: Doctor names from CMS NPPES NPI Registry (2.8M+ providers) and our local database of 500K Medicare-relevant providers. Network confidence uses carrier FHIR APIs (UHC, Humana, Aetna, Cigna, Anthem) plus CMS plan service area files. Plans from CMS CY2026 PBP data."
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {s}
            </div>
            <span
              className={cn(
                "text-sm font-medium hidden sm:inline",
                step >= s ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s === 1 ? "Your Doctors" : s === 2 ? "Location" : "Results"}
            </span>
            {s < 3 && (
              <div
                className={cn(
                  "flex-1 h-0.5 rounded-full",
                  step > s ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Your Doctors ── */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-rose-500" />
                Add Your Doctors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Search for your doctors below. We'll find plans that are most
                likely to include them in-network.
              </p>

              <ProviderSearchInput onSelect={handleProviderSelect} />

              {/* Selected doctors list */}
              {selectedDoctors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-semibold">
                    Your Doctors ({selectedDoctors.length})
                  </p>
                  {selectedDoctors.map((doc) => (
                    <div
                      key={doc.npi}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          Dr. {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.specialty}
                          {doc.city && doc.state
                            ? ` -- ${doc.city}, ${doc.state}`
                            : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          NPI: {doc.npi}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeDoctor(doc.npi)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {selectedDoctors.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Stethoscope className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    Search for a doctor above to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() => setStep(2)}
              disabled={selectedDoctors.length === 0}
            >
              Next: Enter Your Location
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Location + Preferences ── */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">ZIP Code</Label>
                <Input
                  type="text"
                  placeholder="e.g. 33140"
                  maxLength={5}
                  value={zip}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setZip(v);
                  }}
                  className={cn(
                    "text-lg max-w-xs",
                    zip.length > 0 && !zipValid && "border-red-400"
                  )}
                />
                {zip.length > 0 && !zipValid && (
                  <p className="text-xs text-red-500">
                    Enter a valid 5-digit ZIP code
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Optional Preferences
                </p>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={zeroPremium}
                      onCheckedChange={(v) => setZeroPremium(!!v)}
                    />
                    <span className="text-sm">$0 premium plans only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={wantsDental}
                      onCheckedChange={(v) => setWantsDental(!!v)}
                    />
                    <span className="text-sm">Must have dental coverage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={wantsOtc}
                      onCheckedChange={(v) => setWantsOtc(!!v)}
                    />
                    <span className="text-sm">Must have OTC allowance</span>
                  </label>
                </div>
              </div>

              {/* Summary of doctors */}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Searching for plans that include:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedDoctors.map((doc) => (
                    <Badge key={doc.npi} variant="secondary" className="text-xs">
                      Dr. {doc.name} - {doc.specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-300">
              {error.message}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Doctors
            </Button>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!zipValid || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-pulse">Searching plans...</span>
                </>
              ) : (
                <>
                  Find Plans for My Doctors
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && result && (
        <div className="space-y-6">
          {/* Back + context */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={resetSearch}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              New Search
            </Button>
            <p className="text-sm text-muted-foreground">
              {result.location.county}, {result.location.state} &middot;{" "}
              {result.totalPlans} plans found
            </p>
          </div>

          {/* Insight banner */}
          <div
            className={cn(
              "rounded-lg p-4 border",
              result.plansWithAllDoctors > 0
                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
            )}
          >
            <div className="flex items-start gap-3">
              {result.plansWithAllDoctors > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={cn(
                    "font-semibold text-sm",
                    result.plansWithAllDoctors > 0
                      ? "text-green-800 dark:text-green-200"
                      : "text-amber-800 dark:text-amber-200"
                  )}
                >
                  {result.plansWithAllDoctors > 0
                    ? `Great news! ${result.plansWithAllDoctors} of ${result.totalPlans} plans in your area likely include all your doctors.`
                    : result.insight}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence scores are estimates based on available data. Always
                  verify with the carrier before enrolling.
                </p>
              </div>
            </div>
          </div>

          {/* Doctors summary */}
          <div className="flex flex-wrap gap-2">
            {result.doctors.map((doc) => (
              <Badge
                key={doc.npi}
                variant="outline"
                className="text-xs flex items-center gap-1"
              >
                <Stethoscope className="h-3 w-3" />
                Dr. {doc.name} - {doc.specialty}
              </Badge>
            ))}
          </div>

          {/* Plan groups */}
          <div className="space-y-4">
            <PlanGroup
              title="All Doctors Likely In-Network"
              icon={
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              }
              plans={greenPlans}
              defaultOpen={true}
              comparePlanIds={comparePlanIds}
              onCompare={toggleCompare}
              colorClass="bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
            />

            <PlanGroup
              title="Some Doctors May Not Be Covered"
              icon={
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
              }
              plans={yellowPlans}
              defaultOpen={greenPlans.length === 0}
              comparePlanIds={comparePlanIds}
              onCompare={toggleCompare}
              colorClass="bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50"
            />

            <PlanGroup
              title="Doctors Unlikely Covered"
              icon={
                <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0" />
              }
              plans={redPlans}
              defaultOpen={false}
              comparePlanIds={comparePlanIds}
              onCompare={toggleCompare}
              colorClass="bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50"
            />
          </div>

          {/* No results */}
          {result.plans.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No plans found in your area. Try a different ZIP code.
              </CardContent>
            </Card>
          )}

          {/* Compare helper */}
          {result.plans.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Compare Your Top Picks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Select 2-3 plans above, then compare side-by-side.
                      {comparePlanIds.size > 0 &&
                        ` (${comparePlanIds.size} selected)`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={goToCompare}
                    disabled={comparePlanIds.size < 2}
                  >
                    <GitCompareArrows className="h-4 w-4 mr-1.5" />
                    Compare{" "}
                    {comparePlanIds.size >= 2
                      ? `(${comparePlanIds.size})`
                      : ""}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Loading state for step 3 */}
      {step === 2 && isLoading && (
        <div className="space-y-4 mt-6">
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <Stethoscope className="h-8 w-8 mx-auto mb-2 animate-pulse text-primary" />
            <p className="text-sm font-medium">
              Checking doctor networks across all plans...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take a moment.
            </p>
          </div>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-10 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
