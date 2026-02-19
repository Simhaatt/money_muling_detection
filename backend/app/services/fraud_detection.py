"""
fraud_detection.py -- End-to-End Money Muling Detection Pipeline
==================================================================
Hackathon-grade orchestrator that chains:

    CSV -> Graph -> Features -> Scoring -> Temporal Smurfing
        -> Shell Detection -> False-Positive Suppression
        -> Ring Assembly -> JSON Output

Pipeline stages:
    1.  Build transaction graph            (graph_builder)
    2.  Extract graph features             (graph_features)
    3.  Compute base risk scores           (scoring)
    4.  Temporal smurfing detection         (72-hour rolling window)
    5.  Shell account detection             (chain intermediaries)
    6.  False-positive suppression          (payroll / merchant / gateway)
    7.  Cycle-based fraud ring assembly
    8.  Community-based fraud ring assembly
    9.  Compile exact hackathon JSON output

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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SMURF_WINDOW_HOURS: int = 72
_SMURF_TX_THRESHOLD: int = 10
_SMURF_BONUS: int = 15

_SHELL_CHAIN_DEPTH: int = 4
_SHELL_MIN_DEGREE: int = 2
_SHELL_MAX_DEGREE: int = 3
_SHELL_BONUS: int = 30

_PAYROLL_MIN_OUT: int = 10
_PAYROLL_FORWARD_PCT: float = 0.20
_PAYROLL_REDUCTION: float = 0.30

_MERCHANT_MIN_IN: int = 20
_MERCHANT_MAX_OUT: int = 1
_MERCHANT_REDUCTION: float = 0.30

_GATEWAY_MIN_IN: int = 50
_GATEWAY_MIN_OUT: int = 50
_GATEWAY_REDUCTION: float = 0.40

_SUSPICIOUS_THRESHOLD: float = 40.0
_COMMUNITY_MIN_SIZE: int = 3
_COMMUNITY_MIN_AVG_SCORE: float = 40.0


# =========================================================================
# PART 2 -- Temporal smurfing (72-hour rule)
# =========================================================================
def _detect_temporal_smurfing(
    df: pd.DataFrame,
    scores: dict[str, dict[str, Any]],
    sender_col: str,
    timestamp_col: str,
) -> None:
    """Flag accounts with >= 10 transactions inside any 72-hour window.

    Mutates *scores* in-place: adds ``_SMURF_BONUS`` to
    ``suspicion_score`` and appends ``"high_velocity"`` to
    ``detected_patterns``.
    """
    if df.empty:
        return

    work = df[[sender_col, timestamp_col]].copy()
    work[timestamp_col] = pd.to_datetime(work[timestamp_col], errors="coerce")
    work.dropna(subset=[timestamp_col], inplace=True)
    work.sort_values(timestamp_col, inplace=True)

    window = pd.Timedelta(hours=_SMURF_WINDOW_HOURS)

    for account, grp in work.groupby(sender_col, sort=False):
        if len(grp) < _SMURF_TX_THRESHOLD:
            continue
        timestamps = grp[timestamp_col].values
        # Sliding-window count: for each tx, count how many other txs
        # fall within the next 72 h using a two-pointer scan.
        n = len(timestamps)
        right = 0
        flagged = False
        for left in range(n):
            while right < n and (timestamps[right] - timestamps[left]) <= window:
                right += 1
            if (right - left) >= _SMURF_TX_THRESHOLD:
                flagged = True
                break
        if flagged and account in scores:
            entry = scores[account]
            entry["suspicion_score"] = min(
                100.0, entry["suspicion_score"] + _SMURF_BONUS
            )
            if "high_velocity" not in entry["detected_patterns"]:
                entry["detected_patterns"].append("high_velocity")

    logger.debug("Temporal smurfing pass complete")


# =========================================================================
# PART 3 -- Shell account detection
# =========================================================================
def _detect_shell_accounts(
    graph: nx.DiGraph,
    scores: dict[str, dict[str, Any]],
) -> None:
    """Flag intermediate nodes in chains of length >= 3 whose total
    degree is between 2 and 3 (low-activity pass-through accounts).

    Optimised O(N) single-pass instead of O(N²) path enumeration.
    A node qualifies as a shell account when:
        1. ``_SHELL_MIN_DEGREE <= total_degree <= _SHELL_MAX_DEGREE``
        2. Has at least 1 predecessor **and** 1 successor (pass-through)
        3. The chain through it has depth >= 3 (at least one predecessor
           has its own predecessor, or one successor has its own successor)

    Mutates *scores* in-place.
    """
    shell_nodes: set[str] = set()

    in_deg = dict(graph.in_degree())
    out_deg = dict(graph.out_degree())

    for node in graph.nodes():
        node_in = in_deg[node]
        node_out = out_deg[node]
        total_deg = node_in + node_out

        # Condition 1: degree within shell range
        if not (_SHELL_MIN_DEGREE <= total_deg <= _SHELL_MAX_DEGREE):
            continue

        # Condition 2: must be a pass-through (has both incoming and outgoing)
        if node_in < 1 or node_out < 1:
            continue

        # Condition 3: verify chain depth >= 3 (at least 4 nodes in the path)
        # Check if any predecessor has its own predecessor, OR
        # any successor has its own successor.
        has_depth = False
        for pred in graph.predecessors(node):
            if in_deg[pred] > 0:
                has_depth = True
                break
        if not has_depth:
            for succ in graph.successors(node):
                if out_deg[succ] > 0:
                    has_depth = True
                    break
        if not has_depth:
            continue

        shell_nodes.add(node)

    for node in shell_nodes:
        if node in scores:
            entry = scores[node]
            entry["suspicion_score"] = min(
                100.0, entry["suspicion_score"] + _SHELL_BONUS
            )
            if "shell_account" not in entry["detected_patterns"]:
                entry["detected_patterns"].append("shell_account")

    logger.debug("Shell accounts detected: %d", len(shell_nodes))


# =========================================================================
# PART 4 -- False-positive suppression
# =========================================================================
def _suppress_false_positives(
    graph: nx.DiGraph,
    scores: dict[str, dict[str, Any]],
) -> None:
    """Reduce scores for likely-legitimate accounts.

    Three heuristics:
        * **Payroll**: high out_degree, few receivers forward funds.
        * **Merchant**: high in_degree, almost zero out_degree.
        * **Payment gateway**: very high in *and* out degree.

    Mutates *scores* in-place.
    """
    for node in graph.nodes():
        if node not in scores:
            continue
        entry = scores[node]
        in_deg = graph.in_degree(node)
        out_deg = graph.out_degree(node)

        # --- Payroll pattern ---
        if out_deg >= _PAYROLL_MIN_OUT:
            successors = list(graph.successors(node))
            forwarding = sum(
                1 for s in successors if graph.out_degree(s) > 0
            )
            if len(successors) > 0 and (forwarding / len(successors)) < _PAYROLL_FORWARD_PCT:
                entry["suspicion_score"] = max(
                    0.0, entry["suspicion_score"] * (1 - _PAYROLL_REDUCTION)
                )
                if "likely_payroll" not in entry["detected_patterns"]:
                    entry["detected_patterns"].append("likely_payroll")

        # --- Merchant pattern ---
        if in_deg >= _MERCHANT_MIN_IN and out_deg <= _MERCHANT_MAX_OUT:
            entry["suspicion_score"] = max(
                0.0, entry["suspicion_score"] * (1 - _MERCHANT_REDUCTION)
            )
            if "likely_merchant" not in entry["detected_patterns"]:
                entry["detected_patterns"].append("likely_merchant")

        # --- Payment gateway pattern ---
        if in_deg >= _GATEWAY_MIN_IN and out_deg >= _GATEWAY_MIN_OUT:
            entry["suspicion_score"] = max(
                0.0, entry["suspicion_score"] * (1 - _GATEWAY_REDUCTION)
            )
            if "likely_gateway" not in entry["detected_patterns"]:
                entry["detected_patterns"].append("likely_gateway")

    logger.debug("False-positive suppression complete")


# =========================================================================
# PART 5 + 6 -- Ring assembly (cycles + communities)
# =========================================================================
def _assemble_fraud_rings(
    features: dict[str, Any],
    scores: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build fraud ring objects from cycles and communities.

    Returns list of ring dicts matching the hackathon JSON schema.
    Ring IDs are deterministic and sequential: RING_001, RING_002, ...
    """
    rings: list[dict[str, Any]] = []
    ring_counter = 0

    # -- Cycle-based rings (Part 5) -----------------------------------------
    cycles: list[list[str]] = features.get("cycles", [])
    for cycle in cycles:
        ring_counter += 1
        ring_id = f"RING_{ring_counter:03d}"
        members = list(cycle)
        avg_score = _avg_score(members, scores)

        # Assign ring_id back to member accounts
        for m in members:
            if m in scores:
                scores[m]["ring_id"] = ring_id
                if f"cycle_length_{len(cycle)}" not in scores[m]["detected_patterns"]:
                    scores[m]["detected_patterns"].append(
                        f"cycle_length_{len(cycle)}"
                    )

        rings.append({
            "ring_id": ring_id,
            "member_accounts": members,
            "pattern_type": "cycle",
            "risk_score": float(round(avg_score, 2)),
        })

    # -- Community-based rings (Part 6) -------------------------------------
    # Track existing ring member sets to avoid duplicating cycle rings
    existing_ring_sets: list[frozenset[str]] = [
        frozenset(r["member_accounts"]) for r in rings
    ]

    communities: dict[str, int] = features.get("communities", {})
    comm_members: dict[int, list[str]] = defaultdict(list)
    for node, cid in communities.items():
        comm_members[cid].append(node)

    for cid in sorted(comm_members):  # sorted for determinism
        members = comm_members[cid]
        if len(members) < _COMMUNITY_MIN_SIZE:
            continue
        avg_score = _avg_score(members, scores)
        if avg_score < _COMMUNITY_MIN_AVG_SCORE:
            continue

        # Skip if community members duplicate an existing ring:
        #   - exact match  (member_set == existing)
        #   - subset        (member_set ⊂ existing)
        #   - superset      (existing ⊂ member_set) — community absorbs a
        #     smaller cycle ring, still counts as duplicate
        member_set = frozenset(members)
        if any(member_set <= existing or existing <= member_set
               for existing in existing_ring_sets):
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
            "risk_score": float(round(avg_score, 2)),
        })

        existing_ring_sets.append(member_set)

    logger.debug("Fraud rings assembled: %d", len(rings))
    return rings


