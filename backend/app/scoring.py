"""
scoring.py — Risk Scoring Engine
==================================
Responsible for:
  • Combining graph features into a composite risk score per account
  • Applying rule-based heuristics (e.g., fan-in/fan-out patterns)
  • Optionally running an ML model for anomaly detection
  • Classifying accounts into risk tiers: LOW / MEDIUM / HIGH / CRITICAL

Risk Score Factors:
  1. Structural position in the graph (centrality metrics)
  2. Transaction behaviour anomalies (velocity, amounts)
  3. Cycle participation (round-tripping indicator)
  4. Community membership (known mule cluster proximity)
"""

import pandas as pd


def compute_risk_scores(features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute a normalised risk score (0–100) for every account.

    Args:
        features_df: DataFrame of per-node features from graph_features module

    Returns:
        DataFrame with columns: node, risk_score, risk_tier
    """
    # TODO: Implement composite risk scoring logic
    return pd.DataFrame(columns=["node", "risk_score", "risk_tier"])


def classify_risk_tier(score: float) -> str:
    """
    Map a numeric risk score to a human-readable tier.

    Thresholds (configurable):
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
