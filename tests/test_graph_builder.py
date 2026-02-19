"""Tests for transaction graph construction and JSON export."""

import pandas as pd

from app.services.graph_builder import build_graph, graph_to_json


def test_build_graph_aggregates_multiple_transactions_between_same_accounts():
    df = pd.DataFrame(
        [
            {"sender": "A", "receiver": "B", "amount": 100.0, "timestamp": "2026-02-19T10:00:00"},
            {"sender": "A", "receiver": "B", "amount": 50.5, "timestamp": "2026-02-19T10:05:00"},
            {"sender": "B", "receiver": "C", "amount": 20.0, "timestamp": "2026-02-19T10:10:00"},
        ]
    )

    graph = build_graph(df)

    assert graph.number_of_nodes() == 3
    assert graph.number_of_edges() == 2

    edge_ab = graph["A"]["B"]
    assert edge_ab["transaction_count"] == 2
    assert edge_ab["total_amount"] == 150.5
    assert edge_ab["amount"] == 50.5
    assert edge_ab["timestamp"] == "2026-02-19T10:05:00"


def test_build_graph_initializes_new_edge_attributes_correctly():
    df = pd.DataFrame(
        [
            {"sender": "X", "receiver": "Y", "amount": 75.0, "timestamp": "2026-02-19T09:00:00"},
        ]
    )

    graph = build_graph(df)
    edge_xy = graph["X"]["Y"]

    assert edge_xy["transaction_count"] == 1
    assert edge_xy["total_amount"] == 75.0
    assert edge_xy["amount"] == 75.0
    assert edge_xy["timestamp"] == "2026-02-19T09:00:00"


def test_graph_to_json_returns_expected_schema_and_values():
    df = pd.DataFrame(
        [
            {"sender": "A", "receiver": "B", "amount": 10.0, "timestamp": "2026-02-19T10:00:00"},
            {"sender": "A", "receiver": "B", "amount": 30.0, "timestamp": "2026-02-19T10:03:00"},
            {"sender": "B", "receiver": "C", "amount": 5.0, "timestamp": "2026-02-19T10:10:00"},
        ]
    )

    graph = build_graph(df)
    payload = graph_to_json(graph)

    assert set(payload.keys()) == {"nodes", "links"}

    node_ids = {node["id"] for node in payload["nodes"]}
    assert node_ids == {"A", "B", "C"}

    for node in payload["nodes"]:
        assert "in_degree" in node
        assert "out_degree" in node

    link_ab = next(link for link in payload["links"] if link["source"] == "A" and link["target"] == "B")
    assert link_ab["transaction_count"] == 2
    assert link_ab["total_amount"] == 40.0


def test_build_graph_raises_when_required_columns_missing():
    df = pd.DataFrame(
        [
            {"sender": "A", "receiver": "B", "amount": 10.0},
        ]
    )

    try:
        build_graph(df)
    except ValueError as error:
        assert "DataFrame must contain columns" in str(error)
    else:
        raise AssertionError("Expected ValueError for missing required columns")
