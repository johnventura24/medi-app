import { PlanComparison } from "../PlanComparison";
import { planData } from "@/data/mockData";

export default function PlanComparisonExample() {
  return (
    <div className="p-6">
      <PlanComparison plans={planData} />
    </div>
  );
}
