"""
explanation_generator.py — Deterministic Human-Readable Explanations
=====================================================================
Converts detected_patterns lists into judge-friendly explanation text
without any GenAI or external API calls.

Each pattern maps to a fixed explanation sentence.  When an account has
multiple patterns the sentences are joined into a single paragraph.

Located in: app/services/explanation_generator.py
Called by:   app/services/fraud_detection.py
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Pattern → Explanation mapping
# ---------------------------------------------------------------------------
PATTERN_EXPLANATIONS: dict[str, str] = {
    # Cycle patterns
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
        " loops back to its origin."
    ),

    # Temporal / velocity
    "high_velocity": (
        "This account shows unusually high transaction velocity within"
        " a short time window, consistent with money muling."
    ),

    # Shell / intermediary
    "shell_account": (
        "This account acts as an intermediary shell account in a"
        " multi-hop laundering chain."
    ),

    # Fan-in / fan-out (smurfing)
    "Fan-in pattern detected": (
        "This account aggregates funds from many different accounts,"
        " a common smurfing pattern."
    ),
    "fan_in": (
        "This account aggregates funds from many different accounts,"
        " a common smurfing pattern."
    ),
    "Fan-out pattern detected": (
        "This account distributes funds to many accounts, consistent"
        " with laundering dispersion."
    ),
    "fan_out": (
        "This account distributes funds to many accounts, consistent"
        " with laundering dispersion."
    ),

    # Community
    "Part of suspicious transaction community": (
        "This account belongs to a tightly connected suspicious"
        " transaction network."
    ),
    "community_member": (
        "This account belongs to a tightly connected suspicious"
        " transaction network."
    ),

    # Centrality
    "High PageRank (central in transaction network)": (
        "This account is structurally central in the transaction"
        " network, indicating it handles significant money flows."
    ),
    "High betweenness centrality (potential intermediary)": (
        "This account acts as a bridge between otherwise separate"
        " groups of accounts, a hallmark of intermediary mules."
    ),

    # False-positive suppression labels
    "likely_payroll": (
        "This account shows payroll-like behavior and risk score"
        " has been reduced accordingly."
    ),
    "likely_merchant": (
        "This account shows merchant-like behavior and risk score"
        " has been reduced accordingly."
    ),
    "likely_gateway": (
        "This account shows payment gateway behavior and risk score"
        " has been reduced accordingly."
    ),
}

# Fallback for any unrecognised pattern
_FALLBACK_TEMPLATE: str = (
    "This account was flagged for: {pattern}."
)


def generate_explanation(patterns: list[str]) -> str:
    """Convert a list of detected patterns into a single human-readable
    explanation paragraph.

    Args:
        patterns: The ``detected_patterns`` list from a scored account.

    Returns:
        A concatenated explanation string.  Returns a generic message
        when the pattern list is empty.
    """
    if not patterns:
        return "This account was flagged as suspicious based on its transaction behavior."

    sentences: list[str] = []
    seen: set[str] = set()  # deduplicate equivalent explanations

    for pattern in patterns:
        explanation = PATTERN_EXPLANATIONS.get(
            pattern,
            _FALLBACK_TEMPLATE.format(pattern=pattern),
        )
        if explanation not in seen:
            seen.add(explanation)
            sentences.append(explanation)

    return " ".join(sentences)
