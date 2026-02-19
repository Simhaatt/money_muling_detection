/**
 * Results.jsx — Detection Results Page
 * ======================================
 * Displays all detection results in 4 sections:
 * 1. Interactive Graph Visualization
 * 2. Download JSON Button
 * 3. Fraud Ring Summary Table
 * 4. Suspicious Accounts Table with Explanations
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import GraphView from "../components/GraphView";
import RingSummaryTable from "../components/RingSummaryTable";
import SuspiciousAccountsTable from "../components/SuspiciousAccountsTable";

function Results({ results }) {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Redirect to upload if no results
  if (!results) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#e2e8f0",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
          No results available. Please upload a CSV file first.
        </p>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            padding: "12px 30px",
            borderRadius: "8px",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Go to Upload
        </button>
      </div>
    );
  }

  const { suspicious_accounts, fraud_rings, summary, graph_json } = results;

  // Download JSON handler
  const handleDownload = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fraud_detection_results.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Node click handler
  const handleNodeClick = (nodeId, account) => {
    setSelectedNode(nodeId);
    setSelectedAccount(account);
  };

  // Risk tier helper
  const getTier = (score) => {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        padding: "30px 40px",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#e2e8f0",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <h1 style={{ fontSize: "1.8rem", fontWeight: 700, margin: 0 }}>
          Detection Results
        </h1>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#334155",
            color: "#e2e8f0",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          New Analysis
        </button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "30px",
        }}
      >
        <SummaryCard
          label="Total Accounts"
          value={summary?.total_accounts_analyzed || 0}
        />
        <SummaryCard
          label="Suspicious Flagged"
          value={summary?.suspicious_accounts_flagged || 0}
          color="#ef4444"
        />
        <SummaryCard
          label="Fraud Rings"
          value={summary?.fraud_rings_detected || 0}
          color="#a855f7"
        />
        <SummaryCard
          label="Processing Time"
          value={`${summary?.processing_time_seconds || 0}s`}
        />
      </div>

      {/* SECTION 1: Interactive Graph */}
      <Section title="Interactive Transaction Graph">
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 700px" }}>
            <GraphView
              graphData={graph_json}
              suspiciousAccounts={suspicious_accounts}
              fraudRings={fraud_rings}
              onNodeClick={handleNodeClick}
            />
          </div>

          {/* Node Detail Panel */}
          {selectedNode && (
            <div
              style={{
                flex: "0 0 320px",
                background: "#1e293b",
                borderRadius: "12px",
                border: "1px solid #334155",
                padding: "20px",
                maxHeight: "600px",
                overflowY: "auto",
              }}
            >
              <h3 style={{ margin: "0 0 15px 0", fontSize: "1.1rem" }}>
                Node Details
              </h3>
              <DetailRow label="Account ID" value={selectedNode} />
              {selectedAccount ? (
                <>
                  <DetailRow
                    label="Suspicion Score"
                    value={selectedAccount.suspicion_score}
                    color={
                      selectedAccount.suspicion_score >= 80
                        ? "#ef4444"
                        : selectedAccount.suspicion_score >= 60
                        ? "#f97316"
                        : "#eab308"
                    }
                  />
                  <DetailRow
                    label="Risk Tier"
                    value={getTier(selectedAccount.suspicion_score)}
                  />
                  <DetailRow
                    label="Ring ID"
                    value={selectedAccount.ring_id || "NONE"}
                  />
                  <DetailRow
                    label="Detected Patterns"
                    value={
                      (selectedAccount.detected_patterns || []).join(", ") || "—"
                    }
                  />
                  <div style={{ marginTop: "15px" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Explanation
                    </span>
                    <p
                      style={{
                        marginTop: "6px",
                        fontSize: "0.85rem",
                        color: "#cbd5e1",
                        lineHeight: 1.5,
                      }}
                    >
                      {selectedAccount.explanation || "No explanation available."}
                    </p>
                  </div>
                </>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                  This account is not flagged as suspicious.
                </p>
              )}
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setSelectedAccount(null);
                }}
                style={{
                  marginTop: "20px",
                  background: "#334155",
                  color: "#e2e8f0",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  width: "100%",
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* SECTION 2: Download JSON Button */}
      <Section title="Export Results">
        <button
          onClick={handleDownload}
          style={{
            background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
            color: "#fff",
            border: "none",
            padding: "14px 30px",
            borderRadius: "10px",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>⬇️</span>
          Download JSON Output
        </button>
      </Section>

      {/* SECTION 3: Fraud Ring Summary Table */}
      <Section title={`Fraud Ring Summary (${fraud_rings?.length || 0} rings)`}>
        <RingSummaryTable fraudRings={fraud_rings} />
      </Section>

      {/* SECTION 4: Suspicious Accounts Table */}
      <Section
        title={`Suspicious Accounts (${suspicious_accounts?.length || 0} flagged)`}
      >
        <SuspiciousAccountsTable suspiciousAccounts={suspicious_accounts} />
      </Section>
    </div>
  );
}

// Summary Card Component
function SummaryCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "12px",
        padding: "20px 24px",
        border: "1px solid #334155",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          color: "#94a3b8",
          marginBottom: "6px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.8rem",
          fontWeight: 700,
          color: color || "#e2e8f0",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Section Component
function Section({ title, children }) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "12px",
        padding: "24px",
        border: "1px solid #334155",
        marginBottom: "24px",
      }}
    >
      <h2
        style={{
          fontSize: "1.2rem",
          fontWeight: 600,
          marginBottom: "20px",
          color: "#e2e8f0",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// Detail Row Component
function DetailRow({ label, value, color }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <span
        style={{
          fontSize: "0.75rem",
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      <div
        style={{
          marginTop: "4px",
          fontSize: "0.95rem",
          color: color || "#e2e8f0",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default Results;
