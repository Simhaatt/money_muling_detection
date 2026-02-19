"""
Tests for app.services.scoring
================================
Covers classify_risk_tier, compute_risk_scores weights, cap, reasons,
column schema, empty-graph edge case, and threshold logic.
"""

import networkx as nx
import pandas as pd
import pytest

from app.services.scoring import classify_risk_tier, compute_risk_scores

_SENTINEL = object()  # distinguishes "not passed" from "passed as empty dict"


# ── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture
def empty_graph() -> nx.DiGraph:
    return nx.DiGraph()


@pytest.fixture
def cycle_graph() -> nx.DiGraph:
    """A→B→C→A cycle (all 3 nodes participate)."""
    G = nx.DiGraph()
    G.add_edge("A", "B", total_amount=100, transaction_count=1)
    G.add_edge("B", "C", total_amount=200, transaction_count=1)
    G.add_edge("C", "A", total_amount=150, transaction_count=1)
    return G


@pytest.fixture
def fan_in_graph() -> nx.DiGraph:
    """Node 'hub' receives from 11 senders, sends to 1."""
    G = nx.DiGraph()
    for i in range(11):
        G.add_edge(f"s{i}", "hub", total_amount=100, transaction_count=1)
    G.add_edge("hub", "exit", total_amount=500, transaction_count=1)
    return G


@pytest.fixture
def fan_out_graph() -> nx.DiGraph:
    """Node 'src' receives from 1, sends to 11."""
    G = nx.DiGraph()
    G.add_edge("origin", "src", total_amount=1000, transaction_count=1)
    for i in range(11):
        G.add_edge("src", f"r{i}", total_amount=100, transaction_count=1)
    return G


def _make_features(
    nodes,
    *,
    fan_in=None,
    fan_out=None,
    nodes_in_cycles=None,
    communities=_SENTINEL,
    pagerank=None,
    betweenness=None,
):
    """Helper to build a minimal features dict."""
    n = len(nodes) or 1
    return {
        "pagerank": pagerank or {nd: 1.0 / n for nd in nodes},
        "betweenness": betweenness or {nd: 0.0 for nd in nodes},
        "in_degree": {nd: 1 for nd in nodes},
        "out_degree": {nd: 1 for nd in nodes},
        "fan_in_nodes": fan_in or [],
        "fan_out_nodes": fan_out or [],
        "cycles": [],
        "nodes_in_cycles": nodes_in_cycles or [],
        "communities": {nd: 0 for nd in nodes} if communities is _SENTINEL else communities,
    }


# ── classify_risk_tier ────────────────────────────────────────────────────
class TestClassifyRiskTier:
    def test_critical(self):
        assert classify_risk_tier(80) == "CRITICAL"
        assert classify_risk_tier(100) == "CRITICAL"

    def test_high(self):
        assert classify_risk_tier(60) == "HIGH"
        assert classify_risk_tier(79) == "HIGH"

    def test_medium(self):
        assert classify_risk_tier(40) == "MEDIUM"
        assert classify_risk_tier(59) == "MEDIUM"

    def test_low(self):
        assert classify_risk_tier(0) == "LOW"
        assert classify_risk_tier(39) == "LOW"


