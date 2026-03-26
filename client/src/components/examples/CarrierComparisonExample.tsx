import { CarrierComparison } from "../CarrierComparison";
import { carrierData } from "@/data/mockData";

export default function CarrierComparisonExample() {
  return (
    <div className="p-6">
      <CarrierComparison carriers={carrierData} />
    </div>
  );
}
