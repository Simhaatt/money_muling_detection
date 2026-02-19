/**
 * GraphView.jsx — Interactive Transaction Graph Visualisation
 * =============================================================
 * Renders the transaction network as an interactive force-directed graph.
 *
 * This component stays in components/ (not pages/) because it is a
 * self-contained visualisation widget that may be embedded in multiple pages.
 *
 * Planned features:
 *   • Nodes coloured by risk tier (green → red gradient)
 *   • Edge thickness proportional to transaction amount
 *   • Click a node to inspect its risk score & connections
 *   • Highlight detected mule clusters / communities
 *   • Fraud accounts highlighted in RED
 *
 * Library: react-force-graph-2d
 *
 * Located in: frontend/src/components/GraphView.jsx
 */

import React from "react";

function GraphView({ results }) {
  if (!results || !results.graph_json) {
    return (
      <section className="page">
        <h2>Transaction Graph</h2>
        <p>No data available. Upload a CSV file first to visualise the transaction network.</p>
      </section>
    );
  }

  const { nodes, links } = results.graph_json;

  return (
    <section className="page">
      <h2>Transaction Graph</h2>
      <p>
        Showing <strong>{nodes.length}</strong> accounts and{" "}
        <strong>{links.length}</strong> transactions.
      </p>

      {/* TODO: Replace placeholder with react-force-graph-2d component */}
      {/* Fraud nodes should be coloured RED, normal nodes GREEN */}
      <div className="graph-container">
        <span className="graph-placeholder">[ Interactive graph will render here ]</span>
      </div>
    </section>
  );
}

export default GraphView;
