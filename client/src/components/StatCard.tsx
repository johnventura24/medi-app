import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  trend,
  trendLabel,
  icon,
  className,
}: StatCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-3 w-3" />;
    if (trend < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return "";
    if (trend > 0) return "text-green-600 dark:text-green-400";
    if (trend < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("min-h-32", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate" data-testid="stat-label">
              {label}
            </p>
            <p className="mt-2 text-4xl font-bold font-mono tracking-tight" data-testid="stat-value">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </p>
            {trend !== undefined && (
              <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", getTrendColor())}>
                {getTrendIcon()}
                <span data-testid="stat-trend">{Math.abs(trend)}%</span>
                {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
              </div>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 p-2 bg-muted rounded-md">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
