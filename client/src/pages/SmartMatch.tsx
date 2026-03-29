import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  ArrowLeft,
  ExternalLink,
  Phone,
  Bus,
  UtensilsCrossed,
  Dumbbell,
  Video,
  Home,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──

type MatchProfile =
  | "cheapest"
  | "best_dental"
  | "best_drugs"
  | "best_overall"
  | "doctor_friendly"
  | "chronic_care"
  | "extra_benefits";

interface SmartMatchPlan {
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
  whyItMatches: string;
  switchScore: number;
  highlights: string[];
  enrollmentUrl: string | null;
  enrollmentPhone: string | null;
  enrollmentType: string;
}

interface SmartMatchResult {
  profile: MatchProfile;
  profileName: string;
  profileDescription: string;
  plans: SmartMatchPlan[];
  totalMatching: number;
  location: { county: string; state: string } | null;
}

const PROFILES: {
  id: MatchProfile;
  emoji: string;
  title: string;
  description: string;
}[] = [
  {
    id: "cheapest",
    emoji: "\uD83D\uDCB0",
    title: "Lowest Cost",
    description: "$0 premium, minimal out-of-pocket",
  },
  {
    id: "best_dental",
    emoji: "\uD83E\uDDB7",
    title: "Best Dental",
    description: "Highest dental coverage and benefits",
  },
  {
    id: "best_drugs",
    emoji: "\uD83D\uDC8A",
    title: "Best Drug Coverage",
    description: "$0 deductible, lowest copays",
  },
  {
    id: "best_overall",
    emoji: "\u2B50",
    title: "Best Overall Value",
    description: "Most benefits for the money",
  },
  {
    id: "doctor_friendly",
    emoji: "\uD83C\uDFE5",
    title: "Doctor Freedom",
    description: "PPO plans, no referrals needed",
  },
  {
    id: "chronic_care",
    emoji: "\uD83D\uDC9A",
    title: "Chronic Care",
    description: "Extra support for ongoing conditions",
  },
  {
    id: "extra_benefits",
    emoji: "\uD83C\uDF81",
    title: "Most Extra Benefits",
    description: "OTC, meals, transport, and more",
  },
];

// ── Plan Result Card ──

