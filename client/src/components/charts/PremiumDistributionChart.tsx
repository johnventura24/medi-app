import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  premiums: number[];
  title?: string;
}

const BUCKETS = [
  { label: "$0", min: 0, max: 0, color: "#22c55e" },
  { label: "$1-$25", min: 1, max: 25, color: "#84cc16" },
  { label: "$26-$50", min: 26, max: 50, color: "#eab308" },
  { label: "$51-$100", min: 51, max: 100, color: "#f97316" },
  { label: "$100+", min: 101, max: Infinity, color: "#ef4444" },
];

export function PremiumDistributionChart({
  premiums,
  title = "Premium Distribution",
}: Props) {
  const safePremiums = useMemo(() => (premiums ?? []).map((p) => p ?? 0), [premiums]);

  const chartData = useMemo(() => {
    const total = safePremiums.length || 1;
    return BUCKETS.map((bucket) => {
      const count = safePremiums.filter(
        (p) => p >= bucket.min && p <= bucket.max
      ).length;
      return {
        name: bucket.label,
        count,
        percentage: Math.round((count / total) * 100),
        color: bucket.color,
      };
    });
  }, [safePremiums]);

  if (!premiums || premiums.length === 0) {
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
              label={{ value: "Plans", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, _name: string, item: { payload?: { percentage: number } }) => [
                `${value} plans (${item.payload?.percentage ?? 0}%)`,
                "Count",
              ]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
