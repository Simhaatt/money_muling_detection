import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

const COMMUNITY_COLORS = [
  "#67e8f9",
  "#c4b5fd",
  "#6ee7b7",
  "#fdba74",
  "#f9a8d4",
  "#93c5fd",
  "#fca5a5",
  "#86efac",
];

const GRAPH_ENGINE = "react-force-graph-2d";

const toId = (node) => String(node?.id ?? node?.account_id ?? "");
const toSource = (link) => String(link?.source?.id ?? link?.source ?? "");
const toTarget = (link) => String(link?.target?.id ?? link?.target ?? "");
const toTxCount = (link) => Number(link?.transaction_count ?? link?.count ?? 1);
const toAmount = (link) => Number(link?.total_amount ?? link?.amount ?? 0);

function formatValue(value, digits = 2) {
  const num = Number(value ?? 0);
  return Number.isFinite(num)
    ? num.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "0";
}

function GraphView({ results, loading = false, error = null }) {
  const graphRef = useRef(null);
  const wrapRef = useRef(null);

  const [minTxCount, setMinTxCount] = useState(1);
  const [minTotalAmount, setMinTotalAmount] = useState(0);
  const [showFanIn, setShowFanIn] = useState(true);
  const [showFanOut, setShowFanOut] = useState(true);
  const [showCycles, setShowCycles] = useState(true);
  const [showCommunities, setShowCommunities] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [hoverNodeId, setHoverNodeId] = useState("");
  const [size, setSize] = useState({ width: 980, height: 680 });

  const graphPayload = useMemo(() => {
    const root = results?.graph_json || results || {};
    const nodes = Array.isArray(root?.nodes) ? root.nodes : [];
    const links = Array.isArray(root?.links) ? root.links : [];
    const features = root?.features || results?.features || {};

    return {
      nodes: nodes.map((node) => ({ ...node, id: toId(node) })),
      links: links.map((link) => ({
        ...link,
        source: toSource(link),
        target: toTarget(link),
        transaction_count: toTxCount(link),
        total_amount: toAmount(link),
      })),
      features,
    };
  }, [results]);

  const fanInSet = useMemo(
    () => new Set((graphPayload.features?.fan_in_nodes || []).map(String)),
    [graphPayload.features]
  );
  const fanOutSet = useMemo(
    () => new Set((graphPayload.features?.fan_out_nodes || []).map(String)),
    [graphPayload.features]
  );
  const cycleSet = useMemo(() => {
    const direct = (graphPayload.features?.nodes_in_cycles || []).map(String);
    const nested = Array.isArray(graphPayload.features?.cycles)
      ? graphPayload.features.cycles.flat().map(String)
      : [];
    return new Set([...direct, ...nested]);
  }, [graphPayload.features]);
  const communities = useMemo(() => graphPayload.features?.communities || {}, [graphPayload.features]);

  const filteredGraph = useMemo(() => {
    const links = graphPayload.links.filter(
      (link) => toTxCount(link) >= minTxCount && toAmount(link) >= minTotalAmount
    );
    const connected = new Set();
    links.forEach((link) => {
      connected.add(toSource(link));
      connected.add(toTarget(link));
    });
    const nodes = graphPayload.nodes.filter((node) => connected.has(toId(node)));
    return { nodes, links };
  }, [graphPayload, minTxCount, minTotalAmount]);

  const nodeAmountMap = useMemo(() => {
    const map = new Map();
    filteredGraph.links.forEach((link) => {
      const amount = toAmount(link);
      const source = toSource(link);
      const target = toTarget(link);
      map.set(source, (map.get(source) || 0) + amount);
      map.set(target, (map.get(target) || 0) + amount);
    });
    return map;
  }, [filteredGraph.links]);

  const maxTxCount = useMemo(() => {
    const list = filteredGraph.links.map((link) => toTxCount(link));
    return list.length ? Math.max(...list) : 1;
  }, [filteredGraph.links]);

  const [minAmount, maxAmount] = useMemo(() => {
    const values = [...nodeAmountMap.values()];
    if (!values.length) {
      return [0, 1];
    }
    return [Math.min(...values), Math.max(...values)];
  }, [nodeAmountMap]);

  useEffect(() => {
    if (!wrapRef.current) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(500, Math.floor(entry.contentRect.width)), height: 680 });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!graphRef.current || !filteredGraph.nodes.length) {
      return;
    }
    const timer = setTimeout(() => graphRef.current.zoomToFit(450, 90), 180);
    return () => clearTimeout(timer);
  }, [filteredGraph.nodes.length, filteredGraph.links.length]);

  const searchedNodeId = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return "";
    }
    const exact = filteredGraph.nodes.find((node) => toId(node).toLowerCase() === query);
    if (exact) {
      return toId(exact);
    }
    const partial = filteredGraph.nodes.find((node) => toId(node).toLowerCase().includes(query));
    return partial ? toId(partial) : "";
  }, [search, filteredGraph.nodes]);

  useEffect(() => {
    if (!searchedNodeId || !graphRef.current) {
      return;
    }
    const node = filteredGraph.nodes.find((item) => toId(item) === searchedNodeId);
    if (node) {
      graphRef.current.centerAt(node.x || 0, node.y || 0, 450);
      graphRef.current.zoom(3, 450);
      setSelectedNode(node);
      setSelectedLink(null);
    }
  }, [searchedNodeId, filteredGraph.nodes]);

  const nodeFlags = (nodeId) => {
    const tags = [];
    if (showFanIn && fanInSet.has(nodeId)) {
      tags.push("fan-in");
    }
    if (showFanOut && fanOutSet.has(nodeId)) {
      tags.push("fan-out");
    }
    if (showCycles && cycleSet.has(nodeId)) {
      tags.push("cycle");
    }
    return tags;
  };

  const nodeColor = (node) => {
    const id = toId(node);
    const flags = nodeFlags(id);
    const communityId = communities[id];

    if (flags.length >= 2) {
      return "#fb7185";
    }
    if (flags.includes("fan-in")) {
      return "#f97316";
    }
    if (flags.includes("fan-out")) {
      return "#facc15";
    }
    if (flags.includes("cycle")) {
      return "#f43f5e";
    }
    if (showCommunities && Number.isInteger(communityId)) {
      return COMMUNITY_COLORS[Math.abs(communityId) % COMMUNITY_COLORS.length];
    }
    return "#67e8f9";
  };

  const nodeRadius = (node) => {
    const total = nodeAmountMap.get(toId(node)) || 0;
    if (maxAmount === minAmount) {
      return 7;
    }
    const ratio = (total - minAmount) / (maxAmount - minAmount);
    return 5 + ratio * 12;
  };

  const linkWidth = (link) => {
    const txCount = toTxCount(link);
    const ratio = maxTxCount > 1 ? txCount / maxTxCount : 1;
    return 0.8 + ratio * 4;
  };

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) {
      return null;
    }
    const id = toId(selectedNode);
    return {
      id,
      inDegree: Number(graphPayload.features?.in_degree?.[id] ?? selectedNode?.in_degree ?? 0),
      outDegree: Number(graphPayload.features?.out_degree?.[id] ?? selectedNode?.out_degree ?? 0),
      pagerank: Number(graphPayload.features?.pagerank?.[id] ?? selectedNode?.pagerank ?? 0),
      betweenness: Number(graphPayload.features?.betweenness?.[id] ?? selectedNode?.betweenness ?? 0),
      communityId: Number.isInteger(communities[id]) ? communities[id] : "—",
      amount: nodeAmountMap.get(id) || 0,
      flags: nodeFlags(id),
    };
  }, [selectedNode, graphPayload.features, communities, nodeAmountMap, showFanIn, showFanOut, showCycles]);

  if (loading) {
    return (
      <section className="page graph-view-page">
        <h2>Transaction Graph</h2>
        <div className="graph-state loading">Loading graph intelligence...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page graph-view-page">
        <h2>Transaction Graph</h2>
        <div className="graph-state error">Error loading graph: {String(error)}</div>
      </section>
    );
  }

  if (!graphPayload.nodes.length || !graphPayload.links.length) {
    return (
      <section className="page graph-view-page">
        <h2>Transaction Graph</h2>
        <div className="graph-state empty">
          No graph data available. Upload and run analysis first.
        </div>
      </section>
    );
  }

  return (
    <section className="page graph-view-page">
      <h2>Transaction Graph</h2>
      <p className="graph-engine-note">Graph engine: {GRAPH_ENGINE} (swap-ready adapter point)</p>

      <div className="graph-workbench">
        <aside className="graph-controls-panel">
          <h3>Controls</h3>

          <div className="graph-control-group">
            <label htmlFor="min-tx">Min Transaction Count</label>
            <input
              id="min-tx"
              type="number"
              min="0"
              value={minTxCount}
              onChange={(event) => setMinTxCount(Math.max(0, Number(event.target.value || 0)))}
            />
          </div>

          <div className="graph-control-group">
            <label htmlFor="min-amount">Min Total Amount</label>
            <input
              id="min-amount"
              type="number"
              min="0"
              step="0.01"
              value={minTotalAmount}
              onChange={(event) => setMinTotalAmount(Math.max(0, Number(event.target.value || 0)))}
            />
          </div>

          <div className="graph-control-group">
            <span className="control-label">Suspicion Toggles</span>
            <label className="toggle-row"><input type="checkbox" checked={showFanIn} onChange={() => setShowFanIn((v) => !v)} />Show Fan-in nodes</label>
            <label className="toggle-row"><input type="checkbox" checked={showFanOut} onChange={() => setShowFanOut((v) => !v)} />Show Fan-out nodes</label>
            <label className="toggle-row"><input type="checkbox" checked={showCycles} onChange={() => setShowCycles((v) => !v)} />Show Cycles</label>
            <label className="toggle-row"><input type="checkbox" checked={showCommunities} onChange={() => setShowCommunities((v) => !v)} />Show Communities</label>
          </div>

          <div className="graph-control-group">
            <label htmlFor="search-account">Search Account ID</label>
            <input
              id="search-account"
              type="text"
              value={search}
              placeholder="ACC_001"
              onChange={(event) => setSearch(event.target.value)}
            />
            {search.trim() && !searchedNodeId && (
              <small className="search-hint">No matching account in current filtered graph.</small>
            )}
          </div>

          <div className="graph-metrics">
            <div><span>Visible Accounts</span><strong>{filteredGraph.nodes.length}</strong></div>
            <div><span>Visible Transactions</span><strong>{filteredGraph.links.length}</strong></div>
          </div>
        </aside>

        <div className="graph-main-panel" ref={wrapRef}>
          {filteredGraph.nodes.length === 0 || filteredGraph.links.length === 0 ? (
            <div className="graph-state empty">No nodes/edges match these filter thresholds.</div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={filteredGraph}
              width={size.width}
              height={size.height}
              backgroundColor="#070b17"
              cooldownTicks={90}
              nodeRelSize={5}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.08}
              nodeLabel={(node) => {
                const id = toId(node);
                const flags = nodeFlags(id).join(", ") || "none";
                const inD = graphPayload.features?.in_degree?.[id] ?? 0;
                const outD = graphPayload.features?.out_degree?.[id] ?? 0;
                return `<div style="padding:6px 8px;"><strong>${id}</strong><br/>In/Out: ${inD}/${outD}<br/>Flags: ${flags}</div>`;
              }}
              linkLabel={(link) => `<div style="padding:6px 8px;"><strong>${toSource(link)} → ${toTarget(link)}</strong><br/>Tx Count: ${formatValue(toTxCount(link), 0)}<br/>Total Amount: ${formatValue(toAmount(link), 2)}</div>`}
              linkWidth={linkWidth}
              linkColor={(link) => {
                const isSelected = selectedLink && toSource(selectedLink) === toSource(link) && toTarget(selectedLink) === toTarget(link);
                return isSelected ? "#5eead4" : "rgba(148, 163, 184, 0.35)";
              }}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const id = toId(node);
                const radius = nodeRadius(node);
                const color = nodeColor(node);
                const isSearched = searchedNodeId === id;
                const isHovered = hoverNodeId === id;
                const isSelected = selectedNode && toId(selectedNode) === id;
                const isSuspicious = nodeFlags(id).length > 0;

                ctx.save();

                if (isSuspicious) {
                  ctx.shadowColor = color;
                  ctx.shadowBlur = 14;
                }

                if (isSearched || isSelected || isHovered) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
                  ctx.fillStyle = isSearched ? "rgba(94, 234, 212, 0.32)" : "rgba(167, 139, 250, 0.22)";
                  ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.lineWidth = isSelected ? 2.4 : 1.1;
                ctx.strokeStyle = isSelected ? "#f8fafc" : "rgba(2, 6, 23, 0.9)";
                ctx.stroke();

                if (globalScale > 2.2 || isHovered || isSelected || isSearched) {
                  const fontSize = Math.max(9, 12 / globalScale);
                  ctx.font = `${fontSize}px Inter, Segoe UI, sans-serif`;
                  ctx.fillStyle = "#dbeafe";
                  ctx.fillText(id, node.x + radius + 3, node.y + 3);
                }

                ctx.restore();
              }}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeRadius(node) + 4, 0, 2 * Math.PI);
                ctx.fill();
              }}
              onNodeHover={(node) => setHoverNodeId(node ? toId(node) : "")}
              onNodeClick={(node) => {
                setSelectedNode(node);
                setSelectedLink(null);
              }}
              onLinkClick={(link) => {
                setSelectedLink(link);
                setSelectedNode(null);
              }}
            />
          )}
        </div>

        <aside className="graph-info-panel">
          <h3>Selection Details</h3>

          {!selectedNode && !selectedLink && (
            <p className="selection-hint">Select a node or edge to inspect account and transaction details.</p>
          )}

          {selectedNodeDetails && (
            <div className="selection-card">
              <h4>Node Details</h4>
              <p><span>Account ID</span><strong>{selectedNodeDetails.id}</strong></p>
              <p><span>In-degree</span><strong>{formatValue(selectedNodeDetails.inDegree, 0)}</strong></p>
              <p><span>Out-degree</span><strong>{formatValue(selectedNodeDetails.outDegree, 0)}</strong></p>
              <p><span>PageRank</span><strong>{formatValue(selectedNodeDetails.pagerank, 6)}</strong></p>
              <p><span>Betweenness</span><strong>{formatValue(selectedNodeDetails.betweenness, 6)}</strong></p>
              <p><span>Community ID</span><strong>{selectedNodeDetails.communityId}</strong></p>
              <p><span>Total Amount</span><strong>{formatValue(selectedNodeDetails.amount, 2)}</strong></p>

              <div className="tag-row">
                {selectedNodeDetails.flags.length ? (
                  selectedNodeDetails.flags.map((flag) => (
                    <span key={flag} className="risk-tag">{flag}</span>
                  ))
                ) : (
                  <span className="tag-muted">No suspicious tag</span>
                )}
              </div>
            </div>
          )}

          {selectedLink && (
            <div className="selection-card">
              <h4>Edge Details</h4>
              <p><span>Source</span><strong>{toSource(selectedLink)}</strong></p>
              <p><span>Target</span><strong>{toTarget(selectedLink)}</strong></p>
              <p><span>Transaction Count</span><strong>{formatValue(toTxCount(selectedLink), 0)}</strong></p>
              <p><span>Total Amount</span><strong>{formatValue(toAmount(selectedLink), 2)}</strong></p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default GraphView;
