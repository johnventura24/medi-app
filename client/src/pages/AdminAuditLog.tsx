import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  AlertTriangle,
  Users,
  Download,
  Lock,
  Activity,
  Eye,
  RefreshCw,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: number | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  status: "success" | "failure";
  riskLevel: "low" | "medium" | "high";
}

interface SecuritySummary {
  failedLogins24h: number;
  dataExports7d: number;
  activeSessions: number;
  phiAccessCount24h: number;
  lockedAccounts: number;
  highRiskEvents24h: number;
  lastScanTimestamp: string;
}

interface ActiveSession {
  id: string;
  userId: number;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export default function AdminAuditLog() {
  const { token, user } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securitySummary, setSecuritySummary] = useState<SecuritySummary | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [failedLogins, setFailedLogins] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"logs" | "security" | "sessions" | "exports">("security");

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  async function fetchSecuritySummary() {
    try {
      const res = await fetch("/api/admin/security-summary", { headers });
      if (res.ok) {
        const data = await res.json();
        setSecuritySummary(data);
      }
    } catch (err) {
      // silently handled
    }
  }

  async function fetchAuditLogs() {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (riskFilter) params.set("riskLevel", riskFilter);
      if (userFilter) params.set("userId", userFilter);
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());
      params.set("limit", "100");

      const res = await fetch(`/api/admin/audit-logs?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      // silently handled
    }
  }

  async function fetchActiveSessions() {
    try {
      const res = await fetch("/api/admin/active-sessions", { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (err) {
      // silently handled
    }
  }

  async function fetchFailedLogins() {
    try {
      const res = await fetch("/api/admin/failed-logins?hours=24", { headers });
      if (res.ok) {
        const data = await res.json();
        setFailedLogins(data.logs || []);
      }
    } catch (err) {
      // silently handled
    }
  }

  async function refreshAll() {
    setLoading(true);
    await Promise.all([
      fetchSecuritySummary(),
      fetchAuditLogs(),
      fetchActiveSessions(),
      fetchFailedLogins(),
    ]);
    setLoading(false);
  }

  useEffect(() => {
    if (user?.role === "admin" && token) {
      refreshAll();
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (token && tab === "logs") {
      fetchAuditLogs();
    }
  }, [actionFilter, riskFilter, userFilter, startDate, endDate]);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Admin privileges are required to view audit logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function riskBadge(level: string) {
    switch (level) {
      case "high":
        return <Badge variant="destructive">HIGH</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500 text-white">MEDIUM</Badge>;
      default:
        return <Badge variant="secondary">LOW</Badge>;
    }
  }

  function statusBadge(status: string) {
    return status === "success" ? (
      <Badge className="bg-green-600 text-white">Success</Badge>
    ) : (
      <Badge variant="destructive">Failure</Badge>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Security & Audit Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">SOC2 compliance monitoring and audit trail</p>
        </div>
        <Button onClick={refreshAll} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {[
          { key: "security", label: "Security Overview", icon: Shield },
          { key: "logs", label: "Audit Logs", icon: Eye },
          { key: "sessions", label: "Active Sessions", icon: Users },
          { key: "exports", label: "Failed Logins", icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Security Overview Tab */}
      {tab === "security" && securitySummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed Logins (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{securitySummary.failedLogins24h}</div>
              {securitySummary.failedLogins24h > 10 && (
                <p className="text-sm text-destructive mt-1">Above normal threshold</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Data Exports (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{securitySummary.dataExports7d}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{securitySummary.activeSessions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">PHI Access (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{securitySummary.phiAccessCount24h}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Locked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{securitySummary.lockedAccounts}</div>
              {securitySummary.lockedAccounts > 0 && (
                <p className="text-sm text-destructive mt-1">Accounts require review</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High-Risk Events (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{securitySummary.highRiskEvents24h}</div>
              {securitySummary.highRiskEvents24h > 5 && (
                <p className="text-sm text-destructive mt-1">Elevated risk activity</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Logs Tab */}
      {tab === "logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Actions</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="login_failure">Login Failure</SelectItem>
                    <SelectItem value="register">Register</SelectItem>
                    <SelectItem value="data_export">Data Export</SelectItem>
                    <SelectItem value="client_create">Client Create</SelectItem>
                    <SelectItem value="phi_access">PHI Access</SelectItem>
                    <SelectItem value="password_change">Password Change</SelectItem>
                    <SelectItem value="api_key_create">API Key Create</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Risks</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="User ID"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start date"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End date"
                />
              </div>
            </CardContent>
          </Card>

          {/* Log Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Timestamp</th>
                      <th className="p-3 text-left font-medium">User</th>
                      <th className="p-3 text-left font-medium">Action</th>
                      <th className="p-3 text-left font-medium">Resource</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Risk</th>
                      <th className="p-3 text-left font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">{log.userEmail || "—"}</td>
                        <td className="p-3 font-mono text-xs">{log.action}</td>
                        <td className="p-3">{log.resource}{log.resourceId ? ` #${log.resourceId}` : ""}</td>
                        <td className="p-3">{statusBadge(log.status)}</td>
                        <td className="p-3">{riskBadge(log.riskLevel)}</td>
                        <td className="p-3 font-mono text-xs">{log.ipAddress}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No audit logs found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Sessions Tab */}
      {tab === "sessions" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Active Sessions ({activeSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">User</th>
                    <th className="p-3 text-left font-medium">IP Address</th>
                    <th className="p-3 text-left font-medium">Created</th>
                    <th className="p-3 text-left font-medium">Last Activity</th>
                    <th className="p-3 text-left font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map((session) => (
                    <tr key={session.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">{(session as any).userEmail || `User #${session.userId}`}</td>
                      <td className="p-3 font-mono text-xs">{session.ipAddress}</td>
                      <td className="p-3">{new Date(session.createdAt).toLocaleString()}</td>
                      <td className="p-3">{new Date(session.lastActivityAt).toLocaleString()}</td>
                      <td className="p-3">{new Date(session.expiresAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activeSessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No active sessions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Logins Tab */}
      {tab === "exports" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Failed Login Attempts (Last 24h) — {failedLogins.length} events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Timestamp</th>
                    <th className="p-3 text-left font-medium">Email</th>
                    <th className="p-3 text-left font-medium">Reason</th>
                    <th className="p-3 text-left font-medium">IP Address</th>
                    <th className="p-3 text-left font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {failedLogins.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3">{log.userEmail || "—"}</td>
                      <td className="p-3">{log.details?.reason || "—"}</td>
                      <td className="p-3 font-mono text-xs">{log.ipAddress}</td>
                      <td className="p-3">{riskBadge(log.riskLevel)}</td>
                    </tr>
                  ))}
                  {failedLogins.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No failed login attempts in the last 24 hours.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
