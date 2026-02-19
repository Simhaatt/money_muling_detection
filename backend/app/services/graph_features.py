"""
graph_features.py — Feature Extraction from Transaction Graphs
================================================================
Extracts fraud-relevant graph metrics from a directed transaction graph
built by graph_builder.py.

Input :  NetworkX DiGraph G  (edges carry ``transaction_count`` and
         ``total_amount`` weights produced by ``build_graph``).
Output:  Dictionary consumed by scoring.py

Feature categories
------------------
Centrality   — PageRank, betweenness centrality
Degree       — in_degree, out_degree per node
Mule signals — fan-in nodes, fan-out nodes
Topology     — simple cycles, nodes participating in cycles
Communities  — Louvain partition on the undirected projection

Located in: app/services/graph_features.py
Called by:   app/services/fraud_detection.py → scoring.py
"""

from __future__ import annotations

import logging
from typing import Any

import community as community_louvain  # python-louvain
import networkx as nx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — tuneable thresholds
# ---------------------------------------------------------------------------
_FAN_IN_MIN_IN_DEGREE: int = 10   # min senders to flag as fan-in (spec: 10+)
_FAN_IN_MAX_OUT_DEGREE: int = 2   # max receivers allowed for fan-in node
_FAN_OUT_MIN_OUT_DEGREE: int = 10 # min receivers to flag as fan-out (spec: 10+)
_FAN_OUT_MAX_IN_DEGREE: int = 2   # max senders allowed for fan-out node


# ── Centrality ─────────────────────────────────────────────────────────────
def compute_pagerank(G: nx.DiGraph) -> dict[str, float]:
    """Compute PageRank weighted by ``total_amount``.

    Nodes with disproportionately high PageRank may be central mule
    accounts funnelling money through the network.

    Returns:
        Mapping of *node → PageRank score*.
    """
    if G.number_of_nodes() == 0:
        return {}
    return nx.pagerank(G, weight="total_amount")


def compute_betweenness(G: nx.DiGraph) -> dict[str, float]:
    """Compute normalised betweenness centrality weighted by ``total_amount``.

    High-betweenness nodes act as bridges (shell / pass-through accounts).

    For large graphs (>5 000 nodes), an approximate calculation using *k*
    sampled pivot nodes is used so that the pipeline completes within the
    30-second budget.

    Returns:
        Mapping of *node → betweenness centrality*.
    """
    n = G.number_of_nodes()
    if n == 0:
        return {}
    # Exact computation is O(V·E) – feasible only for small graphs.
    _SAMPLE_THRESHOLD = 5_000
    if n > _SAMPLE_THRESHOLD:
        k = min(200, n)  # 200 pivots gives a good approximation
        return nx.betweenness_centrality(
            G, k=k, weight="total_amount", normalized=True, seed=42
        )
    return nx.betweenness_centrality(G, weight="total_amount", normalized=True)


# ── Degree features ───────────────────────────────────────────────────────
def compute_degree_features(G: nx.DiGraph) -> tuple[dict[str, int], dict[str, int]]:
    """Return per-node in-degree and out-degree dictionaries.

    Returns:
        Tuple of (in_degree_dict, out_degree_dict).
    """
    in_degree: dict[str, int] = dict(G.in_degree())
    out_degree: dict[str, int] = dict(G.out_degree())
    return in_degree, out_degree


# ── Fan-in / Fan-out detection ────────────────────────────────────────────
def detect_fan_in(
    G: nx.DiGraph,
    min_in: int = _FAN_IN_MIN_IN_DEGREE,
    max_out: int = _FAN_IN_MAX_OUT_DEGREE,
    *,
    _in_deg: dict[str, int] | None = None,
    _out_deg: dict[str, int] | None = None,
) -> list[str]:
    """Detect **fan-in** mule patterns.

    A fan-in node collects funds from many senders while dispersing to
    very few receivers — classic *collector* mule behaviour.

    Criteria:
        * ``in_degree >= min_in``  (default 5)
        * ``out_degree <= max_out`` (default 2)

    Args:
        _in_deg, _out_deg: Pre-computed degree dicts (avoids redundant
            lookups when called from ``extract_graph_features``).

    Returns:
        List of node IDs flagged as fan-in.
    """
    in_deg = _in_deg or dict(G.in_degree())
    out_deg = _out_deg or dict(G.out_degree())
    fan_in_nodes: list[str] = [
        node for node in G.nodes()
        if in_deg[node] >= min_in and out_deg[node] <= max_out
    ]
    logger.debug("Fan-in nodes detected: %d", len(fan_in_nodes))
    return fan_in_nodes


def detect_fan_out(
    G: nx.DiGraph,
    min_out: int = _FAN_OUT_MIN_OUT_DEGREE,
    max_in: int = _FAN_OUT_MAX_IN_DEGREE,
    *,
    _in_deg: dict[str, int] | None = None,
    _out_deg: dict[str, int] | None = None,
) -> list[str]:
    """Detect **fan-out** mule patterns.

    A fan-out node distributes funds to many receivers while receiving
    from very few senders — classic *distributor* mule behaviour.

    Criteria:
        * ``out_degree >= min_out`` (default 5)
        * ``in_degree <= max_in``   (default 2)

    Args:
        _in_deg, _out_deg: Pre-computed degree dicts (avoids redundant
            lookups when called from ``extract_graph_features``).

    Returns:
        List of node IDs flagged as fan-out.
    """
    in_deg = _in_deg or dict(G.in_degree())
    out_deg = _out_deg or dict(G.out_degree())
    fan_out_nodes: list[str] = [
        node for node in G.nodes()
        if out_deg[node] >= min_out and in_deg[node] <= max_in
    ]
    logger.debug("Fan-out nodes detected: %d", len(fan_out_nodes))
    return fan_out_nodes


