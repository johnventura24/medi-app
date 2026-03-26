import { useState } from "react";
import { USMapHeatmap } from "../USMapHeatmap";
import { stateData, type BenefitType } from "@/data/mockData";

export default function USMapHeatmapExample() {
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitType>("Dental");

  return (
    <div className="p-6">
      <USMapHeatmap
        data={stateData}
        selectedBenefit={selectedBenefit}
        onBenefitChange={setSelectedBenefit}
        onStateClick={(state) => console.log("Selected state:", state)}
      />
    </div>
  );
}
