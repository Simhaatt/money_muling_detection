/**
 * Upload.jsx — CSV Upload Page
 * ==============================
 * Landing page with file upload for CSV transaction data.
 */

import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../services/api";

function Upload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are accepted");
      return;
    }
    setError("");
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const result = await uploadFile(file);
      if (onUploadSuccess) onUploadSuccess(result);
      navigate("/results");
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Upload failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#e2e8f0",
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          marginBottom: "12px",
          background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textAlign: "center",
        }}
      >
        Money Muling Detection Engine
      </h1>

      <p
        style={{
          fontSize: "1.1rem",
          color: "#94a3b8",
          marginBottom: "40px",
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        Upload transaction CSV file to detect fraud rings
      </p>

      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          width: "100%",
          maxWidth: "500px",
          border: `2px dashed ${dragOver ? "#3b82f6" : file ? "#22c55e" : "#475569"}`,
          borderRadius: "16px",
          padding: "60px 40px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "rgba(59,130,246,0.1)" : "rgba(30,41,59,0.6)",
          transition: "all 0.2s",
          marginBottom: "20px",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e.target.files[0])}
        />

        {file ? (
          <>
            <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📄</div>
            <p style={{ fontWeight: 600, fontSize: "1.1rem", color: "#22c55e" }}>
              {file.name}
            </p>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "5px" }}>
              {(file.size / 1024).toFixed(1)} KB — Ready to upload
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📂</div>
            <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>
              Drag & drop CSV here
            </p>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "8px" }}>
              or click to browse files
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#f87171",
            padding: "12px 20px",
            borderRadius: "8px",
            marginBottom: "20px",
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          background: !file || loading ? "#475569" : "linear-gradient(90deg, #3b82f6, #06b6d4)",
          color: "#fff",
          border: "none",
          padding: "16px 48px",
          borderRadius: "10px",
          fontSize: "1.1rem",
          fontWeight: 600,
          cursor: !file || loading ? "not-allowed" : "pointer",
          opacity: !file || loading ? 0.6 : 1,
          transition: "all 0.2s",
          minWidth: "200px",
        }}
      >
        {loading ? "Analyzing..." : "Upload"}
      </button>

      {/* Format Hint */}
      <div
        style={{
          marginTop: "50px",
          background: "rgba(30,41,59,0.8)",
          borderRadius: "12px",
          padding: "20px 30px",
          maxWidth: "500px",
          width: "100%",
          border: "1px solid #334155",
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem" }}>
          Required CSV Columns:
        </p>
        <code
          style={{
            display: "block",
            background: "#0f172a",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            color: "#67e8f9",
            overflowX: "auto",
          }}
        >
          transaction_id, sender_id, receiver_id, amount, timestamp
        </code>
      </div>
    </div>
  );
}

export default Upload;
