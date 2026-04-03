import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Search,
  ArrowRight,
  TrendingUp,
  Star,
  Shield,
  Eye,
  Pill,
  Heart,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

// ── Animated Counter Component ──

function AnimatedCounter({ value, prefix = "$", suffix = "", duration = 1.5, className }: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    const startTime = performance.now();
    const durationMs = duration * 1000;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplayValue(current);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// ── Savings Breakdown Card ──

function SavingsCard({ label, icon: Icon, current, better, gain, maxGain, delay }: {
  label: string;
  icon: any;
  current: string;
  better: string;
  gain: number;
  maxGain: number;
  delay: number;
}) {
  const pct = maxGain > 0 ? Math.min(100, (gain / maxGain) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {gain > 0 ? "+" : ""}<AnimatedCounter value={gain} duration={1} />
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-500 dark:text-red-400 font-mono min-w-[80px]">{current}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">{better}</span>
            </div>
            <Progress value={pct} className="h-2 [&>div]:bg-emerald-500" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Plan Result Card ──

function AlternativeCard({ alt, rank, onSelect }: { alt: any; rank: number; onSelect?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + rank * 0.1 }}
    >
      <Card className={cn(
        "hover:shadow-lg transition-all cursor-pointer border-2",
        rank === 0 ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-transparent hover:border-emerald-200"
      )}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {rank === 0 && (
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Best Match
                </Badge>
              )}
              {rank > 0 && (
                <Badge variant="outline">#{rank + 1}</Badge>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ${alt.totalValue.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">total annual value</p>
            </div>
          </div>

          <h3 className="font-semibold text-base mb-1 line-clamp-1">{alt.plan.name}</h3>
          <p className="text-sm text-muted-foreground mb-3">{alt.plan.carrier}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Premium</p>
              <p className="font-semibold">${alt.benefits.premium}/mo</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Dental</p>
              <p className="font-semibold">${alt.benefits.dental.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">OTC/Year</p>
              <p className="font-semibold">${(alt.benefits.otcQuarterly * 4).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Vision</p>
              <p className="font-semibold">${alt.benefits.vision}</p>
            </div>
          </div>

          {alt.benefits.starRating > 0 && (
            <div className="flex items-center gap-1 mt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={cn(
                  "h-4 w-4",
                  i < alt.benefits.starRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/70"
                )} />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{alt.benefits.starRating} stars</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {alt.breakdown.premiumSavings > 0 && (
              <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30">
                -${alt.breakdown.premiumSavings}/yr premium
              </Badge>
            )}
            {alt.breakdown.dentalGain > 0 && (
              <Badge variant="secondary" className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30">
                +${alt.breakdown.dentalGain} dental
              </Badge>
            )}
            {alt.breakdown.otcGain > 0 && (
              <Badge variant="secondary" className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30">
                +${alt.breakdown.otcGain}/yr OTC
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Search Result Item ──

function SearchResultItem({ plan, onSelect }: { plan: any; onSelect: (id: number) => void }) {
  return (
    <button
      className="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors flex items-center justify-between"
      onClick={() => onSelect(plan.id)}
    >
      <div>
        <p className="font-medium text-sm line-clamp-1">{plan.name}</p>
        <p className="text-xs text-muted-foreground">{plan.carrier} &middot; {plan.state} &middot; {plan.county}</p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-sm font-semibold">${plan.premium}/mo</p>
        <Badge variant="outline" className="text-xs">{plan.planType}</Badge>
      </div>
    </button>
  );
}

// ── Main Page ──

export default function MoneyCalculator() {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [manualInput, setManualInput] = useState({
    zipCode: "",
    currentPremium: "",
    currentDental: "",
    currentOtc: "",
    currentVision: "",
  });
  const [hasCalculated, setHasCalculated] = useState(false);

  // Search plans
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/calculator/search-plans", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const res = await fetch(`/api/calculator/search-plans?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/calculator/money-on-table", body);
      return res.json();
    },
    onSuccess: () => setHasCalculated(true),
  });

  const handleSearchSelect = (planId: number) => {
    setSelectedPlanId(planId);
    setSearchQuery("");
    calculateMutation.mutate({ currentPlanId: planId });
  };

  const handleManualCalculate = () => {
    if (!manualInput.zipCode) return;
    calculateMutation.mutate({
      zipCode: manualInput.zipCode,
      currentPremium: parseFloat(manualInput.currentPremium) || 0,
      currentDental: parseFloat(manualInput.currentDental) || 0,
      currentOtc: parseFloat(manualInput.currentOtc) || 0,
      currentVision: parseFloat(manualInput.currentVision) || 0,
    });
  };

  const result = calculateMutation.data;
  const savings = result?.savings;
  const maxSavingsComponent = savings
    ? Math.max(savings.premiumSavings, savings.dentalGain, savings.otcGain, savings.visionGain, savings.drugSavings, savings.givebackGain, 1)
    : 1;

  const calcInsights = useMemo((): InsightItem[] => {
    if (!result || !savings) return [];
    const items: InsightItem[] = [];
    const county = result.currentPlan?.county || "your county";
    const state = result.currentPlan?.state || "";

    if (savings.totalValue > 0) {
      items.push({
        icon: "alert",
        text: `On average, beneficiaries in ${county}${state ? `, ${state}` : ""} leave $${savings.totalValue.toLocaleString()} on the table annually.`,
        priority: "high",
      });

      // Biggest savings component
      const components = [
        { name: "premium savings", val: savings.premiumSavings },
        { name: "dental coverage", val: savings.dentalGain },
        { name: "OTC benefits", val: savings.otcGain },
        { name: "vision coverage", val: savings.visionGain },
        { name: "drug cost savings", val: savings.drugSavings },
        { name: "Part B giveback", val: savings.givebackGain },
      ].filter((c) => c.val > 0).sort((a, b) => b.val - a.val);

      if (components.length > 0) {
        items.push({
          icon: "target",
          text: `The biggest savings come from ${components[0].name} ($${components[0].val.toLocaleString()}/yr) — lead with that in your pitch.`,
          priority: "high",
        });
      }

      if (components.length > 1) {
        items.push({
          icon: "opportunity",
          text: `Secondary value: ${components[1].name} adds $${components[1].val.toLocaleString()}/yr — mention this to close the deal.`,
          priority: "medium",
        });
      }
    } else {
      items.push({
        icon: "trend",
        text: `This beneficiary has a strong plan — focus on service quality and care coordination rather than benefit comparison.`,
        priority: "low",
      });
    }

    if (result.topAlternatives && result.topAlternatives.length > 0) {
      items.push({
        icon: "trend",
        text: `${result.topAlternatives.length} better alternatives found out of ${result.countyStats?.totalPlans || 0} plans — you have options to present.`,
        priority: "medium",
      });
    }

    return items.slice(0, 4);
  }, [result, savings]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Money Left on the Table"
        description="Calculate how much a beneficiary could save by switching plans. The most powerful sales tool in Medicare."
        helpText="Enter a current plan or estimated costs. The calculator compares against every available alternative in the beneficiary's area and shows total potential yearly savings across premiums, medical costs, and drug costs. Use the animated breakdown to walk clients through the math."
        dataSource="Data: CMS CY2026 PBP files for plan premiums and cost-sharing. Savings calculated by comparing current plan costs against the best available alternatives in the same county."
      />
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 rounded-full text-sm font-medium">
          <DollarSign className="h-4 w-4" />
          Money Calculator
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          How Much Are You{" "}
          <span className="text-emerald-600 dark:text-emerald-400">Leaving on the Table?</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Compare your current Medicare Advantage plan against every alternative in your area.
          Find hidden savings in premiums, dental, OTC, vision, and drug costs.
        </p>
      </motion.div>

      {/* Input Section */}
      {!hasCalculated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Step 1: Tell us about your current plan</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="search">Search by Plan Name</TabsTrigger>
                  <TabsTrigger value="manual">Enter Details Manually</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type a plan name (e.g., Humana, Aetna, AARP)..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {isSearching && (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
                    </div>
                  )}
                  {searchResults && searchResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-72 overflow-auto">
                      {searchResults.map((plan: any) => (
                        <SearchResultItem key={plan.id} plan={plan} onSelect={handleSearchSelect} />
                      ))}
                    </div>
                  )}
                  {searchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No plans found. Try a different search or enter details manually.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>ZIP Code *</Label>
                      <Input
                        placeholder="e.g., 33139"
                        value={manualInput.zipCode}
                        onChange={(e) => setManualInput({ ...manualInput, zipCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Monthly Premium ($)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={manualInput.currentPremium}
                        onChange={(e) => setManualInput({ ...manualInput, currentPremium: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Dental Coverage ($)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={manualInput.currentDental}
                        onChange={(e) => setManualInput({ ...manualInput, currentDental: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>OTC Annual ($)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={manualInput.currentOtc}
                        onChange={(e) => setManualInput({ ...manualInput, currentOtc: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Vision Allowance ($)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={manualInput.currentVision}
                        onChange={(e) => setManualInput({ ...manualInput, currentVision: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                    onClick={handleManualCalculate}
                    disabled={!manualInput.zipCode || calculateMutation.isPending}
                  >
                    {calculateMutation.isPending ? "Calculating..." : "Calculate My Savings"}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading State */}
      {calculateMutation.isPending && (
        <div className="text-center space-y-4 py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="inline-block"
          >
            <DollarSign className="h-12 w-12 text-emerald-500" />
          </motion.div>
          <p className="text-lg text-muted-foreground">Analyzing {result?.countyStats?.totalPlans || "all"} plans in your area...</p>
        </div>
      )}

      {/* Error State */}
      {calculateMutation.isError && (
        <Card className="max-w-2xl mx-auto border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 dark:text-red-300">
              Failed to calculate savings. Please try a different plan or ZIP code.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => {
              setHasCalculated(false);
              calculateMutation.reset();
            }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && hasCalculated && (
        <>
          {/* Giant Savings Number */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="text-center space-y-2"
          >
            {savings && savings.totalValue > 0 ? (
              <>
                <p className="text-lg text-muted-foreground">Better value available:</p>
                <div className="text-6xl md:text-8xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  <AnimatedCounter value={savings.totalValue} prefix="$" suffix="" duration={2} />
                  <span className="text-3xl md:text-4xl text-muted-foreground font-normal">/year</span>
                </div>
                <p className="text-muted-foreground">in additional benefits and savings vs. your current plan</p>
              </>
            ) : (
              <>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  You have a great plan!
                </div>
                <p className="text-muted-foreground">We did not find significantly better alternatives in your area.</p>
              </>
            )}
          </motion.div>

          {/* Current Plan Info */}
          {result.currentPlan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <Card className="inline-block border-dashed">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Plan</p>
                    <p className="font-semibold">{result.currentPlan.name}</p>
                    <p className="text-sm text-muted-foreground">{result.currentPlan.carrier} &middot; {result.currentPlan.county}, {result.currentPlan.state}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setHasCalculated(false);
                    calculateMutation.reset();
                    setSelectedPlanId(null);
                  }}>
                    Change
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Savings Breakdown */}
          {savings && savings.totalValue > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-center">Savings Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savings.premiumSavings > 0 && (
                  <SavingsCard
                    label="Premium Savings"
                    icon={DollarSign}
                    current={`$${result.currentPlan.benefits.premium}/mo`}
                    better={`$${result.bestAlternative?.benefits.premium || 0}/mo`}
                    gain={savings.premiumSavings}
                    maxGain={maxSavingsComponent}
                    delay={0.4}
                  />
                )}
                {savings.dentalGain > 0 && (
                  <SavingsCard
                    label="Dental Coverage Gain"
                    icon={Heart}
                    current={`$${result.currentPlan.benefits.dental.toLocaleString()}`}
                    better={`$${result.bestAlternative?.benefits.dental.toLocaleString() || 0}`}
                    gain={savings.dentalGain}
                    maxGain={maxSavingsComponent}
                    delay={0.5}
                  />
                )}
                {savings.otcGain > 0 && (
                  <SavingsCard
                    label="OTC Benefits"
                    icon={Pill}
                    current={`$${(result.currentPlan.benefits.otcQuarterly * 4).toLocaleString()}/yr`}
                    better={`$${((result.bestAlternative?.benefits.otcQuarterly || 0) * 4).toLocaleString()}/yr`}
                    gain={savings.otcGain}
                    maxGain={maxSavingsComponent}
                    delay={0.6}
                  />
                )}
                {savings.visionGain > 0 && (
                  <SavingsCard
                    label="Vision Coverage"
                    icon={Eye}
                    current={`$${result.currentPlan.benefits.vision}`}
                    better={`$${result.bestAlternative?.benefits.vision || 0}`}
                    gain={savings.visionGain}
                    maxGain={maxSavingsComponent}
                    delay={0.7}
                  />
                )}
                {savings.drugSavings > 0 && (
                  <SavingsCard
                    label="Drug Cost Savings"
                    icon={Pill}
                    current={`$${result.currentPlan.benefits.tier1Copay} tier 1`}
                    better={`$${result.bestAlternative?.benefits.tier1Copay || 0} tier 1`}
                    gain={savings.drugSavings}
                    maxGain={maxSavingsComponent}
                    delay={0.8}
                  />
                )}
                {savings.givebackGain > 0 && (
                  <SavingsCard
                    label="Part B Giveback"
                    icon={TrendingUp}
                    current={`$${(result.currentPlan.benefits.partbGiveback * 12).toFixed(0)}/yr`}
                    better={`$${((result.bestAlternative?.benefits.partbGiveback || 0) * 12).toFixed(0)}/yr`}
                    gain={savings.givebackGain}
                    maxGain={maxSavingsComponent}
                    delay={0.9}
                  />
                )}
              </div>
            </div>
          )}

          {calcInsights.length > 0 && (
            <InsightBox
              title="What This Means for Your Client"
              insights={calcInsights}
            />
          )}

          {/* Top Alternatives */}
          {result.topAlternatives && result.topAlternatives.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">
                Top {result.topAlternatives.length} Alternatives
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  out of {result.countyStats?.totalPlans || 0} plans in {result.currentPlan?.county}, {result.currentPlan?.state}
                </span>
              </h2>
              <div className="space-y-3">
                {result.topAlternatives.map((alt: any, idx: number) => (
                  <AlternativeCard key={alt.plan.id} alt={alt} rank={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Re-calculate button */}
          <div className="text-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setHasCalculated(false);
                calculateMutation.reset();
                setSelectedPlanId(null);
              }}
            >
              Compare a Different Plan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
