import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column, Badge } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { CityData } from "@shared/schema";
import { Building2, DollarSign, Users, TrendingUp } from "lucide-react";

export default function CityReports() {
  const { data: cityData = [], isLoading } = useQuery<CityData[]>({
    queryKey: ["/api/cities"],
  });

  const totalCities = cityData.length;
  const totalPlans = cityData.reduce((acc, c) => acc + c.planCount, 0);
  const avgDental = cityData.length > 0
    ? Math.round(cityData.reduce((acc, c) => acc + c.maxDental, 0) / cityData.length)
    : 0;
  const topCity = cityData.length > 0
    ? cityData.reduce((max, c) => c.planCount > max.planCount ? c : max, cityData[0])?.city
    : "—";

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
          ${(value as number).toLocaleString()}
        </span>
      ),
    },
    {
      key: "maxOtc",
      header: "Max OTC",
      sortable: true,
      render: (value) => (
        <span className="font-mono">${(value as number)}/mo</span>
      ),
    },
    {
      key: "maxFlexCard",
      header: "Max Flex",
      sortable: true,
      render: (value) => (
        <span className="font-mono">${(value as number)}/mo</span>
      ),
    },
    {
      key: "avgPcpCopay",
      header: "PCP Copay",
      sortable: true,
      render: (value) => (
        <Badge variant={value === 0 ? "default" : "secondary"}>
          {value === 0 ? "$0" : `$${value}`}
        </Badge>
      ),
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

      <Card>
        <CardHeader>
          <CardTitle>City-Level Benefits Report</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={cityData as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            searchPlaceholder="Search cities..."
            pageSize={10}
            onRowClick={(row) => console.log("View city:", row)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
