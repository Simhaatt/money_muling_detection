/**
 * Dashboard.jsx — Detection Results Dashboard (Page)
 * =====================================================
 * Main overview page showing key metrics, flagged accounts, and fraud rings.
 *
 * Sections:
 *   • Summary cards  — total accounts, flagged, rings, processing time
 *   • Flagged accounts table with risk scores & detected patterns
 *   • Fraud ring summary table (Ring ID, Pattern, Members, Risk Score)
 *
 * Located in: frontend/src/pages/Dashboard.jsx
 */

import React from "react";

function Dashboard({ results }) {
  if (!results) {
    return (
      <section className="page dashboard">
        <h2>Dashboard</h2>
        <p>
          Welcome to the Money Muling Detection platform. Upload a transaction
          CSV to get started.
        </p>
      </section>
    );
  }

  const { summary, suspicious_accounts = [], fraud_rings = [] } = results;

  return (
    <section className="page dashboard">
      <h2>Dashboard</h2>

      {/* ----- Summary Cards ----- */}
      <div className="summary-cards">
        <div className="card">
          <h3>{summary?.total_accounts_analyzed ?? "—"}</h3>
          <p>Total Accounts</p>
        </div>
        <div className="card">
          <h3>{summary?.suspicious_accounts_flagged ?? "—"}</h3>
          <p>Flagged Accounts</p>
        </div>
        <div className="card">
          <h3>{summary?.fraud_rings_detected ?? "—"}</h3>
          <p>Fraud Rings</p>
        </div>
        <div className="card">
          <h3>{summary?.processing_time_seconds ?? "—"}s</h3>
          <p>Processing Time</p>
        </div>
      </div>

      {/* ----- Flagged Accounts Table ----- */}
      <h3>Flagged Accounts ({suspicious_accounts.length})</h3>
      {suspicious_accounts.length === 0 ? (
        <p className="empty-state">No suspicious accounts detected.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account ID</th>
                <th>Suspicion Score</th>
                <th>Detected Patterns</th>
                <th>Ring ID</th>
              </tr>
            </thead>
            <tbody>
              {suspicious_accounts.map((acct, idx) => (
                <tr key={acct.account_id || idx} className={
                  acct.suspicion_score >= 80 ? "row-critical" :
                  acct.suspicion_score >= 60 ? "row-high" :
                  "row-medium"
                }>
                  <td className="mono">{acct.account_id}</td>
                  <td>
                    <span className="score-badge">
                      {acct.suspicion_score}
                    </span>
                  </td>
                  <td>
                    <div className="pattern-tags">
                      {(acct.detected_patterns || []).map((p) => (
                        <span key={p} className="pattern-tag">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="mono">{acct.ring_id || "NONE"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ----- Fraud Ring Summary Table ----- */}
      <h3>Detected Fraud Rings ({fraud_rings.length})</h3>
      {fraud_rings.length === 0 ? (
        <p className="empty-state">No fraud rings detected.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ring ID</th>
                <th>Pattern Type</th>
                <th>Member Count</th>
                <th>Risk Score</th>
                <th>Member Account IDs</th>
              </tr>
            </thead>
            <tbody>
              {fraud_rings.map((ring, idx) => (
                <tr key={ring.ring_id || idx}>
                  <td className="mono">{ring.ring_id}</td>
                  <td>
                    <span className={`type-badge type-${ring.pattern_type}`}>
                      {ring.pattern_type}
                    </span>
                  </td>
                  <td>{(ring.member_accounts || []).length}</td>
                  <td>
                    <span className="score-badge">{ring.risk_score}</span>
                  </td>
                  <td className="mono members-cell">
                    {(ring.member_accounts || []).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default Dashboard;
