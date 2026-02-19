/**
 * Summary.jsx — Detection Summary Page
 * =======================================
 * Displays a detailed summary of the latest detection run,
 * including downloadable JSON results.
 *
 * Sections:
 *   • Detection run metadata
 *   • Summary statistics
 *   • JSON download button (client-side from cached results)
 *
 * Located in: frontend/src/pages/Summary.jsx
 */

import React from "react";

function Summary({ results }) {
  if (!results) {
    return (
      <section className="page summary">
        <h2>Summary</h2>
        <p>No detection results available. Upload a CSV file first.</p>
      </section>
    );
  }

  const { summary, suspicious_accounts = [], fraud_rings = [] } = results;

  /**
   * Client-side JSON download — builds the exact hackathon output
   * (excluding graph_json which is internal) and triggers a file save.
   */
  const handleDownload = () => {
    const output = {
      suspicious_accounts,
      fraud_rings,
      summary,
    };
    const blob = new Blob(
      [JSON.stringify(output, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "results.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page summary">
      <h2>Detection Summary</h2>

      <div className="summary-details">
        <p><strong>Accounts analysed:</strong> {summary?.total_accounts_analyzed ?? "—"}</p>
        <p><strong>Flagged accounts:</strong> {summary?.suspicious_accounts_flagged ?? "—"}</p>
        <p><strong>Fraud rings detected:</strong> {summary?.fraud_rings_detected ?? "—"}</p>
        <p><strong>Processing time:</strong> {summary?.processing_time_seconds ?? "—"}s</p>
      </div>

      {/* Tier breakdown */}
      {suspicious_accounts.length > 0 && (
        <div className="tier-breakdown">
          <h3>Risk Tier Breakdown</h3>
          <div className="summary-cards">
            <div className="card card-critical">
              <h3>{suspicious_accounts.filter(a => a.suspicion_score >= 80).length}</h3>
              <p>CRITICAL (≥80)</p>
            </div>
            <div className="card card-high">
              <h3>{suspicious_accounts.filter(a => a.suspicion_score >= 60 && a.suspicion_score < 80).length}</h3>
              <p>HIGH (60–79)</p>
            </div>
            <div className="card card-medium">
              <h3>{suspicious_accounts.filter(a => a.suspicion_score >= 40 && a.suspicion_score < 60).length}</h3>
              <p>MEDIUM (40–59)</p>
            </div>
          </div>
        </div>
      )}

      {/* ----- JSON Download ----- */}
      <div style={{ marginTop: "1.5rem" }}>
        <button className="btn-primary" onClick={handleDownload}>
          ⬇ Download results.json
        </button>
      </div>
    </section>
  );
}

export default Summary;
