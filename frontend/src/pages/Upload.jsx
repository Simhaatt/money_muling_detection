/**
 * Upload.jsx — CSV File Upload Page
 * ====================================
 * Homepage of the application. Provides a drag-and-drop / file-picker
 * interface for uploading transaction CSV files.
 *
 * This file lives in pages/ — designed to receive Lovable-generated UI.
 *
 * Responsibilities:
 *   • Accept .csv files from the user
 *   • POST the file to /api/upload
 *   • Show upload progress & validation feedback
 *   • On success, pass detection results up to App via onResults()
 *
 * Located in: frontend/src/pages/Upload.jsx
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
    <section className="page upload">
      <h2>Upload Transaction Data</h2>
      <p>Upload a CSV file containing transaction records (sender_id, receiver_id, amount, timestamp).</p>

      {/* TODO: Replace with Lovable-generated drag-and-drop upload UI */}
      <div className="upload-area">
        <input type="file" accept=".csv" onChange={handleFileChange} />
      </div>

      <button
        className="btn-primary"
        onClick={handleUpload}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : "Upload & Analyse"}
      </button>

      {message && <p className="upload-message">{message}</p>}
    </section>
  );
}

export default Upload;
