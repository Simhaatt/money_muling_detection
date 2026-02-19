"""
explanation_generator.py - Deterministic Human-Readable Explanations
=====================================================================
Converts detected_patterns into judge-friendly explanation text.
Each pattern maps to a fixed sentence. Multiple patterns are joined.

Located in: app/services/explanation_generator.py
Called by:   app/services/fraud_detection.py
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Pattern -> Explanation mapping
# ---------------------------------------------------------------------------
PATTERN_EXPLANATIONS: dict[str, str] = {
    # Cycle patterns (Edge Case 4: validated cycles)
    "cycle_length_3": (
        "This account is part of a circular fund routing pattern involving"
        " 3 accounts, a known laundering technique."
    ),
    "cycle_length_4": (
        "This account is part of a circular laundering ring involving"
        " 4 accounts to obscure fund origin."
    ),
    "cycle_length_5": (
        "This account is part of a circular laundering ring involving"
        " 5 accounts to obscure fund origin."
    ),
    "Account is part of a transaction cycle": (
        "This account participates in circular fund routing where money"
        " loops back to its origin, consistent with repeated laundering cycles."
    ),
    "Account is part of a low-frequency transaction cycle": (
        "This account participates in a single-occurrence fund cycle with"
        " low amounts, which may be a legitimate family transfer."
    ),

    # Temporal smurfing (Edge Case 5: 72h rule)
    "smurfing_fan_in_72h": (
        "This account receives funds from 10+ unique senders within a"
        " 72-hour window, consistent with smurfing aggregation."
    ),
    "smurfing_fan_out_72h": (
        "This account sends funds to 10+ unique receivers within a"
        " 72-hour window, consistent with smurfing distribution."
    ),

    # Velocity (Edge Case 7: burst detection)
    "high_velocity": (
        "This account shows unusually high transaction velocity (many"
        " transactions per day), consistent with rapid money movement."
    ),

    # Shell / intermediary (Edge Case 10)
    "shell_account": (
        "This account acts as an intermediary shell account in a"
        " multi-hop laundering chain with only 2-3 total transactions."
    ),

    # Low-amount cycle trap (Edge Case 8)
    "low_amount_cycle": (
        "This account participates in a cycle with very small amounts,"
        " reducing suspicion as meaningful laundering typically involves"
        " larger values."
    ),

    # Fan-in / fan-out
    "Fan-in pattern detected (receives from many accounts)": (
        "This account aggregates funds from many different accounts,"
        " a common smurfing collection pattern."
    ),
    "Fan-out pattern detected (sends to many accounts)": (
        "This account distributes funds to many accounts, consistent"
        " with laundering dispersion."
    ),

    # Community (Edge Case 9)
    "Part of suspicious transaction community": (
        "This account belongs to a tightly connected suspicious"
        " transaction cluster with dense internal connections."
    ),
    "community_member": (
        "This account belongs to a tightly connected suspicious"
        " transaction network identified by community detection."
    ),

    # Centrality (supporting signals)
    "High PageRank (central in transaction network)": (
        "This account is structurally central in the transaction"
        " network, indicating it handles significant money flows."
    ),
    "High betweenness centrality (intermediary account)": (
        "This account acts as a bridge between otherwise separate"
        " groups of accounts, a hallmark of intermediary mules."
    ),

    # False-positive suppression labels (Edge Cases 1, 2, 3)
    "likely_payroll": (
        "This account shows payroll-like behavior: sends to many"
        " receivers who don't forward funds. Risk score reduced."
    ),
    "likely_merchant": (
        "This account shows merchant-like behavior: receives from"
        " many senders with near-zero outgoing. Risk score reduced."
    ),
    "likely_gateway": (
        "This account shows payment gateway behavior: very high"
        " in-degree and out-degree with no cycles. Risk score reduced."
    ),
}

_FALLBACK_TEMPLATE: str = "This account was flagged for: {pattern}."


def generate_explanation(patterns: list[str]) -> str:
    """Convert detected patterns into a single human-readable explanation."""
    if not patterns:
        return "This account was flagged as suspicious based on its transaction behavior."

    sentences: list[str] = []
    seen: set[str] = set()

    for pattern in patterns:
        explanation = PATTERN_EXPLANATIONS.get(
            pattern, _FALLBACK_TEMPLATE.format(pattern=pattern),
        )
        if explanation not in seen:
            seen.add(explanation)
            sentences.append(explanation)

    return " ".join(sentences)
