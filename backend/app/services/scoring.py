"""
scoring.py - Explainable Fraud Risk Scoring Engine
=====================================================
Pattern Score - Legitimacy Score = Final Suspicion

PRIMARY signals (drive risk):
    Cycle participation (validated)   +40  (reduced to +10 for single low-amount)
    Smurfing (72h fan-in/out)         +25
    Shell chain membership            +30
    High velocity (burst)             +20

SUPPORTING signals:
    High betweenness (> 2x mean)      +5  (only when primary present)
    High PageRank (> 2x mean)         +5  (only when primary present)
    Community membership              +10 (only when primary present)

SUPPRESSION (subtract from score):
    Payroll hub                       -30
    Merchant account                  -40
    Payment gateway                   -40
    Low-activity (out_degree <= 2)    -20
    Low-amount cycle (< 1000)         -15

Tier thresholds:
    >= 80 -> CRITICAL
    >= 60 -> HIGH
    >= 40 -> MEDIUM
     < 40 -> LOW
"""

from __future__ import annotations

import logging
from collections import defaultdict
from statistics import mean
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scoring weights - ADDITIVE
# ---------------------------------------------------------------------------
_W_CYCLE: int = 40
_W_CYCLE_SINGLE_LOW: int = 10       # Edge Case 4: single cycle, low amount
_W_SMURF_72H: int = 25
_W_SHELL_CHAIN: int = 30
_W_VELOCITY: int = 20                # Edge Case 7: high velocity
_W_PAGERANK: int = 5
_W_BETWEENNESS: int = 5
_W_COMMUNITY: int = 10

# ---------------------------------------------------------------------------
# Suppression weights - SUBTRACTIVE
# ---------------------------------------------------------------------------
_S_PAYROLL: int = 30                 # Edge Case 1
_S_MERCHANT: int = 40                # Edge Case 2
_S_GATEWAY: int = 40                 # Edge Case 3
_S_LOW_ACTIVITY: int = 20            # Edge Case 6
_S_LOW_AMOUNT_CYCLE: int = 15        # Edge Case 8

_THRESHOLD_MULT: float = 2.0
_VELOCITY_THRESHOLD: float = 10.0    # tx/day to trigger velocity bonus

# Payroll / merchant thresholds
_PAYROLL_MIN_OUT: int = 10
_PAYROLL_MAX_FORWARDING: float = 0.20
_MERCHANT_MIN_IN: int = 10
_MERCHANT_MAX_OUT: int = 1
_GATEWAY_MIN_IN: int = 50
_GATEWAY_MIN_OUT: int = 50
_LOW_AMOUNT_THRESHOLD: float = 1000.0


