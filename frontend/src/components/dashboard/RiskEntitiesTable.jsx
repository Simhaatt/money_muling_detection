import React, { useMemo, useState } from "react";

const THREAT_BADGE_STYLES = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low: "bg-green-100 text-green-700 border-green-200",
};

const SORTABLE_COLUMNS = {
  accountId: "Account ID",
  riskScore: "Risk Score",
  threatLevel: "Threat Level",
  transactionCount: "Transaction Count",
};

const THREAT_ORDER = { Low: 1, Medium: 2, High: 3, Critical: 4 };

function normalizeThreatLevel(value) {
  const upper = String(value || "LOW").toUpperCase();
  if (upper === "CRITICAL") {
    return "Critical";
  }
  if (upper === "HIGH") {
    return "High";
  }
  if (upper === "MEDIUM") {
    return "Medium";
  }
  return "Low";
}

function SortButton({ column, activeColumn, direction, onSort, children }) {
  const active = activeColumn === column;
  const arrow = !active ? "↕" : direction === "asc" ? "↑" : "↓";

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 rounded px-1 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
    >
      <span>{children}</span>
      <span className="text-slate-400">{arrow}</span>
    </button>
  );
}

function RiskEntitiesTable({ rows }) {
  const [sortBy, setSortBy] = useState("riskScore");
  const [sortDirection, setSortDirection] = useState("desc");

  const sortedRows = useMemo(() => {
    const values = [...rows];
    values.sort((a, b) => {
      let left = a[sortBy];
      let right = b[sortBy];

      if (sortBy === "threatLevel") {
        left = THREAT_ORDER[normalizeThreatLevel(a.threatLevel)] ?? 0;
        right = THREAT_ORDER[normalizeThreatLevel(b.threatLevel)] ?? 0;
      }

      if (typeof left === "string") {
        return sortDirection === "asc" ? left.localeCompare(right) : right.localeCompare(left);
      }

      return sortDirection === "asc" ? left - right : right - left;
    });
    return values;
  }, [rows, sortBy, sortDirection]);

  const handleSort = (column) => {
    if (column === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDirection(column === "accountId" ? "asc" : "desc");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {Object.entries(SORTABLE_COLUMNS).map(([column, label]) => (
                <th key={column} className="px-4 py-3 text-left">
                  <SortButton
                    column={column}
                    activeColumn={sortBy}
                    direction={sortDirection}
                    onSort={handleSort}
                  >
                    {label}
                  </SortButton>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedRows.map((row) => (
              <tr key={row.accountId} className="transition hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">{row.accountId}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.riskScore}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${THREAT_BADGE_STYLES[normalizeThreatLevel(row.threatLevel)]}`}>
                    {normalizeThreatLevel(row.threatLevel)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.transactionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RiskEntitiesTable;
