"""
graph_builder.py — Transaction Graph Construction
===================================================
Responsible for:
  • Parsing uploaded CSV transaction data (sender, receiver, amount, timestamp …)
  • Constructing a directed, weighted NetworkX graph where:
      – Nodes  = bank accounts / wallets
      – Edges  = transactions (weight = amount, with metadata)
  • Providing helper methods to serialise the graph for the frontend (JSON)

Typical entry point:
    build_graph(dataframe: pd.DataFrame) -> nx.DiGraph
"""

import networkx as nx
import pandas as pd


def build_graph(df: pd.DataFrame) -> nx.DiGraph:
    """
    Build a directed transaction graph from a DataFrame.

    Expected columns: sender, receiver, amount, timestamp (optional)

    Returns:
        nx.DiGraph with transaction edges
    """
    # TODO: Implement graph construction logic
    G = nx.DiGraph()
    return G


def graph_to_json(G: nx.DiGraph) -> dict:
    """
    Serialise a NetworkX graph into a JSON-friendly dict
    suitable for frontend visualisation (e.g., D3 / vis.js).

    Returns:
        dict with 'nodes' and 'edges' keys
    """
    # TODO: Implement JSON serialisation
    return {"nodes": [], "edges": []}
