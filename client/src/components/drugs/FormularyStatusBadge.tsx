import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FormularyStatusBadgeProps {
  covered: boolean;
  tier: number | null;
  tierLabel?: string;
  priorAuth?: boolean;
  stepTherapy?: boolean;
  quantityLimit?: boolean;
  className?: string;
}

export function FormularyStatusBadge({
  covered,
  tier,
  tierLabel,
  priorAuth,
  stepTherapy,
  quantityLimit,
  className,
}: FormularyStatusBadgeProps) {
  if (!covered && tier === null && !priorAuth && !stepTherapy && !quantityLimit) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "text-[10px] bg-muted text-muted-foreground",
          className
        )}
      >
        Unknown
      </Badge>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {covered && tier !== null ? (
        <Badge
          variant="secondary"
          className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        >
          Tier {tier}
          {tierLabel ? ` - ${tierLabel}` : ""}
        </Badge>
      ) : !covered ? (
        <Badge
          variant="secondary"
          className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        >
          Not Covered
        </Badge>
      ) : null}
      {priorAuth && (
        <Badge
          variant="secondary"
          className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        >
          PA
        </Badge>
      )}
      {stepTherapy && (
        <Badge
          variant="secondary"
          className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        >
          ST
        </Badge>
      )}
      {quantityLimit && (
        <Badge
          variant="secondary"
          className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        >
          QL
        </Badge>
      )}
    </div>
  );
}
