import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
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
import {
  Search,
  SlidersHorizontal,
  Star,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Bus,
  UtensilsCrossed,
  Dumbbell,
  Video,
  Home,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanFinder, type FinderCriteria, type FinderPlanResult } from "@/hooks/usePlanFinder";
import { AIPlanExplainer } from "@/components/ai/AIPlanExplainer";
import { InlineDoctorCheck } from "@/components/providers/InlineDoctorCheck";
import { EnrollmentButton } from "@/components/EnrollmentButton";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

// ── Slider Filter Component ──

interface SliderFilterProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  direction: "max" | "min"; // "max" means user sets upper bound, "min" means lower bound
}

function SliderFilter({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix = "$",
  suffix = "",
  direction,
}: SliderFilterProps) {
  const displayValue = value !== null ? `${prefix}${value.toLocaleString()}${suffix}` : "Any";
  const sliderValue = value !== null ? [value] : direction === "max" ? [max] : [min];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm text-muted-foreground font-mono">
          {value !== null ? (
            <span className="flex items-center gap-1">
              {direction === "max" ? "\u2264" : "\u2265"} {displayValue}
              <button
                onClick={() => onChange(null)}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
                title="Reset to Any"
              >
                x
              </button>
            </span>
          ) : (
            "Any"
          )}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onValueChange={([v]) => onChange(v === (direction === "max" ? max : min) ? null : v)}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{prefix}{min}{suffix}</span>
        <span>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );
}

// ── Supplemental Benefit Checkbox ──

interface BenefitCheckProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
}

function BenefitCheck({ label, checked, onChange, icon }: BenefitCheckProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <div className="flex items-center gap-1.5">
        {icon}
        <Label className="text-sm cursor-pointer">{label}</Label>
      </div>
    </div>
  );
}

// ── Plan Result Card ──

interface PlanCardProps {
  plan: FinderPlanResult;
  isCompareSelected: boolean;
  onToggleCompare: (id: number) => void;
}

