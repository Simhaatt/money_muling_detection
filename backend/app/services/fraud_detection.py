"""
fraud_detection.py -- End-to-End Money Muling Detection Pipeline
==================================================================
Orchestrates: CSV -> Graph -> Features -> Scoring -> Ring Assembly -> JSON

Pipeline stages:
    1.  Build transaction graph            (graph_builder)
    2.  Extract graph features             (graph_features) - includes all
        edge case detectors: cycles, 72h smurfing, shell chains,
        velocity, forwarding ratios, cycle metadata
    3.  Compute risk scores with           (scoring) - additive +
        subtractive scoring: Pattern Score - Legitimacy Score
    4.  Assemble fraud rings from cycles and shell chains
    5.  Compile hackathon JSON output with explanations

Edge cases handled:
    1. Payroll accounts (fan-out, low forwarding) -> score reduced
    2. Merchant accounts (fan-in, near-zero out) -> score reduced
    3. Payment gateways (high in+out, no cycles) -> score reduced
    4. Family cycles (single, low freq) -> reduced cycle weight
    5. Supply chain chains (slow) -> 72h temporal rule
    6. Salary-then-spending (low out-degree) -> reduced
    7. High-degree stable accounts -> velocity check
    8. Fake low-amount cycles -> amount weighting
    9. High-degree no-ring -> community only boosts primary signals
    10. Shell accounts (degree 2-3 intermediaries) -> detected

Located in: app/services/fraud_detection.py
Called by:   app/routes/upload_routes.py
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

import networkx as nx
import pandas as pd

from app.services.graph_builder import build_graph, graph_to_json, get_graph_stats
from app.services.graph_features import extract_graph_features
from app.services.scoring import compute_risk_scores
from app.services.explanation_generator import generate_explanation

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SUSPICIOUS_THRESHOLD: float = 40.0
_COMMUNITY_MIN_SIZE: int = 3
_COMMUNITY_MIN_AVG_SCORE: float = 40.0


# =========================================================================
# Ring assembly (cycles + shell chains)
# =========================================================================
def _assemble_fraud_rings(
    features: dict[str, Any],
    scores: dict[str, dict[str, Any]],
    graph: nx.DiGraph | None = None,
) -> list[dict[str, Any]]:
    """Build fraud ring objects from cycles and shell chains.
    Ring IDs are deterministic: RING_001, RING_002, ...
    Only real patterns get ring IDs (no community-only rings).
    """
    rings: list[dict[str, Any]] = []
    ring_counter = 0

    # -- Cycle-based rings --
    cycles: list[list[str]] = features.get("cycles", [])
    for cycle in cycles:
        ring_counter += 1
        ring_id = f"RING_{ring_counter:03d}"
        members = list(cycle)
        avg_score = _avg_score(members, scores)

        for m in members:
            if m in scores:
                scores[m]["ring_id"] = ring_id
                pat = f"cycle_length_{len(cycle)}"
                if pat not in scores[m]["detected_patterns"]:
                    scores[m]["detected_patterns"].append(pat)

        rings.append({
            "ring_id": ring_id,
            "member_accounts": members,
            "pattern_type": "cycle",
            "risk_score": float(round(avg_score, 2)),
            "total_amount": _ring_total_amount(members, graph),
        })

    # -- Shell chain-based rings --
    shell_data = features.get("shell_data", {})
    shell_chains = shell_data.get("shell_chains", [])
    existing_ring_sets = [frozenset(r["member_accounts"]) for r in rings]

    for chain in shell_chains:
        member_set = frozenset(chain)
        # Skip if duplicates an existing cycle ring
        if any(member_set <= ex or ex <= member_set for ex in existing_ring_sets):
            continue

        ring_counter += 1
        ring_id = f"RING_{ring_counter:03d}"
        members = list(chain)
        avg_score = _avg_score(members, scores)

        for m in members:
            if m in scores and scores[m]["ring_id"] is None:
                scores[m]["ring_id"] = ring_id

        rings.append({
            "ring_id": ring_id,
            "member_accounts": members,
            "pattern_type": "shell_chain",
            "risk_score": float(round(avg_score, 2)),
            "total_amount": _ring_total_amount(members, graph),
        })
        existing_ring_sets.append(member_set)

    # -- Community-based rings (only for suspicious communities) --
    communities: dict[str, int] = features.get("communities", {})
    comm_members: dict[int, list[str]] = defaultdict(list)
    for node, cid in communities.items():
        comm_members[cid].append(node)

    for cid in sorted(comm_members):
        members = comm_members[cid]
        if len(members) < _COMMUNITY_MIN_SIZE:
            continue
        avg = _avg_score(members, scores)
        if avg < _COMMUNITY_MIN_AVG_SCORE:
            continue

        member_set = frozenset(members)
        if any(member_set <= ex or ex <= member_set for ex in existing_ring_sets):
            continue

        ring_counter += 1
        ring_id = f"RING_{ring_counter:03d}"

        for m in members:
            if m in scores and scores[m]["ring_id"] is None:
                scores[m]["ring_id"] = ring_id
                if "community_member" not in scores[m]["detected_patterns"]:
                    scores[m]["detected_patterns"].append("community_member")

        rings.append({
            "ring_id": ring_id,
            "member_accounts": members,
            "pattern_type": "community",
            "risk_score": float(round(avg, 2)),
            "total_amount": _ring_total_amount(members, graph),
        })
        existing_ring_sets.append(member_set)

    logger.debug("Fraud rings assembled: %d", len(rings))
    return rings


def _avg_score(members: list[str], scores: dict[str, dict[str, Any]]) -> float:
    vals = [scores[m]["suspicion_score"] for m in members if m in scores]
    return sum(vals) / len(vals) if vals else 0.0


def _ring_total_amount(members: list[str], graph: nx.DiGraph | None) -> float:
    """Sum total_amount on all edges between ring members."""
    if graph is None:
        return 0.0
    member_set = set(members)
    total = 0.0
    for u, v, data in graph.edges(data=True):
        if u in member_set and v in member_set:
            total += data.get("total_amount", 0.0)
    return float(round(total, 2))


# =========================================================================
# Per-account explanation builder
# =========================================================================
def _build_account_explanation(entry: dict[str, Any]) -> str:
    """Build a richer, per-account explanation by combining the generic
    pattern text with account-specific context (connections, ring, score)."""
    base_text = generate_explanation(entry["detected_patterns"])

    parts: list[str] = [base_text]

    # Add ring context
    if entry.get("ring_id"):
        parts.append(f"This account is a member of fraud ring {entry['ring_id']}.")

    # Add connectivity context
    in_d = entry.get("in_degree", 0)
    out_d = entry.get("out_degree", 0)
    if in_d > 0 or out_d > 0:
        parts.append(
            f"It has {in_d} incoming and {out_d} outgoing connections"
            f" (total degree: {in_d + out_d})."
        )

    # Add centrality context when notable
    pr = entry.get("pagerank", 0.0)
    bt = entry.get("betweenness", 0.0)
    if pr > 0.01:
        parts.append(f"Its PageRank centrality is {pr:.4f}, indicating structural importance.")
    if bt > 0.01:
        parts.append(f"Its betweenness centrality is {bt:.4f}, suggesting it bridges account clusters.")

    return " ".join(parts)


# =========================================================================
# Column resolution
# =========================================================================
def _resolve_cols(df: pd.DataFrame) -> tuple[str, str, str]:
    if "sender" in df.columns:
        return "sender", "receiver", "timestamp"
    return "sender_id", "receiver_id", "timestamp"


# =========================================================================
# PUBLIC ENTRY POINT
# =========================================================================
def run_detection_pipeline(df: pd.DataFrame) -> dict[str, Any]:
    """Execute the full money-muling detection pipeline.

    Returns hackathon JSON:
        {
            "suspicious_accounts": [...],
            "fraud_rings": [...],
            "summary": {...},
            "graph_json": {...}
        }
    """
    t_start = time.time()
    logger.info("Starting detection pipeline (%d rows)", len(df))

    sender_col, receiver_col, timestamp_col = _resolve_cols(df)
    df[timestamp_col] = pd.to_datetime(df[timestamp_col], errors="coerce")

    # Step 1: Build graph
    graph: nx.DiGraph = build_graph(df)
    logger.info("Graph: %d nodes, %d edges", graph.number_of_nodes(), graph.number_of_edges())

    # Step 2: Extract ALL features (passes tx_df for temporal analysis)
    features: dict[str, Any] = extract_graph_features(graph, tx_df=df)

    # Step 3: Score with additive + subtractive logic
    scores_df: pd.DataFrame = compute_risk_scores(graph, features, tx_df=df)

    # Build mutable per-account dict
    scores: dict[str, dict[str, Any]] = {}
    for row in scores_df.itertuples(index=False):
        scores[row.account_id] = {
            "account_id": row.account_id,
            "suspicion_score": float(row.risk_score),
            "detected_patterns": list(getattr(row, "reasons", [])),
            "ring_id": None,
            "pagerank": float(getattr(row, "pagerank", 0.0)),
            "betweenness": float(getattr(row, "betweenness", 0.0)),
            "in_degree": int(getattr(row, "in_degree", 0)),
            "out_degree": int(getattr(row, "out_degree", 0)),
            "is_payroll": bool(getattr(row, "is_payroll", False)),
            "is_merchant": bool(getattr(row, "is_merchant", False)),
            "is_gateway": bool(getattr(row, "is_gateway", False)),
        }

    # Step 4: Ring assembly
    fraud_rings = _assemble_fraud_rings(features, scores, graph)

    # Step 5: Compile output
    for entry in scores.values():
        entry["suspicion_score"] = round(
            min(100.0, max(0.0, entry["suspicion_score"])), 1
        )

    # Build ring_id lookup
    account_ring_map: dict[str, str] = {}
    for e in scores.values():
        if e["ring_id"]:
            account_ring_map[e["account_id"]] = e["ring_id"]

    # Suspicious accounts: score >= 40, exclude payroll/merchant/gateway
    suspicious_accounts: list[dict[str, Any]] = sorted(
        [
            {
                "account_id": e["account_id"],
                "suspicion_score": e["suspicion_score"],
                "detected_patterns": e["detected_patterns"],
                "explanation": _build_account_explanation(e),
                "ring_id": e["ring_id"] or "NONE",
            }
            for e in scores.values()
            if e["suspicion_score"] >= _SUSPICIOUS_THRESHOLD
            and not e.get("is_payroll", False)
            and not e.get("is_merchant", False)
            and not e.get("is_gateway", False)
        ],
        key=lambda x: (-x["suspicion_score"], x["account_id"]),
    )
    suspicious_set = {a["account_id"] for a in suspicious_accounts}

    # Annotate graph JSON
    graph_json = graph_to_json(graph)
    for node_data in graph_json["nodes"]:
        nid = node_data["id"]
        if nid in scores:
            node_data["suspicion_score"] = scores[nid]["suspicion_score"]
            node_data["is_suspicious"] = nid in suspicious_set
            node_data["ring_id"] = account_ring_map.get(nid, "NONE")
            node_data["detected_patterns"] = scores[nid]["detected_patterns"]
        else:
            node_data["suspicion_score"] = 0.0
            node_data["is_suspicious"] = False
            node_data["ring_id"] = "NONE"
            node_data["detected_patterns"] = []

    processing_time = round(time.time() - t_start, 3)

    summary = {
        "total_accounts_analyzed": graph.number_of_nodes(),
        "suspicious_accounts_flagged": len(suspicious_accounts),
        "fraud_rings_detected": len(fraud_rings),
        "processing_time_seconds": processing_time,
    }

    logger.info("Pipeline done in %.3fs -- %d suspicious, %d rings",
                processing_time, len(suspicious_accounts), len(fraud_rings))

    return {
        "suspicious_accounts": suspicious_accounts,
        "fraud_rings": fraud_rings,
        "summary": summary,
        "graph_json": graph_json,
    }
