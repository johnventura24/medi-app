import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BenefitScores {
  dental: number;
  otc: number;
  vision: number;
  premium: number;
  copay: number;
  starRating: number;
}

interface Props {
  planData: BenefitScores;
  areaAverage: BenefitScores;
  planLabel?: string;
  averageLabel?: string;
}

const AXIS_LABELS: Record<keyof BenefitScores, string> = {
  dental: "Dental",
  otc: "OTC",
  vision: "Vision",
  premium: "Premium",
  copay: "Copay",
  starRating: "Star Rating",
};

export function BenefitRadarChart({
  planData,
  areaAverage,
  planLabel = "This Plan",
  averageLabel = "Area Average",
}: Props) {
  const chartData = (Object.keys(AXIS_LABELS) as (keyof BenefitScores)[]).map(
    (key) => ({
      axis: AXIS_LABELS[key],
      plan: planData[key],
      average: areaAverage[key],
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Benefit Comparison Radar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, "auto"]}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
            />
            <Radar
              name={planLabel}
              dataKey="plan"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Radar
              name={averageLabel}
              dataKey="average"
              stroke="#9ca3af"
              fill="#9ca3af"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
