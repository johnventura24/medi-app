import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useAIPlanExplainer } from "@/hooks/useAIExplainer";

interface AIPlanExplainerProps {
  planId: number;
  clientId?: number;
}

export function AIPlanExplainer({ planId, clientId }: AIPlanExplainerProps) {
  const { generate, data, isGenerating, error } = useAIPlanExplainer(
    planId,
    clientId
  );
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              AI Plan Summary
              {data?.cached && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                >
                  Cached
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {data && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generate(true)}
                  disabled={isGenerating}
                  title="Regenerate (bypass cache)"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`}
                  />
                </Button>
              )}
              {!data && (
                <Button
                  size="sm"
                  onClick={() => {
                    generate(false);
                    setExpanded(true);
                  }}
                  disabled={isGenerating}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? "Analyzing..." : "Generate AI Summary"}
                </Button>
              )}
              {data && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {isGenerating && (
              <div className="flex items-center gap-3 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                <span className="text-sm text-muted-foreground">
                  Analyzing plan...
                </span>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {data && !isGenerating && (
              <>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {data.content}
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-[10px] text-muted-foreground italic">
                    *AI-generated summary. Verify details in the official Summary
                    of Benefits.*
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
