/**
 * GraphView.jsx — Interactive Transaction Graph Visualisation
 * =============================================================
 * Renders the transaction network as an interactive force-directed graph.
 *
 * Planned features:
 *   • Nodes coloured by risk tier (green → red gradient)
 *   • Edge thickness proportional to transaction amount
 *   • Click a node to inspect its risk score & connections
 *   • Highlight detected mule clusters / communities
 *   • Zoom, pan, and search capabilities
 *
 * Library candidates:
 *   • react-force-graph-2d / 3d
 *   • D3.js (via custom hooks)
 *   • vis.js / cytoscape.js
 */

import React from "react";

function GraphView({ results }) {
  if (!results || !results.graph_json) {
    return (
      <section>
        <h2>Transaction Graph</h2>
        <p>No data available. Upload a CSV file first to visualise the transaction network.</p>
      </section>
    );
  }

  // TODO: Render interactive graph using results.graph_json
  const { nodes, edges } = results.graph_json;

  return (
    <section>
      <h2>Transaction Graph</h2>
      <p>
        Showing <strong>{nodes.length}</strong> accounts and{" "}
        <strong>{edges.length}</strong> transactions.
      </p>

      {/* TODO: Replace placeholder with interactive graph component */}
      <div
        style={{
          width: "100%",
          height: "500px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9f9f9",
        }}
      >
        <span style={{ color: "#999" }}>[ Interactive graph will render here ]</span>
      </div>
    </section>
  );
}

export default GraphView;
