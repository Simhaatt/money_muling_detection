import React, { useState } from "react";
const STATUS_STYLES = {
  idle: "bg-slate-100 text-slate-700",
  uploading: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

function Upload({ onUpload, uploading = false, error = "" }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const onFileSelected = (selected) => {
    if (!selected) {
      return;
    }
    setFile(selected);
    setStatus("idle");
  };

  const handleFileChange = (event) => onFileSelected(event.target.files?.[0]);

  const handleDrop = (event) => {
    event.preventDefault();
    onFileSelected(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus("error");
      setMessage("Please select a CSV file before uploading.");
      return;
    }

    setStatus("uploading");
    setMessage("Uploading file and triggering fraud detection pipeline...");

    if (!onUpload) {
      setStatus("error");
      setMessage("Upload handler is not configured.");
      return;
    }

    const response = await onUpload(file);
    if (response?.ok) {
      setStatus("success");
      setMessage("Upload complete. Results, summary, and graph were refreshed.");
    } else {
      setStatus("error");
      setMessage(response?.message || "Upload failed.");
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Upload Data</h2>
        <p className="mt-1 text-sm text-slate-500">
          Drag and drop a CSV file to stage data ingestion for the next analysis run.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-56 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-green-400 hover:bg-green-50/40"
        >
          <p className="text-sm font-medium text-slate-700">Drop CSV file here</p>
          <p className="mt-1 text-xs text-slate-500">or choose a local file manually</p>
          <label
            htmlFor="csv-input"
            className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          >
            Select CSV File
          </label>
          <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {file ? `Selected file: ${file.name}` : "No file selected"}
          </div>

          <div className="flex items-center gap-3">
            <span className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
              {status}
            </span>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {message || error}
          </div>
        )}
      </div>
    </section>
  );
}

export default Upload;
