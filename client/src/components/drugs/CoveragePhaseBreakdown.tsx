import { cn } from "@/lib/utils";

interface CoveragePhaseBreakdownProps {
  phases: {
    deductible: number;
    initialCoverage: number;
    coverageGap: number;
    catastrophic: number;
  };
  className?: string;
}

const phaseConfig = [
  {
    key: "deductible" as const,
    label: "Deductible",
    color: "bg-red-500",
    textColor: "text-red-700 dark:text-red-300",
    payLabel: "You pay 100%",
  },
  {
    key: "initialCoverage" as const,
    label: "Initial Coverage",
    color: "bg-blue-500",
    textColor: "text-blue-700 dark:text-blue-300",
    payLabel: "Plan pays ~75%",
  },
  {
    key: "coverageGap" as const,
    label: "Coverage Gap",
    color: "bg-orange-500",
    textColor: "text-orange-700 dark:text-orange-300",
    payLabel: "You pay ~25%",
  },
  {
    key: "catastrophic" as const,
    label: "Catastrophic",
    color: "bg-green-500",
    textColor: "text-green-700 dark:text-green-300",
    payLabel: "Plan pays ~95%",
  },
];

export function CoveragePhaseBreakdown({
  phases,
  className,
}: CoveragePhaseBreakdownProps) {
  const total =
    phases.deductible +
    phases.initialCoverage +
    phases.coverageGap +
    phases.catastrophic;

  if (total === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No coverage phase data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium">Part D Coverage Phases</h4>

      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden border">
        {phaseConfig.map((phase) => {
          const amount = phases[phase.key];
          const pct = total > 0 ? (amount / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={phase.key}
              className={cn(
                "flex items-center justify-center text-white text-[10px] font-medium transition-all",
                phase.color
              )}
              style={{ width: `${pct}%` }}
              title={`${phase.label}: $${amount.toLocaleString()}`}
            >
              {pct > 12 ? `$${amount.toLocaleString()}` : ""}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {phaseConfig.map((phase) => {
          const amount = phases[phase.key];
          return (
            <div key={phase.key} className="flex items-start gap-2">
              <div
                className={cn("w-3 h-3 rounded-sm shrink-0 mt-0.5", phase.color)}
              />
              <div className="min-w-0">
                <p className={cn("text-xs font-medium", phase.textColor)}>
                  {phase.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  ${amount.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{phase.payLabel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
