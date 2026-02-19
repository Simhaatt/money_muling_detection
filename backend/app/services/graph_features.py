"""
graph_features.py - Feature Extraction from Transaction Graphs
================================================================
Extracts fraud-relevant graph metrics from a directed transaction graph
built by graph_builder.py.

Feature categories
------------------
PRIMARY detection signals:
    Cycles (3-5)           - directed fund round-tripping
    Smurfing (72h window)  - fan-in/fan-out with >=10 unique counterparties
    Shell chains (3+ hops) - layered pass-through intermediaries

SUPPORTING signals:
    Centrality   - PageRank, betweenness centrality
    Degree       - in_degree, out_degree per node
    Communities  - Louvain partition on the undirected projection

SUPPRESSION helpers:
    Payroll / Merchant / Gateway detection
    Forwarding ratio computation
    Velocity (tx/day) computation
    Cycle metadata (frequency, amounts)

Located in: app/services/graph_features.py
Called by:   app/services/fraud_detection.py -> scoring.py
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta
from typing import Any

import community as community_louvain  # python-louvain
import networkx as nx
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_FAN_IN_MIN_IN_DEGREE: int = 10
_FAN_IN_MAX_OUT_DEGREE: int = 2
_FAN_OUT_MIN_OUT_DEGREE: int = 10
_FAN_OUT_MAX_IN_DEGREE: int = 2
_MAX_CYCLE_LENGTH: int = 5
_MAX_CYCLES_COLLECTED: int = 500
_SMURFING_UNIQUE_THRESHOLD: int = 10
_SMURFING_WINDOW_HOURS: int = 72
_SHELL_MIN_HOPS: int = 3
_SHELL_DEGREE_MIN: int = 2
_SHELL_DEGREE_MAX: int = 3


# =========================================================================
# Helper: find column name
# =========================================================================
def _find_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Find first matching column name from candidates list."""
    for col in candidates:
        if col in df.columns:
            return col
    return None


# =========================================================================
# 1. Centrality
# =========================================================================
def compute_pagerank(G: nx.DiGraph) -> dict[str, float]:
    """PageRank weighted by total_amount."""
    if G.number_of_nodes() == 0:
        return {}
    return nx.pagerank(G, weight="total_amount")


def compute_betweenness(G: nx.DiGraph) -> dict[str, float]:
    """Betweenness centrality (approximate for large graphs)."""
    n = G.number_of_nodes()
    if n == 0:
        return {}
    _SAMPLE_THRESHOLD = 5_000
    if n > _SAMPLE_THRESHOLD:
        k = min(200, n)
        return nx.betweenness_centrality(
            G, k=k, weight="total_amount", normalized=True, seed=42
        )
    return nx.betweenness_centrality(G, weight="total_amount", normalized=True)


# =========================================================================
# 2. Degree features
# =========================================================================
def compute_degree_features(G: nx.DiGraph) -> tuple[dict[str, int], dict[str, int]]:
    """Return (in_degree_dict, out_degree_dict)."""
    return dict(G.in_degree()), dict(G.out_degree())


# =========================================================================
# 3. Fan-in / Fan-out (basic degree)
# =========================================================================
def detect_fan_in(
    G: nx.DiGraph,
    min_in: int = _FAN_IN_MIN_IN_DEGREE,
    max_out: int = _FAN_IN_MAX_OUT_DEGREE,
    *,
    _in_deg: dict[str, int] | None = None,
    _out_deg: dict[str, int] | None = None,
) -> list[str]:
    """Degree-based fan-in detection."""
    in_deg = _in_deg or dict(G.in_degree())
    out_deg = _out_deg or dict(G.out_degree())
    return [n for n in G.nodes() if in_deg[n] >= min_in and out_deg[n] <= max_out]


