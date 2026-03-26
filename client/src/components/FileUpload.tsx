import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface UploadResult {
  success: boolean;
  message: string;
  stats?: {
    planCount: number;
    stateCount: number;
    fileName: string;
  };
  error?: string;
}

export function FileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsb') && !file.name.endsWith('.xlsx')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an XLSB or XLSX Excel file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      setUploadProgress(30);

      const response = await fetch('/api/upload-xlsb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: buffer,
      });

      setUploadProgress(80);

      const data = await response.json();
      setUploadProgress(100);

      if (response.ok && data.success) {
        setResult(data);
        toast({
          title: "Import successful",
          description: `Imported ${data.stats?.planCount?.toLocaleString() || 0} plans from ${data.stats?.stateCount || 0} states`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setResult({ success: false, message: data.error || "Upload failed" });
        toast({
          title: "Import failed",
          description: data.error || "Failed to process the file",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message });
      toast({
        title: "Upload error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import Medicare Benefits Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload an XLSB or XLSX file containing CMS Medicare Advantage benefits data. 
          The file should have a "SUMM" sheet with plan information.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsb,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-upload"
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full"
          variant="outline"
          data-testid="button-upload-file"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Select XLSB File
            </>
          )}
        </Button>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} />
            <p className="text-xs text-muted-foreground text-center">
              {uploadProgress < 30 && "Reading file..."}
              {uploadProgress >= 30 && uploadProgress < 80 && "Processing data (this may take a few minutes)..."}
              {uploadProgress >= 80 && "Finalizing import..."}
            </p>
          </div>
        )}

        {result && (
          <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                {result.message}
              </span>
            </div>
            {result.stats && (
              <div className="mt-2 text-sm text-muted-foreground">
                <p>Plans imported: {result.stats.planCount?.toLocaleString()}</p>
                <p>States covered: {result.stats.stateCount}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
