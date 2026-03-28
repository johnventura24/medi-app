import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Inbox, Phone, UserCheck, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  zipCode: string;
  county: string | null;
  state: string | null;
  quizAnswers: {
    priority: string;
    seesSpecialist: boolean;
    medications: string;
    wantsExtras: boolean;
  } | null;
  topPlanIds: number[] | null;
  moneyOnTable: number | null;
  assignedAgentId: number | null;
  status: string;
  source: string | null;
  createdAt: string;
  contactedAt: string | null;
}

interface LeadStats {
  newLeads: number;
  contactedToday: number;
  enrolledThisMonth: number;
  conversionRate: number;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  enrolled: "bg-green-100 text-green-800",
  lost: "bg-muted text-muted-foreground",
};

const priorityLabels: Record<string, string> = {
  low_cost: "Low Cost",
  best_dental: "Best Dental",
  best_drugs: "Best Drugs",
  everything: "Everything",
};

export default function LeadDashboard() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Fetch stats
  const { data: stats } = useQuery<LeadStats>({
    queryKey: ["/api/leads/stats"],
    queryFn: async () => {
      const res = await fetch("/api/leads/stats", { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Fetch leads
  const { data: leadsData, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/leads", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/leads?${params}`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  // Update lead status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/stats"] });
      setSelectedLead(null);
      setNotes("");
    },
  });

  const totalPages = leadsData ? Math.ceil(leadsData.total / leadsData.limit) : 1;

  const statCards = [
    { label: "New Leads", value: stats?.newLeads ?? 0, icon: Inbox, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Contacted Today", value: stats?.contactedToday ?? 0, icon: Phone, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Enrolled This Month", value: stats?.enrolledThisMonth ?? 0, icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "Conversion Rate", value: `${stats?.conversionRate ?? 0}%`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const statusTabs = ["all", "new", "contacted", "enrolled", "lost"];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Dashboard</h1>
        <p className="text-muted-foreground">Manage consumer leads from the plan discovery flow</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">ZIP</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-right p-3 font-medium">Money on Table</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">Loading leads...</td>
                  </tr>
                ) : !leadsData?.leads.length ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">No leads found</td>
                  </tr>
                ) : (
                  leadsData.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="p-3 font-medium">
                        {lead.firstName} {lead.lastName}
                      </td>
                      <td className="p-3">
                        <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {lead.phone}
                        </a>
                      </td>
                      <td className="p-3">{lead.zipCode}</td>
                      <td className="p-3">
                        {lead.quizAnswers?.priority ? (
                          <span className="text-xs bg-muted px-2 py-1 rounded-full">
                            {priorityLabels[lead.quizAnswers.priority] || lead.quizAnswers.priority}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-3 text-right font-semibold text-green-600">
                        {lead.moneyOnTable ? `$${lead.moneyOnTable.toLocaleString()}` : "-"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={`${statusColors[lead.status] || ""} capitalize`}>
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          {lead.status === "new" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatus.mutate({ id: lead.id, status: "contacted" })}
                            >
                              Mark Contacted
                            </Button>
                          )}
                          {lead.status === "contacted" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300"
                              onClick={() => updateStatus.mutate({ id: lead.id, status: "enrolled" })}
                            >
                              Mark Enrolled
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, leadsData?.total || 0)} of {leadsData?.total || 0}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedLead.firstName} {selectedLead.lastName}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <a href={`tel:${selectedLead.phone}`} className="text-blue-600 font-medium hover:underline">
                      {selectedLead.phone}
                    </a>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedLead.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ZIP / County</p>
                    <p className="font-medium">{selectedLead.zipCode} &middot; {selectedLead.county}, {selectedLead.state}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={`${statusColors[selectedLead.status] || ""} capitalize`}>
                      {selectedLead.status}
                    </Badge>
                  </div>
                </div>

                {selectedLead.quizAnswers && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Quiz Answers</p>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                      <p><span className="font-medium">Priority:</span> {priorityLabels[selectedLead.quizAnswers.priority] || selectedLead.quizAnswers.priority}</p>
                      <p><span className="font-medium">Sees Specialist:</span> {selectedLead.quizAnswers.seesSpecialist ? "Yes" : "No"}</p>
                      <p><span className="font-medium">Medications:</span> {selectedLead.quizAnswers.medications}</p>
                      <p><span className="font-medium">Wants Extras:</span> {selectedLead.quizAnswers.wantsExtras ? "Yes" : "No"}</p>
                    </div>
                  </div>
                )}

                {selectedLead.moneyOnTable && selectedLead.moneyOnTable > 0 && (
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
                    <p className="text-sm text-green-600 dark:text-green-400">Money on Table</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">${selectedLead.moneyOnTable.toLocaleString()}/year</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium block mb-1">Notes</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this lead..."
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2 flex-wrap">
                {selectedLead.status === "new" && (
                  <Button
                    onClick={() => updateStatus.mutate({ id: selectedLead.id, status: "contacted", notes })}
                    disabled={updateStatus.isPending}
                  >
                    Mark Contacted
                  </Button>
                )}
                {(selectedLead.status === "new" || selectedLead.status === "contacted") && (
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => updateStatus.mutate({ id: selectedLead.id, status: "enrolled", notes })}
                    disabled={updateStatus.isPending}
                  >
                    Mark Enrolled
                  </Button>
                )}
                {selectedLead.status !== "lost" && selectedLead.status !== "enrolled" && (
                  <Button
                    variant="outline"
                    onClick={() => updateStatus.mutate({ id: selectedLead.id, status: "lost", notes })}
                    disabled={updateStatus.isPending}
                  >
                    Mark Lost
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