def detect_fan_out(
    G: nx.DiGraph,
    min_out: int = _FAN_OUT_MIN_OUT_DEGREE,
    max_in: int = _FAN_OUT_MAX_IN_DEGREE,
    *,
    _in_deg: dict[str, int] | None = None,
    _out_deg: dict[str, int] | None = None,
) -> list[str]:
    """Degree-based fan-out detection."""
    in_deg = _in_deg or dict(G.in_degree())
    out_deg = _out_deg or dict(G.out_degree())
    return [n for n in G.nodes() if out_deg[n] >= min_out and in_deg[n] <= max_in]


# =========================================================================
# 4. Cycle detection (length 3-5, directed)
# =========================================================================
def detect_cycles(
    G: nx.DiGraph,
    length_bound: int = _MAX_CYCLE_LENGTH,
    max_cycles: int = _MAX_CYCLES_COLLECTED,
) -> tuple[list[list[str]], list[str]]:
    """Find directed simple cycles of length 3 to 5.
    Returns (cycles_list, nodes_in_cycles).
    """
    cycles: list[list[str]] = []
    seen: set[str] = set()
    nodes_in_cycles: list[str] = []

    for cycle in nx.simple_cycles(G, length_bound=length_bound):
        if len(cycle) < 3:
            continue
        cycles.append(cycle)
        for node in cycle:
            if node not in seen:
                seen.add(node)
                nodes_in_cycles.append(node)
        if len(cycles) >= max_cycles:
            logger.warning("Cycle cap reached (%d).", max_cycles)
            break

    logger.debug("Cycles (3-5): %d | Unique nodes: %d",
                 len(cycles), len(nodes_in_cycles))
    return cycles, nodes_in_cycles


# Alias
detect_cycles_3_to_5 = detect_cycles


# =========================================================================
# 5. Smurfing: fan-in/fan-out within 72-hour sliding window
# =========================================================================
def detect_fan_in_out_72h(
    G: nx.DiGraph,
    tx_df: pd.DataFrame | None,
    window_hours: int = _SMURFING_WINDOW_HOURS,
    unique_threshold: int = _SMURFING_UNIQUE_THRESHOLD,
) -> dict[str, Any]:
    """Detect smurfing: >=10 unique senders/receivers within any 72h window.

    Returns dict with: fan_in_nodes_72h, fan_out_nodes_72h,
                       fan_in_counts, fan_out_counts
    """
    empty = {
        "fan_in_nodes_72h": [], "fan_out_nodes_72h": [],
        "fan_in_counts": {}, "fan_out_counts": {},
    }
    if tx_df is None or tx_df.empty:
        return empty

    ts_col = _find_column(tx_df, ["timestamp", "Timestamp", "date", "Date"])
    sender_col = _find_column(tx_df, ["sender", "sender_id", "source", "from", "from_id", "Source"])
    receiver_col = _find_column(tx_df, ["receiver", "receiver_id", "target", "to", "to_id", "Target"])

    if not all([ts_col, sender_col, receiver_col]):
        logger.warning("Missing columns for 72h detection. Falling back to degree.")
        return _fan_in_out_degree_fallback(G, unique_threshold)

    df = tx_df.copy()
    df["_ts"] = pd.to_datetime(df[ts_col], errors="coerce")
    df = df.dropna(subset=["_ts"]).sort_values("_ts")

    window = timedelta(hours=window_hours)

    # Fan-in: for each receiver, count max unique senders in window
    fan_in_counts: dict[str, int] = {}
    for recv, grp in df.groupby(receiver_col, sort=False):
        if len(grp) < unique_threshold:
            continue
        mx = _max_unique_in_window(grp["_ts"].values, grp[sender_col].values, window)
        if mx >= unique_threshold:
            fan_in_counts[str(recv)] = mx

    # Fan-out: for each sender, count max unique receivers in window
    fan_out_counts: dict[str, int] = {}
    for send, grp in df.groupby(sender_col, sort=False):
        if len(grp) < unique_threshold:
            continue
        mx = _max_unique_in_window(grp["_ts"].values, grp[receiver_col].values, window)
        if mx >= unique_threshold:
            fan_out_counts[str(send)] = mx

    logger.debug("72h fan-in: %d | fan-out: %d", len(fan_in_counts), len(fan_out_counts))
    return {
        "fan_in_nodes_72h": list(fan_in_counts.keys()),
        "fan_out_nodes_72h": list(fan_out_counts.keys()),
        "fan_in_counts": fan_in_counts,
        "fan_out_counts": fan_out_counts,
    }


