import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Building,
  Hash,
  Shield,
  Search,
  Star,
  Trash2,
  Play,
  Eye,
  LogOut,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface SavedSearch {
  id: number;
  name: string;
  criteria: Record<string, string>;
  createdAt: string;
}

interface FavoritePlan {
  planId: string;
  planName: string;
  carrier: string;
  addedAt: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ProfileContent() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: savedSearches = [], isLoading: searchesLoading } = useQuery<SavedSearch[]>({
    queryKey: ["/api/saved-searches"],
    enabled: !!user,
  });

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery<FavoritePlan[]>({
    queryKey: ["/api/favorites"],
    enabled: !!user,
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete saved search");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/favorites/${planId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove favorite");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  function runSearch(criteria: Record<string, string>) {
    const params = new URLSearchParams(criteria).toString();
    navigate(`/find?${params}`);
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <PageHeader
        title="My Profile"
        description="Your account, saved searches, and favorite plans."
        helpText="View and update your account details, saved searches, and favorite plans."
      />
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl">{user.fullName}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {user.email}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge variant="secondary" className="capitalize">
                {user.role}
              </Badge>
            </div>
            {user.organization && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Organization:</span>
                <span className="text-sm font-medium">{user.organization}</span>
              </div>
            )}
            {user.npn && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">NPN:</span>
                <span className="text-sm font-medium">{user.npn}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saved Searches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Saved Searches
          </CardTitle>
          <CardDescription>Your saved search criteria</CardDescription>
        </CardHeader>
        <CardContent>
          {searchesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : savedSearches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No saved searches yet. Search for plans and save your criteria to see them here.
            </p>
          ) : (
            <div className="space-y-3">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{search.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Object.entries(search.criteria)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" | ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runSearch(search.criteria)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSearchMutation.mutate(search.id)}
                      disabled={deleteSearchMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Favorite Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Favorite Plans
          </CardTitle>
          <CardDescription>Plans you have marked as favorites</CardDescription>
        </CardHeader>
        <CardContent>
          {favoritesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No favorite plans yet. Browse plans and mark your favorites to see them here.
            </p>
          ) : (
            <div className="space-y-3">
              {favorites.map((fav) => (
                <div
                  key={fav.planId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{fav.planName}</p>
                    <p className="text-xs text-muted-foreground">{fav.carrier}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/plans?planId=${fav.planId}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFavoriteMutation.mutate(fav.planId)}
                      disabled={removeFavoriteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
