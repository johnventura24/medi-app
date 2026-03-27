import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { SearchCommandPalette } from "./SearchCommandPalette";
import { ExportButton } from "./ExportButton";
import { Bell } from "lucide-react";

interface DashboardHeaderProps {
  title?: string;
  showSearch?: boolean;
  exportScope?: "plans" | "states" | "cities" | "zips" | "carriers";
  exportFilters?: Record<string, string>;
}

export function DashboardHeader({
  title,
  showSearch = true,
  exportScope,
  exportFilters,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b bg-background sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        {title && <h1 className="font-semibold text-lg hidden md:block">{title}</h1>}
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end">
        {showSearch && <SearchCommandPalette />}

        {exportScope && (
          <ExportButton scope={exportScope} filters={exportFilters} />
        )}

        <Button variant="ghost" size="icon" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <ThemeToggle />
      </div>
    </header>
  );
}
