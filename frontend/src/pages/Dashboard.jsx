/**
 * Dashboard.jsx — Detection Results Dashboard (Page)
 * =====================================================
 * Main overview page showing key metrics, flagged accounts, and fraud rings.
 *
 * Sections:
 *   • Summary cards  — total accounts, transactions, flagged, critical, rings
 *   • Risk distribution chart (Recharts bar/pie)
 *   • Top flagged accounts table with risk scores & tiers
 *   • Fraud rings table with members and ring IDs
 *
 * This file lives in pages/ — designed to receive Lovable-generated UI.
 * Data flows in via the `results` prop from App.jsx.
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

  const { summary, suspicious_accounts, fraud_rings } = results;

  return (
    <section className="page dashboard">
      <h2>Dashboard</h2>

      {/* ----- Summary Cards ----- */}
      <div className="summary-cards">
        <div className="card">
          <h3>{summary?.total_accounts ?? "—"}</h3>
          <p>Total Accounts</p>
        </div>
        <div className="card">
          <h3>{summary?.total_transactions ?? "—"}</h3>
          <p>Total Transactions</p>
        </div>
        <div className="card">
          <h3>{summary?.flagged_accounts ?? "—"}</h3>
          <p>Flagged Accounts</p>
        </div>
        <div className="card">
          <h3>{summary?.critical_accounts ?? "—"}</h3>
          <p>Critical Accounts</p>
        </div>
        <div className="card">
          <h3>{summary?.fraud_rings_detected ?? "—"}</h3>
          <p>Fraud Rings</p>
        </div>
      </div>

      {/* ----- Flagged Accounts Table ----- */}
      {/* TODO: Replace with Lovable-generated styled table + Recharts chart */}
      <h3>Flagged Accounts</h3>
      <p>Detailed risk score table will appear here after analysis.</p>

      {/* ----- Fraud Rings Table ----- */}
      {/* TODO: Display fraud ring memberships */}
      <h3>Detected Fraud Rings</h3>
      <p>Fraud ring membership table will appear here after analysis.</p>
    </section>
  );
}

export default Dashboard;
