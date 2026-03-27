import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExport } from "@/hooks/useExport";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

interface ExportButtonProps {
  scope: "plans" | "states" | "cities" | "zips" | "carriers";
  filters?: Record<string, string>;
  disabled?: boolean;
}

export function ExportButton({ scope, filters, disabled }: ExportButtonProps) {
  const { exportCSV, exportPDF, isExporting } = useExport();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          data-testid="button-export"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => exportCSV(scope, filters)}
          disabled={isExporting}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportPDF(scope, filters)}
          disabled={isExporting}
        >
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
