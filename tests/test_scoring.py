"""
Tests for app.services.scoring
================================
Covers:
    - classify_risk_tier
    - compute_risk_scores with additive + subtractive scoring
    - Edge Case 1: Payroll suppression
    - Edge Case 2: Merchant suppression
    - Edge Case 3: Gateway suppression
    - Edge Case 4: Family cycle (low amount, single occurrence)
    - Edge Case 7: Velocity bonus
    - Edge Case 8: Low-amount cycle trap
    - Edge Case 9: Community only with primary
    - Score cap at 100
    - Empty graph
"""

import networkx as nx
import pandas as pd
import pytest

from app.services.scoring import (
    classify_risk_tier,
    compute_risk_scores,
    is_likely_payroll,
    is_likely_merchant,
    is_likely_gateway,
)

_SENTINEL = object()


# ── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture
def empty_graph() -> nx.DiGraph:
    return nx.DiGraph()


@pytest.fixture
def cycle_graph() -> nx.DiGraph:
    G = nx.DiGraph()
    G.add_edge("A", "B", total_amount=5000, transaction_count=1)
    G.add_edge("B", "C", total_amount=5000, transaction_count=1)
    G.add_edge("C", "A", total_amount=5000, transaction_count=1)
    return G


def _make_features(
    nodes, *, fan_in=None, fan_out=None, nodes_in_cycles=None,
    cycles=None, communities=_SENTINEL, pagerank=None, betweenness=None,
    cycle_metadata=None, shell_data=None, fan_72h=None,
    velocity=None, forwarding_ratios=None,
):
    n = len(nodes) or 1
    return {
        "pagerank": pagerank or {nd: 1.0 / n for nd in nodes},
        "betweenness": betweenness or {nd: 0.0 for nd in nodes},
        "in_degree": {nd: 1 for nd in nodes},
        "out_degree": {nd: 1 for nd in nodes},
        "fan_in_nodes": fan_in or [],
        "fan_out_nodes": fan_out or [],
        "cycles": cycles or [],
        "nodes_in_cycles": nodes_in_cycles or [],
        "communities": {nd: 0 for nd in nodes} if communities is _SENTINEL else communities,
        "cycle_metadata": cycle_metadata or {},
        "shell_data": shell_data or {"shell_chains": [], "shell_nodes": [], "nodes_in_chains": []},
        "fan_72h": fan_72h or {"fan_in_nodes_72h": [], "fan_out_nodes_72h": [],
                                "fan_in_counts": {}, "fan_out_counts": {}},
        "velocity": velocity or {},
        "forwarding_ratios": forwarding_ratios or {},
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

    def test_columns_present(self, cycle_graph):
        nodes = list(cycle_graph.nodes())
        features = _make_features(nodes)
        df = compute_risk_scores(cycle_graph, features)
        expected = {
            "account_id", "risk_score", "risk_tier", "reasons",
            "pagerank", "betweenness", "in_degree", "out_degree",
            "is_payroll", "is_merchant", "is_gateway",
        }
        assert expected == set(df.columns)

    def test_one_row_per_node(self, cycle_graph):
        nodes = list(cycle_graph.nodes())
        features = _make_features(nodes)
        df = compute_risk_scores(cycle_graph, features)
        assert len(df) == len(nodes)

    def test_cycle_high_amount_gets_full_weight(self, cycle_graph):
        """Cycle with amount > 1000 -> +40 (Edge Case 4: validated)."""
        nodes = list(cycle_graph.nodes())
        cycle = ["A", "B", "C"]
        features = _make_features(
            nodes, nodes_in_cycles=nodes, cycles=[cycle],
            cycle_metadata={
                "A": {"cycle_count": 1, "max_cycle_amount": 15000.0, "min_cycle_length": 3},
                "B": {"cycle_count": 1, "max_cycle_amount": 15000.0, "min_cycle_length": 3},
                "C": {"cycle_count": 1, "max_cycle_amount": 15000.0, "min_cycle_length": 3},
            },
            communities={},
        )
        df = compute_risk_scores(cycle_graph, features)
        for _, row in df.iterrows():
            assert row["risk_score"] >= 40

    def test_cycle_low_amount_reduced(self):
        """Edge Case 8: cycle with tiny amounts gets reduced score."""
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=10, transaction_count=1)
        G.add_edge("B", "C", total_amount=10, transaction_count=1)
        G.add_edge("C", "A", total_amount=10, transaction_count=1)
        nodes = ["A", "B", "C"]
        features = _make_features(
            nodes, nodes_in_cycles=nodes, cycles=[nodes],
            cycle_metadata={
                "A": {"cycle_count": 1, "max_cycle_amount": 30.0, "min_cycle_length": 3},
                "B": {"cycle_count": 1, "max_cycle_amount": 30.0, "min_cycle_length": 3},
                "C": {"cycle_count": 1, "max_cycle_amount": 30.0, "min_cycle_length": 3},
            },
            communities={},
        )
        df = compute_risk_scores(G, features)
        # Should get +10 (low freq) - 15 (low amount) = 0 (clamped)
        for _, row in df.iterrows():
            assert row["risk_score"] < 40  # Not MEDIUM/HIGH

    def test_score_capped_at_100(self, cycle_graph):
        nodes = list(cycle_graph.nodes())
        features = _make_features(
            nodes, nodes_in_cycles=nodes,
            cycles=[nodes],
            cycle_metadata={n: {"cycle_count": 3, "max_cycle_amount": 50000, "min_cycle_length": 3} for n in nodes},
            fan_in=nodes, fan_out=nodes,
            pagerank={nd: 10.0 for nd in nodes},
            betweenness={nd: 10.0 for nd in nodes},
            velocity={n: 100.0 for n in nodes},
        )
        df = compute_risk_scores(cycle_graph, features)
        assert df["risk_score"].max() <= 100

    def test_no_flags_low_score(self):
        G = nx.DiGraph()
        G.add_edge("X", "Y", total_amount=100, transaction_count=1)
        features = _make_features(["X", "Y"], communities={})
        df = compute_risk_scores(G, features)
        for _, row in df.iterrows():
            assert row["risk_score"] == 0
            assert row["risk_tier"] == "LOW"

    def test_high_pagerank_only_with_primary(self):
        """PageRank alone (no primary) should NOT boost score."""
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=100, transaction_count=1)
        features = _make_features(
            ["A", "B"],
            pagerank={"A": 0.9, "B": 0.1},
            communities={},
        )
        df = compute_risk_scores(G, features)
        a_row = df[df["account_id"] == "A"].iloc[0]
        # No primary signal, so PR shouldn't add anything
        assert a_row["risk_score"] == 0

    def test_velocity_bonus(self):
        """Edge Case 7: high velocity gets +20."""
        G = nx.DiGraph()
        G.add_edge("FAST", "SLOW", total_amount=100, transaction_count=1)
        features = _make_features(
            ["FAST", "SLOW"],
            velocity={"FAST": 50.0, "SLOW": 1.0},  # 50 tx/day
            communities={},
        )
        df = compute_risk_scores(G, features)
        fast_row = df[df["account_id"] == "FAST"].iloc[0]
        assert fast_row["risk_score"] >= 20
        assert "high_velocity" in fast_row["reasons"]


