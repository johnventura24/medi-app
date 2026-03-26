import { ZipRankingTable } from "../ZipRankingTable";
import { zipData } from "@/data/mockData";

export default function ZipRankingTableExample() {
  return (
    <div className="p-6">
      <ZipRankingTable
        data={zipData}
        onZipClick={(zip) => console.log("Clicked ZIP:", zip)}
      />
    </div>
  );
}
