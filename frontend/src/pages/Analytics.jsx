import React from "react";
import AnalyticsPanel from "../components/analytics/AnalyticsPanel";

function Analytics() {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Risk Analytics</h2>
        <p className="mt-1 text-sm text-slate-500">
          Investigation-focused analytics placeholders for future chart integrations.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <AnalyticsPanel
          title="Risk Distribution"
          description="Segmented distribution of entities by threat category."
        />
        <AnalyticsPanel
          title="Fraud Ring Analysis"
          description="Cluster-level insights for related high-risk entities."
        />
        <AnalyticsPanel
          title="Suspicious Activity Trends"
          description="Trendline for abnormal movement and escalation over time."
        />
      </div>
    </section>
  );
}

export default Analytics;
