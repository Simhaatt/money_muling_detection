/**
 * Summary.jsx — Detection Summary Page
 * =======================================
 * Displays a detailed summary of the latest detection run,
 * including downloadable JSON results.
 *
 * Sections:
 *   • Detection run metadata (timestamp, file processed)
 *   • Score distribution breakdown by tier
 *   • JSON download button for results.json
 *
 * This file lives in pages/ — designed to receive Lovable-generated UI.
 *
 * Located in: frontend/src/pages/Summary.jsx
 */

import React from "react";
import { downloadResults } from "../services/api";

function Summary({ results }) {
  if (!results) {
    return (
      <section className="page summary">
        <h2>Summary</h2>
        <p>No detection results available. Upload a CSV file first.</p>
      </section>
    );
  }

  const { summary } = results;

  const handleDownload = async () => {
    try {
      await downloadResults();
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <section className="page summary">
      <h2>Detection Summary</h2>

      <div className="summary-details">
        <p><strong>Accounts analysed:</strong> {summary?.total_accounts}</p>
        <p><strong>Transactions processed:</strong> {summary?.total_transactions}</p>
        <p><strong>Total volume:</strong> ${summary?.total_volume?.toLocaleString()}</p>
        <p><strong>Flagged accounts:</strong> {summary?.flagged_accounts}</p>
        <p><strong>Critical accounts:</strong> {summary?.critical_accounts}</p>
        <p><strong>Fraud rings detected:</strong> {summary?.fraud_rings_detected}</p>
      </div>

      {/* ----- JSON Download ----- */}
      <button className="btn-primary" onClick={handleDownload}>
        Download results.json
      </button>
    </section>
  );
}

export default Summary;
