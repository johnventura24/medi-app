import { DashboardHeader } from "../DashboardHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/lib/ThemeProvider";

export default function DashboardHeaderExample() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <div className="w-full">
          <DashboardHeader
            title="State-Level Benefits"
            showSearch={true}
            exportScope="states"
          />
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
