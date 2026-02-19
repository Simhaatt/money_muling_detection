import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import cytoscape from "cytoscape";
import type { SuspiciousAccount, FraudRing, GraphData } from "@/services/api";

export interface GraphViewerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  exportPng: () => void;
}

export interface NodeHoverInfo {
  id: string;
  riskClass: string;
  score: number | null;
  riskLevel: string;
  reason: string;
  connectedNodes: string[];
  edgeCount: number;
}

// ── Constants ────────────────────────────────────────────────
const MAX_NODES = 12000;
const LABEL_THRESHOLD = 2000;
const FAST_LAYOUT_THRESHOLD = 3000;
const HOVER_SCALE = 2.2;
const HOVER_ANIM_MS = 220;

// ── Bright hover colours per risk class ──────────────────────
const HOVER_COLORS: Record<string, string> = {
  normal: "#00f0ff",
  medium: "#ffea00",
  high: "#ff6fff",
  critical: "#ff2d2d",
};

const ORIG_COLORS: Record<string, string> = {
  normal: "#94a3b8",
  medium: "#f97316",
  high: "#f97316",
  critical: "#ef4444",
};

// ── Props ────────────────────────────────────────────────────
interface GraphViewerProps {
  graphData?: GraphData;
  suspiciousAccounts?: SuspiciousAccount[];
  fraudRings?: FraudRing[];
  onNodeHover?: (info: NodeHoverInfo | null) => void;
  onNodeClick?: (info: NodeHoverInfo | null) => void;
}

// ── Lookups ──────────────────────────────────────────────────
function buildLookups(accounts: SuspiciousAccount[], rings: FraudRing[]) {
  const accountMap: Record<string, SuspiciousAccount> = {};
  accounts.forEach((a) => { accountMap[a.account_id] = a; });
  const ringMemberSet = new Set<string>();
  rings.forEach((r) => (r.member_accounts || []).forEach((id) => ringMemberSet.add(id)));
  return { accountMap, ringMemberSet };
}

function classifyNode(id: string, accountMap: Record<string, SuspiciousAccount>, ringMemberSet: Set<string>): string {
  const acc = accountMap[id];
  if (!acc) return "normal";
  const s = acc.suspicion_score || 0;
  const ring = ringMemberSet.has(id);
  if (s >= 80) return ring ? "critical ring" : "critical";
  if (s >= 60) return ring ? "high ring" : "high";
  return ring ? "medium ring" : "medium";
}

function primaryClass(node: any): string {
  for (const c of ["critical", "high", "medium"]) {
    if (node.hasClass(c)) return c;
  }
  return "normal";
}

// ── Base sizes ───────────────────────────────────────────────
// Sizes scale with dataset: high/critical nodes stay visually dominant
// regardless of how many nodes are in the graph.
function baseSizes(nodeCount: number) {
  // Scale factor: bigger graphs → normal nodes shrink, risky nodes stay huge
  const s = Math.max(1, Math.log10(nodeCount));
  return {
    normal:   Math.max(2, Math.round(6 / s)),
    medium:   Math.max(18, Math.round(35 / s)),
    high:     Math.max(55, Math.round(100 / Math.sqrt(s))),
    critical: Math.max(90, Math.round(160 / Math.sqrt(s))),
  };
}

// ── Layout picker ────────────────────────────────────────────
// For large graphs we use a "preset" layout with computed positions:
//   • Ring members → arranged in small circles per ring
//   • Suspicious non-ring nodes → clustered near center
//   • Normal nodes → scattered randomly across the canvas
// For medium/small graphs we keep force-directed layouts.

function pickLayout(
  n: number,
  accountMap: Record<string, SuspiciousAccount>,
  positionMap?: Map<string, { x: number; y: number }>,
) {
  // Any graph with >200 nodes: use precomputed scatter positions
  if (n > 200 && positionMap) {
    return {
      name: "preset",
      animate: false,
      fit: true,
      padding: 30,
      positions: (node: any) => positionMap.get(node.id()) || { x: 0, y: 0 },
    };
  }
  // Small graphs: force-directed for organic layout
  return {
    name: "cose",
    animate: true,
    animationDuration: 800,
    fit: true,
    randomize: true,
    nodeRepulsion: () => 5000,
    idealEdgeLength: () => 50,
    gravity: 0.4,
  };
}

