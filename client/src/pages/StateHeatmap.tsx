import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { BenefitCard } from "@/components/BenefitCard";
import { USMapHeatmap } from "@/components/USMapHeatmap";
import { FilterPanel, type FilterState, defaultFilters } from "@/components/FilterPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { CarrierMarketShareChart } from "@/components/charts/CarrierMarketShareChart";
import { BenefitComparisonBar } from "@/components/charts/BenefitComparisonBar";
import { PremiumDistributionChart } from "@/components/charts/PremiumDistributionChart";
import type { StateData, NationalAverages, BenefitType, CarrierData, PlanData } from "@shared/schema";
import { Heart, DollarSign, MapPin, TrendingUp, Stethoscope, Pill, CreditCard, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

export default function StateHeatmap() {
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitType>("Dental");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const { data: stateData = [], isLoading: statesLoading, isError: statesError } = useQuery<StateData[]>({
    queryKey: ["/api/states"],
  });

  const { data: nationalAverages, isLoading: averagesLoading } = useQuery<NationalAverages>({
    queryKey: ["/api/averages"],
  });

  const { data: carrierData = [] } = useQuery<CarrierData[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: planData = [] } = useQuery<PlanData[]>({
    queryKey: ["/api/plans"],
  });

  const { data: nationalInsights = [] } = useQuery<InsightItem[]>({
    queryKey: ["/api/insights/national"],
  });

  // Auto-generate client-side insights from state data
  const autoInsights = useMemo((): InsightItem[] => {
    if (stateData.length === 0) return [];
    const items: InsightItem[] = [];

    // Highest dental state
    const highDental = [...stateData].sort((a, b) => (b.avgDentalAllowance ?? 0) - (a.avgDentalAllowance ?? 0))[0];
    if (highDental && (highDental.avgDentalAllowance ?? 0) > 0) {
      items.push({
        icon: "target",
        text: `Target ${highDental.abbreviation} (${highDental.name}) — highest dental coverage at $${(highDental.avgDentalAllowance ?? 0).toLocaleString()} avg. Lead with dental messaging.`,
        priority: "high",
      });
    }

    // Low OTC states
    const lowOtc = stateData.filter((s) => (s.otcCoverage ?? 0) < 50 && (s.planCount ?? 0) > 10);
    if (lowOtc.length > 0) {
      const first = lowOtc.sort((a, b) => (a.otcCoverage ?? 0) - (b.otcCoverage ?? 0))[0];
      items.push({
        icon: "opportunity",
        text: `${first.abbreviation} has low OTC coverage (${first.otcCoverage ?? 0}%) — lead with OTC messaging to differentiate.`,
        priority: "medium",
      });
    }

    // Most competitive market
    const mostPlans = [...stateData].sort((a, b) => (b.planCount ?? 0) - (a.planCount ?? 0))[0];
    if (mostPlans) {
      items.push({
        icon: "alert",
        text: `${mostPlans.abbreviation} is the most competitive market with ${(mostPlans.planCount ?? 0).toLocaleString()} plans — focus on differentiation over breadth.`,
        priority: "high",
      });
    }

    return items.slice(0, 4);
  }, [stateData]);

  const combinedInsights = nationalInsights.length > 0 ? nationalInsights : autoInsights;

  const isLoading = statesLoading || averagesLoading;

  const carrierShareData = useMemo(
    () => carrierData.map((c) => ({ name: c.name ?? "Unknown", plans: c.totalPlans ?? 0, marketShare: c.marketShare ?? 0 })),
    [carrierData]
  );

  const top5StatesBenefitData = useMemo(() => {
    return [...stateData]
      .sort((a, b) => (b.planCount ?? 0) - (a.planCount ?? 0))
      .slice(0, 5)
      .map((s) => ({
        name: s.abbreviation || s.name || "Unknown",
        dental: s.avgDentalAllowance ?? 0,
        otc: s.avgOtcAllowance ?? 0,
        vision: 0,
        flexCard: s.avgFlexCard ?? 0,
      }));
  }, [stateData]);

  const premiums = useMemo(
    () => planData.map((p) => p.premium ?? 0),
    [planData]
  );

  const totalPlans = stateData.reduce((acc, s) => acc + (s.planCount ?? 0), 0);
  const avgDental = stateData.length > 0
    ? Math.round(stateData.reduce((acc, s) => acc + (s.avgDentalAllowance ?? 0), 0) / stateData.length)
    : 0;
  const avgOtc = stateData.length > 0
    ? Math.round(stateData.reduce((acc, s) => acc + (s.avgOtcAllowance ?? 0), 0) / stateData.length)
    : 0;

  if (statesError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load state data</p>
          <p className="text-sm mt-1">Please check your connection and try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="National Overview"
        description="Medicare Advantage plan landscape across all 50 states. Click any state to drill into county-level data."
        helpText="The heatmap shows benefit intensity by state. Darker colors = richer benefits. Use the filters to focus on specific benefit types."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Plans Analyzed"
          value={totalPlans}
          trend={12}
          trendLabel="vs last year"
          icon={<Heart className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Dental Allowance"
          prefix="$"
          value={avgDental}
          trend={nationalAverages && nationalAverages.dentalAllowance ? Math.round(((avgDental - nationalAverages.dentalAllowance) / nationalAverages.dentalAllowance) * 100) : 0}
          trendLabel="vs national"
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="States Covered"
          value={stateData.length}
          icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg OTC Monthly"
          prefix="$"
          value={avgOtc}
          trend={nationalAverages && nationalAverages.otcAllowance ? Math.round(((avgOtc - nationalAverages.otcAllowance) / nationalAverages.otcAllowance) * 100) : 0}
          trendLabel="vs national"
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <USMapHeatmap
          data={stateData}
          selectedBenefit={selectedBenefit}
          onBenefitChange={setSelectedBenefit}
          onStateClick={(state) => console.log("Navigate to state:", state.name)}
        />
        <FilterPanel filters={filters} onFiltersChange={setFilters} />
      </div>

      {combinedInsights.length > 0 && (
        <InsightBox
          title="Action Items — National Overview"
          insights={combinedInsights}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <BenefitCard
          icon={<Stethoscope className="h-6 w-6 text-chart-1" />}
          title="Dental"
          value={avgDental}
          prefix="$"
          suffix="/yr"
          coverage={stateData.length > 0 ? Math.round(stateData.reduce((acc, s) => acc + (s.dentalCoverage ?? 0), 0) / stateData.length) : 0}
          details={[
            { label: "Top State", value: "California" },
            { label: "Max Available", value: "$5,000" },
          ]}
          onViewDetails={() => console.log("View dental")}
        />
        <BenefitCard
          icon={<Pill className="h-6 w-6 text-chart-2" />}
          title="OTC Allowance"
          value={avgOtc}
          prefix="$"
          suffix="/mo"
          coverage={stateData.length > 0 ? Math.round(stateData.reduce((acc, s) => acc + (s.otcCoverage ?? 0), 0) / stateData.length) : 0}
          details={[
            { label: "Top State", value: "California" },
            { label: "Max Available", value: "$400/mo" },
          ]}
          onViewDetails={() => console.log("View OTC")}
        />
        <BenefitCard
          icon={<CreditCard className="h-6 w-6 text-chart-3" />}
          title="Flex Card"
          value={stateData.length > 0 ? Math.round(stateData.reduce((acc, s) => acc + (s.avgFlexCard ?? 0), 0) / stateData.length) : 0}
          prefix="$"
          suffix="/mo"
          coverage={stateData.length > 0 ? Math.round(stateData.reduce((acc, s) => acc + (s.flexCardCoverage ?? 0), 0) / stateData.length) : 0}
          details={[
            { label: "Top State", value: "California" },
            { label: "Max Available", value: "$680/mo" },
          ]}
          onViewDetails={() => console.log("View flex card")}
        />
        <BenefitCard
          icon={<ShoppingCart className="h-6 w-6 text-chart-4" />}
          title="Groceries"
          value={stateData.length > 0 ? Math.round(stateData.reduce((acc, s) => acc + (s.avgGroceryAllowance ?? 0), 0) / stateData.length) : 0}
          prefix="$"
          suffix="/mo"
          coverage={stateData.length > 0 ? Math.round(stateData.reduce((acc, s) => acc + (s.groceryCoverage ?? 0), 0) / stateData.length) : 0}
          details={[
            { label: "Top State", value: "California" },
            { label: "Max Available", value: "$300/mo" },
          ]}
          onViewDetails={() => console.log("View groceries")}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {carrierShareData.length > 0 && (
          <CarrierMarketShareChart
            data={carrierShareData}
            title="National Carrier Market Share"
          />
        )}
        {premiums.length > 0 && (
          <PremiumDistributionChart
            premiums={premiums}
            title="National Premium Distribution"
          />
        )}
      </div>

      {top5StatesBenefitData.length > 0 && (
        <BenefitComparisonBar
          data={top5StatesBenefitData}
          title="Top 5 States - Benefit Comparison (Dental, OTC, Flex Card)"
        />
      )}
    </div>
  );
}
