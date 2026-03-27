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

interface ZipScore {
  zip: string;
  city: string;
  state: string;
  score: number;
}

interface Props {
  data: ZipScore[];
  count?: number;
  title?: string;
}

function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 80) return "#84cc16";
  if (score >= 70) return "#eab308";
  if (score >= 60) return "#f97316";
  return "#ef4444";
}

export function ZipScoresBarChart({
  data,
  count = 15,
  title = "Top ZIP Codes by Desirability Score",
}: Props) {
  const topZips = [...data]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .reverse(); // reverse for horizontal bars (bottom = best)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, topZips.length * 28 + 40)}>
          <BarChart
            data={topZips}
            layout="vertical"
            margin={{ top: 5, right: 30, bottom: 5, left: 90 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <YAxis
              type="category"
              dataKey="zip"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={{ stroke: "#d1d5db" }}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, _name: string, item: { payload?: ZipScore }) => [
                `Score: ${value}/100 - ${item.payload?.city ?? ""}, ${item.payload?.state ?? ""}`,
                "Desirability",
              ]}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {topZips.map((entry, index) => (
                <Cell key={index} fill={scoreColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
