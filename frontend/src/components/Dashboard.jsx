/**
 * Dashboard.jsx — Detection Results Dashboard
 * ==============================================
 * Main overview panel showing key metrics and flagged accounts.
 *
 * Planned sections:
 *   • Summary cards  — total accounts, transactions, flagged, critical
 *   • Risk distribution chart (bar / pie via Recharts)
 *   • Top flagged accounts table with risk scores
 *   • Recent detection activity timeline
 *
 * Data comes from the parent App component via the `results` prop.
 */

import React from "react";

function Dashboard({ results }) {
  if (!results) {
    return (
      <section>
        <h2>Dashboard</h2>
        <p>
          Welcome to the Money Muling Detection platform. Upload a transaction
          CSV to get started.
        </p>
      </section>
    );
  }

  const { summary, risk_scores } = results;

  return (
    <section>
      <h2>Dashboard</h2>

      {/* ----- Summary Cards ----- */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {/* TODO: Style these as proper metric cards */}
        <div style={cardStyle}>
          <h3>{summary?.total_accounts ?? "—"}</h3>
          <p>Total Accounts</p>
        </div>
        <div style={cardStyle}>
          <h3>{summary?.total_transactions ?? "—"}</h3>
          <p>Total Transactions</p>
        </div>
        <div style={cardStyle}>
          <h3>{summary?.flagged_accounts ?? "—"}</h3>
          <p>Flagged Accounts</p>
        </div>
        <div style={cardStyle}>
          <h3>{summary?.critical_accounts ?? "—"}</h3>
          <p>Critical Accounts</p>
        </div>
      </div>

      {/* ----- Risk Scores Table ----- */}
      {/* TODO: Add Recharts visualisation + sortable table */}
      <h3>Flagged Accounts</h3>
      <p>Detailed risk score table will appear here after analysis.</p>
    </section>
  );
}

/** Placeholder card styling */
const cardStyle = {
  padding: "1rem 1.5rem",
  border: "1px solid #ddd",
  borderRadius: "8px",
  minWidth: "140px",
  textAlign: "center",
  background: "#fafafa",
};

export default Dashboard;