// ── Scatter position builder for large graphs ────────────────
// Arranges ring members in small circles and scatters the rest.
function buildPositionMap(
  nodes: { id: string }[],
  rings: FraudRing[],
  accountMap: Record<string, SuspiciousAccount>,
): Map<string, { x: number; y: number }> {
  const posMap = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  // Canvas size — compact to reduce distance between nodes
  const W = 2000;
  const H = 2000;
  const cx = W / 2;
  const cy = H / 2;

  // Deterministic RNG
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };

  // 1) Position ring members in circular clusters
  const ringCount = rings.length;
  rings.forEach((ring, ri) => {
    const members = ring.member_accounts || [];
    if (!members.length) return;

    // Spread ring centers across the canvas
    const angle = (2 * Math.PI * ri) / Math.max(ringCount, 1);
    const dist = W * 0.18 + rand() * W * 0.06;
    const rcx = cx + Math.cos(angle) * dist;
    const rcy = cy + Math.sin(angle) * dist;
    const ringRadius = Math.max(20, members.length * 4);

    members.forEach((id, mi) => {
      const a = (2 * Math.PI * mi) / members.length;
      posMap.set(id, {
        x: rcx + Math.cos(a) * ringRadius,
        y: rcy + Math.sin(a) * ringRadius,
      });
      placed.add(id);
    });
  });

  // 2) Position suspicious (non-ring) nodes in inner zone
  const susIds = Object.keys(accountMap).filter((id) => !placed.has(id));
  susIds.forEach((id) => {
    const score = accountMap[id]?.suspicion_score || 0;
    // Higher score → closer to center
    const r = W * 0.04 + (1 - score / 100) * W * 0.12 + rand() * W * 0.04;
    const a = rand() * 2 * Math.PI;
    posMap.set(id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    placed.add(id);
  });

  // 3) Scatter normal nodes across the full canvas
  nodes.forEach((n) => {
    if (placed.has(n.id)) return;
    posMap.set(n.id, {
      x: W * 0.08 + rand() * W * 0.84,
      y: H * 0.08 + rand() * H * 0.84,
    });
  });

  return posMap;
}

// ── Stylesheet ───────────────────────────────────────────────
function buildStylesheet(nodeCount: number, large: boolean) {
  const sz = baseSizes(nodeCount);
  return [
    {
      selector: "node",
      style: {
        "transition-property": "width, height, background-color, border-color, border-width, overlay-opacity",
        "transition-duration": `${HOVER_ANIM_MS}ms`,
        "transition-timing-function": "ease-out",
        "font-family": "Inter, system-ui, sans-serif",
      },
    },
    {
      selector: "node.normal",
      style: {
        "background-color": "#64748b",
        width: sz.normal,
        height: sz.normal,
        label: large ? "" : "data(id)",
        "font-size": "7px",
        color: "#475569",
        "text-valign": "bottom" as const,
        "text-margin-y": 4,
        "border-width": 0,
        "overlay-opacity": 0,
        opacity: 0.5,
      },
    },
    {
      selector: "node.medium",
      style: {
        "background-color": "#fb923c",
        width: sz.medium,
        height: sz.medium,
        label: large ? "" : "data(id)",
        "font-size": "8px",
        color: "#94a3b8",
        "text-valign": "bottom" as const,
        "text-margin-y": 5,
        "border-width": 2,
        "border-color": "#ea580c44",
      },
    },
    {
      selector: "node.high",
      style: {
        "background-color": "#dc2626",
        width: sz.high,
        height: sz.high,
        label: "data(id)",
        "font-size": "9px",
        color: "#fca5a5",
        "text-valign": "bottom" as const,
        "text-margin-y": 5,
        "border-width": 3,
        "border-color": "#7f1d1d",
      },
    },
    {
      selector: "node.critical",
      style: {
        "background-color": "#b91c1c",
        width: sz.critical,
        height: sz.critical,
        label: "data(id)",
        "font-size": "10px",
        "font-weight": "bold",
        color: "#ffffff",
        "text-valign": "bottom" as const,
        "text-margin-y": 6,
        "border-width": 4,
        "border-color": "#450a0a",
      },
    },
    {
      selector: "node.ring",
      style: {
        "border-width": 3,
        "border-color": "#facc15",
      },
    },
    {
      selector: "edge",
      style: {
        width: large ? 0.5 : 1.5,
        "line-color": "#334155",
        "target-arrow-color": "#334155",
        "target-arrow-shape": large ? "none" : "triangle",
        "curve-style": large ? "haystack" as const : "bezier" as const,
        opacity: large ? 0.25 : 0.5,
        "transition-property": "line-color, opacity, width",
        "transition-duration": `${HOVER_ANIM_MS}ms`,
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 4,
        "border-color": "#00a86b",
        label: "data(id)",
        "font-size": "10px",
        color: "#00a86b",
      },
    },
  ];
}

