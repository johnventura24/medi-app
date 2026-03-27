import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataItem {
  name: string;
  dental: number;
  otc: number;
  vision: number;
  flexCard: number;
}

interface Props {
  data: DataItem[];
  highlightIndex?: number;
  title?: string;
}

const BENEFITS = [
  { key: "dental", label: "Dental", color: "#3b82f6", dimColor: "#93c5fd" },
  { key: "otc", label: "OTC", color: "#10b981", dimColor: "#6ee7b7" },
  { key: "vision", label: "Vision", color: "#f59e0b", dimColor: "#fcd34d" },
  { key: "flexCard", label: "Flex Card", color: "#8b5cf6", dimColor: "#c4b5fd" },
] as const;

export function BenefitComparisonBar({
  data,
  highlightIndex,
  title = "Benefit Comparison",
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={{ stroke: "#d1d5db" }}
              interval={0}
              angle={data.length > 6 ? -30 : 0}
              textAnchor={data.length > 6 ? "end" : "middle"}
              height={data.length > 6 ? 60 : 30}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 12 }}
              axisLine={{ stroke: "#d1d5db" }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `$${value.toLocaleString()}`,
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {BENEFITS.map((benefit) => (
              <Bar
                key={benefit.key}
                dataKey={benefit.key}
                name={benefit.label}
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      highlightIndex === undefined || highlightIndex === idx
                        ? benefit.color
                        : benefit.dimColor
                    }
                    fillOpacity={
                      highlightIndex === undefined || highlightIndex === idx
                        ? 1
                        : 0.5
                    }
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
