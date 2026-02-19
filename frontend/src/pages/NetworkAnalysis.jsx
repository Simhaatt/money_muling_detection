import React from "react";
import GraphView from "../components/GraphView";

function NetworkAnalysis({ graphData, loading = false, error = "" }) {
  const hasGraph = Array.isArray(graphData?.nodes) && Array.isArray(graphData?.links);

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Network Analysis</h2>
        <p className="mt-1 text-sm text-slate-500">
          Graph view sourced from /api/graph after upload pipeline completion.
        </p>
      </header>

      {!hasGraph && !loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div
            id="graph-container"
            className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center"
          >
            <p className="max-w-lg text-sm text-slate-500">
              No graph data available yet. Upload a CSV on the Upload Data page to populate /api/graph.
            </p>
          </div>
        </section>
      ) : (
        <GraphView results={graphData} loading={loading} error={error} />
      )}
    </section>
  );
}

export default NetworkAnalysis;
