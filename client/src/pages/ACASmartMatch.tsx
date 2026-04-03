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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ExternalLink,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──

type ACAMatchProfile =
  | "cheapest_after_subsidy"
  | "lowest_deductible"
  | "best_value_silver"
  | "hsa_eligible"
  | "family_friendly"
  | "comprehensive";

interface ACASmartMatchPlan {
  id: number;
  planId: string;
  planName: string;
  issuer: string;
  metalLevel: string;
  planType: string | null;
  state: string;
  county: string | null;
  premiumFull: number;
  premiumAfterSubsidy: number;
  monthlySubsidy: number;
  deductibleIndividual: number | null;
  deductibleFamily: number | null;
  moopIndividual: number | null;
  moopFamily: number | null;
  hsaEligible: boolean;
  ehbPct: number | null;
  whyItMatches: string;
  highlights: string[];
  enrollmentUrl: string;
}

interface ACASmartMatchResult {
  profile: ACAMatchProfile;
  profileName: string;
  profileDescription: string;
  plans: ACASmartMatchPlan[];
  totalMatching: number;
  location: { state: string; county: string | null } | null;
  subsidyApplied: boolean;
  monthlySubsidy: number;
  fplPercent: number | null;
}

const PROFILES: {
  id: ACAMatchProfile;
  emoji: string;
  title: string;
  description: string;
}[] = [
  {
    id: "cheapest_after_subsidy",
    emoji: "\uD83D\uDCB0",
    title: "Cheapest After Subsidy",
    description: "Lowest premium after your tax credit",
  },
  {
    id: "lowest_deductible",
    emoji: "\uD83C\uDFE5",
    title: "Lowest Deductible",
    description: "Gold/Platinum plans with smallest deductible",
  },
  {
    id: "best_value_silver",
    emoji: "\u2B50",
    title: "Best Silver Plan",
    description: "Best Silver plans (CSR makes these amazing)",
  },
  {
    id: "hsa_eligible",
    emoji: "\uD83C\uDFE6",
    title: "HSA-Eligible",
    description: "Bronze plans for tax-free healthcare savings",
  },
  {
    id: "family_friendly",
    emoji: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66",
    title: "Best for Families",
    description: "Best family deductible and out-of-pocket",
  },
  {
    id: "comprehensive",
    emoji: "\uD83D\uDC8E",
    title: "Most Comprehensive",
    description: "Platinum/Gold with lowest out-of-pocket",
  },
];

