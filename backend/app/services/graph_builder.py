"""
graph_builder.py — Transaction Graph Construction
===================================================
IIBuilds and exports the transaction graph from CSV transaction data.

Each node represents an account, and each directed edge represents one or more
transactions from sender → receiver.

Primary API:
    - build_graph(df): build a directed transaction graph from DataFrame
    - graph_to_json(G): export graph in frontend-friendly JSON structure

Located in: app/services/graph_builder.py
Called by:   app/services/fraud_detection.py
"""

from __future__ import annotations

import networkx as nx
import pandas as pd
from typing import Any


def _resolve_column_map(df: pd.DataFrame) -> dict[str, str]:
    """
    Resolve input column mapping.

    Preferred schema (as required):
        sender, receiver, amount, timestamp

    Backward-compatible schema:
        sender_id, receiver_id, amount, timestamp
    """
    required_primary = {"sender", "receiver", "amount", "timestamp"}
    if required_primary.issubset(df.columns):
        return {
            "sender": "sender",
            "receiver": "receiver",
            "amount": "amount",
            "timestamp": "timestamp",
        }

    required_legacy = {"sender_id", "receiver_id", "amount", "timestamp"}
    if required_legacy.issubset(df.columns):
        return {
            "sender": "sender_id",
            "receiver": "receiver_id",
            "amount": "amount",
            "timestamp": "timestamp",
        }

    expected = "{'sender','receiver','amount','timestamp'}"
    legacy = "{'sender_id','receiver_id','amount','timestamp'}"
    raise ValueError(
        f"DataFrame must contain columns {expected} (or legacy {legacy}). "
        f"Received: {set(df.columns)}"
    )


def build_graph(df: pd.DataFrame) -> nx.DiGraph:
    """
    Build a directed transaction graph from a DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Expected columns:
            - sender (string)
            - receiver (string)
            - amount (float)
            - timestamp (string or datetime)

    Returns
    -------
    nx.DiGraph
        Directed graph where:
            - each unique account is a node
            - each sender -> receiver pair is an edge
            - edge attributes include:
                amount (most recent transaction amount)
                timestamp (most recent transaction timestamp as string)
                transaction_count (number of transactions on this edge)
                total_amount (sum of all transaction amounts on this edge)

    Raises
    ------
    ValueError
        If required columns are missing.
    """
    column_map = _resolve_column_map(df)

    sender_col = column_map["sender"]
    receiver_col = column_map["receiver"]
    amount_col = column_map["amount"]
    timestamp_col = column_map["timestamp"]

    # --- Vectorised pre-processing (avoid iterrows) -------------------------
    # Work on a clean copy: coerce amount to numeric, drop invalid rows.
    work = df[[sender_col, receiver_col, amount_col, timestamp_col]].copy()
    work[sender_col] = work[sender_col].astype(str).str.strip()
    work[receiver_col] = work[receiver_col].astype(str).str.strip()
    work[amount_col] = pd.to_numeric(work[amount_col], errors="coerce")
    work[timestamp_col] = work[timestamp_col].astype(str)

    # Drop rows with missing/invalid amounts or empty account IDs.
    work.dropna(subset=[amount_col], inplace=True)
    work = work[(work[sender_col] != "") & (work[receiver_col] != "")]

    # --- Aggregate per edge using groupby (vectorised) ----------------------
    grouped = work.groupby([sender_col, receiver_col], sort=False).agg(
        transaction_count=(amount_col, "size"),
        total_amount=(amount_col, "sum"),
        amount=(amount_col, "last"),           # most-recent txn amount
        timestamp=(timestamp_col, "last"),     # most-recent timestamp
    ).reset_index()

    # --- Build graph in bulk using from_pandas_edgelist --------------------
    # Faster than iterating rows; NetworkX handles DataFrame natively.
    G = nx.from_pandas_edgelist(
        grouped,
        source=sender_col,
        target=receiver_col,
        edge_attr=["transaction_count", "total_amount", "amount", "timestamp"],
        create_using=nx.DiGraph(),
    )

    return G


def build_transaction_graph(df: pd.DataFrame) -> nx.DiGraph:
    """
    Backward-compatible wrapper around build_graph().

    Kept to avoid breaking existing imports in other modules.
    """
    return build_graph(df)


def graph_to_json(G: nx.DiGraph) -> dict[str, list[dict[str, Any]]]:
    """
    Export a directed graph to JSON for frontend visualization.

    Output format:
        {
            "nodes": [
                {
                    "id": "account_id",
                    "in_degree": int,
                    "out_degree": int
                }
            ],
            "links": [
                {
                    "source": "account_id",
                    "target": "account_id",
                    "transaction_count": int,
                    "total_amount": float
                }
            ]
        }
    """
    # Batch degree lookups (O(1) dict access vs per-node method calls)
    in_deg = dict(G.in_degree())
    out_deg = dict(G.out_degree())
    nodes = [
        {
            "id": str(node),
            "in_degree": in_deg[node],
            "out_degree": out_deg[node],
        }
        for node in G.nodes()
    ]

    links = [
        {
            "source": str(u),
            "target": str(v),
            "transaction_count": int(data.get("transaction_count", 0)),
            "total_amount": float(round(data.get("total_amount", 0.0), 2)),
        }
        for u, v, data in G.edges(data=True)
    ]

    return {"nodes": nodes, "links": links}


def get_graph_stats(G: nx.DiGraph) -> dict[str, Any]:
    """
    Compute high-level statistics about the transaction graph.
    Used by the /api/summary endpoint.
    """
    total_volume = sum(data.get("total_amount", 0.0) for _, _, data in G.edges(data=True))
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
