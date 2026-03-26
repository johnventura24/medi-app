import { DataTable, type Column, Badge } from "../DataTable";
import { cityData, type CityData } from "@/data/mockData";

export default function DataTableExample() {
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

  return (
    <div className="p-6">
      <DataTable
        data={cityData as unknown as Record<string, unknown>[]}
        columns={columns as Column<Record<string, unknown>>[]}
        searchPlaceholder="Search cities..."
        pageSize={5}
        onRowClick={(row) => console.log("Clicked row:", row)}
      />
    </div>
  );
}
