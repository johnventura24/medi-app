import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Target, AlertTriangle, Lightbulb, TrendingUp, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InsightItem {
  icon: "target" | "alert" | "opportunity" | "trend" | "warning";
  text: string;
  priority: "high" | "medium" | "low";
}

export interface InsightBoxProps {
  title: string;
  insights: InsightItem[];
  className?: string;
  variant?: "default" | "briefing";
}

const iconMap = {
  target: Target,
  alert: AlertTriangle,
  opportunity: Lightbulb,
  trend: TrendingUp,
  warning: ShieldAlert,
};

const priorityDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const iconColor: Record<string, string> = {
  target: "text-blue-500",
  alert: "text-red-500",
  opportunity: "text-emerald-500",
  trend: "text-violet-500",
  warning: "text-amber-500",
};

export function InsightBox({ title, insights, className, variant = "default" }: InsightBoxProps) {
  if (!insights || insights.length === 0) return null;

  const isBriefing = variant === "briefing";

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isBriefing
          ? "border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20"
          : "border border-border bg-gradient-to-br from-primary/[0.03] to-primary/[0.07]",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className={cn("h-4.5 w-4.5", isBriefing ? "text-amber-500" : "text-primary")} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const Icon = iconMap[insight.icon];
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  "bg-background/60 hover:bg-background/90 border border-border/50",
                )}
              >
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", priorityDot[insight.priority])} />
                  <Icon className={cn("h-4 w-4", iconColor[insight.icon])} />
                </div>
                <p className="text-sm leading-relaxed">{insight.text}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
