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

export default function CarrierView() {
  const { data: carrierData = [], isLoading } = useQuery<CarrierData[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: nationalAverages } = useQuery<NationalAverages>({
    queryKey: ["/api/averages"],
  });

  const totalCarriers = carrierData.length;
  const totalPlans = carrierData.reduce((acc, c) => acc + c.totalPlans, 0);
  const avgMarketShare = carrierData.length > 0
    ? Math.round((carrierData.reduce((acc, c) => acc + c.marketShare, 0) / carrierData.length) * 10) / 10
    : 0;

  const carrierShareData = useMemo(
    () => carrierData.map((c) => ({ name: c.name, plans: c.totalPlans, marketShare: c.marketShare })),
    [carrierData]
  );

  const topCarrier = useMemo(
    () => carrierData.length > 0 ? [...carrierData].sort((a, b) => b.totalPlans - a.totalPlans)[0] : null,
    [carrierData]
  );

  const topCarrierRadar = useMemo(() => {
    if (!topCarrier || !nationalAverages) return null;
    return {
      planData: {
        dental: topCarrier.avgDentalAllowance,
        otc: topCarrier.avgOtcAllowance,
        vision: 0,
        premium: 0,
        copay: 0,
        starRating: 0,
      },
      areaAverage: {
        dental: nationalAverages.dentalAllowance,
        otc: nationalAverages.otcAllowance,
        vision: 0,
        premium: 0,
        copay: nationalAverages.pcpCopay,
        starRating: 0,
      },
    };
  }, [topCarrier, nationalAverages]);

  const top5CarriersBenefitData = useMemo(() => {
    return [...carrierData]
      .sort((a, b) => b.totalPlans - a.totalPlans)
      .slice(0, 5)
      .map((c) => ({
        name: c.name.length > 18 ? c.name.substring(0, 18) + "..." : c.name,
        dental: c.avgDentalAllowance,
        otc: c.avgOtcAllowance,
        vision: 0,
        flexCard: c.avgFlexCard,
      }));
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
