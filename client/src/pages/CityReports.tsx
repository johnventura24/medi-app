import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column, Badge } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BenefitComparisonBar } from "@/components/charts/BenefitComparisonBar";
import { StarRatingDistribution } from "@/components/charts/StarRatingDistribution";
import type { CityData, PlanData } from "@shared/schema";
import { Building2, DollarSign, Users, TrendingUp } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

export default function CityReports() {
  const { data: cityData = [], isLoading, isError } = useQuery<CityData[]>({
    queryKey: ["/api/cities"],
  });

  const { data: planData = [] } = useQuery<PlanData[]>({
    queryKey: ["/api/plans"],
  });

  const totalCities = cityData.length;
  const totalPlans = cityData.reduce((acc, c) => acc + (c.planCount ?? 0), 0);
  const avgDental = cityData.length > 0
    ? Math.round(cityData.reduce((acc, c) => acc + (c.maxDental ?? 0), 0) / cityData.length)
    : 0;
  const topCity = cityData.length > 0
    ? cityData.reduce((max, c) => (c.planCount ?? 0) > (max.planCount ?? 0) ? c : max, cityData[0])?.city ?? "—"
    : "—";

  const top10CitiesBenefitData = useMemo(() => {
    return [...cityData]
      .sort((a, b) => ((b.maxDental ?? 0) + (b.maxOtc ?? 0)) - ((a.maxDental ?? 0) + (a.maxOtc ?? 0)))
      .slice(0, 10)
      .map((c) => ({
        name: c.city ?? "Unknown",
        dental: c.maxDental ?? 0,
        otc: c.maxOtc ?? 0,
        vision: 0,
        flexCard: c.maxFlexCard ?? 0,
      }));
  }, [cityData]);

  const starRatings = useMemo(() => {
    return planData
      .map((p) => p.overallStarRating ?? 0)
      .filter((r) => r > 0);
  }, [planData]);

  const cityInsights = useMemo((): InsightItem[] => {
    if (cityData.length === 0) return [];
    const items: InsightItem[] = [];

    // Most competitive county
    const mostCarriers = [...cityData].sort((a, b) => (b.carrierCount ?? 0) - (a.carrierCount ?? 0))[0];
    if (mostCarriers) {
      items.push({
        icon: "alert",
        text: `Most competitive: ${mostCarriers.city}, ${mostCarriers.stateAbbr} with ${mostCarriers.carrierCount} carriers and ${mostCarriers.planCount} plans.`,
        priority: "high",
      });
    }

    // County with highest dental but few carriers
    const highDentalLowCarriers = [...cityData]
      .filter((c) => (c.maxDental ?? 0) > 0 && (c.carrierCount ?? 0) <= 4)
      .sort((a, b) => (b.maxDental ?? 0) - (a.maxDental ?? 0));
    if (highDentalLowCarriers.length > 0) {
      const c = highDentalLowCarriers[0];
      items.push({
        icon: "opportunity",
        text: `Opportunity: ${c.city}, ${c.stateAbbr} — $${(c.maxDental ?? 0).toLocaleString()} max dental but only ${c.carrierCount} carriers competing.`,
        priority: "high",
      });
    }

    // County where one carrier dominates
    const dominated = cityData.filter(
      (c) => c.topCarrier && (c.carrierCount ?? 0) >= 3
    );
    if (dominated.length > 0) {
      const c = dominated[0];
      items.push({
        icon: "warning",
        text: `${c.topCarrier} leads ${c.city}, ${c.stateAbbr} — vulnerability for competitors with stronger dental or OTC.`,
        priority: "medium",
      });
    }

    // Low plan count counties
    const underserved = cityData.filter((c) => (c.planCount ?? 0) < 5 && (c.planCount ?? 0) > 0);
    if (underserved.length > 0) {
      items.push({
        icon: "target",
        text: `${underserved.length} counties have fewer than 5 plans — first-mover advantage for new plan offerings.`,
        priority: "medium",
      });
    }

    return items.slice(0, 4);
  }, [cityData]);

  const columns: Column<CityData>[] = [
    { key: "city", header: "City", sortable: true },
    { key: "stateAbbr", header: "State", sortable: true },
    {
      key: "planCount",
      header: "Plans",
      sortable: true,
      render: (value) => (
        <span className="font-mono font-medium">{value as number}</span>
      ),
    },
    {
      key: "carrierCount",
      header: "Carriers",
      sortable: true,
      render: (value) => (
        <span className="font-mono">{value as number}</span>
      ),
    },
    { key: "topCarrier", header: "Top Carrier", sortable: true },
    {
      key: "maxDental",
      header: "Max Dental",
      sortable: true,
      render: (value) => (
        <span className="font-mono font-medium text-chart-1">
          ${((value as number) ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "maxOtc",
      header: "Max OTC",
      sortable: true,
      render: (value) => (
        <span className="font-mono">${(value as number) ?? 0}/mo</span>
      ),
    },
    {
      key: "maxFlexCard",
      header: "Max Flex",
      sortable: true,
      render: (value) => (
        <span className="font-mono">${(value as number) ?? 0}/mo</span>
      ),
    },
    {
      key: "avgPcpCopay",
      header: "PCP Copay",
      sortable: true,
      render: (value) => (
        <Badge variant={(value ?? 0) === 0 ? "default" : "secondary"}>
          {(value ?? 0) === 0 ? "$0" : `$${value}`}
        </Badge>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load city data</p>
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="County Reports"
        description="Plan availability and benefit comparison at the county level. See which carriers dominate each area."
        helpText="Sort any column by clicking the header. Click Export to download this data as CSV. Each row shows a county's plan count, top carrier, average premium, and benefit percentages (dental, OTC, vision, etc.)."
        dataSource="Data: CMS CY2026 PBP files aggregated by county. Plans are mapped to counties via CMS service area files. Carrier dominance = carrier with the most plans in that county."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Cities Analyzed"
          value={totalCities}
          icon={<Building2 className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Total Plans"
          value={totalPlans}
          trend={8}
          trendLabel="growth"
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Max Dental"
          prefix="$"
          value={avgDental}
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Top City by Plans"
          value={topCity}
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {cityInsights.length > 0 && (
        <InsightBox
          title="Action Items — County Reports"
          insights={cityInsights}
        />
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {top10CitiesBenefitData.length > 0 && (
          <BenefitComparisonBar
            data={top10CitiesBenefitData}
            title="Top 10 Cities by Dental & OTC Benefits"
          />
        )}
        {starRatings.length > 0 && (
          <StarRatingDistribution
            ratings={starRatings}
            title="Plan Star Rating Distribution"
          />
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>City-Level Benefits Report</CardTitle>
          <ExportButton scope="cities" />
        </CardHeader>
        <CardContent>
          <DataTable
            data={cityData as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            searchPlaceholder="Search cities..."
            pageSize={10}
            onRowClick={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
