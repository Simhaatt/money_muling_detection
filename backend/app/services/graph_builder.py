"""
graph_builder.py — Transaction Graph Construction
===================================================
Builds a directed, weighted transaction network from raw transaction data.
Each node represents an account (sender or receiver), and each edge represents
a transaction with amount and timestamp metadata.

Located in: app/services/graph_builder.py
Called by:   app/services/fraud_detection.py
"""

import networkx as nx
import pandas as pd
from typing import Any


def build_transaction_graph(df: pd.DataFrame) -> nx.DiGraph:
    """
    Construct a directed graph from a transaction DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain columns: sender_id, receiver_id, amount, timestamp.

    Returns
    -------
    nx.DiGraph
        Directed graph where edges carry 'weight' (cumulative amount),
        'transactions' (list of individual tx), and 'tx_count'.

    Raises
    ------
    ValueError
        If required columns are missing from the DataFrame.
    """
    required_cols = {"sender_id", "receiver_id", "amount", "timestamp"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame is missing required columns: {missing}")

    G = nx.DiGraph()

    for _, row in df.iterrows():
        sender = str(row["sender_id"]).strip()
        receiver = str(row["receiver_id"]).strip()
        amount = float(row["amount"])
        timestamp = str(row["timestamp"]).strip()

        # Skip self-loops and invalid rows
        if sender == receiver or not sender or not receiver:
            continue

        if G.has_edge(sender, receiver):
            # Accumulate parallel transactions on the same edge
            edge_data = G[sender][receiver]
            edge_data["weight"] += amount
            edge_data["transactions"].append({
                "amount": amount,
                "timestamp": timestamp,
            })
            edge_data["tx_count"] += 1
        else:
            G.add_edge(
                sender,
                receiver,
                weight=amount,
                transactions=[{"amount": amount, "timestamp": timestamp}],
                tx_count=1,
            )

    return G


def graph_to_json(G: nx.DiGraph) -> dict[str, list[dict[str, Any]]]:
    """
    Serialise a NetworkX DiGraph into a JSON-friendly dictionary.

    Returns a structure consumable by react-force-graph / D3:
        {
            "nodes": [{"id": "A", "degree": 3, "in_degree": 1, "out_degree": 2}],
            "links": [{"source": "A", "target": "B", "amount": 100.0, "tx_count": 1}]
        }
    """
    nodes = [
        {
            "id": str(node),
            "degree": G.degree(node),
            "in_degree": G.in_degree(node),
            "out_degree": G.out_degree(node),
        }
        for node in G.nodes()
    ]

    links = [
        {
            "source": str(u),
            "target": str(v),
            "amount": round(data.get("weight", 0.0), 2),
            "tx_count": data.get("tx_count", 1),
        }
        for u, v, data in G.edges(data=True)
    ]

    return {"nodes": nodes, "links": links}


def get_graph_stats(G: nx.DiGraph) -> dict[str, Any]:
    """
    Compute high-level statistics about the transaction graph.
    Used by the /api/summary endpoint.
    """
    total_volume = sum(data.get("weight", 0.0) for _, _, data in G.edges(data=True))
    total_edges = G.number_of_edges()

    return {
        "total_nodes": G.number_of_nodes(),
        "total_edges": total_edges,
        "total_volume": round(total_volume, 2),
        "avg_tx_amount": round(total_volume / total_edges, 2) if total_edges > 0 else 0.0,
        "density": round(nx.density(G), 6),
        "is_weakly_connected": nx.is_weakly_connected(G) if G.number_of_nodes() > 0 else False,
        "num_weakly_connected_components": (
            nx.number_weakly_connected_components(G) if G.number_of_nodes() > 0 else 0
        ),
    }
