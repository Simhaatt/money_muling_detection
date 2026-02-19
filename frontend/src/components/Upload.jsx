/**
 * Upload.jsx — CSV File Upload Component
 * ========================================
 * Provides a drag-and-drop / file-picker interface for uploading
 * transaction CSV files to the backend API.
 *
 * Responsibilities:
 *   • Accept .csv files from the user
 *   • POST the file to /api/upload
 *   • Show upload progress & validation feedback
 *   • On success, pass detection results up to the parent via onResults()
 */

import React, { useState } from "react";
import { uploadCSV } from "../services/api";

function Upload({ onResults }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a CSV file first.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      // TODO: Call API and handle response
      const data = await uploadCSV(file);
      setMessage("Upload successful! Running detection pipeline…");
      if (onResults) onResults(data);
    } catch (err) {
      setMessage(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section>
      <h2>Upload Transaction Data</h2>
      <p>Upload a CSV file containing transaction records (sender, receiver, amount, timestamp).</p>

      <div style={{ margin: "1rem 0" }}>
        <input type="file" accept=".csv" onChange={handleFileChange} />
      </div>

      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading…" : "Upload & Analyse"}
      </button>

      {message && <p style={{ marginTop: "0.5rem" }}>{message}</p>}
    </section>
  );
}

export default Upload;