function PlanCard({ plan, isCompareSelected, onToggleCompare }: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  const totalCriteria = plan.matchedCriteria.length + plan.unmatchedCriteria.length;
  const matchRatio = totalCriteria > 0 ? plan.matchedCriteria.length / totalCriteria : 0;
  const matchColor =
    matchRatio >= 0.8
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : matchRatio >= 0.5
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";

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
    { key: "transportation", has: plan.transportation, icon: <Bus className="h-3.5 w-3.5" />, label: "Transportation" },
    { key: "mealBenefit", has: plan.mealBenefit, icon: <UtensilsCrossed className="h-3.5 w-3.5" />, label: "Meals" },
    { key: "fitness", has: plan.fitness, icon: <Dumbbell className="h-3.5 w-3.5" />, label: "Fitness" },
    { key: "telehealth", has: plan.telehealth, icon: <Video className="h-3.5 w-3.5" />, label: "Telehealth" },
    { key: "inHomeSupport", has: plan.inHomeSupport, icon: <Home className="h-3.5 w-3.5" />, label: "In-Home" },
    {
      key: "partBGiveback",
      has: plan.partBGiveback !== null && plan.partBGiveback !== undefined && plan.partBGiveback > 0,
      icon: <DollarSign className="h-3.5 w-3.5" />,
      label: "Part B Giveback",
    },
  ];

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{plan.name}</h3>
              <Badge variant="outline" className="text-xs shrink-0">
                {plan.planType}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan.carrier} &middot; {plan.county}, {plan.state}
            </p>
          </div>
          <Badge className={cn("shrink-0 text-xs", matchColor)}>
            {plan.matchedCriteria.length}/{totalCriteria} matched
          </Badge>
        </div>

        {/* Key Metrics Row */}
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

        {/* Supplemental Benefit Icons */}
        <div className="flex items-center gap-2 flex-wrap">
          {supplementalIcons.map((s) => (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
                s.has
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-muted text-muted-foreground"
              )}
              title={s.label}
            >
              {s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Matched / Unmatched Criteria */}
        {totalCriteria > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plan.matchedCriteria.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-0.5 text-xs text-green-700 dark:text-green-300"
              >
                <CheckCircle className="h-3 w-3" />
                {c}
              </span>
            ))}
            {plan.unmatchedCriteria.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400"
              >
                <XCircle className="h-3 w-3" />
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between pt-1 border-t gap-2 flex-wrap">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={isCompareSelected}
              onCheckedChange={() => onToggleCompare(plan.id)}
            />
            <Label className="text-sm cursor-pointer">Compare</Label>
          </div>
          <div className="flex items-center gap-2">
            <EnrollmentButton carrier={plan.carrier} state={plan.state} size="sm" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs"
            >
              {expanded ? (
                <>
                  Less <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  Details <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="pt-2 border-t text-sm space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              <DetailItem label="Specialist Copay" value={`$${plan.specialistCopay}`} />
              <DetailItem label="Drug Deductible" value={plan.drugDeductible !== null ? `$${plan.drugDeductible}` : "N/A"} />
              <DetailItem label="ER Copay" value={plan.erCopay !== undefined ? `$${plan.erCopay}` : "N/A"} />
              <DetailItem label="Flex Card" value={plan.flexCardAmount ? `$${plan.flexCardAmount}` : "N/A"} />
              <DetailItem label="Grocery Allowance" value={plan.groceryAllowanceAmount ? `$${plan.groceryAllowanceAmount}` : "N/A"} />
              <DetailItem label="Transportation/yr" value={plan.transportationAmountPerYear ? `$${plan.transportationAmountPerYear}` : "N/A"} />
              <DetailItem label="Meal Benefit" value={plan.mealBenefitAmount ? `$${plan.mealBenefitAmount}` : "N/A"} />
              <DetailItem label="Hearing Aid" value={plan.hearingAidAllowance ? `$${plan.hearingAidAllowance}` : "N/A"} />
              <DetailItem label="Vision Exam Copay" value={plan.visionExamCopay !== null && plan.visionExamCopay !== undefined ? `$${plan.visionExamCopay}` : "N/A"} />
              <DetailItem label="Telehealth Copay" value={plan.telehealthCopay !== null && plan.telehealthCopay !== undefined ? `$${plan.telehealthCopay}` : "N/A"} />
              <DetailItem label="Part B Giveback" value={plan.partBGiveback ? `$${plan.partBGiveback}/mo` : "None"} />
              <DetailItem label="PCP Referral Required" value={plan.requiresPcpReferral ? "Yes" : "No"} />
              <DetailItem label="Dental Preventive" value={plan.dentalPreventiveCovered ? "Covered" : "N/A"} />
              <DetailItem label="Dental Comprehensive" value={plan.dentalComprehensiveCovered ? "Covered" : "N/A"} />
              {plan.tier1CopayPreferred !== null && plan.tier1CopayPreferred !== undefined && (
                <DetailItem label="Tier 1 Copay (Pref)" value={`$${plan.tier1CopayPreferred}`} />
              )}
              {plan.tier2CopayPreferred !== null && plan.tier2CopayPreferred !== undefined && (
                <DetailItem label="Tier 2 Copay (Pref)" value={`$${plan.tier2CopayPreferred}`} />
              )}
              {plan.tier3CopayPreferred !== null && plan.tier3CopayPreferred !== undefined && (
                <DetailItem label="Tier 3 Copay (Pref)" value={`$${plan.tier3CopayPreferred}`} />
              )}
            </div>

            {/* Inline Doctor Network Check */}
            <div className="border-t pt-3">
              <InlineDoctorCheck planId={plan.id} />
            </div>

            {/* AI Plan Explainer */}
            <AIPlanExplainer planId={plan.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="block font-medium">{value}</span>
    </div>
  );
}

// ── Main PlanFinder Page ──

export default function PlanFinder() {
  const [, navigate] = useLocation();
  const {
    criteria,
    setCriteria,
    results,
    isLoading,
    activeFilterCount,
    page,
    setPage,
    sortBy,
    setSortBy,
    submitSearch,
    resetCriteria,
  } = usePlanFinder();

  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(true);

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < 6) next.add(id);
      }
      return next;
    });
  };

  const updateCriteria = <K extends keyof FinderCriteria>(key: K, value: FinderCriteria[K]) => {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch();
  };

  const zipValid = /^\d{5}$/.test(criteria.zip);
  const plans = results?.plans ?? [];
  const total = results?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));
  const locationLabel = results?.location
    ? `${results.location.county}, ${results.location.state}`
    : "";

  const finderInsights = useMemo((): InsightItem[] => {
    if (!results || plans.length === 0) return [];
    const items: InsightItem[] = [];

    // Strong match count
    const strongMatches = plans.filter((p) => {
      const totalCrit = p.matchedCriteria.length + p.unmatchedCriteria.length;
      return totalCrit > 0 && p.matchedCriteria.length / totalCrit >= 0.8;
    });
    if (results.totalCriteria > 0) {
      items.push({
        icon: "target",
        text: `${strongMatches.length} of ${total} plans in this area are a strong match (80%+ criteria met)`,
        priority: strongMatches.length > 0 ? "low" : "high",
      });
    }

    // Best savings vs average
    const avgPremium = plans.reduce((s, p) => s + p.premium, 0) / plans.length;
    const bestPlan = plans.reduce((best, p) => (p.premium < best.premium ? p : best), plans[0]);
    const annualSavings = Math.round((avgPremium - bestPlan.premium) * 12);
    if (annualSavings > 0) {
      items.push({
        icon: "opportunity",
        text: `Best option saves $${annualSavings}/year vs the average plan in this ZIP ($${bestPlan.premium}/mo vs $${Math.round(avgPremium)}/mo avg)`,
        priority: annualSavings > 500 ? "high" : "medium",
      });
    }

    // Low star rating warning
    const lowStarPlans = plans.filter((p) => p.starRating !== null && p.starRating < 3);
    if (lowStarPlans.length > 0) {
      items.push({
        icon: "warning",
        text: `${lowStarPlans.length} plan${lowStarPlans.length > 1 ? "s" : ""} in results have below-average star ratings (< 3 stars) — review quality before recommending`,
        priority: "medium",
      });
    }

    // Supplemental benefit coverage gaps
    const checkedBenefits: { key: keyof typeof criteria; label: string }[] = [
      { key: "transportation", label: "Transportation" },
      { key: "mealBenefit", label: "Meal Benefit" },
      { key: "fitness", label: "Fitness" },
      { key: "telehealth", label: "Telehealth" },
      { key: "inHomeSupport", label: "In-Home Support" },
    ];
    const missingBenefits = checkedBenefits.filter(
      (b) => criteria[b.key] && plans.every((p) => !(p as unknown as Record<string, unknown>)[b.key])
    );
    if (missingBenefits.length > 0) {
      items.push({
        icon: "alert",
        text: `No plans in this ZIP offer ${missingBenefits.map((b) => b.label).join(", ")} — consider adjusting criteria`,
        priority: "high",
      });
    }

    return items.slice(0, 5);
  }, [results, plans, criteria, total]);

  const goToCompare = () => {
    const ids = Array.from(compareIds).join(",");
    navigate(`/compare?ids=${ids}`);
  };

  // ── Search Form Content ──
  const searchFormContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ZIP Code */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">ZIP Code *</Label>
        <Input
          type="text"
          placeholder="e.g. 33140"
          maxLength={5}
          value={criteria.zip}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
            updateCriteria("zip", v);
          }}
          className={cn(
            criteria.zip.length > 0 && !zipValid && "border-red-400 focus-visible:ring-red-400"
          )}
        />
        {criteria.zip.length > 0 && !zipValid && (
          <p className="text-xs text-red-500">Enter a valid 5-digit ZIP code</p>
        )}
      </div>

      {/* Sliders */}
      <SliderFilter
        label="Max Monthly Premium"
        value={criteria.maxPremium}
        onChange={(v) => updateCriteria("maxPremium", v)}
        min={0}
        max={300}
        step={5}
        direction="max"
      />
      <SliderFilter
        label="Max Out-of-Pocket"
        value={criteria.maxMoop}
        onChange={(v) => updateCriteria("maxMoop", v)}
        min={0}
        max={8850}
        step={50}
        direction="max"
      />
      <SliderFilter
        label="Max PCP Copay"
        value={criteria.maxPcpCopay}
        onChange={(v) => updateCriteria("maxPcpCopay", v)}
        min={0}
        max={50}
        step={5}
        direction="max"
      />
      <SliderFilter
        label="Max Specialist Copay"
        value={criteria.maxSpecialistCopay}
        onChange={(v) => updateCriteria("maxSpecialistCopay", v)}
        min={0}
        max={100}
        step={5}
        direction="max"
      />
      <SliderFilter
        label="Min Dental Coverage"
        value={criteria.minDental}
        onChange={(v) => updateCriteria("minDental", v)}
        min={0}
        max={5000}
        step={100}
        direction="min"
      />
      <SliderFilter
        label="Min Vision Allowance"
        value={criteria.minVision}
        onChange={(v) => updateCriteria("minVision", v)}
        min={0}
        max={500}
        step={25}
        direction="min"
      />
      <SliderFilter
        label="Min OTC Per Quarter"
        value={criteria.minOtcPerQuarter}
        onChange={(v) => updateCriteria("minOtcPerQuarter", v)}
        min={0}
        max={200}
        step={10}
        direction="min"
      />
      <SliderFilter
        label="Max Drug Deductible"
        value={criteria.maxDrugDeductible}
        onChange={(v) => updateCriteria("maxDrugDeductible", v)}
        min={0}
        max={600}
        step={10}
        direction="max"
      />

      {/* Min Star Rating */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Min Star Rating</Label>
        <Select
          value={criteria.minStarRating !== null ? String(criteria.minStarRating) : "any"}
          onValueChange={(v) => updateCriteria("minStarRating", v === "any" ? null : Number(v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            {[1, 2, 3, 4, 5].map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} {s === 1 ? "Star" : "Stars"} +
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plan Type */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Plan Type</Label>
        <Select
          value={criteria.planType ?? "any"}
          onValueChange={(v) => updateCriteria("planType", v === "any" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="HMO">HMO</SelectItem>
            <SelectItem value="PPO">PPO</SelectItem>
            <SelectItem value="HMO-POS">HMO-POS</SelectItem>
            <SelectItem value="PFFS">PFFS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supplemental Benefits */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Supplemental Benefits</Label>
        <div className="space-y-2">
          <BenefitCheck
            label="Transportation"
            checked={criteria.transportation}
            onChange={(v) => updateCriteria("transportation", v)}
            icon={<Bus className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          <BenefitCheck
            label="Meal Benefit"
            checked={criteria.mealBenefit}
            onChange={(v) => updateCriteria("mealBenefit", v)}
            icon={<UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          <BenefitCheck
            label="Fitness"
            checked={criteria.fitness}
            onChange={(v) => updateCriteria("fitness", v)}
            icon={<Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          <BenefitCheck
            label="Telehealth"
            checked={criteria.telehealth}
            onChange={(v) => updateCriteria("telehealth", v)}
            icon={<Video className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          <BenefitCheck
            label="In-Home Support"
            checked={criteria.inHomeSupport}
            onChange={(v) => updateCriteria("inHomeSupport", v)}
            icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          <BenefitCheck
            label="Part B Giveback"
            checked={criteria.partBGiveback}
            onChange={(v) => updateCriteria("partBGiveback", v)}
            icon={<DollarSign className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Actions */}
      <Button
        type="submit"
        className="w-full"
        disabled={!zipValid}
      >
        <Search className="h-4 w-4 mr-2" />
        Find Plans
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-2 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
      <button
        type="button"
        onClick={resetCriteria}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
      >
        <RotateCcw className="h-3 w-3" />
        Reset All Filters
      </button>
    </form>
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Plan Finder"
        description="Search for plans by specific benefit criteria. The #1 tool for matching clients to plans."
        helpText="Enter a ZIP code and set your criteria. Plans are ranked by how many criteria they match. Green checkmarks = criteria met."
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Search Criteria */}
        <div className="w-full lg:w-1/3 shrink-0">
          {/* Desktop: always visible */}
          <div className="hidden lg:block">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Search Criteria
                  </CardTitle>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary">{activeFilterCount} active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>{searchFormContent}</CardContent>
            </Card>
          </div>

          {/* Mobile: collapsible */}
          <div className="lg:hidden">
            <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        Search Criteria
                        {activeFilterCount > 0 && (
                          <Badge variant="secondary">{activeFilterCount}</Badge>
                        )}
                      </CardTitle>
                      {mobileFiltersOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>{searchFormContent}</CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
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

          {/* Results */}
          {!isLoading && results && (
            <>
              {/* Stats Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-muted/50 rounded-lg p-3">
                <p className="text-sm">
                  <span className="font-semibold">{total}</span> plan{total !== 1 ? "s" : ""} found
                  {results.totalCriteria > 0 && (
                    <>
                      {" "}matching{" "}
                      <span className="font-semibold">{results.totalCriteria}</span>{" "}
                      criteria
                    </>
                  )}
                  {locationLabel && (
                    <>
                      {" "}in <span className="font-semibold">{locationLabel}</span>
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="matchScore">Match Score</SelectItem>
                      <SelectItem value="premiumAsc">Premium (Low-High)</SelectItem>
                      <SelectItem value="dentalDesc">Dental (High-Low)</SelectItem>
                      <SelectItem value="starRating">Star Rating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actionable Insights */}
              {finderInsights.length > 0 && (
                <InsightBox title="What To Do Next" insights={finderInsights} />
              )}

              {/* Plan Cards */}
              {plans.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    No plans match your criteria. Try broadening your filters.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCompareSelected={compareIds.has(plan.id)}
                      onToggleCompare={toggleCompare}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}

          {/* No search yet */}
          {!isLoading && !results && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-1">Find the Perfect Plan</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Enter a ZIP code and set your benefit criteria to find Medicare Advantage
                  plans that match your client's specific needs. Filter by dental coverage,
                  vision allowance, OTC amounts, and more.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky Compare Button */}
      {compareIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Button
            onClick={goToCompare}
            size="lg"
            className="shadow-lg"
          >
            Compare Selected ({compareIds.size})
          </Button>
        </div>
      )}
    </div>
  );
}