def _max_unique_in_window(
    timestamps: np.ndarray, counterparties: np.ndarray, window: timedelta,
) -> int:
    """Sliding window: max unique counterparties within window."""
    if len(timestamps) == 0:
        return 0
    ts = pd.to_datetime(timestamps)
    max_unique = 0
    left = 0
    for right in range(len(ts)):
        while left < right and (ts[right] - ts[left]) > window:
            left += 1
        unique = len(set(counterparties[left:right + 1]))
        if unique > max_unique:
            max_unique = unique
    return max_unique


def _fan_in_out_degree_fallback(G: nx.DiGraph, threshold: int) -> dict[str, Any]:
    """Fallback when no timestamps available."""
    in_deg = dict(G.in_degree())
    out_deg = dict(G.out_degree())
    fan_in = [n for n in G.nodes() if in_deg.get(n, 0) >= threshold]
    fan_out = [n for n in G.nodes() if out_deg.get(n, 0) >= threshold]
    return {
        "fan_in_nodes_72h": fan_in,
        "fan_out_nodes_72h": fan_out,
        "fan_in_counts": {n: in_deg[n] for n in fan_in},
        "fan_out_counts": {n: out_deg[n] for n in fan_out},
    }


# =========================================================================
# 6. Layered Shell Chain Detection (Edge Case 10)
# =========================================================================
def detect_layered_shell_chains(
    G: nx.DiGraph,
    min_hops: int = _SHELL_MIN_HOPS,
    degree_min: int = _SHELL_DEGREE_MIN,
    degree_max: int = _SHELL_DEGREE_MAX,
) -> dict[str, Any]:
    """Detect chains >=3 hops where intermediates have degree 2-3.

    Returns dict with: shell_chains, shell_nodes, nodes_in_chains
    """
    in_deg = dict(G.in_degree())
    out_deg = dict(G.out_degree())

    # Shell candidates: degree 2-3, has both in and out
    shell_candidates: set[str] = set()
    for node in G.nodes():
        td = in_deg.get(node, 0) + out_deg.get(node, 0)
        if degree_min <= td <= degree_max and in_deg.get(node, 0) >= 1 and out_deg.get(node, 0) >= 1:
            shell_candidates.add(node)

    chains: list[list[str]] = []
    shell_nodes: set[str] = set()
    all_chain_nodes: set[str] = set()
    visited_chains: set[tuple[str, ...]] = set()

    # Trace from non-shell sources through shell intermediaries
    for source in sorted(G.nodes()):
        if source in shell_candidates:
            continue
        if out_deg.get(source, 0) == 0:
            continue
        for nbr in sorted(G.successors(source)):
            if nbr in shell_candidates:
                chain = [source, nbr]
                _trace_shell_chain(
                    G, chain, shell_candidates, chains, shell_nodes,
                    all_chain_nodes, visited_chains, min_hops, max_depth=8,
                )

    logger.debug("Shell chains: %d | Shell nodes: %d", len(chains), len(shell_nodes))
    return {
        "shell_chains": chains,
        "shell_nodes": sorted(shell_nodes),
        "nodes_in_chains": sorted(all_chain_nodes),
    }


