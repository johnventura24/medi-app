import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Search, Bell, Download } from "lucide-react";

interface DashboardHeaderProps {
  title?: string;
  showSearch?: boolean;
  onExport?: () => void;
}

export function DashboardHeader({
  title,
  showSearch = true,
  onExport,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b bg-background sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        {title && <h1 className="font-semibold text-lg hidden md:block">{title}</h1>}
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end">
        {showSearch && (
          <div className="relative max-w-sm hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search states, cities, ZIPs..."
              className="pl-10 w-64"
              data-testid="input-global-search"
            />
          </div>
        )}

        {onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}

        <Button variant="ghost" size="icon" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <ThemeToggle />
      </div>
    </header>
  );
}
