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
  scores: number[];
  title?: string;
}

const BUCKETS = [
  { label: "0-20", min: 0, max: 20, color: "#ef4444" },
  { label: "21-40", min: 21, max: 40, color: "#f97316" },
  { label: "41-60", min: 41, max: 60, color: "#eab308" },
  { label: "61-80", min: 61, max: 80, color: "#84cc16" },
  { label: "81-100", min: 81, max: 100, color: "#22c55e" },
];

export function DesirabilityHistogram({
  scores,
  title = "Desirability Score Distribution",
}: Props) {
  const chartData = useMemo(() => {
    const total = scores.length || 1;
    return BUCKETS.map((bucket) => {
      const count = scores.filter(
        (s) => s >= bucket.min && s <= bucket.max
      ).length;
      return {
        name: bucket.label,
        count,
        percentage: Math.round((count / total) * 100),
        color: bucket.color,
      };
    });
  }, [scores]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
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
              label={{ value: "ZIP Codes", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, _name: string, item: { payload?: { percentage: number } }) => [
                `${value} ZIPs (${item.payload?.percentage ?? 0}%)`,
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
