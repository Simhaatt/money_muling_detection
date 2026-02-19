/**
 * RingSummaryTable.jsx — Fraud Ring Summary Table
 * =================================================
 * Displays all detected fraud rings.
 */

import React from "react";

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.85rem",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 16px",
  borderBottom: "2px solid #334155",
  color: "#94a3b8",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #1e293b",
  verticalAlign: "top",
  color: "#e2e8f0",
};

function RingSummaryTable({ fraudRings }) {
  if (!fraudRings || fraudRings.length === 0) {
    return (
      <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
        No fraud rings detected.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Ring ID</th>
            <th style={thStyle}>Pattern Type</th>
            <th style={thStyle}>Member Count</th>
            <th style={thStyle}>Risk Score</th>
            <th style={thStyle}>Member Account IDs</th>
          </tr>
        </thead>
        <tbody>
          {fraudRings.map((ring) => (
            <tr key={ring.ring_id} style={{ background: "rgba(30,41,59,0.3)" }}>
              <td style={tdStyle}>
                <span
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {ring.ring_id}
                </span>
              </td>
              <td style={tdStyle}>
                <span
                  style={{
                    background: ring.pattern_type === "cycle" ? "#0ea5e9" : "#8b5cf6",
                    color: "#fff",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                  }}
                >
                  {ring.pattern_type}
                </span>
              </td>
              <td style={tdStyle}>{ring.member_accounts?.length || 0}</td>
              <td style={tdStyle}>
                <span
                  style={{
                    background:
                      ring.risk_score >= 80
                        ? "#ef4444"
                        : ring.risk_score >= 60
                        ? "#f97316"
                        : "#eab308",
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: "4px",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {ring.risk_score}
                </span>
              </td>
              <td style={{ ...tdStyle, maxWidth: "400px", wordBreak: "break-all" }}>
                {(ring.member_accounts || []).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RingSummaryTable;
