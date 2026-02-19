import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

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
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [hoverNodeId, setHoverNodeId] = useState("");
  const [size, setSize] = useState({ width: 980, height: 680 });

  const graphPayload = useMemo(() => {
    const root = results?.graph_json || results || {};
    const nodes = Array.isArray(root?.nodes) ? root.nodes : [];
    const links = Array.isArray(root?.links) ? root.links : [];

    return {
      nodes: nodes.map((node) => ({
        ...node,
        id: toId(node),
        detected_patterns: node.detected_patterns || [],
        ring_id: node.ring_id || "NONE",
        suspicion_score: Number(node.suspicion_score ?? 0),
        is_suspicious: Boolean(node.is_suspicious ?? false),
      })),
      links: links.map((link) => ({
        ...link,
        source: toSource(link),
        target: toTarget(link),
        transaction_count: toTxCount(link),
        total_amount: toAmount(link),
      })),
    };
  }, [results]);

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

  const nodeFlags = (node) => {
    const patterns = node.detected_patterns || [];
    const tags = [];
    if (patterns.some((p) => p.includes("fan_in") || p.includes("fan-in"))) tags.push("fan-in");
    if (patterns.some((p) => p.includes("fan_out") || p.includes("fan-out"))) tags.push("fan-out");
    if (patterns.some((p) => p.startsWith("cycle") || p.includes("cycle"))) tags.push("cycle");
    if (patterns.some((p) => p.includes("community"))) tags.push("community");
    if (node.ring_id && node.ring_id !== "NONE") tags.push("ring");
    if (node.is_suspicious) tags.push("suspicious");
    return tags;
  };

  const nodeColor = (node) => {
    const flags = nodeFlags(node);
    if (flags.includes("suspicious") && node.suspicion_score >= 80) return "#dc2626";
    if (flags.includes("suspicious") && node.suspicion_score >= 60) return "#a16207";
    if (flags.includes("suspicious")) return "#ea580c";
    if (flags.includes("ring") || flags.includes("community")) return "#c2410c";
    return "#b7c71f";
  };

  const isCoreNode = (node) => {
    const flags = nodeFlags(node);
    return (
      flags.includes("suspicious") ||
      flags.includes("ring") ||
      flags.includes("community") ||
      Number(node?.suspicion_score ?? 0) >= 60
    );
  };

  const nodeLabelLines = (node) => {
    const id = toId(node);
    if (!id) return ["Unknown"];
    if (id.length <= 22) return [id];
    const midpoint = Math.floor(id.length / 2);
    const splitIdx = id.lastIndexOf(" ", midpoint) > 0 ? id.lastIndexOf(" ", midpoint) : id.lastIndexOf("-", midpoint);
    if (splitIdx > 3 && splitIdx < id.length - 3) {
      return [id.slice(0, splitIdx + 1).trim(), id.slice(splitIdx + 1).trim()];
    }
    return [id.slice(0, 20).trim(), id.slice(20).trim()];
  };

  const nodeRadius = (node) => {
    if (!isCoreNode(node)) {
      return 4.6;
    }
    const total = nodeAmountMap.get(toId(node)) || 0;
    if (maxAmount === minAmount) {
      return 16;
    }
    const ratio = (total - minAmount) / (maxAmount - minAmount);
    return 12 + ratio * 8;
  };

  const linkWidth = (link) => {
    const txCount = toTxCount(link);
    const ratio = maxTxCount > 1 ? txCount / maxTxCount : 1;
    return 0.5 + ratio * 2.2;
  };

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null;
    const id = toId(selectedNode);
    return {
      id,
      inDegree: Number(selectedNode?.in_degree ?? 0),
      outDegree: Number(selectedNode?.out_degree ?? 0),
      pagerank: Number(selectedNode?.pagerank ?? 0),
      betweenness: Number(selectedNode?.betweenness ?? 0),
      ringId: selectedNode?.ring_id ?? "NONE",
      amount: nodeAmountMap.get(id) || 0,
      flags: nodeFlags(selectedNode),
      suspicionScore: Number(selectedNode?.suspicion_score ?? 0),
      communityId: selectedNode?.community_id ?? "N/A",
    };
  }, [selectedNode, nodeAmountMap]);

  useEffect(() => {
    if (!graphRef.current || !filteredGraph.nodes.length) {
      return;
    }

    graphRef.current.d3Force("charge")?.strength(-210);
    graphRef.current.d3Force("link")?.distance((link) => {
      const txCount = toTxCount(link);
      return txCount > 8 ? 56 : 84;
    });
    graphRef.current.d3Force("collide", null);
    graphRef.current.d3Force("collide", graphRef.current.d3Force("collide") || null);
  }, [filteredGraph.nodes.length, filteredGraph.links.length]);

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
              backgroundColor="#e5e7eb"
              cooldownTicks={90}
              nodeRelSize={5}
              linkDirectionalArrowLength={0}
              linkDirectionalArrowRelPos={1}
              linkCurvature={0.2}
              nodeLabel={(node) => {
                const id = toId(node);
                const flags = nodeFlags(node).join(", ") || "none";
                const inD = node.in_degree ?? 0;
                const outD = node.out_degree ?? 0;
                return `<div style="padding:6px 8px;"><strong>${id}</strong><br/>Score: ${formatValue(node.suspicion_score, 1)}<br/>In/Out: ${inD}/${outD}<br/>Flags: ${flags}</div>`;
              }}
              linkLabel={(link) => `<div style="padding:6px 8px;"><strong>${toSource(link)} → ${toTarget(link)}</strong><br/>Tx Count: ${formatValue(toTxCount(link), 0)}<br/>Total Amount: ${formatValue(toAmount(link), 2)}</div>`}
              linkWidth={linkWidth}
              linkColor={(link) => {
                const isSelected = selectedLink && toSource(selectedLink) === toSource(link) && toTarget(selectedLink) === toTarget(link);
                return isSelected ? "rgba(220, 38, 38, 0.75)" : "rgba(31, 41, 55, 0.24)";
              }}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const id = toId(node);
                const lines = nodeLabelLines(node);
                const radius = nodeRadius(node);
                const color = nodeColor(node);
                const isSearched = searchedNodeId === id;
                const isHovered = hoverNodeId === id;
                const isSelected = selectedNode && toId(selectedNode) === id;
                const coreNode = isCoreNode(node);

                ctx.save();

                if (coreNode) {
                  ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
                  ctx.shadowBlur = 8;
                }

                if (isSearched || isSelected || isHovered) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius + 4.2, 0, 2 * Math.PI);
                  ctx.fillStyle = isSearched ? "rgba(220, 38, 38, 0.18)" : "rgba(31, 41, 55, 0.12)";
                  ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.lineWidth = isSelected ? 2.2 : 1;
                ctx.strokeStyle = isSelected ? "#111827" : "rgba(0, 0, 0, 0.22)";
                ctx.stroke();

                if (coreNode) {
                  const iconSize = Math.max(8, 14 / globalScale);
                  ctx.font = `700 ${iconSize}px Inter, Segoe UI, sans-serif`;
                  ctx.fillStyle = "#f8fafc";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText("🏛", node.x, node.y + 0.2);

                  const badgeValue = Math.max(
                    Number(node.in_degree ?? 0) + Number(node.out_degree ?? 0),
                    Math.round(Number(node.suspicion_score ?? 0) / 5)
                  );
                  if (badgeValue > 0) {
                    const badgeRadius = Math.max(4.5, radius * 0.34);
                    const badgeX = node.x + radius * 0.66;
                    const badgeY = node.y - radius * 0.7;
                    ctx.beginPath();
                    ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = "#ef4444";
                    ctx.fill();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = "#fff";
                    ctx.stroke();

                    ctx.font = `700 ${Math.max(6, 9 / globalScale)}px Inter, Segoe UI, sans-serif`;
                    ctx.fillStyle = "#fff";
                    ctx.fillText(String(Math.round(badgeValue)), badgeX, badgeY + 0.2);
                  }
                }

                if (globalScale > 1.4 || isHovered || isSelected || isSearched || coreNode) {
                  const fontSize = Math.max(8, 11 / globalScale);
                  ctx.font = `${fontSize}px Inter, Segoe UI, sans-serif`;
                  ctx.fillStyle = "#4b5563";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  if (coreNode && lines.length > 1) {
                    ctx.fillText(lines[0], node.x, node.y + radius + 12 / globalScale);
                    ctx.fillText(lines[1], node.x, node.y + radius + 24 / globalScale);
                  } else {
                    ctx.fillText(lines[0], node.x, node.y + radius + 12 / globalScale);
                  }
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
