import { useState } from "react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Map,
  Building2,
  MapPin,
  Search,
  GitCompareArrows,
  Calculator,
  Gem,
  Users,
  UserPlus,
  FileCheck,
  Inbox,
  TrendingUp,
  Swords,
  Activity,
  HeartPulse,
  ArrowRightLeft,
  LineChart,
  LayoutGrid,
  ArrowLeftRight,
  ShieldCheck,
  FileSpreadsheet,
  Database,
  Settings,
  LogIn,
  Target,
  Diamond,
  Home,
  ChevronDown,
  Users as UsersIcon,
  ClipboardCheck,
  Zap,
  Stethoscope,
  Award,
  Calendar,
  Printer,
  AlertTriangle,
  Heart,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen: boolean;
  /** Which roles can see this group. undefined = everyone */
  roles?: Array<"admin" | "compliance" | "agent" | "viewer">;
}

const navGroups: NavGroup[] = [
  {
    label: "Explore",
    icon: MapPin,
    defaultOpen: true,
    // Always visible to everyone
    items: [
      { title: "State Overview", url: "/dashboard/states", icon: Map },
      { title: "County Reports", url: "/cities", icon: Building2 },
      { title: "ZIP Rankings", url: "/zips", icon: MapPin },
      { title: "ACA Marketplace", url: "/aca", icon: ShieldCheck },
      { title: "ACA Eligibility", url: "/aca/eligibility", icon: ClipboardCheck },
      { title: "ACA Smart Match", url: "/aca/smart-match", icon: Zap },
    ],
  },
  {
    label: "Find & Compare",
    icon: Search,
    defaultOpen: true,
    // Always visible to everyone
    items: [
      { title: "Keep My Doctor", url: "/keep-my-doctor", icon: Stethoscope },
      { title: "Eligibility Check", url: "/eligibility", icon: ClipboardCheck },
      { title: "Smart Match", url: "/smart-match", icon: Zap },
      { title: "Plan Finder", url: "/find", icon: Search },
      { title: "Compare Plans", url: "/compare", icon: GitCompareArrows },
      { title: "Money Calculator", url: "/calculator", icon: Calculator },
      { title: "Hidden Gems", url: "/gems", icon: Gem },
      { title: "SEP Checker", url: "/sep/check", icon: Calendar },
    ],
  },
  {
    label: "Sales Pipelines",
    icon: Target,
    defaultOpen: false,
    items: [
      { title: "Turning 65 Pipeline", url: "/pipeline/turning-65", icon: UserPlus },
      { title: "OEP Outreach", url: "/pipeline/oep-remorse", icon: RefreshCw },
      { title: "D-SNP Pipeline", url: "/pipeline/dsnp", icon: Heart },
    ],
  },
  {
    label: "Clients",
    icon: Users,
    defaultOpen: false,
    roles: ["admin", "agent"],
    items: [
      { title: "My Clients", url: "/clients", icon: Users },
      { title: "New Client", url: "/clients/new", icon: UserPlus },
      { title: "SOA Dashboard", url: "/soa", icon: FileCheck },
      { title: "Leads", url: "/leads", icon: Inbox },
    ],
  },
  {
    label: "Intelligence",
    icon: TrendingUp,
    defaultOpen: true,
    roles: ["admin", "compliance"],
    items: [
      { title: "Market Intelligence", url: "/intelligence", icon: TrendingUp },
      { title: "Battleground Map", url: "/battleground", icon: Swords },
      { title: "Carrier Movements", url: "/carrier-movements", icon: ArrowRightLeft },
      { title: "AEP War Room", url: "/warroom", icon: Activity },
      { title: "Trends", url: "/trends", icon: LineChart },
      { title: "Archetypes", url: "/archetypes", icon: UsersIcon },
      { title: "Health Gaps", url: "/health-gaps", icon: HeartPulse },
      { title: "SEP Optimizer", url: "/sep", icon: Calendar },
      { title: "Carrier Scorecards", url: "/scorecards", icon: Award },
      { title: "Disruption Alerts", url: "/disruptions", icon: AlertTriangle },
      { title: "Crosswalk Tracker", url: "/crosswalk", icon: Shuffle },
    ],
  },
  {
    label: "Compliance",
    icon: ShieldCheck,
    defaultOpen: false,
    roles: ["admin", "compliance"],
    items: [
      { title: "Benefit Grid", url: "/benefit-grid", icon: FileSpreadsheet },
      { title: "Matrix View", url: "/matrix", icon: LayoutGrid },
      { title: "Change Report", url: "/changes", icon: ArrowLeftRight },
      { title: "Data Validation", url: "/validation", icon: ShieldCheck },
      { title: "Plan Cheatsheets", url: "/cheatsheets", icon: Printer },
      { title: "Regulatory Calendar", url: "/regulatory", icon: Calendar },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    defaultOpen: false,
    roles: ["admin"],
    items: [
      { title: "Audit Logs", url: "/admin/audit", icon: ShieldCheck },
      { title: "User Management", url: "/admin/users", icon: Users },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const role = user?.role || "viewer";

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/" || location === "/dashboard";
    if (url === "/dashboard/states") return location === "/dashboard/states";
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  };

  // All groups visible to everyone — collapsed groups keep it uncluttered
  const visibleGroups = navGroups;

  // Track which groups are open — initialize from defaultOpen
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.label] = g.defaultOpen;
    });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Diamond className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Prism</h1>
            <p className="text-xs text-muted-foreground">Medicare Superintelligence</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard — always visible at top */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard")}
                  data-testid="nav-dashboard"
                >
                  <Link href="/dashboard">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Collapsible nav groups — filtered by role */}
        {visibleGroups.map((group) => (
          <Collapsible
            key={group.label}
            open={openGroups[group.label]}
            onOpenChange={() => toggleGroup(group.label)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer select-none hover:text-foreground transition-colors">
                  <span className="flex items-center gap-1.5 flex-1">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openGroups[group.label] ? "" : "-rotate-90"
                    }`}
                  />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((navItem) => (
                      <SidebarMenuItem key={navItem.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(navItem.url)}
                          data-testid={`nav-${navItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Link href={navItem.url}>
                            <navItem.icon className="h-4 w-4" />
                            <span>{navItem.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
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
            <SidebarMenuButton asChild isActive={isActive("/settings")} data-testid="nav-settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
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
