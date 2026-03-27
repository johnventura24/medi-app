import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BenefitCoverage {
  dental: number;
  otc: number;
  transportation: number;
  meals: number;
  fitness: number;
  telehealth: number;
  inHomeSupport: number;
}

interface Props {
  /** Each value is 0-100 representing % of plans that have the benefit */
  coverage: BenefitCoverage;
  title?: string;
}

const BENEFIT_META = [
  { key: "dental", label: "Dental", color: "#3b82f6" },
  { key: "otc", label: "OTC", color: "#10b981" },
  { key: "transportation", label: "Transportation", color: "#f59e0b" },
  { key: "meals", label: "Meals", color: "#ef4444" },
  { key: "fitness", label: "Fitness", color: "#8b5cf6" },
  { key: "telehealth", label: "Telehealth", color: "#06b6d4" },
  { key: "inHomeSupport", label: "In-Home Support", color: "#ec4899" },
] as const;

export function SupplementalBenefitsPie({
  coverage,
  title = "Supplemental Benefits Coverage",
}: Props) {
  const chartData = useMemo(
    () =>
      BENEFIT_META.map((b) => ({
        name: b.label,
        value: coverage?.[b.key as keyof BenefitCoverage] ?? 0,
        color: b.color,
      })),
    [coverage]
  );

  const allZero = chartData.every((d) => d.value === 0);

  if (!coverage || allZero) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-12">No data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              outerRadius={110}
              dataKey="value"
              nameKey="name"
              label={({ name, value }) => `${name}: ${value}%`}
              labelLine={{ stroke: "#9ca3af" }}
              style={{ fontSize: 11 }}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `${value}% of plans`,
                name,
              ]}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
