import { useState, useCallback } from "react";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(
    async (scope: string, filters?: Record<string, string>) => {
      setIsExporting(true);
      try {
        const params = new URLSearchParams({ scope });
        if (filters) {
          params.set("filters", JSON.stringify(filters));
        }
        const response = await fetch(`/api/export/csv?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }
        const blob = await response.blob();
        const filename = `${scope}-export-${new Date().toISOString().split("T")[0]}.csv`;
        triggerDownload(blob, filename);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const exportPDF = useCallback(
    async (scope: string, filters?: Record<string, string>, ids?: number[]) => {
      setIsExporting(true);
      try {
        const params = new URLSearchParams({ scope });
        if (filters) {
          params.set("filters", JSON.stringify(filters));
        }
        if (ids && ids.length > 0) {
          params.set("ids", JSON.stringify(ids));
        }
        const response = await fetch(`/api/export/pdf?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }
        const blob = await response.blob();
        const filename = `${scope}-export-${new Date().toISOString().split("T")[0]}.pdf`;
        triggerDownload(blob, filename);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return { exportCSV, exportPDF, isExporting };
}
