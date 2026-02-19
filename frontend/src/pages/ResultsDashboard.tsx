import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Table2, Image, ZoomIn, ZoomOut, Maximize2, Minimize2, ArrowLeft, Activity, Shield, Network, AlertTriangle, FileSpreadsheet, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GraphViewer from "@/components/GraphViewer";
import type { GraphViewerHandle, NodeHoverInfo } from "@/components/GraphViewer";
import FraudTable from "@/components/FraudTable";
import type { UploadResponse } from "@/services/api";

// ── Risk colour helpers ──────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  normal: "#22d3ee",
  medium: "#ffea00",
  high: "#ff6fff",
  critical: "#ff2d2d",
};
const RISK_BG: Record<string, string> = {
  normal: "rgba(34,211,238,0.08)",
  medium: "rgba(255,234,0,0.08)",
  high: "rgba(255,111,255,0.08)",
  critical: "rgba(255,45,45,0.1)",
};

// ── Node Detail Side Panel ───────────────────────────────────
const NodeDetailPanel = ({ node, pinned }: { node: NodeHoverInfo | null; pinned: boolean }) => {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Network className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground/60">Hover over a node</p>
        <p className="mt-1 text-xs text-muted-foreground/40">Click a node to pin its details</p>
      </div>
    );
  }

  const color = RISK_COLORS[node.riskClass] || RISK_COLORS.normal;
  const bg = RISK_BG[node.riskClass] || RISK_BG.normal;

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex h-full flex-col p-4"
    >
      {/* Account ID header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: bg, color, border: `2px solid ${color}` }}
        >
          {node.id.replace(/[^0-9]/g, "").slice(-3) || "?"}
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color }}>{node.id}</p>
          <p className="text-xs text-muted-foreground">{node.riskLevel} Risk</p>
        </div>
        {pinned && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>
            Pinned
          </span>
        )}
      </div>

      {/* Score bar */}
      {node.score !== null && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Suspicion Score</span>
            <span className="text-sm font-bold" style={{ color }}>{node.score}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(node.score, 100)}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[10px]" style={{ color: "#94a3b8" }}>Connections</p>
          <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{node.edgeCount}</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[10px]" style={{ color: "#94a3b8" }}>Neighbors</p>
          <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{node.connectedNodes.length}</p>
        </div>
      </div>

      {/* Risk badge */}
      <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: bg }}>
        {node.riskClass === "critical" || node.riskClass === "high" ? (
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color }} />
        ) : node.riskClass === "medium" ? (
          <Shield className="h-4 w-4 shrink-0" style={{ color }} />
        ) : (
          <Activity className="h-4 w-4 shrink-0" style={{ color }} />
        )}
        <span className="text-xs font-medium" style={{ color }}>{node.riskLevel}</span>
      </div>

      {/* Reason */}
      <div className="mb-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Analysis</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{node.reason}</p>
      </div>

      {/* Connected nodes list */}
      {node.connectedNodes.length > 0 && (
        <div className="mt-auto">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Connected Accounts ({node.connectedNodes.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {node.connectedNodes.slice(0, 12).map((n) => (
              <span
                key={n}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#ffffff" }}
              >
                {n}
              </span>
            ))}
            {node.connectedNodes.length > 12 && (
              <span className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground" style={{ background: "rgba(255,255,255,0.03)" }}>
                +{node.connectedNodes.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ResultsDashboard = () => {
  const [showTable, setShowTable] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const navigate = useNavigate();
  const [data, setData] = useState<UploadResponse | null>(null);
  const graphRef = useRef<GraphViewerHandle>(null);
  const fullscreenGraphRef = useRef<GraphViewerHandle>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeHoverInfo | null>(null);
  const [pinnedNode, setPinnedNode] = useState<NodeHoverInfo | null>(null);
  const [fsHoveredNode, setFsHoveredNode] = useState<NodeHoverInfo | null>(null);
  const [fsPinnedNode, setFsPinnedNode] = useState<NodeHoverInfo | null>(null);

  // The panel shows the pinned node if set, otherwise the hovered node
  const activeNode = pinnedNode || hoveredNode;
  const fsActiveNode = fsPinnedNode || fsHoveredNode;

  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResults");
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch {
        navigate("/upload");
      }
    } else {
      navigate("/upload");
    }
  }, [navigate]);

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  const summary = data.summary || {
    total_accounts: data.graph?.nodes?.length || 0,
    total_transactions: data.graph?.links?.length || 0,
    suspicious_count: data.suspicious_accounts?.length || 0,
    fraud_ring_count: data.fraud_rings?.length || 0,
    avg_risk_score: 0,
  };

  const avgScore = data.fraud_rings?.length
    ? (data.fraud_rings.reduce((s, r) => s + (r.risk_score || r.avg_suspicion || 0), 0) / data.fraud_rings.length).toFixed(2)
    : summary.avg_risk_score?.toFixed(2) || "0.00";

  const totalAccounts = data.graph?.nodes?.length || summary.total_accounts || 0;
  const suspiciousCount = data.suspicious_accounts?.length || summary.suspicious_count || 0;
  const fraudPct = totalAccounts > 0 ? ((suspiciousCount / totalAccounts) * 100).toFixed(1) : "0.0";

  const handleDownloadJSON = () => {
    // Build export payload in the exact required format
    const exportData = {
      suspicious_accounts: (data.suspicious_accounts || []).map((a) => ({
        account_id: a.account_id,
        suspicion_score: a.suspicion_score,
        detected_patterns: a.detected_patterns || a.explanations || [],
        ring_id: a.ring_id || null,
      })),
      fraud_rings: (data.fraud_rings || []).map((r) => ({
        ring_id: r.ring_id,
        member_accounts: r.member_accounts,
        pattern_type: r.pattern_type,
        risk_score: r.risk_score,
      })),
      summary: {
        total_accounts_analyzed: data.summary?.total_accounts || data.graph?.nodes?.length || 0,
        suspicious_accounts_flagged: data.suspicious_accounts?.length || 0,
        fraud_rings_detected: data.fraud_rings?.length || 0,
        processing_time_seconds: data.summary?.processing_time_seconds ?? 0,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analysis_results.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 py-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-foreground">Analysis Results</h1>
          <p className="text-sm text-muted-foreground">
            Transaction graph analysis complete — {data.fraud_rings?.length || 0} fraud ring{(data.fraud_rings?.length || 0) !== 1 ? "s" : ""} detected across {data.graph?.nodes?.length || 0} nodes.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {[
            { label: "Total Nodes", value: (data.graph?.nodes?.length || summary.total_accounts || 0).toLocaleString() },
            { label: "Total Edges", value: (data.graph?.links?.length || summary.total_transactions || 0).toLocaleString() },
            { label: "Fraud Rings", value: String(data.fraud_rings?.length || summary.fraud_ring_count || 0) },
            { label: "Fraud Accounts", value: `${fraudPct}%` },
          ].map((stat, i) => (
            <div key={i} className="card-forensic p-4">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Graph */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-forensic mb-6 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Transaction Graph</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphRef.current?.zoomIn()} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphRef.current?.zoomOut()} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullscreen(true)} title="Fullscreen">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex h-[500px]">
            <div className="flex-1 min-w-0">
              <GraphViewer
                ref={graphRef}
                graphData={data.graph}
                suspiciousAccounts={data.suspicious_accounts}
                fraudRings={data.fraud_rings}
                onNodeHover={setHoveredNode}
                onNodeClick={setPinnedNode}
              />
            </div>
            <div className="w-[300px] shrink-0 border-l border-border overflow-y-auto" style={{ background: "hsl(220 25% 6%)" }}>
              <NodeDetailPanel node={activeNode} pinned={!!pinnedNode} />
            </div>
          </div>
        </motion.div>

        {/* Fullscreen Graph Overlay */}
        {fullscreen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullscreen(false)} title="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-sm font-semibold text-foreground">Transaction Graph — Fullscreen</h2>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fullscreenGraphRef.current?.zoomIn()} title="Zoom In">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fullscreenGraphRef.current?.zoomOut()} title="Zoom Out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fullscreenGraphRef.current?.fit()} title="Fit to View">
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullscreen(false)} title="Exit Fullscreen">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-1">
              <div className="flex-1 min-w-0">
                <GraphViewer
                  ref={fullscreenGraphRef}
                  graphData={data.graph}
                  suspiciousAccounts={data.suspicious_accounts}
                  fraudRings={data.fraud_rings}
                  onNodeHover={setFsHoveredNode}
                  onNodeClick={setFsPinnedNode}
                />
              </div>
              <div className="w-[340px] shrink-0 border-l border-border overflow-y-auto" style={{ background: "hsl(220 25% 6%)" }}>
                <NodeDetailPanel node={fsActiveNode} pinned={!!fsPinnedNode} />
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6 flex flex-wrap gap-3"
        >
          <Button
            variant="outline"
            className="gap-2 transition-all hover:border-primary hover:text-primary"
            onClick={handleDownloadJSON}
          >
            <Download className="h-4 w-4" />
            Download JSON
          </Button>
          <Button
            variant="outline"
            className="gap-2 transition-all hover:border-primary hover:text-primary"
            onClick={() => setShowTable((v) => !v)}
          >
            <Table2 className="h-4 w-4" />
            {showTable ? "Hide" : "Show"} Fraud Ring Summary
          </Button>
          <Button
            variant="outline"
            className="gap-2 transition-all hover:border-primary hover:text-primary"
            onClick={() => graphRef.current?.exportPng()}
          >
            <Image className="h-4 w-4" />
            Export Graph Image
          </Button>
          <Button
            variant="outline"
            className="gap-2 transition-all hover:border-primary hover:text-primary"
            onClick={() => {
              if (!data?.fraud_rings?.length) return;
              const headers = ["Ring ID", "Pattern Type", "Members", "Risk Score", "Total Amount", "Member Accounts"];
              const rows = data.fraud_rings.map((r) => [
                r.ring_id || "",
                r.pattern_type || "",
                String(r.member_accounts?.length || 0),
                String(r.risk_score || r.avg_suspicion || 0),
                String(r.total_amount || 0),
                (r.member_accounts || []).join(";"),
              ]);
              const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "fraud_rings.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Fraud Rings
          </Button>
          <Button
            variant="outline"
            className="gap-2 transition-all hover:border-primary hover:text-primary"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </motion.div>

        {/* Suspicious Accounts Table */}
        {showTable && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <FraudTable
              fraudRings={data.fraud_rings}
              suspiciousAccounts={data.suspicious_accounts}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;
