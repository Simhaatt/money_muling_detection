/**
 * GraphView.jsx — Interactive Cytoscape.js Graph Visualization
 * ==============================================================
 * Renders a FILTERED subgraph showing only suspicious accounts
 * and their direct neighbors to avoid browser freezing on large datasets.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import cytoscape from "cytoscape";

// Max nodes to render for performance
const MAX_NODES = 500;

// Build lookup maps from backend data
function buildLookups(suspiciousAccounts, fraudRings) {
  const accountMap = {};
  (suspiciousAccounts || []).forEach((acc) => {
    accountMap[acc.account_id] = acc;
  });

  const ringMemberSet = new Set();
  (fraudRings || []).forEach((ring) => {
    (ring.member_accounts || []).forEach((id) => ringMemberSet.add(id));
  });

  return { accountMap, ringMemberSet };
}

// Filter graph to show only suspicious accounts + neighbors
function filterGraphToSuspicious(graphData, accountMap) {
  const suspiciousIds = new Set(Object.keys(accountMap));
  if (suspiciousIds.size === 0) return { nodes: [], links: [] };

  // Find neighbors of suspicious accounts
  const neighborIds = new Set();
  (graphData.links || []).forEach((e) => {
    if (suspiciousIds.has(e.source)) neighborIds.add(e.target);
    if (suspiciousIds.has(e.target)) neighborIds.add(e.source);
  });

  // Combined set: suspicious + their neighbors
  const includeIds = new Set([...suspiciousIds, ...neighborIds]);

  // Limit total nodes
  let nodeList = [...includeIds];
  if (nodeList.length > MAX_NODES) {
    // Prioritize suspicious accounts
    const suspiciousArray = [...suspiciousIds];
    const neighborsArray = [...neighborIds].filter((id) => !suspiciousIds.has(id));
    nodeList = [...suspiciousArray.slice(0, MAX_NODES)];
    const remaining = MAX_NODES - nodeList.length;
    if (remaining > 0) {
      nodeList = [...nodeList, ...neighborsArray.slice(0, remaining)];
    }
  }

  const finalIds = new Set(nodeList);

  // Build node map from original data
  const originalNodeMap = {};
  (graphData.nodes || []).forEach((n) => {
    originalNodeMap[n.id] = n;
  });

  const filteredNodes = nodeList
    .filter((id) => originalNodeMap[id])
    .map((id) => originalNodeMap[id]);

  const filteredLinks = (graphData.links || []).filter(
    (e) => finalIds.has(e.source) && finalIds.has(e.target)
  );

  return { nodes: filteredNodes, links: filteredLinks };
}

// Determine node style based on risk
function getNodeStyle(nodeId, accountMap, ringMemberSet) {
  const acc = accountMap[nodeId];
  const inRing = ringMemberSet.has(nodeId);

  if (!acc) {
    // Normal node (not suspicious)
    return {
      backgroundColor: "#3b82f6", // blue
      width: 20,
      height: 20,
      borderWidth: 0,
      borderColor: "transparent",
    };
  }

  const score = acc.suspicion_score || 0;

  if (score >= 80) {
    // CRITICAL
    return {
      backgroundColor: "#ef4444", // red
      width: 40,
      height: 40,
      borderWidth: inRing ? 4 : 3,
      borderColor: inRing ? "#facc15" : "#000", // yellow border for ring members
    };
  } else if (score >= 60) {
    // HIGH
    return {
      backgroundColor: "#f97316", // orange
      width: 30,
      height: 30,
      borderWidth: inRing ? 3 : 0,
      borderColor: inRing ? "#facc15" : "transparent",
    };
  } else {
    // MEDIUM (score >= 40)
    return {
      backgroundColor: "#f97316", // orange
      width: 30,
      height: 30,
      borderWidth: inRing ? 3 : 0,
      borderColor: inRing ? "#facc15" : "transparent",
    };
  }
}

function GraphView({ graphData, suspiciousAccounts, fraudRings, onNodeClick }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, suspicious: 0, truncated: false });

  // Memoize onNodeClick to prevent re-renders
  const handleNodeClick = useCallback(onNodeClick, []);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const { accountMap, ringMemberSet } = buildLookups(suspiciousAccounts, fraudRings);

    // Filter to suspicious accounts + neighbors only
    const filtered = filterGraphToSuspicious(graphData, accountMap);
    const wasTruncated = Object.keys(accountMap).length > MAX_NODES;

    // Build Cytoscape elements
    const nodes = (filtered.nodes || []).map((n) => {
      const style = getNodeStyle(n.id, accountMap, ringMemberSet);
      return {
        data: {
          id: n.id,
          label: n.id,
          ...style,
        },
      };
    });

    const edges = (filtered.links || []).map((e, i) => ({
      data: {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        weight: e.transaction_count || 1,
      },
    }));

    // Create Cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "8px",
            color: "#e2e8f0",
            "text-valign": "bottom",
            "text-margin-y": 5,
            "background-color": "data(backgroundColor)",
            width: "data(width)",
            height: "data(height)",
            "border-width": "data(borderWidth)",
            "border-color": "data(borderColor)",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#475569",
            "target-arrow-color": "#475569",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.6,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#22d3ee",
          },
        },
      ],
      layout: {
        name: nodes.length > 200 ? "concentric" : "cose",
        animate: false,
        fit: true,
        // cose options
        randomize: true,
        nodeRepulsion: 8000,
        idealEdgeLength: 80,
        gravity: 0.25,
        // concentric options (used for large graphs)
        concentric: (node) => {
          const acc = accountMap[node.id()];
          return acc ? acc.suspicion_score || 0 : -10;
        },
        levelWidth: () => 2,
        spacingFactor: 1.5,
      },
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;

    // Node click handler
    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      const acc = accountMap[nodeId];
      if (handleNodeClick) {
        handleNodeClick(nodeId, acc);
      }
    });

    // Update stats
    setStats({
      nodes: nodes.length,
      edges: edges.length,
      suspicious: Object.keys(accountMap).length,
      truncated: wasTruncated,
    });

    return () => {
      cy.destroy();
    };
  }, [graphData, suspiciousAccounts, fraudRings, handleNodeClick]);

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div
        style={{
          height: "600px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: "12px",
          border: "1px solid #334155",
          color: "#94a3b8",
        }}
      >
        <p>No graph data available</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Stats Bar */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          background: "rgba(15,23,42,0.9)",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid #334155",
          fontSize: "0.75rem",
          color: "#e2e8f0",
        }}
      >
        <div>
          Nodes: {stats.nodes} | Edges: {stats.edges} | Suspicious: {stats.suspicious}
        </div>
        {stats.truncated && (
          <div style={{ color: "#facc15", marginTop: 4 }}>
            ⚠ Showing top {MAX_NODES} nodes for performance
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10,
          background: "rgba(15,23,42,0.9)",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid #334155",
          fontSize: "0.75rem",
          color: "#e2e8f0",
          lineHeight: 1.8,
        }}
      >
        <div>
          <span style={{ color: "#3b82f6" }}>●</span> Normal
        </div>
        <div>
          <span style={{ color: "#f97316" }}>●</span> Suspicious (40-79)
        </div>
        <div>
          <span style={{ color: "#ef4444" }}>●</span> CRITICAL (≥80)
        </div>
        <div>
          <span style={{ color: "#facc15" }}>◎</span> Fraud Ring Member
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "600px",
          background: "#0f172a",
          borderRadius: "12px",
          border: "1px solid #334155",
        }}
      />
    </div>
  );
}

export default GraphView;
