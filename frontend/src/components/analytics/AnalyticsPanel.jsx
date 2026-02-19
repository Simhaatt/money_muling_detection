import React from "react";

function AnalyticsPanel({ title, description }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </header>
      <div className="h-56 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-400">
        Chart placeholder — reserved for future integration
      </div>
    </section>
  );
}

export default AnalyticsPanel;
