import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { CarrierComparison } from "@/components/CarrierComparison";
import { DataTable, type Column, Badge } from "@/components/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { CarrierMarketShareChart } from "@/components/charts/CarrierMarketShareChart";
import { BenefitRadarChart } from "@/components/charts/BenefitRadarChart";
import { BenefitComparisonBar } from "@/components/charts/BenefitComparisonBar";
import type { CarrierData, NationalAverages } from "@shared/schema";
import { Building, Users, MapPin, TrendingUp } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";

export default function CarrierView() {
  const { data: carrierData = [], isLoading, isError } = useQuery<CarrierData[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: nationalAverages } = useQuery<NationalAverages>({
    queryKey: ["/api/averages"],
  });

  const totalCarriers = carrierData.length;
  const totalPlans = carrierData.reduce((acc, c) => acc + (c.totalPlans ?? 0), 0);
  const avgMarketShare = carrierData.length > 0
    ? Math.round((carrierData.reduce((acc, c) => acc + (c.marketShare ?? 0), 0) / carrierData.length) * 10) / 10
    : 0;

  const carrierShareData = useMemo(
    () => carrierData.map((c) => ({ name: c.name ?? "Unknown", plans: c.totalPlans ?? 0, marketShare: c.marketShare ?? 0 })),
    [carrierData]
  );

  const topCarrier = useMemo(
    () => carrierData.length > 0 ? [...carrierData].sort((a, b) => (b.totalPlans ?? 0) - (a.totalPlans ?? 0))[0] : null,
    [carrierData]
  );

  const topCarrierRadar = useMemo(() => {
    if (!topCarrier || !nationalAverages) return null;
    return {
      planData: {
        dental: topCarrier.avgDentalAllowance ?? 0,
        otc: topCarrier.avgOtcAllowance ?? 0,
        vision: 0,
        premium: 0,
        copay: 0,
        starRating: 0,
      },
      areaAverage: {
        dental: nationalAverages.dentalAllowance ?? 0,
        otc: nationalAverages.otcAllowance ?? 0,
        vision: 0,
        premium: 0,
        copay: nationalAverages.pcpCopay ?? 0,
        starRating: 0,
      },
    };
  }, [topCarrier, nationalAverages]);

  const top5CarriersBenefitData = useMemo(() => {
    return [...carrierData]
      .sort((a, b) => (b.totalPlans ?? 0) - (a.totalPlans ?? 0))
      .slice(0, 5)
      .map((c) => ({
        name: (c.name ?? "Unknown").length > 18 ? (c.name ?? "Unknown").substring(0, 18) + "..." : (c.name ?? "Unknown"),
        dental: c.avgDentalAllowance ?? 0,
        otc: c.avgOtcAllowance ?? 0,
        vision: 0,
        flexCard: c.avgFlexCard ?? 0,
      }));
  }, [carrierData]);

  const carrierInsights = useMemo((): InsightItem[] => {
    if (carrierData.length === 0) return [];
    const items: InsightItem[] = [];
    const sorted = [...carrierData].sort((a, b) => (b.marketShare ?? 0) - (a.marketShare ?? 0));

    // Top 3 carriers market concentration
    const top3Share = sorted.slice(0, 3).reduce((s, c) => s + (c.marketShare ?? 0), 0);
    const top3Names = sorted.slice(0, 3).map((c) => c.name).join(", ");
    items.push({
      icon: "trend",
      text: `Top 3 carriers (${top3Names}) control ${Math.round(top3Share)}% of the national market`,
      priority: top3Share > 50 ? "high" : "medium",
    });

    // Best dental vs lowest OTC
    const byDental = [...carrierData].sort((a, b) => (b.avgDentalAllowance ?? 0) - (a.avgDentalAllowance ?? 0));
    const bestDentalCarrier = byDental[0];
    if (bestDentalCarrier) {
      items.push({
        icon: "opportunity",
        text: `${bestDentalCarrier.name} has the best avg dental ($${bestDentalCarrier.avgDentalAllowance?.toLocaleString()}) — target for dental-focused clients`,
        priority: "medium",
      });
    }

    // Smaller carriers hidden value
    const smallCarriers = carrierData.filter((c) => (c.marketShare ?? 0) < 5);
    if (smallCarriers.length > 0) {
      const smallAvgDental = Math.round(smallCarriers.reduce((s, c) => s + (c.avgDentalAllowance ?? 0), 0) / smallCarriers.length);
      const bigCarriers = carrierData.filter((c) => (c.marketShare ?? 0) >= 5);
      const bigAvgDental = bigCarriers.length > 0 ? Math.round(bigCarriers.reduce((s, c) => s + (c.avgDentalAllowance ?? 0), 0) / bigCarriers.length) : 0;
      if (smallAvgDental > bigAvgDental) {
        const pctHigher = bigAvgDental > 0 ? Math.round(((smallAvgDental - bigAvgDental) / bigAvgDental) * 100) : 0;
        items.push({
          icon: "opportunity",
          text: `Smaller carriers (<5% share) average ${pctHigher}% higher dental ($${smallAvgDental} vs $${bigAvgDental}) — hidden value for agents`,
          priority: "medium",
        });
      }
    }

    // OTC leader
    const byOtc = [...carrierData].sort((a, b) => (b.avgOtcAllowance ?? 0) - (a.avgOtcAllowance ?? 0));
    if (byOtc[0]) {
      items.push({
        icon: "target",
        text: `${byOtc[0].name} leads in avg OTC allowance ($${byOtc[0].avgOtcAllowance}/mo) — recommend for OTC-sensitive beneficiaries`,
        priority: "low",
      });
    }

    return items.slice(0, 5);
  }, [carrierData]);

  const columns: Column<CarrierData>[] = [
    { key: "name", header: "Carrier", sortable: true },
    {
      key: "statesServed",
      header: "States",
      sortable: true,
      render: (value) => <span className="font-mono">{value as number}</span>,
    },
    {
      key: "totalPlans",
      header: "Total Plans",
      sortable: true,
      render: (value) => (
        <span className="font-mono font-medium">{(value as number).toLocaleString()}</span>
      ),
    },
    {
      key: "avgDentalAllowance",
      header: "Avg Dental",
      sortable: true,
      render: (value) => (
        <span className="font-mono text-chart-1">${(value as number).toLocaleString()}</span>
      ),
    },
    {
      key: "avgOtcAllowance",
      header: "Avg OTC",
      sortable: true,
      render: (value) => <span className="font-mono">${value as number}/mo</span>,
    },
    {
      key: "avgFlexCard",
      header: "Avg Flex Card",
      sortable: true,
      render: (value) => <span className="font-mono">${value as number}/mo</span>,
    },
    {
      key: "marketShare",
      header: "Market Share",
      sortable: true,
      render: (value) => <Badge variant="secondary">{value as number}%</Badge>,
    },
  ];

  if (isError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load carrier data</p>
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
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
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
        title="Carrier Analysis"
        description="Market share and benefit comparison across 301 Medicare Advantage carriers."
        helpText="Compare carriers on dental, OTC, vision, and flex card benefits. Market share is based on plan count."
        dataSource="Data: CMS CY2026 PBP files covering 301 carriers. Market share based on plan count per carrier. Benefit comparisons from actual CMS PBP benefit data."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Carriers"
          value={totalCarriers}
          icon={<Building className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Total Plans"
          value={totalPlans.toLocaleString()}
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Market Share"
          value={avgMarketShare}
          suffix="%"
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Nationwide Coverage"
          value="50"
          suffix=" states"
          icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {carrierInsights.length > 0 && (
        <InsightBox title="Carrier Intelligence" insights={carrierInsights} />
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Top Carriers Comparison</h2>
        <CarrierComparison carriers={carrierData} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {carrierShareData.length > 0 && (
          <CarrierMarketShareChart
            data={carrierShareData}
            title="Carrier Market Share"
          />
        )}
        {topCarrierRadar && topCarrier && (
          <BenefitRadarChart
            planData={topCarrierRadar.planData}
            areaAverage={topCarrierRadar.areaAverage}
            planLabel={topCarrier.name}
            averageLabel="National Average"
          />
        )}
      </div>

      {top5CarriersBenefitData.length > 0 && (
        <BenefitComparisonBar
          data={top5CarriersBenefitData}
          title="Top 5 Carriers - Dental, OTC, Flex Card Comparison"
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Carriers</CardTitle>
          <ExportButton scope="carriers" />
        </CardHeader>
        <CardContent>
          <DataTable
            data={carrierData as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            searchPlaceholder="Search carriers..."
            pageSize={10}
            onRowClick={(row) => console.log("View carrier:", row)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
