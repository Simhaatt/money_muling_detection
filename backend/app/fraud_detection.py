"""
fraud_detection.py — End-to-End Detection Pipeline
=====================================================
Orchestrates the full detection workflow:

  1. Receive raw CSV data
  2. Build the transaction graph          (graph_builder)
  3. Extract features                     (graph_features)
  4. Compute risk scores                  (scoring)
  5. Return structured results for the API layer

This module is the primary interface called by routes.py.
"""

import pandas as pd

from app.graph_builder import build_graph, graph_to_json
from app.graph_features import compute_node_features, detect_cycles, detect_communities
from app.scoring import compute_risk_scores


def run_detection_pipeline(df: pd.DataFrame) -> dict:
    """
    Execute the full money-muling detection pipeline.

    Args:
        df: Transaction DataFrame (sender, receiver, amount, …)

    Returns:
        dict containing:
            - graph_json: serialised graph for visualisation
            - risk_scores: list of {node, risk_score, risk_tier}
            - cycles: detected fund-cycling paths
            - communities: cluster membership mapping
            - summary: high-level statistics
    """
    # TODO: Wire together the pipeline steps
    # Step 1 — Build graph
    # Step 2 — Extract features
    # Step 3 — Score accounts
    # Step 4 — Compile results

    return {
        "graph_json": {"nodes": [], "edges": []},
        "risk_scores": [],
        "cycles": [],
        "communities": {},
        "summary": {
            "total_accounts": 0,
            "total_transactions": 0,
            "flagged_accounts": 0,
            "critical_accounts": 0,
        },
    }
