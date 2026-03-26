import { TargetingRecommendations } from "../TargetingRecommendations";
import { targetingRecommendations } from "@/data/mockData";

export default function TargetingRecommendationsExample() {
  return (
    <div className="p-6">
      <TargetingRecommendations
        recommendations={targetingRecommendations.slice(0, 4)}
        onExport={(rec) => console.log("Export:", rec.location)}
        onShare={(rec) => console.log("Share:", rec.location)}
      />
    </div>
  );
}
