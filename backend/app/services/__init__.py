"""
services — Business Logic Layer
==================================
Contains all core detection algorithms and pipeline orchestration.

Modules:
    graph_builder    — Build directed transaction graphs from CSV data
    graph_features   — Extract node/graph features (centrality, cycles, communities)
    scoring          — Combine features into composite risk scores
    fraud_detection  — End-to-end pipeline orchestrator
"""

from app.services.graph_builder import build_transaction_graph, graph_to_json, get_graph_stats
from app.services.graph_features import compute_node_features, detect_cycles, detect_communities
from app.services.scoring import compute_risk_scores, classify_risk_tier
from app.services.fraud_detection import run_detection_pipeline

__all__ = [
    "build_transaction_graph", "graph_to_json", "get_graph_stats",
    "compute_node_features", "detect_cycles", "detect_communities",
    "compute_risk_scores", "classify_risk_tier",
    "run_detection_pipeline",
]