# -- Tier classification ---------------------------------------------------
def classify_risk_tier(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


# -- Suppression detection -------------------------------------------------
def is_likely_payroll(
    node_id: str, G: nx.DiGraph,
    nodes_in_cycles: set[str], shell_nodes: set[str],
    forwarding_ratios: dict[str, float],
) -> bool:
    """Edge Case 1: Fan-out hub where receivers rarely forward money.
    Payroll: batch sends, periodic, receivers are endpoints.
    """
    out_deg = G.out_degree(node_id)
    in_deg = G.in_degree(node_id)

    if out_deg < _PAYROLL_MIN_OUT:
        return False
    if node_id in nodes_in_cycles:
        return False
    if node_id in shell_nodes:
        return False

    # Check forwarding ratio < 20%
    fwd = forwarding_ratios.get(node_id, 1.0)
    if fwd >= _PAYROLL_MAX_FORWARDING:
        return False

    # No return paths from receivers
    for succ in list(G.successors(node_id))[:20]:
        if G.has_edge(succ, node_id):
            return False

    return True


def is_likely_merchant(
    node_id: str, G: nx.DiGraph,
    nodes_in_cycles: set[str], shell_nodes: set[str],
) -> bool:
    """Edge Case 2: High in-degree, near-zero out-degree.
    Merchant receives from many, sends to very few.
    """
    in_deg = G.in_degree(node_id)
    out_deg = G.out_degree(node_id)

    if in_deg < _MERCHANT_MIN_IN or out_deg > _MERCHANT_MAX_OUT:
        return False
    if node_id in nodes_in_cycles:
        return False
    if node_id in shell_nodes:
        return False
    return True


def is_likely_gateway(
    node_id: str, G: nx.DiGraph,
    nodes_in_cycles: set[str],
) -> bool:
    """Edge Case 3: Very high in-degree AND out-degree, no cycles."""
    in_deg = G.in_degree(node_id)
    out_deg = G.out_degree(node_id)

    if in_deg < _GATEWAY_MIN_IN or out_deg < _GATEWAY_MIN_OUT:
        return False
    if node_id in nodes_in_cycles:
        return False
    return True


# -- Risk scoring -----------------------------------------------------------
def compute_risk_scores(
    graph: nx.DiGraph,
    features: dict[str, Any],
    tx_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Compute per-account: Pattern Score - Legitimacy Score = Final Suspicion.

    Returns DataFrame with columns:
        account_id, risk_score, risk_tier, reasons,
        pagerank, betweenness, in_degree, out_degree,
        is_payroll, is_merchant, is_gateway
    """
    # Unpack features
    pagerank: dict[str, float] = features.get("pagerank", {})
    betweenness: dict[str, float] = features.get("betweenness", {})
    in_degree: dict[str, int] = features.get("in_degree", {})
    out_degree: dict[str, int] = features.get("out_degree", {})

    cycle_set: set[str] = set(features.get("nodes_in_cycles", []))
    cycles: list[list[str]] = features.get("cycles", [])
    communities: dict[str, int] = features.get("communities", {})

    # New features
    cycle_metadata = features.get("cycle_metadata", {})
    shell_data = features.get("shell_data", {})
    shell_nodes: set[str] = set(shell_data.get("shell_nodes", []))
    fan_72h = features.get("fan_72h", {})
    velocity = features.get("velocity", {})
    forwarding_ratios = features.get("forwarding_ratios", {})

    # Build cycle membership details
    node_cycle_lengths: dict[str, set[int]] = defaultdict(set)
    for cycle in cycles:
        for node in cycle:
            node_cycle_lengths[node].add(len(cycle))

    # Thresholds
    pr_values = list(pagerank.values())
    bt_values = list(betweenness.values())
    pr_threshold = (mean(pr_values) * _THRESHOLD_MULT) if pr_values else 0.0
    bt_threshold = (mean(bt_values) * _THRESHOLD_MULT) if bt_values else 0.0

    # Pre-compute suppression sets
    payroll_set: set[str] = set()
    merchant_set: set[str] = set()
    gateway_set: set[str] = set()

    for node in graph.nodes():
        if is_likely_payroll(node, graph, cycle_set, shell_nodes, forwarding_ratios):
            payroll_set.add(node)
        if is_likely_merchant(node, graph, cycle_set, shell_nodes):
            merchant_set.add(node)
        if is_likely_gateway(node, graph, cycle_set):
            gateway_set.add(node)

    # Score every node
    rows: list[dict[str, Any]] = []

    for node in graph.nodes():
        score = 0
        reasons: list[str] = []
        has_primary = False

        # ===== ADDITIVE: Primary signals =====

        # --- Cycle participation (Edge Case 4: validate frequency/amount) ---
        if node in cycle_set:
            meta = cycle_metadata.get(node, {})
            cycle_count = meta.get("cycle_count", 1)
            max_amount = meta.get("max_cycle_amount", 0.0)

            if cycle_count >= 2 or max_amount > _LOW_AMOUNT_THRESHOLD:
                # Repeating cycle or high amount = real fraud
                score += _W_CYCLE
                has_primary = True
                reasons.append("Account is part of a transaction cycle")
            else:
                # Edge Case 4: single low-value cycle (family transfer?)
                score += _W_CYCLE_SINGLE_LOW
                reasons.append("Account is part of a low-frequency transaction cycle")

            for clen in sorted(node_cycle_lengths.get(node, [])):
                reasons.append(f"cycle_length_{clen}")

        # --- Smurfing 72h (Edge Case 5: temporal rule) ---
        fan_in_72h = fan_72h.get("fan_in_counts", {})
        fan_out_72h = fan_72h.get("fan_out_counts", {})
        if node in fan_in_72h or node in fan_out_72h:
            score += _W_SMURF_72H
            has_primary = True
            if node in fan_in_72h:
                reasons.append("smurfing_fan_in_72h")
            if node in fan_out_72h:
                reasons.append("smurfing_fan_out_72h")

        # --- Shell chain (Edge Case 10) ---
        if node in shell_nodes:
            score += _W_SHELL_CHAIN
            has_primary = True
            reasons.append("shell_account")

        # --- High velocity (Edge Case 7) ---
        node_velocity = velocity.get(node, 0.0)
        if node_velocity > _VELOCITY_THRESHOLD:
            score += _W_VELOCITY
            has_primary = True
            reasons.append("high_velocity")

        # ===== ADDITIVE: Supporting signals (only with primary) =====

        node_pr = pagerank.get(node, 0.0)
        if has_primary and node_pr > pr_threshold:
            score += _W_PAGERANK
            reasons.append("High PageRank (central in transaction network)")

        node_bt = betweenness.get(node, 0.0)
        if has_primary and node_bt > bt_threshold:
            score += _W_BETWEENNESS
            reasons.append("High betweenness centrality (intermediary account)")

        # Edge Case 9: community membership (only boost if primary present)
        if has_primary and node in communities:
            score += _W_COMMUNITY
            reasons.append("Part of suspicious transaction community")

        # ===== SUBTRACTIVE: Suppress false positives =====

        # Edge Case 1: Payroll suppression
        is_pay = node in payroll_set
        if is_pay:
            score -= _S_PAYROLL
            reasons.append("likely_payroll")

        # Edge Case 2: Merchant suppression
        is_merch = node in merchant_set
        if is_merch:
            score -= _S_MERCHANT
            reasons.append("likely_merchant")

        # Edge Case 3: Gateway suppression
        is_gw = node in gateway_set
        if is_gw:
            score -= _S_GATEWAY
            reasons.append("likely_gateway")

        # Edge Case 6: Low-activity (salary then spending)
        node_out = out_degree.get(node, 0)
        if node_out <= 2 and not has_primary:
            score -= _S_LOW_ACTIVITY
            # Don't add reason for this, it just lowers score

        # Edge Case 8: Low-amount cycle trap
        if node in cycle_set:
            meta = cycle_metadata.get(node, {})
            if meta.get("max_cycle_amount", 0.0) < _LOW_AMOUNT_THRESHOLD:
                if meta.get("cycle_count", 1) <= 1:
                    score -= _S_LOW_AMOUNT_CYCLE
                    reasons.append("low_amount_cycle")

        # ===== Clamp [0, 100] =====
        score = min(100, max(0, score))

        tier = classify_risk_tier(score)

        # Force suppressed accounts to LOW
        if is_pay or is_merch or is_gw:
            if score < 40:
                tier = "LOW"

        rows.append({
            "account_id": node,
            "risk_score": score,
            "risk_tier": tier,
            "reasons": reasons,
            "pagerank": node_pr,
            "betweenness": node_bt,
            "in_degree": in_degree.get(node, 0),
            "out_degree": out_degree.get(node, 0),
            "is_payroll": is_pay,
            "is_merchant": is_merch,
            "is_gateway": is_gw,
        })

    df = pd.DataFrame(rows)

    if df.empty:
        df = pd.DataFrame(columns=[
            "account_id", "risk_score", "risk_tier", "reasons",
            "pagerank", "betweenness", "in_degree", "out_degree",
            "is_payroll", "is_merchant", "is_gateway",
        ])

    logger.info(
        "Scored %d accounts -- CRITICAL: %d, HIGH: %d, MEDIUM: %d, LOW: %d",
        len(df),
        (df["risk_tier"] == "CRITICAL").sum() if not df.empty else 0,
        (df["risk_tier"] == "HIGH").sum() if not df.empty else 0,
        (df["risk_tier"] == "MEDIUM").sum() if not df.empty else 0,
        (df["risk_tier"] == "LOW").sum() if not df.empty else 0,
    )

    return df
