import { FileUpload } from "@/components/FileUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Database, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Import data and manage application settings."
        helpText="Import CMS data files, manage API keys, and configure application preferences. Data imports refresh the plan database with the latest CMS PBP files."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FileUpload />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Current Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The dashboard is currently using imported Medicare Advantage data.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Data Source</span>
                <span className="font-medium">CMS MA Benefits Report</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">File Format</span>
                <span className="font-medium">XLSB (Excel Binary)</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Required Sheet</span>
                <span className="font-medium">SUMM</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a new file to replace the current data. The file will be processed 
              server-side and may take several minutes for large datasets.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
