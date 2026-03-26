import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  details: { label: string; value: string }[];
  coverage?: number;
  onViewDetails?: () => void;
  className?: string;
}

export function BenefitCard({
  icon,
  title,
  value,
  prefix = "",
  suffix = "",
  details,
  coverage,
  onViewDetails,
  className,
}: BenefitCardProps) {
  return (
    <Card className={cn("hover-elevate", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="p-3 bg-muted rounded-md">
          {icon}
        </div>
        {coverage !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {coverage}% coverage
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-lg font-semibold" data-testid={`benefit-title-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {title}
          </p>
          <p className="text-3xl font-bold font-mono mt-1" data-testid={`benefit-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </p>
        </div>
        <ul className="space-y-2">
          {details.map((detail, idx) => (
            <li key={idx} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{detail.label}</span>
              <span className="font-medium">{detail.value}</span>
            </li>
          ))}
        </ul>
        {onViewDetails && (
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={onViewDetails}
            data-testid={`button-view-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            View Details
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