const METAL_COLORS: Record<string, string> = {
  Bronze: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Expanded Bronze": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Silver: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  Gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Platinum: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  Catastrophic: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

// ── Plan Card ──

function ACASmartMatchPlanCard({ plan, subsidyApplied }: { plan: ACASmartMatchPlan; subsidyApplied: boolean }) {
  const metalColor = METAL_COLORS[plan.metalLevel] || "bg-muted text-muted-foreground";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{plan.planName}</h3>
              <Badge className={cn("text-xs shrink-0", metalColor)}>
                {plan.metalLevel}
              </Badge>
              {plan.planType && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {plan.planType}
                </Badge>
              )}
              {plan.hsaEligible && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  HSA
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan.issuer} &middot; {plan.state}{plan.county ? `, ${plan.county}` : ""}
            </p>
          </div>
          {/* Premium display */}
          <div className="text-right shrink-0">
            {subsidyApplied && plan.monthlySubsidy > 0 ? (
              <>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">
                  ${plan.premiumAfterSubsidy}/mo
                </p>
                <p className="text-xs text-muted-foreground line-through">
                  ${plan.premiumFull}/mo
                </p>
              </>
            ) : (
              <p className="text-lg font-bold">${plan.premiumFull}/mo</p>
            )}
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
            <span className="text-xs text-muted-foreground block">Deductible</span>
            <span className="font-semibold">
              {plan.deductibleIndividual !== null
                ? `$${plan.deductibleIndividual.toLocaleString()}`
                : "N/A"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">MOOP</span>
            <span className="font-semibold">
              {plan.moopIndividual !== null
                ? `$${plan.moopIndividual.toLocaleString()}`
                : "N/A"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Family Ded.</span>
            <span className="font-semibold">
              {plan.deductibleFamily !== null
                ? `$${plan.deductibleFamily.toLocaleString()}`
                : "N/A"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Family MOOP</span>
            <span className="font-semibold">
              {plan.moopFamily !== null
                ? `$${plan.moopFamily.toLocaleString()}`
                : "N/A"}
            </span>
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

        {/* Subsidy savings callout */}
        {subsidyApplied && plan.monthlySubsidy > 0 && (
          <div className="flex items-center gap-2 text-xs rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-2">
            <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300 font-medium">
              You save ${plan.monthlySubsidy}/mo with your Premium Tax Credit
            </span>
          </div>
        )}

        {/* Enrollment Button */}
        <div className="pt-2 border-t">
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => window.open(plan.enrollmentUrl, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Enroll on {plan.state === "CA" ? "Covered California" :
                       plan.state === "NY" ? "NY State of Health" :
                       plan.state === "CO" ? "Connect for Health CO" :
                       "HealthCare.gov"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function ACASmartMatch() {
  const [, navigate] = useLocation();
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [income, setIncome] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [age, setAge] = useState("");
  const [selectedProfiles, setSelectedProfiles] = useState<ACAMatchProfile[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState<{
    state: string;
    county: string;
    profiles: ACAMatchProfile[];
    income: string;
    householdSize: string;
    age: string;
  } | null>(null);

  const stateValid = /^[A-Za-z]{2}$/.test(state);

  // Use the first selected profile for the query (or cheapest_after_subsidy for multi)
  const queryProfile = submittedQuery?.profiles.length === 1
    ? submittedQuery.profiles[0]
    : "cheapest_after_subsidy";

  const { data: result, isLoading } = useQuery<ACASmartMatchResult>({
    queryKey: [
      "/api/aca/smart-match",
      submittedQuery?.state,
      submittedQuery?.county,
      submittedQuery?.profiles.join(","),
      submittedQuery?.income,
      submittedQuery?.householdSize,
      submittedQuery?.age,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        state: submittedQuery!.state,
        profile: queryProfile,
      });
      if (submittedQuery!.county) params.set("county", submittedQuery!.county);
      if (submittedQuery!.income) params.set("income", submittedQuery!.income);
      if (submittedQuery!.householdSize) params.set("householdSize", submittedQuery!.householdSize);
      if (submittedQuery!.age) params.set("age", submittedQuery!.age);

      const res = await fetch(`/api/aca/smart-match?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to run ACA smart match");
      return res.json();
    },
    enabled: !!submittedQuery,
  });

  const toggleProfile = (profile: ACAMatchProfile) => {
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
    if (stateValid && selectedProfiles.length > 0) {
      setSubmittedQuery({
        state,
        county,
        profiles: selectedProfiles,
        income,
        householdSize,
        age,
      });
    }
  };

  const resetSearch = () => {
    setSubmittedQuery(null);
    setSelectedProfiles([]);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="ACA Smart Match"
        description="Tell us what matters most and we'll find the best ACA marketplace plans for you."
        helpText="Pick your priorities, enter your state and income for subsidy calculation, and we'll instantly match you with the best plans. No complicated filters needed. Plans are scored based on how well they match your preferences."
        dataSource="Data: CMS QHP PY2026 landscape files. Matching algorithm weighs your selected priorities (cost, coverage breadth, network size) against plan attributes. Subsidy estimates use current FPL guidelines."
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
                {result.location.state}
                {result.location.county ? `, ${result.location.county}` : ""} &middot;{" "}
                {result.totalMatching} plans found
              </p>
            )}
          </div>

          {/* Profile + subsidy context */}
          {result && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{result.profileName}</p>
                  <p className="text-xs text-muted-foreground">{result.profileDescription}</p>
                </div>
                {result.subsidyApplied && result.monthlySubsidy > 0 && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    ${result.monthlySubsidy}/mo subsidy applied
                  </Badge>
                )}
              </div>
              {result.fplPercent !== null && (
                <p className="text-xs text-muted-foreground">
                  Your income is at {result.fplPercent}% of the Federal Poverty Level
                </p>
              )}
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
                    No plans found matching this profile in your area. Try a different profile or state.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {result.plans.map((plan) => (
                    <ACASmartMatchPlanCard
                      key={plan.id}
                      plan={plan}
                      subsidyApplied={result.subsidyApplied}
                    />
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
              Pick one or more priorities and we'll find the ACA plans that best fit your needs.
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

          {/* Inputs + Submit */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
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
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">County (optional)</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Los Angeles"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Income (optional)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="45000"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Household</Label>
                  <Select value={householdSize} onValueChange={setHouseholdSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "person" : "people"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="space-y-1.5 w-32">
                  <Label className="text-sm font-medium">Age (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    placeholder="35"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div className="flex-1" />
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!stateValid || selectedProfiles.length === 0}
                  className="w-full sm:w-auto"
                >
                  Find My Best ACA Plans{" "}
                  {selectedProfiles.length > 0 && `(${selectedProfiles.length} selected)`}
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>

              {income && parseInt(income) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Enter your income to see after-subsidy prices. Plans will show both full and subsidized premiums.
                </p>
              )}

              {selectedProfiles.length === 0 && stateValid && (
                <p className="text-xs text-muted-foreground">
                  Select one or more priorities above, then click "Find My Best ACA Plans"
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
