import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardHeader } from "@/components/DashboardHeader";
import StateHeatmap from "@/pages/StateHeatmap";
import CityReports from "@/pages/CityReports";
import ZipRankings from "@/pages/ZipRankings";
import BenefitView from "@/pages/BenefitView";
import BenefitDetailView from "@/pages/BenefitDetailView";
import CarrierView from "@/pages/CarrierView";
import PlanView from "@/pages/PlanView";
import Recommendations from "@/pages/Recommendations";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={StateHeatmap} />
      <Route path="/cities" component={CityReports} />
      <Route path="/zips" component={ZipRankings} />
      <Route path="/benefits" component={BenefitView} />
      <Route path="/benefits/:type" component={BenefitDetailView} />
      <Route path="/carriers" component={CarrierView} />
      <Route path="/plans" component={PlanView} />
      <Route path="/opportunity" component={Recommendations} />
      <Route path="/recommendations" component={Recommendations} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <DashboardHeader
                  showSearch={true}
                  onExport={() => console.log("Export data")}
                />
                <main className="flex-1 overflow-auto bg-background">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
