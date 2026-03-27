import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { AuthProvider } from "@/lib/AuthContext";
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
import MatrixView from "@/pages/MatrixView";
import ChangeReportView from "@/pages/ChangeReportView";
import ValidationDashboard from "@/pages/ValidationDashboard";
import PlanFinder from "@/pages/PlanFinder";
import PlanCompare from "@/pages/PlanCompare";
import Settings from "@/pages/Settings";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ProfilePage from "@/pages/ProfilePage";
import ClientList from "@/pages/ClientList";
import ClientIntake from "@/pages/ClientIntake";
import ClientDetail from "@/pages/ClientDetail";
import SOADashboard from "@/pages/SOADashboard";
import BenefitGridView from "@/pages/BenefitGridView";
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
      <Route path="/matrix" component={MatrixView} />
      <Route path="/changes" component={ChangeReportView} />
      <Route path="/validation" component={ValidationDashboard} />
      <Route path="/find" component={PlanFinder} />
      <Route path="/compare" component={PlanCompare} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/clients/new" component={ClientIntake} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/clients" component={ClientList} />
      <Route path="/soa" component={SOADashboard} />
      <Route path="/benefit-grid" component={BenefitGridView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <DashboardHeader showSearch={true} />
          <main className="flex-1 overflow-auto bg-background">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Switch>
              {/* Standalone auth pages — no sidebar/header */}
              <Route path="/login" component={LoginPage} />
              <Route path="/register" component={RegisterPage} />

              {/* All other routes use the sidebar layout */}
              <Route>
                <AppLayout />
              </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