// ═════════════════════════════════════════════════════════════
const GraphViewer = forwardRef<GraphViewerHandle, GraphViewerProps>(({ graphData, suspiciousAccounts, fraudRings, onNodeHover, onNodeClick }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  // Expose zoom/fit controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const cy = cyRef.current;
      if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    zoomOut: () => {
      const cy = cyRef.current;
      if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    fit: () => {
      const cy = cyRef.current;
      if (cy) cy.fit(undefined, 30);
    },
    exportPng: () => {
      const cy = cyRef.current;
      if (!cy) return;
      const png = cy.png({ output: "blob", bg: "hsl(220,25%,6%)", full: true, scale: 2 });
      const url = URL.createObjectURL(png);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transaction_graph.png";
      a.click();
      URL.revokeObjectURL(url);
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !graphData?.nodes?.length) return;

    const { accountMap, ringMemberSet } = buildLookups(
      suspiciousAccounts || [],
      fraudRings || []
    );

    // Prepare nodes (cap at MAX_NODES)
    let nodes = graphData.nodes;
    let links = graphData.links || [];
    if (nodes.length > MAX_NODES) {
      const susIds = new Set(Object.keys(accountMap));
      const sus = nodes.filter((n) => susIds.has(n.id));
      const normal = nodes.filter((n) => !susIds.has(n.id)).slice(0, MAX_NODES - sus.length);
      nodes = [...sus, ...normal];
      const keep = new Set(nodes.map((n) => n.id));
      links = links.filter((e) => keep.has(e.source) && keep.has(e.target));
    }

    const large = nodes.length > LABEL_THRESHOLD;
    const sz = baseSizes(nodes.length);

    // Build scatter positions for graphs with >200 nodes
    const positionMap = nodes.length > 200
      ? buildPositionMap(nodes, fraudRings || [], accountMap)
      : undefined;

    const elements: any[] = [];
    nodes.forEach((n) => {
      elements.push({
        group: "nodes",
        data: { id: n.id },
        classes: classifyNode(n.id, accountMap, ringMemberSet),
      });
    });
    links.forEach((e, i) => {
      elements.push({
        group: "edges",
        data: { id: `e${i}`, source: e.source, target: e.target },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: buildStylesheet(nodes.length, large) as any,
      layout: pickLayout(nodes.length, accountMap, positionMap) as any,
      minZoom: 0.05,
      maxZoom: 5,
      wheelSensitivity: 0.3,
      pixelRatio: large ? 1 : ("auto" as any),
      textureOnViewport: large,
      hideEdgesOnViewport: large,
      hideLabelsOnViewport: large,
    });

    cyRef.current = cy;
    const tooltip = tooltipRef.current;

    // ── HOVER IN ─────────────────────────────────────────────
    cy.on("mouseover", "node", (evt: any) => {
      const node = evt.target;
      const cls = primaryClass(node);
      const base = (sz as any)[cls] || sz.normal;
      const big = Math.round(base * HOVER_SCALE);

      node.animate(
        { style: { width: big, height: big } },
        { duration: HOVER_ANIM_MS, easing: "ease-out-cubic" }
      );

      node.style({
        "background-color": HOVER_COLORS[cls],
        "border-width": 4,
        "border-color": "#ffffff",
        "overlay-opacity": 0.25,
        "overlay-color": HOVER_COLORS[cls],
        label: node.id(),
        "font-size": "11px",
        color: "#ffffff",
        "font-weight": "bold",
        "text-outline-color": "#0f172a",
        "text-outline-width": 2,
      });

      node.connectedEdges().animate(
        { style: { "line-color": "#22d3ee", opacity: 1, width: 2.5 } },
        { duration: HOVER_ANIM_MS }
      );

      // Fire callback for side-panel display
      if (onNodeHover) {
        const acc = accountMap[node.id()];
        const neighbors = node.neighborhood("node").map((n: any) => n.id());
        onNodeHover({
          id: node.id(),
          riskClass: cls,
          score: acc?.suspicion_score ?? null,
          riskLevel: acc?.risk_level || "Normal",
          reason: acc?.primary_reason || (acc ? "Suspicious activity detected" : "No suspicious activity"),
          connectedNodes: neighbors,
          edgeCount: node.connectedEdges().length,
        });
      }

      if (tooltip && !onNodeHover) {
        const acc = accountMap[node.id()];
        const pos = node.renderedPosition();
        const rect = containerRef.current!.getBoundingClientRect();

        // Build content first so we can measure
        if (acc) {
          tooltip.innerHTML = `
            <div style="font-weight:700;color:${HOVER_COLORS[cls]};margin-bottom:4px;font-size:13px">${node.id()}</div>
            <div>Score: <b>${acc.suspicion_score ?? "N/A"}</b></div>
            <div>Risk: <b style="color:${cls === "critical" ? "#ff2d2d" : cls === "high" ? "#ff6fff" : "#ffea00"}">${acc.risk_level || "—"}</b></div>
            ${acc.primary_reason ? `<div style="margin-top:4px;color:#94a3b8;font-size:11px">${acc.primary_reason}</div>` : ""}
          `;
        } else {
          tooltip.innerHTML = `
            <div style="font-weight:700;color:#00f0ff;font-size:13px">${node.id()}</div>
            <div style="color:#94a3b8;margin-top:2px">Normal account</div>
          `;
        }

        // Smart positioning: avoid clipping at viewport edges
        const tipW = tooltip.offsetWidth || 260;
        const tipH = tooltip.offsetHeight || 120;
        const margin = 16; // gap from node
        const absX = pos.x + rect.left;
        const absY = pos.y + rect.top;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Horizontal: prefer right of node, flip to left if clipped
        let left = absX + margin;
        if (left + tipW > vw - 8) {
          left = absX - tipW - margin;
        }
        // Keep within viewport
        left = Math.max(8, Math.min(left, vw - tipW - 8));

        // Vertical: prefer aligned to node top, shift up if clipped at bottom
        let top = absY - 12;
        if (top + tipH > vh - 8) {
          top = absY - tipH + 12; // flip above
        }
        // Keep within viewport
        top = Math.max(8, Math.min(top, vh - tipH - 8));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.opacity = "1";
        tooltip.style.transform = "scale(1)";
      }
    });

    // ── HOVER OUT ────────────────────────────────────────────
    cy.on("mouseout", "node", (evt: any) => {
      const node = evt.target;
      const cls = primaryClass(node);
      const base = (sz as any)[cls] || sz.normal;

      node.animate(
        { style: { width: base, height: base } },
        { duration: HOVER_ANIM_MS, easing: "ease-in-cubic" }
      );

      node.style({
        "background-color": ORIG_COLORS[cls],
        "border-width": node.hasClass("ring") ? 3 : cls === "critical" ? 3 : 2,
        "border-color": node.hasClass("ring") ? "#facc15" : cls === "critical" ? "#000000" : "#ffffff22",
        "overlay-opacity": 0,
        "font-weight": "normal",
        "text-outline-width": 0,
      });

      if (large && cls !== "critical" && cls !== "high") {
        node.style("label", "");
      }

      node.connectedEdges().animate(
        { style: { "line-color": "#334155", opacity: large ? 0.25 : 0.5, width: large ? 0.5 : 1.5 } },
        { duration: HOVER_ANIM_MS }
      );

      if (onNodeHover) {
        onNodeHover(null);
      }

      if (tooltip) {
        tooltip.style.opacity = "0";
        tooltip.style.transform = "scale(0.85)";
      }
    });

    // ── CLICK NODE (pin info) ────────────────────────────────
    const buildNodeInfo = (node: any): NodeHoverInfo => {
      const nCls = primaryClass(node);
      const acc = accountMap[node.id()];
      const neighbors = node.neighborhood("node").map((n: any) => n.id());
      return {
        id: node.id(),
        riskClass: nCls,
        score: acc?.suspicion_score ?? null,
        riskLevel: acc?.risk_level || "Normal",
        reason: acc?.primary_reason || (acc ? "Suspicious activity detected" : "No suspicious activity"),
        connectedNodes: neighbors,
        edgeCount: node.connectedEdges().length,
      };
    };

    cy.on("tap", "node", (evt: any) => {
      if (onNodeClick) {
        onNodeClick(buildNodeInfo(evt.target));
      }
    });

    // Click empty space → unpin
    cy.on("tap", (evt: any) => {
      if (evt.target === cy && onNodeClick) {
        onNodeClick(null);
      }
    });

    return () => {
      cy.destroy();
    };
  }, [graphData, suspiciousAccounts, fraudRings]);

  if (!graphData?.nodes?.length) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>No graph data available. Upload a CSV to begin.</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          background: "hsl(220 25% 6%)",
          borderRadius: "0 0 8px 8px",
        }}
      />
      <div
        ref={tooltipRef}
        style={{
          position: "fixed",
          zIndex: 100,
          pointerEvents: "none",
          background: "rgba(15,23,42,0.96)",
          border: "1px solid #22d3ee",
          borderRadius: "10px",
          padding: "10px 14px",
          fontSize: "0.78rem",
          color: "#e2e8f0",
          lineHeight: 1.5,
          boxShadow: "0 0 18px rgba(0,240,255,0.35), 0 4px 20px rgba(0,0,0,0.5)",
          opacity: 0,
          transform: "scale(0.85)",
          transition: "opacity 180ms ease, transform 180ms ease",
          maxWidth: "260px",
        }}
      />
    </>
  );
});

GraphViewer.displayName = "GraphViewer";
export default GraphViewer;
