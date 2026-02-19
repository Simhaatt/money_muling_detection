import React from "react";
import MetricCard from "../components/dashboard/MetricCard";
import RiskEntitiesTable from "../components/dashboard/RiskEntitiesTable";

function Dashboard({ results, summary, loading = false, error = "" }) {
  const suspiciousAccounts = Array.isArray(results?.suspicious_accounts)
    ? results.suspicious_accounts
    : [];
  const totalAccounts = summary?.total_accounts ?? summary?.total_accounts_analyzed ?? 0;
  const flaggedAccounts = summary?.flagged_accounts ?? summary?.suspicious_accounts_flagged ?? suspiciousAccounts.length;
  const fraudRingsDetected = summary?.fraud_rings_detected ?? 0;
  const totalTransactions = summary?.total_transactions ?? 0;

  const dashboardMetrics = [
    { key: "accounts", label: "Total Accounts Analyzed", value: totalAccounts.toLocaleString(), delta: "Live", tone: "neutral" },
    { key: "suspicious", label: "Suspicious Accounts", value: flaggedAccounts.toLocaleString(), delta: "Live", tone: "alert" },
    { key: "rings", label: "Fraud Rings Detected", value: fraudRingsDetected.toLocaleString(), delta: "Live", tone: "alert" },
    { key: "transactions", label: "Total Transactions", value: totalTransactions.toLocaleString(), delta: "Live", tone: "neutral" },
  ];

  const riskEntities = suspiciousAccounts.map((account) => ({
    accountId: account.account_id,
    riskScore: Number(account.risk_score ?? account.suspicion_score ?? 0),
    threatLevel: String(account.risk_tier || "Low"),
    transactionCount: Number(account.transaction_count ?? account.tx_count ?? 0),
  }));

  return (
    <section className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Operational overview of account activity and risk signals.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              delta={metric.delta}
              tone={metric.tone}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Transaction Network Intelligence</h3>
          <p className="mt-1 text-sm text-slate-500">
            Network visualization will be integrated in this container during the next phase.
          </p>
        </header>

        <div
          id="graph-container"
          className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center"
        >
          <p className="max-w-lg text-sm text-slate-500">
            Graph placeholder: transaction network visualization area reserved for future rendering integration.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">High Risk Entities</h3>
          <p className="mt-1 text-sm text-slate-500">Loaded from /api/results and sortable for investigator review.</p>
        </div>
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-card">
            Loading risk entities...
          </div>
        ) : (
          <RiskEntitiesTable rows={riskEntities} />
        )}
      </section>
    </section>
  );
}

export default Dashboard;