function SmartMatchPlanCard({ plan }: { plan: SmartMatchPlan }) {
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
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
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
          {/* Switch Score */}
          <div
            className={cn(
              "text-center shrink-0 rounded-lg px-3 py-1.5",
              plan.switchScore > 0
                ? "bg-green-50 dark:bg-green-950"
                : plan.switchScore < -500
                  ? "bg-red-50 dark:bg-red-950"
                  : "bg-muted"
            )}
          >
            <div className="flex items-center gap-1">
              {plan.switchScore > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-sm font-bold",
                  plan.switchScore > 0
                    ? "text-green-700 dark:text-green-300"
                    : "text-muted-foreground"
                )}
              >
                {plan.switchScore > 0 ? "+" : ""}${plan.switchScore.toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">vs average</p>
          </div>
        </div>

        {/* Why It Matches */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 p-3">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {plan.whyItMatches}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Premium</span>
            <span className="font-semibold">${plan.premium}/mo</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">MOOP</span>
            <span className="font-semibold">${plan.moop.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">PCP Copay</span>
            <span className="font-semibold">${plan.pcpCopay}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Star Rating</span>
            <div className="flex items-center gap-0.5">
              {starDisplay ?? <span className="text-muted-foreground">N/A</span>}
            </div>
          </div>
        </div>

        {/* Benefits Row */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block">Dental</span>
            <span className="font-semibold">${plan.dental.toLocaleString()}</span>
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

        {/* Enrollment Button */}
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
          {plan.enrollmentPhone && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`tel:${plan.enrollmentPhone}`, "_self")}
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              {plan.enrollmentPhone}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function SmartMatch() {
  const [, navigate] = useLocation();
  const [zip, setZip] = useState("");
  const [selectedProfiles, setSelectedProfiles] = useState<MatchProfile[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState<{
    zip: string;
    profiles: MatchProfile[];
  } | null>(null);
  // Keep selectedProfile for backward compat in the query
  const selectedProfile = selectedProfiles[0] || null;

  const zipValid = /^\d{5}$/.test(zip);

  // Query the first selected profile (or "best_overall" for multi)
  const queryProfile = submittedQuery?.profiles.length === 1
    ? submittedQuery.profiles[0]
    : "best_overall";

  const { data: result, isLoading } = useQuery<SmartMatchResult>({
    queryKey: ["/api/smart-match", submittedQuery?.zip, submittedQuery?.profiles.join(",")],
    queryFn: async () => {
      // If multiple profiles selected, fetch best_overall which captures all
      const res = await fetch(
        `/api/smart-match?zip=${submittedQuery!.zip}&profile=${queryProfile}`
      );
      if (!res.ok) throw new Error("Failed to run smart match");
      return res.json();
    },
    enabled: !!submittedQuery,
  });

  const toggleProfile = (profile: MatchProfile) => {
    setSelectedProfiles((prev) =>
      prev.includes(profile)
        ? prev.filter((p) => p !== profile)
        : [...prev, profile]
    );
  };

  const selectAll = () => {
    const allIds = PROFILES.map((p) => p.id);
    setSelectedProfiles((prev) => prev.length === allIds.length ? [] : allIds);
  };

  const handleSubmit = () => {
    if (zipValid && selectedProfiles.length > 0) {
      setSubmittedQuery({ zip, profiles: selectedProfiles });
    }
  };

  const resetSearch = () => {
    setSubmittedQuery(null);
    setSelectedProfiles([]);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Smart Match"
        description="Tell us what matters most to you, and we'll find the best Medicare plans instantly."
        helpText="Instead of adjusting dozens of filters, just pick what's most important to you and enter your ZIP code. We'll do the rest."
      />

      {/* Show results */}
      {submittedQuery && (
        <div className="space-y-4">
          {/* Back button + context */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={resetSearch}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change Preferences
            </Button>
            {result?.location && (
              <p className="text-sm text-muted-foreground">
                {result.location.county}, {result.location.state} &middot;{" "}
                {result.totalMatching} plans found
              </p>
            )}
          </div>

          {/* Profile context */}
          {result && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="font-semibold text-sm">{result.profileName}</p>
              <p className="text-xs text-muted-foreground">{result.profileDescription}</p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-16 w-full" />
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

          {/* Plan results */}
          {!isLoading && result && (
            <>
              {result.plans.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    No plans found matching this profile in your area. Try a different profile or ZIP code.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {result.plans.map((plan) => (
                    <SmartMatchPlanCard key={plan.id} plan={plan} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Show profile selection */}
      {!submittedQuery && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">What matters most to you?</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Pick one or more priorities and we'll find the plans that are the best fit.
              No complicated filters needed.
            </p>
            <button
              onClick={selectAll}
              className="text-xs text-primary hover:underline"
            >
              {selectedProfiles.length === PROFILES.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* Profile Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROFILES.map((profile) => (
              <button
                key={profile.id}
                onClick={() => toggleProfile(profile.id)}
                className={cn(
                  "text-left rounded-xl border-2 p-5 transition-all hover:shadow-md relative",
                  selectedProfiles.includes(profile.id)
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/50"
                )}
              >
                {selectedProfiles.includes(profile.id) && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="text-2xl mb-2">{profile.emoji}</div>
                <p className="font-semibold text-sm">{profile.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.description}
                </p>
              </button>
            ))}
          </div>

          {/* ZIP + Submit */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 space-y-1.5 w-full">
                  <Label className="text-sm font-medium">Your ZIP Code</Label>
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
                      "text-lg",
                      zip.length > 0 && !zipValid && "border-red-400"
                    )}
                  />
                </div>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!zipValid || selectedProfiles.length === 0}
                  className="w-full sm:w-auto"
                >
                  Find My Best Plans {selectedProfiles.length > 0 && `(${selectedProfiles.length} selected)`}
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
              {selectedProfiles.length === 0 && zip.length > 0 && zipValid && (
                <p className="text-xs text-muted-foreground mt-2">
                  Select one or more priorities above, then click "Find My Best Plans"
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
