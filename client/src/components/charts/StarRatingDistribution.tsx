import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

interface Props {
  ratings: number[];
  title?: string;
}

const RATING_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
};

export function StarRatingDistribution({
  ratings,
  title = "Star Rating Distribution",
}: Props) {
  const distribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((r) => {
      const rounded = Math.max(1, Math.min(5, Math.round(r)));
      counts[rounded]++;
    });
    const maxCount = Math.max(...Object.values(counts), 1);
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star],
      pct: ratings.length > 0 ? Math.round((counts[star] / ratings.length) * 100) : 0,
      widthPct: (counts[star] / maxCount) * 100,
      color: RATING_COLORS[star],
    }));
  }, [ratings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {distribution.map((d) => (
          <div key={d.star} className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 w-20 shrink-0">
              {Array.from({ length: d.star }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  fill={d.color}
                  stroke={d.color}
                />
              ))}
            </div>
            <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${d.widthPct}%`,
                  backgroundColor: d.color,
                  minWidth: d.count > 0 ? "8px" : "0px",
                }}
              />
            </div>
            <span className="text-sm font-mono text-muted-foreground w-20 text-right shrink-0">
              {d.count.toLocaleString()} ({d.pct}%)
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
