import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, FileText, ArrowRight, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/services/api";

const UploadPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Store the file for the processing page to upload
      sessionStorage.setItem("pendingFile", file.name);
      // We need to pass the actual File object — use a global
      (window as any).__pendingUploadFile = file;
      navigate("/processing");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Upload Transaction Data</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file containing transaction records for graph analysis.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`card-forensic flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            isDragging
              ? "border-primary bg-accent"
              : "border-border hover:border-primary/40"
          }`}
        >
          {!file ? (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                <Upload className="h-6 w-6 text-accent-foreground" />
              </div>
              <p className="mb-1 text-sm font-medium text-foreground">
                Drag & drop your CSV file here
              </p>
              <p className="mb-4 text-xs text-muted-foreground">or click to browse files</p>
              <label>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleInputChange}
                />
                <span className="cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                  Browse Files
                </span>
              </label>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex w-full flex-col items-center"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                <FileText className="h-6 w-6 text-accent-foreground" />
              </div>
              <div className="mb-1 flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <button
                  onClick={() => { setFile(null); setError(null); }}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </motion.div>
          )}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        {file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex justify-center"
          >
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={uploading}
              className="gradient-primary border-0 px-8 text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading & Analyzing...
                </>
              ) : (
                <>
                  Analyze Transactions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default UploadPage;
