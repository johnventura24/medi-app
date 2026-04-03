import { useState } from "react";
import { useLocation } from "wouter";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileCheck,
  AlertTriangle,
  Clock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSOA, type SOARecord } from "@/hooks/useRecommendations";
import { PageHeader } from "@/components/PageHeader";

function formatDate(dateStr?: string): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getExpiryInfo(expiresAt?: string): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: "--", urgent: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: "Expired", urgent: false };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const urgent = hours < 24;
  if (hours > 24) return { text: `${Math.floor(hours / 24)}d ${hours % 24}h`, urgent };
  return { text: `${hours}h ${mins}m`, urgent: true };
}

function SOADashboardContent() {
  const [, navigate] = useLocation();
  const { soas, isLoading } = useSOA();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

  const activeSoas = soas.filter((s) => s.status === "active");
  const expiredSoas = soas.filter((s) => s.status === "expired");
  const expiringSoon = activeSoas.filter((s) => {
    if (!s.expiresAt) return false;
    const diff = new Date(s.expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  });

  const filteredSoas =
    statusFilter === "all"
      ? soas
      : soas.filter((s) => s.status === statusFilter);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Scope of Appointments"
        description="Track SOA compliance. Never miss an expiration."
        helpText="Telephonic SOAs expire 48 hours after signing. The alert banner warns you when SOAs are about to expire."
        dataSource="Data: SOA records created and tracked within this platform. Telephonic SOAs expire 48 hours after signing per CMS Medicare Communications and Marketing Guidelines (MCMG)."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Active"
          value={activeSoas.length}
          icon={<ShieldCheck className="h-5 w-5 text-green-500" />}
        />
        <StatCard
          label="Expiring Soon (24h)"
          value={expiringSoon.length}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
        />
        <StatCard
          label="Expired"
          value={expiredSoas.length}
          icon={<XCircle className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <Alert className="bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {expiringSoon.length} SOA{expiringSoon.length > 1 ? "s" : ""} expiring within 24 hours.
            Review and take action before they expire.
          </AlertDescription>
        </Alert>
      )}

      {/* Filter */}
      <div className="flex gap-1">
        {(["all", "active", "expired"] as const).map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
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
                    <TableHead>Client Name</TableHead>
                    <TableHead>SOA Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Plan Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSoas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No SOAs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSoas.map((soa: SOARecord) => {
                      const expiry = getExpiryInfo(soa.expiresAt);
                      return (
                        <TableRow
                          key={soa.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            soa.status === "expired" && "opacity-60"
                          )}
                          onClick={() => navigate(`/clients/${soa.clientId}`)}
                        >
                          <TableCell className="font-medium">
                            {soa.clientName ?? soa.beneficiaryName}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(soa.soaDate)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                soa.contactMethod === "Telephonic"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                  : soa.contactMethod === "Online"
                                  ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                              )}
                            >
                              {soa.contactMethod}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(soa.planTypes ?? []).map((pt) => (
                                <Badge key={pt} variant="outline" className="text-[10px] py-0">
                                  {pt}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs capitalize",
                                soa.status === "active"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {soa.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {soa.expiresAt ? (
                              <span
                                className={cn(
                                  "text-sm",
                                  expiry.urgent
                                    ? "text-amber-600 dark:text-amber-400 font-medium"
                                    : "text-muted-foreground"
                                )}
                              >
                                {expiry.text}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">--</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SOADashboard() {
  return (
    <AuthGuard roles={["agent", "admin", "compliance"]}>
      <SOADashboardContent />
    </AuthGuard>
  );
}
