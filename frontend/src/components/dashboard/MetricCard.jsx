import React from "react";

function MetricCard({ label, value, delta, tone = "neutral" }) {
  const toneStyles = {
    neutral: "border-slate-200 text-slate-500",
    alert: "border-green-200 text-green-700",
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className={`mt-3 inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${toneStyles[tone]}`}>
        {delta}
      </div>
    </article>
  );
}

export default MetricCard;
