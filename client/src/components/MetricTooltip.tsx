import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const termDefinitions: Record<string, string> = {
  "MOOP": "Maximum Out-of-Pocket — the most you'll pay in a year for covered services",
  "PCP Copay": "Primary Care Physician copay — what you pay per doctor visit",
  "OTC": "Over-the-Counter allowance — money for health products like vitamins and first aid",
  "Star Rating": "CMS quality score from 1-5 stars. 4+ stars indicates high quality",
  "SNP": "Special Needs Plan — designed for people with specific health conditions",
  "D-SNP": "Dual Special Needs Plan — for people with both Medicare and Medicaid",
  "Part B Giveback": "Reduces your Medicare Part B premium, putting money back in your pocket",
  "TPMO": "Third Party Marketing Organization",
  "SOA": "Scope of Appointment — required compliance form before discussing specific plans",
  "AEP": "Annual Enrollment Period — October 15 to December 7",
  "OEP": "Open Enrollment Period — January 1 to March 31",
};

interface MetricTooltipProps {
  term: string;
  children: React.ReactNode;
}

export function MetricTooltip({ term, children }: MetricTooltipProps) {
  const definition = termDefinitions[term];

  if (!definition) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground/50 hover:border-foreground transition-colors">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { termDefinitions };