def _avg_score(
    members: list[str], scores: dict[str, dict[str, Any]]
) -> float:
    """Compute average suspicion_score for a list of accounts."""
    vals = [scores[m]["suspicion_score"] for m in members if m in scores]
    return sum(vals) / len(vals) if vals else 0.0


# =========================================================================
# Column resolution helper
# =========================================================================
def _resolve_cols(df: pd.DataFrame) -> tuple[str, str, str]:
    """Return (sender_col, receiver_col, timestamp_col) from the DataFrame."""
    if "sender" in df.columns:
        return "sender", "receiver", "timestamp"
    return "sender_id", "receiver_id", "timestamp"


# =========================================================================
# PUBLIC ENTRY POINT
# =========================================================================
def run_detection_pipeline(df: pd.DataFrame) -> dict[str, Any]:
    """Execute the full money-muling detection pipeline.

    Parameters
    ----------
    df : pd.DataFrame
        Transaction data with columns:
        ``transaction_id``, ``sender_id``, ``receiver_id``,
        ``amount``, ``timestamp``  (or ``sender``/``receiver`` variants).

    Returns
    -------
    dict
        Exact hackathon JSON schema::

            {
                "suspicious_accounts": [...],
                "fraud_rings": [...],
                "summary": {...}
            }
    """
    t_start = time.time()
    logger.info("Starting detection pipeline (%d rows)", len(df))

    sender_col, receiver_col, timestamp_col = _resolve_cols(df)

    # Ensure timestamp is datetime
    df[timestamp_col] = pd.to_datetime(df[timestamp_col], errors="coerce")

    # ── Step 1: Build graph ------------------------------------------------
    graph: nx.DiGraph = build_graph(df)
    logger.info("Graph built: %d nodes, %d edges",
                graph.number_of_nodes(), graph.number_of_edges())

    # ── Step 2: Extract features -------------------------------------------
    features: dict[str, Any] = extract_graph_features(graph)

    # ── Step 3: Base risk scores -------------------------------------------
    scores_df: pd.DataFrame = compute_risk_scores(graph, features)

    # Build mutable per-account dict for in-place mutation in later stages.
    # itertuples() is 10-100x faster than iterrows().
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
        }

    # ── Step 4: Temporal smurfing ------------------------------------------
    _detect_temporal_smurfing(df, scores, sender_col, timestamp_col)

    # ── Step 5: Shell account detection ------------------------------------
    _detect_shell_accounts(graph, scores)

    # ── Step 6: False-positive suppression ---------------------------------
    _suppress_false_positives(graph, scores)

    # ── Step 7 + 8: Ring assembly ------------------------------------------
    fraud_rings = _assemble_fraud_rings(features, scores)

    # ── Step 9: Compile output ---------------------------------------------
    # Round and cap final scores
    for entry in scores.values():
        entry["suspicion_score"] = round(
            min(100.0, max(0.0, entry["suspicion_score"])), 1
        )

    # Build ring_id lookup for graph_json node annotation
    account_ring_map: dict[str, str] = {}
    for e in scores.values():
        if e["ring_id"]:
            account_ring_map[e["account_id"]] = e["ring_id"]

    # Suspicious accounts: score >= 40, sorted descending
    suspicious_set: set[str] = set()
    suspicious_accounts: list[dict[str, Any]] = sorted(
        [
            {
                "account_id": e["account_id"],
                "suspicion_score": e["suspicion_score"],
                "detected_patterns": e["detected_patterns"],
                "ring_id": e["ring_id"] or "NONE",
            }
            for e in scores.values()
            if e["suspicion_score"] >= _SUSPICIOUS_THRESHOLD
        ],
        key=lambda x: x["suspicion_score"],
        reverse=True,
    )
    suspicious_set = {a["account_id"] for a in suspicious_accounts}

    # ── Step 10: Build graph JSON for frontend visualization ---------------
    graph_json = graph_to_json(graph)
    # Annotate nodes with risk info for frontend coloring
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

    summary: dict[str, Any] = {
        "total_accounts_analyzed": graph.number_of_nodes(),
        "suspicious_accounts_flagged": len(suspicious_accounts),
        "fraud_rings_detected": len(fraud_rings),
        "processing_time_seconds": processing_time,
    }

    logger.info(
        "Pipeline complete in %.3fs -- %d suspicious, %d rings",
        processing_time, len(suspicious_accounts), len(fraud_rings),
    )

    return {
        "suspicious_accounts": suspicious_accounts,
        "fraud_rings": fraud_rings,
        "summary": summary,
        "graph_json": graph_json,
    }
