import { StatCard } from "../StatCard";
import { Heart, DollarSign, MapPin, Users } from "lucide-react";

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 p-6">
      <StatCard
        label="Total Plans Available"
        value={2847}
        trend={12}
        trendLabel="vs last year"
        icon={<Heart className="h-5 w-5 text-muted-foreground" />}
      />
      <StatCard
        label="Avg Dental Allowance"
        prefix="$"
        value={3100}
        trend={8}
        trendLabel="vs national avg"
        icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
      />
      <StatCard
        label="States Analyzed"
        value={50}
        icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
      />
      <StatCard
        label="ZIP Codes Covered"
        value="41,692"
        trend={-2}
        trendLabel="coverage gap"
        icon={<Users className="h-5 w-5 text-muted-foreground" />}
      />
    </div>
  );
}