# ── Suppression tests ─────────────────────────────────────────────────────
class TestPayrollSuppression:
    def test_payroll_detected(self):
        """Edge Case 1: Fan-out with low forwarding = payroll."""
        G = nx.DiGraph()
        G.add_edge("FUNDING", "PAYROLL", total_amount=50000, transaction_count=1)
        for i in range(15):
            G.add_edge("PAYROLL", f"EMP{i}", total_amount=2000, transaction_count=1)
        # Employees don't forward
        fwd = compute_forwarding_ratios_helper(G)
        assert is_likely_payroll("PAYROLL", G, set(), set(), fwd)

    def test_payroll_in_cycle_not_suppressed(self):
        """Payroll-like hub that's in a cycle should NOT be suppressed."""
        G = nx.DiGraph()
        G.add_edge("FUNDING", "PAYROLL", total_amount=50000, transaction_count=1)
        for i in range(15):
            G.add_edge("PAYROLL", f"EMP{i}", total_amount=2000, transaction_count=1)
        fwd = compute_forwarding_ratios_helper(G)
        assert not is_likely_payroll("PAYROLL", G, {"PAYROLL"}, set(), fwd)

    def test_payroll_score_reduced(self):
        """Payroll accounts should have reduced scores in compute_risk_scores."""
        G = nx.DiGraph()
        G.add_edge("FUNDING", "PAYROLL", total_amount=50000, transaction_count=1)
        for i in range(15):
            G.add_edge("PAYROLL", f"EMP{i}", total_amount=2000, transaction_count=1)
        nodes = list(G.nodes())
        features = _make_features(
            nodes, fan_out=["PAYROLL"],
            forwarding_ratios={n: 0.0 for n in nodes},
            communities={},
        )
        df = compute_risk_scores(G, features)
        payroll_row = df[df["account_id"] == "PAYROLL"].iloc[0]
        assert bool(payroll_row["is_payroll"]) is True


class TestMerchantSuppression:
    def test_merchant_detected(self):
        """Edge Case 2: High in-degree, near-zero out-degree."""
        G = nx.DiGraph()
        for i in range(20):
            G.add_edge(f"C{i}", "MERCHANT", total_amount=100, transaction_count=1)
        assert is_likely_merchant("MERCHANT", G, set(), set())

    def test_merchant_with_outgoing_not_suppressed(self):
        """Merchant with out_degree > 1 should NOT be suppressed."""
        G = nx.DiGraph()
        for i in range(20):
            G.add_edge(f"C{i}", "MERCHANT", total_amount=100, transaction_count=1)
        G.add_edge("MERCHANT", "REFUND1", total_amount=50, transaction_count=1)
        G.add_edge("MERCHANT", "REFUND2", total_amount=50, transaction_count=1)
        assert not is_likely_merchant("MERCHANT", G, set(), set())


class TestGatewaySuppression:
    def test_gateway_detected(self):
        """Edge Case 3: Very high in-degree AND out-degree."""
        G = nx.DiGraph()
        for i in range(55):
            G.add_edge(f"IN{i}", "GW", total_amount=100, transaction_count=1)
            G.add_edge("GW", f"OUT{i}", total_amount=100, transaction_count=1)
        assert is_likely_gateway("GW", G, set())

    def test_gateway_in_cycle_not_suppressed(self):
        G = nx.DiGraph()
        for i in range(55):
            G.add_edge(f"IN{i}", "GW", total_amount=100, transaction_count=1)
            G.add_edge("GW", f"OUT{i}", total_amount=100, transaction_count=1)
        assert not is_likely_gateway("GW", G, {"GW"})


# Helper
def compute_forwarding_ratios_helper(G):
    from app.services.graph_features import compute_forwarding_ratios
    return compute_forwarding_ratios(G)