# ── compute_risk_scores ──────────────────────────────────────────────────
class TestComputeRiskScores:
    def test_empty_graph(self, empty_graph):
        features = _make_features([])
        df = compute_risk_scores(empty_graph, features)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0
        expected_cols = {
            "account_id", "risk_score", "risk_tier", "reasons",
            "pagerank", "betweenness", "in_degree", "out_degree",
        }
        assert expected_cols == set(df.columns)

    def test_columns_present(self, cycle_graph):
        nodes = list(cycle_graph.nodes())
        features = _make_features(nodes)
        df = compute_risk_scores(cycle_graph, features)
        expected_cols = {
            "account_id", "risk_score", "risk_tier", "reasons",
            "pagerank", "betweenness", "in_degree", "out_degree",
        }
        assert expected_cols == set(df.columns)

    def test_one_row_per_node(self, cycle_graph):
        nodes = list(cycle_graph.nodes())
        features = _make_features(nodes)
        df = compute_risk_scores(cycle_graph, features)
        assert len(df) == len(nodes)

    def test_cycle_score(self, cycle_graph):
        """Cycle nodes should get +60 (cycle) + 20 (community) = 80."""
        nodes = list(cycle_graph.nodes())
        features = _make_features(nodes, nodes_in_cycles=nodes)
        df = compute_risk_scores(cycle_graph, features)
        for _, row in df.iterrows():
            assert row["risk_score"] >= 60  # at minimum cycle weight

    def test_cycle_reason(self, cycle_graph):
        nodes = list(cycle_graph.nodes())
        features = _make_features(nodes, nodes_in_cycles=nodes)
        df = compute_risk_scores(cycle_graph, features)
        for _, row in df.iterrows():
            assert any("cycle" in r.lower() for r in row["reasons"])

    def test_fan_in_score(self, fan_in_graph):
        nodes = list(fan_in_graph.nodes())
        features = _make_features(nodes, fan_in=["hub"])
        df = compute_risk_scores(fan_in_graph, features)
        hub_row = df[df["account_id"] == "hub"].iloc[0]
        assert hub_row["risk_score"] >= 25

    def test_fan_out_score(self, fan_out_graph):
        nodes = list(fan_out_graph.nodes())
        features = _make_features(nodes, fan_out=["src"])
        df = compute_risk_scores(fan_out_graph, features)
        src_row = df[df["account_id"] == "src"].iloc[0]
        assert src_row["risk_score"] >= 25

    def test_score_capped_at_100(self, cycle_graph):
        """Even if all flags fire, score must not exceed 100."""
        nodes = list(cycle_graph.nodes())
        features = _make_features(
            nodes,
            nodes_in_cycles=nodes,
            fan_in=nodes,
            fan_out=nodes,
            # give one node absurdly high pagerank + betweenness
            pagerank={nd: 10.0 for nd in nodes},
            betweenness={nd: 10.0 for nd in nodes},
        )
        df = compute_risk_scores(cycle_graph, features)
        assert df["risk_score"].max() <= 100

    def test_high_pagerank_reason(self):
        """Node with pagerank > 2x mean should get the PageRank reason."""
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=100, transaction_count=1)
        G.add_edge("B", "C", total_amount=100, transaction_count=1)
        # A has very high PR relative to mean
        features = _make_features(
            ["A", "B", "C"],
            pagerank={"A": 0.9, "B": 0.05, "C": 0.05},
            communities={},
        )
        df = compute_risk_scores(G, features)
        a_row = df[df["account_id"] == "A"].iloc[0]
        assert any("PageRank" in r for r in a_row["reasons"])

    def test_high_betweenness_reason(self):
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=100, transaction_count=1)
        G.add_edge("B", "C", total_amount=100, transaction_count=1)
        features = _make_features(
            ["A", "B", "C"],
            betweenness={"A": 0.0, "B": 0.9, "C": 0.0},
            communities={},
        )
        df = compute_risk_scores(G, features)
        b_row = df[df["account_id"] == "B"].iloc[0]
        assert any("betweenness" in r.lower() for r in b_row["reasons"])

    def test_no_flags_low_score(self):
        """Node with no flags should get only the community weight."""
        G = nx.DiGraph()
        G.add_edge("X", "Y", total_amount=100, transaction_count=1)
        # No communities → score should be 0
        features = _make_features(["X", "Y"], communities={})
        df = compute_risk_scores(G, features)
        assert all(row["risk_score"] == 0 for _, row in df.iterrows())
        assert all(row["risk_tier"] == "LOW" for _, row in df.iterrows())

    def test_community_adds_20(self):
        """Nodes in a community should get +20."""
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=100, transaction_count=1)
        features = _make_features(
            ["A", "B"],
            communities={"A": 0, "B": 0},
        )
        df = compute_risk_scores(G, features)
        # Both in community → both get +20, so score = 20
        for _, row in df.iterrows():
            assert row["risk_score"] >= 20
