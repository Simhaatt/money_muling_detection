/**
 * SuspiciousAccountsTable.jsx — Suspicious Accounts with Explanations
 * =====================================================================
 * Displays all flagged accounts with full details.
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

function getTier(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function getTierColor(tier) {
  switch (tier) {
    case "CRITICAL":
      return "#ef4444";
    case "HIGH":
      return "#f97316";
    case "MEDIUM":
      return "#eab308";
    default:
      return "#22c55e";
  }
}

function SuspiciousAccountsTable({ suspiciousAccounts }) {
  if (!suspiciousAccounts || suspiciousAccounts.length === 0) {
    return (
      <div style={{ color: "#94a3b8", padding: "20px", textAlign: "center" }}>
        No suspicious accounts detected.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto" }}>
      <table style={tableStyle}>
        <thead style={{ position: "sticky", top: 0, background: "#1e293b" }}>
          <tr>
            <th style={thStyle}>Account ID</th>
            <th style={thStyle}>Suspicion Score</th>
            <th style={thStyle}>Risk Tier</th>
            <th style={thStyle}>Ring ID</th>
            <th style={thStyle}>Detected Patterns</th>
            <th style={thStyle}>Explanation</th>
          </tr>
        </thead>
        <tbody>
          {suspiciousAccounts.map((acc) => {
            const tier = getTier(acc.suspicion_score);
            const tierColor = getTierColor(tier);

            return (
              <tr key={acc.account_id} style={{ background: "rgba(30,41,59,0.3)" }}>
                <td style={tdStyle}>
                  <span style={{ fontWeight: 600 }}>{acc.account_id}</span>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: tierColor,
                      color: "#fff",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {acc.suspicion_score}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: tierColor,
                      color: "#fff",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  >
                    {tier}
                  </span>
                </td>
                <td style={tdStyle}>
                  {acc.ring_id && acc.ring_id !== "NONE" ? (
                    <span
                      style={{
                        background: "#7c3aed",
                        color: "#fff",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      {acc.ring_id}
                    </span>
                  ) : (
                    <span style={{ color: "#64748b" }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {(acc.detected_patterns || []).map((pattern, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#334155",
                          color: "#e2e8f0",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                        }}
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ ...tdStyle, maxWidth: "350px", fontSize: "0.8rem", color: "#94a3b8" }}>
                  {acc.explanation || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default SuspiciousAccountsTable;
