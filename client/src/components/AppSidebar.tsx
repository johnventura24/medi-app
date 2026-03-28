import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Map,
  Building2,
  MapPin,
  Stethoscope,
  Pill,
  CreditCard,
  ShoppingCart,
  Car,
  DollarSign,
  Building,
  FileText,
  Target,
  Zap,
  LayoutGrid,
  ArrowLeftRight,
  ShieldCheck,
  Settings,
  HelpCircle,
  LogIn,
  Search,
  GitCompareArrows,
  Users,
  FileCheck,
  FileSpreadsheet,
  TrendingUp,
  BarChart3,
  Gem,
  Calculator,
  Swords,
  Activity,
  HeartPulse,
  Inbox,
  Database,
  LineChart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const geographyViews = [
  { title: "State Heatmap", url: "/dashboard", icon: Map },
  { title: "City Reports", url: "/cities", icon: Building2 },
  { title: "ZIP Rankings", url: "/zips", icon: MapPin },
];

const benefitViews = [
  { title: "All Benefits", url: "/benefits", icon: Zap },
  { title: "Dental", url: "/benefits/dental", icon: Stethoscope },
  { title: "OTC", url: "/benefits/otc", icon: Pill },
  { title: "Flex Card", url: "/benefits/flex-card", icon: CreditCard },
  { title: "Groceries", url: "/benefits/groceries", icon: ShoppingCart },
  { title: "Transportation", url: "/benefits/transportation", icon: Car },
];

const carrierViews = [
  { title: "Carrier Comparison", url: "/carriers", icon: Building },
  { title: "Plan Comparison", url: "/plans", icon: FileText },
];

const targetingViews = [
  { title: "Opportunity Score", url: "/opportunity", icon: Target },
  { title: "Best Angles", url: "/recommendations", icon: Zap },
];

const intelligenceViews = [
  { title: "Market Intelligence", url: "/intelligence", icon: TrendingUp },
  { title: "Trends & Timeline", url: "/trends", icon: LineChart },
  { title: "Battleground Map", url: "/battleground", icon: Swords },
  { title: "AEP War Room", url: "/warroom", icon: Activity },
  { title: "Health Gaps", url: "/health-gaps", icon: HeartPulse },
];

const agentToolsViews = [
  { title: "Plan Finder", url: "/find", icon: Search },
  { title: "Compare Plans", url: "/compare", icon: GitCompareArrows },
  { title: "Leads", url: "/leads", icon: Inbox },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "SOA Dashboard", url: "/soa", icon: FileCheck },
];

const powerToolsViews = [
  { title: "Money Calculator", url: "/calculator", icon: Calculator },
  { title: "Hidden Gems", url: "/gems", icon: Gem },
  { title: "Archetypes", url: "/archetypes", icon: Users },
];

const complianceViews = [
  { title: "Matrix View", url: "/matrix", icon: LayoutGrid },
  { title: "Change Report", url: "/changes", icon: ArrowLeftRight },
  { title: "Data Validation", url: "/validation", icon: ShieldCheck },
  { title: "Benefit Grid", url: "/benefit-grid", icon: FileSpreadsheet },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/" || location === "/dashboard";
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">MA Benefits</h1>
            <p className="text-xs text-muted-foreground">Analytics Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Geography Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {geographyViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Benefit Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {benefitViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Carrier & Plans</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {carrierViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Targeting</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {targetingViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Intelligence</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {intelligenceViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Power Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {powerToolsViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agent Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agentToolsViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Compliance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {complianceViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/data-sources")} data-testid="nav-data-sources">
              <Link href="/data-sources">
                <Database className="h-4 w-4" />
                <span>Data Sources</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="nav-settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild data-testid="nav-help">
              <Link href="/help">
                <HelpCircle className="h-4 w-4" />
                <span>Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator className="my-2" />

        {isAuthenticated && user ? (
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">
              {user.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{user.fullName}</span>
              <Badge variant="secondary" className="w-fit text-[10px] capitalize px-1.5 py-0">
                {user.role}
              </Badge>
            </div>
          </div>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild data-testid="nav-sign-in">
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
