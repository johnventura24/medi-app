import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CopayRange {
  service: string;
  min: number;
  max: number;
  avg: number;
}

interface Props {
  data: CopayRange[];
  title?: string;
}

const SERVICE_COLORS: Record<string, string> = {
  PCP: "#3b82f6",
  Specialist: "#8b5cf6",
  ER: "#ef4444",
  "Urgent Care": "#f59e0b",
  Inpatient: "#06b6d4",
};

export function CopayRangeChart({
  data,
  title = "Copay Ranges by Service",
}: Props) {
  if (!data || data.length === 0) {
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

  // Transform data for stacked bars: base (invisible) + range (visible)
  const chartData = data.map((d) => ({
    service: d.service,
    base: d.min,
    range: d.max - d.min,
    avg: d.avg,
    min: d.min,
    max: d.max,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis
              type="category"
              dataKey="service"
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
              width={75}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(_v: number, name: string, item: { payload?: { min: number; max: number; avg: number } }) => {
                if (name === "base") return [null, null];
                const p = item.payload;
                if (!p) return ["", "Range"];
                return [`$${p.min} - $${p.max} (avg: $${p.avg})`, "Range"];
              }}
            />
            {/* Invisible base */}
            <Bar dataKey="base" stackId="a" fill="transparent" radius={0} />
            {/* Visible range */}
            <Bar dataKey="range" stackId="a" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={SERVICE_COLORS[entry.service] || "#6b7280"}
                  fillOpacity={0.75}
                />
              ))}
            </Bar>
            {/* Average dots */}
            {chartData.map((entry, index) => (
              <ReferenceDot
                key={index}
                x={entry.avg}
                y={entry.service}
                r={5}
                fill="#1f2937"
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 bg-blue-400 rounded opacity-75" />
            <span>Min-Max Range</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-800 rounded-full border-2 border-white" />
            <span>Average</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
