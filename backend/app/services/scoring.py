"""
scoring.py — Explainable Fraud Risk Scoring Engine
=====================================================
Computes a composite risk score (0-100), a human-readable risk tier,
and a list of **explainable reasons** for every account in the
transaction graph.

Scoring weights
---------------
    Cycle participation        +60
    Fan-in pattern             +25
    Fan-out pattern            +25
    Community membership       +20
    High PageRank (> 2x mean)  +10
    High betweenness (> 2x mean)+10

Final score is clamped to [0, 100].

Tier thresholds
---------------
    >= 80 -> CRITICAL
    >= 60 -> HIGH
    >= 40 -> MEDIUM
     < 40 -> LOW

Located in: app/services/scoring.py
Called by:   app/services/fraud_detection.py
"""

from __future__ import annotations

import logging
from statistics import mean
from typing import Any

import networkx as nx
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scoring weights -- single source of truth, easy to tune
# ---------------------------------------------------------------------------
_W_CYCLE: int = 60
_W_FAN_IN: int = 25
_W_FAN_OUT: int = 25
_W_COMMUNITY: int = 20
_W_PAGERANK: int = 10
_W_BETWEENNESS: int = 10

# Multiplier: a node's value must exceed  mean x _THRESHOLD_MULT  to trigger
_THRESHOLD_MULT: float = 2.0


# -- Tier classification ----------------------------------------------------
def classify_risk_tier(score: float) -> str:
    """Map a numeric risk score to a human-readable tier.

    Thresholds::

        >= 80 -> CRITICAL
        >= 60 -> HIGH
        >= 40 -> MEDIUM
         < 40 -> LOW

    Args:
        score: Risk score in [0, 100].

    Returns:
        One of ``"CRITICAL"``, ``"HIGH"``, ``"MEDIUM"``, ``"LOW"``.
    """
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


# -- Risk scoring -----------------------------------------------------------
def compute_risk_scores(
    graph: nx.DiGraph,
    features: dict[str, Any],
) -> pd.DataFrame:
    """Compute per-account risk score, tier and explainable reasons.

    Parameters
    ----------
    graph : nx.DiGraph
        The directed transaction graph (used for the node list).
    features : dict
        Dictionary returned by ``extract_graph_features()``::

            pagerank, betweenness, in_degree, out_degree,
            fan_in_nodes, fan_out_nodes, cycles, nodes_in_cycles,
            communities

    Returns
    -------
    pd.DataFrame
        One row per account with columns:

        * ``account_id`` -- node identifier
        * ``risk_score``  -- int in [0, 100]
        * ``risk_tier``   -- CRITICAL / HIGH / MEDIUM / LOW
        * ``reasons``     -- list[str] of human-readable explanations
        * ``pagerank``    -- float
        * ``betweenness`` -- float
        * ``in_degree``   -- int
        * ``out_degree``  -- int
    """
    # Unpack features -------------------------------------------------------
    pagerank: dict[str, float] = features.get("pagerank", {})
    betweenness: dict[str, float] = features.get("betweenness", {})
    in_degree: dict[str, int] = features.get("in_degree", {})
    out_degree: dict[str, int] = features.get("out_degree", {})

    fan_in_set: set[str] = set(features.get("fan_in_nodes", []))
    fan_out_set: set[str] = set(features.get("fan_out_nodes", []))
    cycle_set: set[str] = set(features.get("nodes_in_cycles", []))
    communities: dict[str, int] = features.get("communities", {})

    # Pre-compute thresholds (avoid per-node mean() calls) ------------------
    pr_values = list(pagerank.values())
    bt_values = list(betweenness.values())
    pr_threshold = (mean(pr_values) * _THRESHOLD_MULT) if pr_values else 0.0
    bt_threshold = (mean(bt_values) * _THRESHOLD_MULT) if bt_values else 0.0

    # Score every node in a single pass ------------------------------------
    rows: list[dict[str, Any]] = []

    for node in graph.nodes():
        score = 0
        reasons: list[str] = []

        # --- Cycle membership (+60) ---
        if node in cycle_set:
            score += _W_CYCLE
            reasons.append("Account is part of a transaction cycle")

        # --- Fan-in (+25) ---
        if node in fan_in_set:
            score += _W_FAN_IN
            reasons.append(
                "Fan-in pattern detected (receives from many accounts)"
            )

        # --- Fan-out (+25) ---
        if node in fan_out_set:
            score += _W_FAN_OUT
            reasons.append(
                "Fan-out pattern detected (sends to many accounts)"
            )

        # --- Community membership (+20) ---
        if node in communities:
            score += _W_COMMUNITY
            reasons.append("Part of suspicious transaction community")

        # --- High PageRank (+10) ---
        node_pr = pagerank.get(node, 0.0)
        if node_pr > pr_threshold:
            score += _W_PAGERANK
            reasons.append("High PageRank (central in transaction network)")

        # --- High betweenness (+10) ---
        node_bt = betweenness.get(node, 0.0)
        if node_bt > bt_threshold:
            score += _W_BETWEENNESS
            reasons.append(
                "High betweenness centrality (intermediary account)"
            )

        # --- Cap at 100 ---
        score = min(score, 100)

        rows.append(
            {
                "account_id": node,
                "risk_score": score,
                "risk_tier": classify_risk_tier(score),
                "reasons": reasons,
                "pagerank": node_pr,
                "betweenness": node_bt,
                "in_degree": in_degree.get(node, 0),
                "out_degree": out_degree.get(node, 0),
            }
        )

    df = pd.DataFrame(rows)

    # Ensure column order even on an empty graph
    if df.empty:
        df = pd.DataFrame(
            columns=[
                "account_id", "risk_score", "risk_tier", "reasons",
                "pagerank", "betweenness", "in_degree", "out_degree",
            ]
        )

    logger.info(
        "Scored %d accounts -- CRITICAL: %d, HIGH: %d, MEDIUM: %d, LOW: %d",
        len(df),
        (df["risk_tier"] == "CRITICAL").sum() if not df.empty else 0,
        (df["risk_tier"] == "HIGH").sum() if not df.empty else 0,
        (df["risk_tier"] == "MEDIUM").sum() if not df.empty else 0,
        (df["risk_tier"] == "LOW").sum() if not df.empty else 0,
    )

    return df
