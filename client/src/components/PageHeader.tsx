import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HelpCircle } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
  helpText?: string;
  dataSource?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, helpText, dataSource, badge, actions }: PageHeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {badge && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {badge}
                </Badge>
              )}
              {(helpText || dataSource) && (
                <CollapsibleTrigger asChild>
                  <button
                    className="inline-flex items-center justify-center rounded-full h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Toggle help text"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </CollapsibleTrigger>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
        {(helpText || dataSource) && (
          <CollapsibleContent>
            <div className="space-y-2">
              {helpText && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{helpText}</span>
                </div>
              )}
              {dataSource && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m3 15 2 2 4-4"/></svg>
                  <span>{dataSource}</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
