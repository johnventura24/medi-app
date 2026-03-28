import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { BenefitCard } from "@/components/BenefitCard";
import { USMapHeatmap } from "@/components/USMapHeatmap";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumDistributionChart } from "@/components/charts/PremiumDistributionChart";
import { CopayRangeChart } from "@/components/charts/CopayRangeChart";
import { SupplementalBenefitsPie } from "@/components/charts/SupplementalBenefitsPie";
import type { StateData, NationalAverages, BenefitType, PlanData } from "@shared/schema";
import { Stethoscope, Pill, CreditCard, ShoppingCart, Car, Eye, Ear, Heart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function BenefitView() {
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitType>("Dental");
  const [, navigate] = useLocation();

  const { data: stateData = [], isLoading: statesLoading } = useQuery<StateData[]>({
    queryKey: ["/api/states"],
  });

  const { data: nationalAverages, isLoading: averagesLoading } = useQuery<NationalAverages>({
    queryKey: ["/api/averages"],
  });

  const { data: planData = [] } = useQuery<PlanData[]>({
    queryKey: ["/api/plans"],
  });

  const isLoading = statesLoading || averagesLoading;

  const premiums = useMemo(() => planData.map((p) => p.premium ?? 0), [planData]);

  const copayRanges = useMemo(() => {
    if (planData.length === 0) return [];
    const services = [
      { service: "PCP", getVal: (p: PlanData) => p.pcpCopay },
      { service: "Specialist", getVal: (p: PlanData) => p.specialistCopay },
      { service: "ER", getVal: (p: PlanData) => p.erCopay },
      { service: "Urgent Care", getVal: (p: PlanData) => p.hospitalCopay },
      { service: "Inpatient", getVal: (p: PlanData) => p.deductible },
    ];
    return services.map(({ service, getVal }) => {
      const vals = planData.map(getVal).filter((v) => v != null && v >= 0);
      if (vals.length === 0) return { service, min: 0, max: 0, avg: 0 };
      return {
        service,
        min: Math.min(...vals),
        max: Math.max(...vals),
        avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
      };
    });
  }, [planData]);

  const supplementalCoverage = useMemo(() => {
    if (planData.length === 0) {
      return { dental: 0, otc: 0, transportation: 0, meals: 0, fitness: 0, telehealth: 0, inHomeSupport: 0 };
    }
    const total = planData.length;
    return {
      dental: Math.round((planData.filter((p) => p.dentalAllowance > 0).length / total) * 100),
      otc: Math.round((planData.filter((p) => p.otcAllowance > 0).length / total) * 100),
      transportation: Math.round((planData.filter((p) => p.transportation > 0).length / total) * 100),
      meals: Math.round((planData.filter((p) => (p.mealBenefitAmount ?? 0) > 0).length / total) * 100),
      fitness: Math.round((planData.filter((p) => p.hearing > 0).length / total) * 100),
      telehealth: Math.round((planData.filter((p) => (p.telehealthCopay ?? 0) >= 0 && p.telehealthCopay != null).length / total) * 100),
      inHomeSupport: Math.round((planData.filter((p) => p.vision > 0).length / total) * 100),
    };
  }, [planData]);

  const benefitCards = nationalAverages ? [
    {
      icon: <Stethoscope className="h-6 w-6 text-chart-1" />,
      title: "Dental",
      value: nationalAverages.dentalAllowance,
      prefix: "$",
      suffix: "/yr",
      coverage: 89,
      details: [
        { label: "Preventive", value: "100% covered" },
        { label: "Comprehensive", value: "$2,500 max" },
      ],
    },
    {
      icon: <Pill className="h-6 w-6 text-chart-2" />,
      title: "OTC Allowance",
      value: nationalAverages.otcAllowance,
      prefix: "$",
      suffix: "/mo",
      coverage: 84,
      details: [
        { label: "Annual Total", value: "$2,940" },
        { label: "Use For", value: "Health items" },
      ],
    },
    {
      icon: <CreditCard className="h-6 w-6 text-chart-3" />,
      title: "Flex Card",
      value: nationalAverages.flexCard,
      prefix: "$",
      suffix: "/mo",
      coverage: 65,
      details: [
        { label: "Annual Total", value: "$4,380" },
        { label: "Use For", value: "Medical + More" },
      ],
    },
    {
      icon: <ShoppingCart className="h-6 w-6 text-chart-4" />,
      title: "Groceries",
      value: nationalAverages.groceryAllowance,
      prefix: "$",
      suffix: "/mo",
      coverage: 42,
      details: [
        { label: "Annual Total", value: "$1,920" },
        { label: "Restrictions", value: "Healthy foods" },
      ],
    },
    {
      icon: <Car className="h-6 w-6 text-chart-5" />,
      title: "Transportation",
      value: nationalAverages.transportation,
      prefix: "$",
      suffix: "/yr",
      coverage: 58,
      details: [
        { label: "Trips/Month", value: "Unlimited" },
        { label: "Use For", value: "Medical visits" },
      ],
    },
    {
      icon: <Eye className="h-6 w-6 text-chart-1" />,
      title: "Vision",
      value: 225,
      prefix: "$",
      suffix: "/yr",
      coverage: 91,
      details: [
        { label: "Exam", value: "$0 copay" },
        { label: "Frames/Lenses", value: "$150 max" },
      ],
    },
    {
      icon: <Ear className="h-6 w-6 text-chart-2" />,
      title: "Hearing",
      value: 2200,
      prefix: "$",
      suffix: "/yr",
      coverage: 72,
      details: [
        { label: "Exam", value: "$0 copay" },
        { label: "Aids", value: "$2,000 max" },
      ],
    },
    {
      icon: <Heart className="h-6 w-6 text-chart-3" />,
      title: "Insulin",
      value: 35,
      prefix: "$",
      suffix: "/mo max",
      coverage: 95,
      details: [
        { label: "30-day supply", value: "$35 max" },
        { label: "90-day supply", value: "$35 max" },
      ],
    },
  ] : [];

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
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Benefit Analysis"
        description="National breakdown of supplemental benefits — dental, OTC, vision, transportation, and more."
        helpText="Click any benefit card to see state-by-state details and top ZIP codes for that benefit."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Avg Dental Allowance"
          prefix="$"
          value={nationalAverages?.dentalAllowance ?? 0}
          trend={5}
          trendLabel="YoY"
        />
        <StatCard
          label="Avg OTC Monthly"
          prefix="$"
          value={nationalAverages?.otcAllowance ?? 0}
          trend={12}
          trendLabel="YoY"
        />
        <StatCard
          label="Avg Flex Card"
          prefix="$"
          value={nationalAverages?.flexCard ?? 0}
          suffix="/mo"
          trend={18}
          trendLabel="YoY"
        />
        <StatCard
          label="Avg Transportation"
          prefix="$"
          value={nationalAverages?.transportation ?? 0}
          suffix="/yr"
          trend={8}
          trendLabel="YoY"
        />
      </div>

      <Tabs defaultValue="heatmap" className="space-y-6">
        <TabsList>
          <TabsTrigger value="heatmap" data-testid="tab-heatmap">Geographic Heatmap</TabsTrigger>
          <TabsTrigger value="cards" data-testid="tab-cards">Benefit Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap">
          <USMapHeatmap
            data={stateData}
            selectedBenefit={selectedBenefit}
            onBenefitChange={setSelectedBenefit}
            onStateClick={(state) => console.log("Navigate to state:", state.name)}
          />
        </TabsContent>

        <TabsContent value="cards">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {benefitCards.map((card) => {
              const benefitSlug = card.title.toLowerCase().replace(/\s+/g, '-').replace('allowance', '').replace('--', '-').replace(/-$/, '');
              return (
                <BenefitCard
                  key={card.title}
                  icon={card.icon}
                  title={card.title}
                  value={card.value}
                  prefix={card.prefix}
                  suffix={card.suffix}
                  coverage={card.coverage}
                  details={card.details}
                  onViewDetails={() => navigate(`/benefits/${benefitSlug}`)}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {premiums.length > 0 && (
          <PremiumDistributionChart
            premiums={premiums}
            title="Premium Distribution Across Plans"
          />
        )}
        {copayRanges.length > 0 && (
          <CopayRangeChart
            data={copayRanges}
            title="National Copay Ranges by Service Type"
          />
        )}
      </div>

      {planData.length > 0 && (
        <SupplementalBenefitsPie
          coverage={supplementalCoverage}
          title="Supplemental Benefits Coverage (% of Plans)"
        />
      )}
    </div>
  );
}
