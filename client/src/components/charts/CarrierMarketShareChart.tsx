import { useState, useMemo, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CarrierShare {
  name: string;
  plans: number;
  marketShare: number;
}

interface Props {
  data: CarrierShare[];
  title?: string;
  onSliceClick?: (carrier: string) => void;
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b",
  "#ef4444", "#10b981", "#ec4899", "#f97316",
  "#6b7280",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="currentColor" className="text-sm font-semibold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b7280" className="text-xs">
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius - 1}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export function CarrierMarketShareChart({
  data,
  title = "Carrier Market Share",
  onSliceClick,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.plans - a.plans);
    if (sorted.length <= 8) return sorted;
    const top8 = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    const otherPlans = rest.reduce((s, c) => s + c.plans, 0);
    const otherShare = rest.reduce((s, c) => s + c.marketShare, 0);
    return [...top8, { name: "Other", plans: otherPlans, marketShare: otherShare }];
  }, [data]);

  const totalPlans = useMemo(
    () => chartData.reduce((s, c) => s + c.plans, 0),
    [chartData]
  );

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={70}
              outerRadius={120}
              dataKey="plans"
              nameKey="name"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              onClick={(_, index) => {
                const item = chartData[index];
                if (item && onSliceClick) onSliceClick(item.name);
              }}
              style={{ cursor: onSliceClick ? "pointer" : "default" }}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            {activeIndex === undefined && (
              <text
                x="50%"
                y="43%"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-lg font-bold"
                fill="currentColor"
              >
                {totalPlans.toLocaleString()}
              </text>
            )}
            {activeIndex === undefined && (
              <text
                x="50%"
                y="49%"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#6b7280"
                className="text-xs"
              >
                total plans
              </text>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString()} plans (${((value / totalPlans) * 100).toFixed(1)}%)`,
                name,
              ]}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value: string, entry) => {
                const item = chartData.find((d) => d.name === value);
                const pct = item ? ((item.plans / totalPlans) * 100).toFixed(1) : "0";
                return (
                  <span style={{ color: entry.color }}>
                    {value} ({pct}%)
                  </span>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