def _trace_shell_chain(
    G, current_chain, shell_candidates, chains, shell_nodes,
    all_chain_nodes, visited, min_hops, max_depth,
):
    """Recursively trace chains through low-degree intermediates."""
    last = current_chain[-1]
    for succ in sorted(G.successors(last)):
        if succ in current_chain:
            continue
        new_chain = current_chain + [succ]
        if succ in shell_candidates and len(new_chain) <= max_depth:
            _trace_shell_chain(
                G, new_chain, shell_candidates, chains, shell_nodes,
                all_chain_nodes, visited, min_hops, max_depth,
            )
        else:
            if len(new_chain) - 1 >= min_hops:
                key = tuple(new_chain)
                if key not in visited:
                    visited.add(key)
                    chains.append(new_chain)
                    for n in new_chain[1:-1]:
                        if n in shell_candidates:
                            shell_nodes.add(n)
                    for n in new_chain:
                        all_chain_nodes.add(n)


# =========================================================================
# 7. Community detection (Louvain)
# =========================================================================
def detect_communities(G: nx.DiGraph) -> dict[str, int]:
    """Louvain community detection on undirected projection."""
    if G.number_of_nodes() == 0:
        return {}
    undirected: nx.Graph = G.to_undirected()
    partition: dict[str, int] = community_louvain.best_partition(undirected)
    logger.debug("Louvain communities: %d", len(set(partition.values())))
    return partition


detect_louvain_communities = detect_communities


# =========================================================================
# 8. Velocity features (Edge Case 7 - short burst detection)
# =========================================================================
def compute_velocity_features(
    tx_df: pd.DataFrame | None = None,
) -> dict[str, float]:
    """Compute transactions-per-day for each account.
    High velocity in short burst = mule indicator.

    Vectorised: uses groupby instead of per-node DataFrame scans.
    """
    if tx_df is None or tx_df.empty:
        return {}

    ts_col = _find_column(tx_df, ["timestamp", "Timestamp", "date", "Date"])
    sender_col = _find_column(tx_df, ["sender", "sender_id", "source", "from"])
    receiver_col = _find_column(tx_df, ["receiver", "receiver_id", "target", "to"])

    if not all([ts_col, sender_col, receiver_col]):
        return {}

    df = tx_df[[sender_col, receiver_col, ts_col]].copy()
    df["_ts"] = pd.to_datetime(df[ts_col], errors="coerce")
    df = df.dropna(subset=["_ts"])
    if df.empty:
        return {}

    df[sender_col] = df[sender_col].astype(str).str.strip()
    df[receiver_col] = df[receiver_col].astype(str).str.strip()

    # Build sender-side stats via groupby
    send_stats = df.groupby(sender_col)["_ts"].agg(["count", "min", "max"])
    send_stats.columns = ["count", "ts_min", "ts_max"]

    # Build receiver-side stats via groupby
    recv_stats = df.groupby(receiver_col)["_ts"].agg(["count", "min", "max"])
    recv_stats.columns = ["count", "ts_min", "ts_max"]

    # Merge both sides per account
    all_nodes = set(send_stats.index) | set(recv_stats.index)
    velocity: dict[str, float] = {}

    for node in all_nodes:
        s = send_stats.loc[node] if node in send_stats.index else None
        r = recv_stats.loc[node] if node in recv_stats.index else None

        total_count = (s["count"] if s is not None else 0) + (r["count"] if r is not None else 0)

        if total_count < 2:
            velocity[node] = float(total_count)
            continue

        ts_min = min(x for x in [s["ts_min"] if s is not None else None, r["ts_min"] if r is not None else None] if x is not None)
        ts_max = max(x for x in [s["ts_max"] if s is not None else None, r["ts_max"] if r is not None else None] if x is not None)

        days = max((ts_max - ts_min).total_seconds() / 86400, 0.01)
        velocity[node] = total_count / days

    return velocity