# ── Cycle detection ───────────────────────────────────────────────────────
# Default safety cap: avoids exponential blowup on dense graphs.
_MAX_CYCLE_LENGTH: int = 5  # spec: detect cycles of length 3 to 5
_MAX_CYCLES_COLLECTED: int = 500


def detect_cycles(
    G: nx.DiGraph,
    length_bound: int = _MAX_CYCLE_LENGTH,
    max_cycles: int = _MAX_CYCLES_COLLECTED,
) -> tuple[list[list[str]], list[str]]:
    """Find simple cycles in the directed graph.

    Cycles indicate **fund round-tripping** — money sent in a loop to
    obscure its origin.

    Safety guards (critical for production):
        * ``length_bound`` caps the maximum cycle length searched.
          Without this, ``nx.simple_cycles`` can return an **exponential**
          number of results on dense graphs and hang indefinitely.
        * ``max_cycles`` caps the total number of cycles collected to
          prevent memory exhaustion.

    Returns:
        Tuple of:
            * ``cycles`` — list of cycles (each a list of node IDs),
              capped at *max_cycles*.
            * ``nodes_in_cycles`` — deduplicated list of all nodes
              that participate in at least one collected cycle.
    """
    cycles: list[list[str]] = []
    seen_nodes: set[str] = set()
    nodes_in_cycles: list[str] = []

    # nx.simple_cycles yields lazily — consume only what we need.
    for cycle in nx.simple_cycles(G, length_bound=length_bound):
        cycles.append(cycle)
        for node in cycle:
            if node not in seen_nodes:
                seen_nodes.add(node)
                nodes_in_cycles.append(node)
        if len(cycles) >= max_cycles:
            logger.warning(
                "Cycle cap reached (%d). Stopping enumeration early.", max_cycles
            )
            break

    logger.debug("Cycles found: %d  |  Unique nodes in cycles: %d",
                 len(cycles), len(nodes_in_cycles))
    return cycles, nodes_in_cycles


# ── Community detection (Louvain) ─────────────────────────────────────────
def detect_communities(G: nx.DiGraph) -> dict[str, int]:
    """Run **Louvain** community detection on the undirected projection.

    Tightly-connected clusters may represent coordinated mule rings.
    The algorithm operates on an undirected view; direction is dropped
    intentionally since mule rings communicate bidirectionally.

    Returns:
        Mapping of *node → community_id* (int).
    """
    if G.number_of_nodes() == 0:
        return {}

    # Louvain expects an undirected graph
    undirected: nx.Graph = G.to_undirected()
    partition: dict[str, int] = community_louvain.best_partition(undirected)
    n_communities = len(set(partition.values()))
    logger.debug("Louvain communities detected: %d", n_communities)
    return partition


# ── Public aggregator ─────────────────────────────────────────────────────
def extract_graph_features(G: nx.DiGraph) -> dict[str, Any]:
    """Run **all** feature extractors and return a unified dictionary.

    This is the single entry-point called by ``fraud_detection.py``.
    The returned dictionary is consumed directly by ``scoring.py``.

    Returns:
        Dictionary with the following keys::

            {
                "pagerank":        {node: float, ...},
                "betweenness":     {node: float, ...},
                "in_degree":       {node: int, ...},
                "out_degree":      {node: int, ...},
                "fan_in_nodes":    [node, ...],
                "fan_out_nodes":   [node, ...],
                "cycles":          [[node, ...], ...],
                "nodes_in_cycles": [node, ...],
                "communities":     {node: community_id, ...},
            }
    """
    logger.info("Extracting graph features from %d nodes, %d edges …",
                G.number_of_nodes(), G.number_of_edges())

    # Centrality measures
    pagerank = compute_pagerank(G)
    betweenness = compute_betweenness(G)

    # Degree features (computed once, reused by fan-in/fan-out)
    in_degree, out_degree = compute_degree_features(G)

    # Mule-pattern detection — pass pre-computed degrees to avoid redundant work
    fan_in_nodes = detect_fan_in(G, _in_deg=in_degree, _out_deg=out_degree)
    fan_out_nodes = detect_fan_out(G, _in_deg=in_degree, _out_deg=out_degree)

    # Cycle detection
    cycles, nodes_in_cycles = detect_cycles(G)

    # Community detection (Louvain)
    communities = detect_communities(G)

    features: dict[str, Any] = {
        "pagerank": pagerank,
        "betweenness": betweenness,
        "in_degree": in_degree,
        "out_degree": out_degree,
        "fan_in_nodes": fan_in_nodes,
        "fan_out_nodes": fan_out_nodes,
        "cycles": cycles,
        "nodes_in_cycles": nodes_in_cycles,
        "communities": communities,
    }

    logger.info("Feature extraction complete — %d fan-in, %d fan-out, "
                "%d cycles, %d communities",
                len(fan_in_nodes), len(fan_out_nodes),
                len(cycles), len(set(communities.values())) if communities else 0)

    return features
