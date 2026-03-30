import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditEntry {
  id: number;
  action: string;
  user: string;
  ip: string;
  time: string;
  level: "info" | "warning" | "error";
  details: string;
}

const mockAuditEntries: AuditEntry[] = [
  { id: 1, action: "User login", user: "agent@example.com", ip: "192.168.1.10", time: "2 min ago", level: "info", details: "Successful login from Chrome on macOS" },
  { id: 2, action: "Plan data imported", user: "system", ip: "internal", time: "15 min ago", level: "info", details: "Imported 12,450 plans from CMS data feed" },
  { id: 3, action: "Role changed", user: "admin@example.com", ip: "192.168.1.5", time: "1 hr ago", level: "warning", details: "Changed user mike@agency.com from viewer to agent" },
  { id: 4, action: "API key generated", user: "fmo@example.com", ip: "10.0.0.15", time: "2 hrs ago", level: "info", details: "New API key created for data export integration" },
  { id: 5, action: "User registered", user: "newagent@example.com", ip: "72.45.12.8", time: "3 hrs ago", level: "info", details: "New user self-registered as agent" },
  { id: 6, action: "Data validation completed", user: "system", ip: "internal", time: "4 hrs ago", level: "info", details: "Validation run: 99.2% pass rate, 18 warnings" },
  { id: 7, action: "Export generated", user: "compliance@example.com", ip: "10.0.0.20", time: "5 hrs ago", level: "info", details: "Benefit grid export for FL market" },
  { id: 8, action: "Failed login attempt", user: "unknown@test.com", ip: "203.0.113.50", time: "6 hrs ago", level: "error", details: "3 failed attempts, account not found" },
  { id: 9, action: "Carrier data updated", user: "system", ip: "internal", time: "8 hrs ago", level: "info", details: "Updated carrier network data for Q1 2026" },
  { id: 10, action: "User deactivated", user: "admin@example.com", ip: "192.168.1.5", time: "1 day ago", level: "warning", details: "Deactivated user james@old.com due to inactivity" },
  { id: 11, action: "Bulk plan update", user: "system", ip: "internal", time: "1 day ago", level: "info", details: "Updated premium data for 8,200 plans" },
  { id: 12, action: "Permission denied", user: "viewer@example.com", ip: "192.168.1.22", time: "2 days ago", level: "error", details: "Attempted to access /admin/users without admin role" },
  { id: 13, action: "SOA batch export", user: "fmo@example.com", ip: "10.0.0.15", time: "2 days ago", level: "info", details: "Exported 125 SOA records for compliance audit" },
  { id: 14, action: "System backup", user: "system", ip: "internal", time: "3 days ago", level: "info", details: "Automated daily backup completed successfully" },
  { id: 15, action: "Rate limit exceeded", user: "api-client-3", ip: "198.51.100.12", time: "3 days ago", level: "warning", details: "API rate limit exceeded: 1000 req/hr" },
];

export default function AdminAudit() {
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const filteredEntries = mockAuditEntries.filter((entry) => {
    const matchSearch =
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLevel = levelFilter === "all" || entry.level === levelFilter;
    return matchSearch && matchLevel;
  });

  const levelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const levelBadgeClass = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "warning":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="h-8 w-8" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Track all platform activity, user actions, and system events.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex gap-3"
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, users, details..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Audit Log Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4"
      >
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium w-8"></th>
                    <th className="text-left py-3 px-4 font-medium">Action</th>
                    <th className="text-left py-3 px-4 font-medium">User</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">IP</th>
                    <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Details</th>
                    <th className="text-left py-3 px-4 font-medium">Level</th>
                    <th className="text-right py-3 px-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-muted/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4">{levelIcon(entry.level)}</td>
                      <td className="py-3 px-4 font-medium">{entry.action}</td>
                      <td className="py-3 px-4 text-muted-foreground">{entry.user}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell font-mono text-xs">
                        {entry.ip}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell max-w-[300px] truncate">
                        {entry.details}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className={`text-xs capitalize ${levelBadgeClass(entry.level)}`}>
                          {entry.level}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {entry.time}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEntries.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No audit entries match your search.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
