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
import Dashboard from "@/pages/Dashboard";
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
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ProfilePage from "@/pages/ProfilePage";
import ClientList from "@/pages/ClientList";
import ClientIntake from "@/pages/ClientIntake";
import ClientDetail from "@/pages/ClientDetail";
import SOADashboard from "@/pages/SOADashboard";
import BenefitGridView from "@/pages/BenefitGridView";
import MarketIntelligence from "@/pages/MarketIntelligence";
import MoneyCalculator from "@/pages/MoneyCalculator";
import HiddenGems from "@/pages/HiddenGems";
import Archetypes from "@/pages/Archetypes";
import BattlegroundMap from "@/pages/BattlegroundMap";
import AEPWarRoom from "@/pages/AEPWarRoom";
import HealthGapAnalysis from "@/pages/HealthGapAnalysis";
import LeadDashboard from "@/pages/LeadDashboard";
import DataSources from "@/pages/DataSources";
import TrendsTimeline from "@/pages/TrendsTimeline";
import CarrierMovements from "@/pages/CarrierMovements";
import ACAMarketplace from "@/pages/ACAMarketplace";
import EligibilityCheck from "@/pages/EligibilityCheck";
import SmartMatch from "@/pages/SmartMatch";
import ACAEligibility from "@/pages/ACAEligibility";
import ACASmartMatch from "@/pages/ACASmartMatch";
import KeepMyDoctor from "@/pages/KeepMyDoctor";
import PlanCheatsheets from "@/pages/PlanCheatsheets";
import CarrierScorecards from "@/pages/CarrierScorecards";
import RegulatoryCalendar from "@/pages/RegulatoryCalendar";
import SEPOptimizer from "@/pages/SEPOptimizer";
import SEPChecker from "@/pages/SEPChecker";
import DisruptionAlerts from "@/pages/DisruptionAlerts";
import CrosswalkTracker from "@/pages/CrosswalkTracker";
import AdminUsers from "@/pages/AdminUsers";
import AdminAuditLog from "@/pages/AdminAuditLog";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Turning65Pipeline from "@/pages/Turning65Pipeline";
import OEPRemorse from "@/pages/OEPRemorse";
import DSNPPipeline from "@/pages/DSNPPipeline";
import NotFound from "@/pages/not-found";
import TPMODisclaimer from "@/components/TPMODisclaimer";
import LandingPage from "@/pages/LandingPage";
import PricingPage from "@/pages/PricingPage";
import EntryPage from "@/pages/EntryPage";
import AgentShowcase from "@/pages/AgentShowcase";

// Lazy-load the consumer flow (standalone page)
import ConsumerFlow from "@/pages/ConsumerFlow";

import { useAuth } from "@/hooks/useAuth";
import { AIAnalystProvider } from "@/lib/AIAnalystContext";
import { AIAnalystChat } from "@/components/ai/AIAnalystChat";

/** Guards a route so only users with matching roles can access it */
function AuthGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user || !roles.includes(user.role)) {
    return <NotFound />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/states" component={StateHeatmap} />
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
      <Route path="/intelligence" component={MarketIntelligence} />
      <Route path="/calculator" component={MoneyCalculator} />
      <Route path="/gems" component={HiddenGems} />
      <Route path="/archetypes" component={Archetypes} />
      <Route path="/battleground" component={BattlegroundMap} />
      <Route path="/warroom" component={AEPWarRoom} />
      <Route path="/health-gaps" component={HealthGapAnalysis} />
      <Route path="/leads" component={LeadDashboard} />
      <Route path="/trends" component={TrendsTimeline} />
      <Route path="/carrier-movements" component={CarrierMovements} />
      <Route path="/aca/eligibility" component={ACAEligibility} />
      <Route path="/aca/smart-match" component={ACASmartMatch} />
      <Route path="/aca" component={ACAMarketplace} />
      <Route path="/eligibility" component={EligibilityCheck} />
      <Route path="/smart-match" component={SmartMatch} />
      <Route path="/keep-my-doctor" component={KeepMyDoctor} />
      <Route path="/cheatsheets" component={PlanCheatsheets} />
      <Route path="/scorecards" component={CarrierScorecards} />
      <Route path="/regulatory" component={RegulatoryCalendar} />
      <Route path="/sep" component={SEPOptimizer} />
      <Route path="/sep/check" component={SEPChecker} />
      <Route path="/disruptions" component={DisruptionAlerts} />
      <Route path="/crosswalk" component={CrosswalkTracker} />
      <Route path="/pipeline/turning-65" component={Turning65Pipeline} />
      <Route path="/pipeline/oep-remorse" component={OEPRemorse} />
      <Route path="/pipeline/dsnp" component={DSNPPipeline} />
      <Route path="/data-sources" component={DataSources} />
      <Route path="/admin/users">
        {() => (
          <AuthGuard roles={["admin"]}>
            <AdminUsers />
          </AuthGuard>
        )}
      </Route>
      <Route path="/admin/audit">
        {() => (
          <AuthGuard roles={["admin"]}>
            <AdminAuditLog />
          </AuthGuard>
        )}
      </Route>
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
    <AIAnalystProvider>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <DashboardHeader showSearch={true} />
            <main className="flex-1 overflow-auto bg-background">
              <Router />
              <TPMODisclaimer />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <AIAnalystChat />
    </AIAnalystProvider>
  );
}

/**
 * Root route — show entry page for new visitors, dashboard for authenticated users
 */
function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <AppLayout />;
  return <EntryPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Switch>
              {/* Standalone pages — no sidebar/header */}
              <Route path="/login" component={LoginPage} />
              <Route path="/register" component={RegisterPage} />
              <Route path="/forgot-password" component={ForgotPassword} />
              <Route path="/reset-password" component={ResetPassword} />
              <Route path="/for-you" component={ConsumerFlow} />
              <Route path="/tools" component={AgentShowcase} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/welcome" component={LandingPage} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/terms" component={Terms} />

              {/* Landing page for unauthenticated, dashboard for authenticated */}
              <Route path="/" component={RootRoute} />

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