# =========================================================================
# 9. Cycle metadata (Edge Case 4, 8 - frequency + amounts)
# =========================================================================
def compute_cycle_metadata(
    cycles: list[list[str]], G: nx.DiGraph,
) -> dict[str, dict[str, Any]]:
    """For each node in cycles, compute cycle_count, max_cycle_amount, min_cycle_length."""
    meta: dict[str, dict[str, Any]] = {}
    for cycle in cycles:
        cycle_amount = 0.0
        for i in range(len(cycle)):
            u, v = cycle[i], cycle[(i + 1) % len(cycle)]
            edge_data = G.get_edge_data(u, v, default={})
            cycle_amount += edge_data.get("total_amount", 0.0)

        for node in cycle:
            if node not in meta:
                meta[node] = {"cycle_count": 0, "max_cycle_amount": 0.0, "min_cycle_length": 999}
            meta[node]["cycle_count"] += 1
            meta[node]["max_cycle_amount"] = max(meta[node]["max_cycle_amount"], cycle_amount)
            meta[node]["min_cycle_length"] = min(meta[node]["min_cycle_length"], len(cycle))
    return meta


# =========================================================================
# 10. Forwarding ratio computation (Edge Case 1, 6)
# =========================================================================
def compute_forwarding_ratios(G: nx.DiGraph) -> dict[str, float]:
    """For each node, what fraction of its receivers also forward funds.
    Low forwarding ratio = more likely payroll (receivers are endpoints).
    """
    ratios: dict[str, float] = {}
    for node in G.nodes():
        successors = list(G.successors(node))
        if not successors:
            ratios[node] = 0.0
            continue
        forwarding = sum(1 for s in successors if G.out_degree(s) > 0)
        ratios[node] = forwarding / len(successors)
    return ratios


# =========================================================================
# PUBLIC ENTRY POINT
# =========================================================================
def extract_graph_features(G: nx.DiGraph, tx_df: pd.DataFrame | None = None) -> dict[str, Any]:
    """Run ALL feature extractors and return a unified dictionary.
    This is the single entry-point called by fraud_detection.py.
    """
    logger.info("Extracting graph features from %d nodes, %d edges ...",
                G.number_of_nodes(), G.number_of_edges())

    # Centrality
    pagerank = compute_pagerank(G)
    betweenness = compute_betweenness(G)

    # Degree
    in_degree, out_degree = compute_degree_features(G)

    # Basic fan-in/fan-out (degree-based)
    fan_in_nodes = detect_fan_in(G, _in_deg=in_degree, _out_deg=out_degree)
    fan_out_nodes = detect_fan_out(G, _in_deg=in_degree, _out_deg=out_degree)

    # Cycles (3-5)
    cycles, nodes_in_cycles = detect_cycles(G)

    # Cycle metadata (frequency, amounts) - Edge Cases 4, 8
    cycle_metadata = compute_cycle_metadata(cycles, G)

    # Shell chains - Edge Case 10
    shell_data = detect_layered_shell_chains(G)

    # 72h smurfing - Edge Case 5 (temporal rule)
    fan_72h = detect_fan_in_out_72h(G, tx_df)

    # Velocity - Edge Case 7
    velocity = compute_velocity_features(tx_df)

    # Forwarding ratios - Edge Cases 1, 6
    forwarding_ratios = compute_forwarding_ratios(G)

    # Communities
    communities = detect_communities(G)

    features: dict[str, Any] = {
        # Core
        "pagerank": pagerank,
        "betweenness": betweenness,
        "in_degree": in_degree,
        "out_degree": out_degree,
        "fan_in_nodes": fan_in_nodes,
        "fan_out_nodes": fan_out_nodes,
        "cycles": cycles,
        "nodes_in_cycles": nodes_in_cycles,
        "communities": communities,
        # New detection signals
        "cycle_metadata": cycle_metadata,
        "shell_data": shell_data,
        "fan_72h": fan_72h,
        "velocity": velocity,
        "forwarding_ratios": forwarding_ratios,
    }

    logger.info("Feature extraction complete - %d fan-in, %d fan-out, "
                "%d cycles, %d shell_nodes, %d communities",
                len(fan_in_nodes), len(fan_out_nodes), len(cycles),
                len(shell_data.get("shell_nodes", [])),
                len(set(communities.values())) if communities else 0)

    return features
