import { useLocation } from "wouter";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserPlus,
  UserCheck,
  Archive,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, type ClientData } from "@/hooks/useClients";
import { PageHeader } from "@/components/PageHeader";

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Intake", value: "intake" },
  { label: "Plans Reviewed", value: "plans_reviewed" },
  { label: "Enrolled", value: "enrolled" },
  { label: "Archived", value: "archived" },
];

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "intake":
      return "secondary";
    case "plans_reviewed":
      return "default";
    case "enrolled":
      return "default";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "intake":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "plans_reviewed":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "enrolled":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "archived":
      return "bg-muted text-muted-foreground";
    default:
      return "";
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ClientListContent() {
  const [, navigate] = useLocation();
  const {
    clients,
    total,
    totalPages,
    isLoading,
    page,
    setPage,
    status,
    setStatus,
    search,
    setSearch,
  } = useClients();

  const activeCount = clients.filter(
    (c) => c.status === "intake" || c.status === "plans_reviewed"
  ).length;
  const enrolledCount = clients.filter((c) => c.status === "enrolled").length;
  const archivedCount = clients.filter((c) => c.status === "archived").length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="My Clients"
        description="Manage your beneficiary clients. Track intake, recommendations, and enrollment status."
        helpText="Click a client to see their profile, plan recommendations, and compliance records."
        actions={
          <Button onClick={() => navigate("/clients/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Clients"
          value={total}
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={<UserPlus className="h-5 w-5 text-blue-500" />}
        />
        <StatCard
          label="Enrolled"
          value={enrolledCount}
          icon={<UserCheck className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          label="Archived"
          value={archivedCount}
          icon={<Archive className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={status === tab.value ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>ZIP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No clients found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client: ClientData) => (
                      <TableRow
                        key={client.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <TableCell className="font-medium">
                          {client.firstName} {client.lastName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {client.zipCode}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("capitalize text-xs", statusBadgeClass(client.status ?? "intake"))}
                          >
                            {(client.status ?? "intake").replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(client.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clients/${client.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} clients)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientList() {
  return (
    <AuthGuard roles={["agent", "admin", "compliance"]}>
      <ClientListContent />
    </AuthGuard>
  );
}
