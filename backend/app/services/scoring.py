"""
scoring.py — Suspicion Risk Scoring Engine
=============================================
Combines graph features into a composite risk score (0–100) per account
and assigns risk tiers.

Score Components (from hackathon workflow):
    Cycle participation:       +60
    Fan-in flagged:            +25
    Fan-out flagged:           +25
    Layering intermediary:     +20
    Louvain cluster member:    +20
    High PageRank:             +10
    High betweenness:          +10
    Rapid temporal velocity:   +15

Final score is capped at 100.
Fraud threshold: score >= 50

Located in: app/services/scoring.py
Called by:   app/services/fraud_detection.py
"""

import pandas as pd


def compute_risk_scores(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute a normalised risk score (0–100) for every account.

    Args:
        features_df: DataFrame of per-node features from graph_features

    Returns:
        DataFrame with columns: account_id, risk_score, risk_tier, flags
    """
    # TODO: Implement weighted score combination
    # TODO: Cap at 100, apply classify_risk_tier()
    return pd.DataFrame(columns=["account_id", "risk_score", "risk_tier", "flags"])


def classify_risk_tier(score: float) -> str:
    """
    Map a numeric risk score to a human-readable tier.

    Thresholds:
        0–25  → LOW
        26–50 → MEDIUM
        51–75 → HIGH
        76–100→ CRITICAL
    """
    if score <= 25:
        return "LOW"
    elif score <= 50:
        return "MEDIUM"
    elif score <= 75:
        return "HIGH"
    return "CRITICAL"
