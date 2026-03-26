import { useState } from "react";
import { FilterPanel, type FilterState, defaultFilters } from "../FilterPanel";

export default function FilterPanelExample() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  return (
    <div className="p-6 max-w-sm">
      <FilterPanel
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          console.log("Filters applied:", newFilters);
        }}
      />
    </div>
  );
}
