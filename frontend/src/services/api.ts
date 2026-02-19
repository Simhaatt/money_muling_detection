/**
 * api.ts — API Service Layer
 * Handles all HTTP communication with the FastAPI backend.
 */

const API_BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface UploadResponse {
  suspicious_accounts: SuspiciousAccount[];
  fraud_rings: FraudRing[];
  graph: GraphData;
  graph_json?: GraphData;  // backend key name
  summary: Summary;
}

export interface SuspiciousAccount {
  account_id: string;
  suspicion_score: number;
  risk_level: string;
  primary_reason: string;
  explanations: string[];
  detected_patterns?: string[];
  explanation?: string;
  ring_id?: string;
}

export interface FraudRing {
  ring_id: string;
  member_accounts: string[];
  total_amount: number;
  pattern_type: string;
  risk_score: number;
  avg_suspicion: number;
}

export interface GraphData {
  nodes: { id: string }[];
  links: { source: string; target: string; total_amount?: number; transaction_count?: number }[];
}

export interface Summary {
  total_transactions: number;
  total_accounts: number;
  suspicious_count: number;
  fraud_ring_count: number;
  avg_risk_score: number;
  processing_time_seconds: number;
}

/**
 * Normalise the backend response so the frontend gets consistent keys.
 * - graph_json → graph
 * - suspicious account fields mapped to frontend interface
 */
function normalizeResponse(raw: any): UploadResponse {
  // Map graph_json → graph
  const graph: GraphData = raw.graph || raw.graph_json || { nodes: [], links: [] };

  // Normalise suspicious accounts
  const suspicious_accounts: SuspiciousAccount[] = (raw.suspicious_accounts || []).map((a: any) => ({
    account_id: a.account_id,
    suspicion_score: a.suspicion_score ?? 0,
    risk_level: a.risk_level || riskLevelFromScore(a.suspicion_score),
    primary_reason: a.primary_reason || a.explanation || (a.detected_patterns?.[0]) || "",
    explanations: a.explanations || a.detected_patterns || [],
    detected_patterns: a.detected_patterns || [],
    ring_id: a.ring_id,
  }));

  // Normalise fraud rings
  const fraud_rings: FraudRing[] = (raw.fraud_rings || []).map((r: any) => ({
    ring_id: r.ring_id,
    member_accounts: r.member_accounts || [],
    total_amount: r.total_amount ?? 0,
    pattern_type: r.pattern_type || "unknown",
    risk_score: r.risk_score ?? 0,
    avg_suspicion: r.avg_suspicion ?? r.risk_score ?? 0,
  }));

  // Normalise summary
  const summary: Summary = {
    total_transactions: raw.summary?.total_transactions ?? raw.summary?.total_accounts_analyzed ?? graph.links.length,
    total_accounts: raw.summary?.total_accounts ?? raw.summary?.total_accounts_analyzed ?? graph.nodes.length,
    suspicious_count: raw.summary?.suspicious_count ?? raw.summary?.suspicious_accounts_flagged ?? suspicious_accounts.length,
    fraud_ring_count: raw.summary?.fraud_ring_count ?? raw.summary?.fraud_rings_detected ?? fraud_rings.length,
    avg_risk_score: raw.summary?.avg_risk_score ?? 0,
    processing_time_seconds: raw.summary?.processing_time_seconds ?? 0,
  };

  return { suspicious_accounts, fraud_rings, graph, summary };
}

function riskLevelFromScore(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

/**
 * Upload a CSV file and run the detection pipeline.
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Upload failed");
    throw new Error(text);
  }
  const raw = await res.json();
  return normalizeResponse(raw);
}

/**
 * Get cached detection results.
 */
export async function getResults(): Promise<UploadResponse> {
  const raw = await request<any>("/results");
  return normalizeResponse(raw);
}

/**
 * Get graph data for visualization.
 */
export async function getGraph(): Promise<GraphData> {
  return request<GraphData>("/graph");
}

/**
 * Health check.
 */
export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}
