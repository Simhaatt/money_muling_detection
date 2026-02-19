"""
Tests for app.services.graph_features
======================================
Covers all feature extractors including new edge-case detectors:
    - centrality, degree, fan-in/out
    - cycle detection (3-5)
    - 72h smurfing detection
    - shell chain detection
    - velocity features
    - cycle metadata
    - forwarding ratios
    - community detection
    - unified extract_graph_features()
"""

from datetime import datetime, timedelta

import networkx as nx
import pandas as pd
import pytest

from app.services.graph_features import (
    compute_betweenness,
    compute_degree_features,
    compute_pagerank,
    detect_communities,
    detect_cycles,
    detect_fan_in,
    detect_fan_out,
    detect_fan_in_out_72h,
    detect_layered_shell_chains,
    compute_velocity_features,
    compute_cycle_metadata,
    compute_forwarding_ratios,
    extract_graph_features,
)


# ── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture
def empty_graph() -> nx.DiGraph:
    return nx.DiGraph()


@pytest.fixture
def simple_graph() -> nx.DiGraph:
    """A->B->C->A cycle with spur C->D."""
    G = nx.DiGraph()
    G.add_edge("A", "B", total_amount=100, transaction_count=1)
    G.add_edge("B", "C", total_amount=200, transaction_count=2)
    G.add_edge("C", "A", total_amount=150, transaction_count=1)
    G.add_edge("C", "D", total_amount=50, transaction_count=1)
    return G


@pytest.fixture
def fan_in_graph() -> nx.DiGraph:
    G = nx.DiGraph()
    for i in range(11):
        G.add_edge(f"sender_{i}", "hub", total_amount=100, transaction_count=1)
    G.add_edge("hub", "exit", total_amount=500, transaction_count=1)
    return G


@pytest.fixture
def fan_out_graph() -> nx.DiGraph:
    G = nx.DiGraph()
    G.add_edge("origin", "source", total_amount=1000, transaction_count=1)
    for i in range(11):
        G.add_edge("source", f"receiver_{i}", total_amount=100, transaction_count=1)
    return G


# ── Centrality ─────────────────────────────────────────────────────────────
class TestPageRank:
    def test_returns_all_nodes(self, simple_graph):
        pr = compute_pagerank(simple_graph)
        assert set(pr.keys()) == set(simple_graph.nodes())

    def test_values_sum_to_one(self, simple_graph):
        pr = compute_pagerank(simple_graph)
        assert pytest.approx(sum(pr.values()), abs=1e-6) == 1.0

    def test_empty_graph(self, empty_graph):
        assert compute_pagerank(empty_graph) == {}


class TestBetweenness:
    def test_returns_all_nodes(self, simple_graph):
        bc = compute_betweenness(simple_graph)
        assert set(bc.keys()) == set(simple_graph.nodes())

    def test_values_in_range(self, simple_graph):
        for v in compute_betweenness(simple_graph).values():
            assert 0.0 <= v <= 1.0

    def test_empty_graph(self, empty_graph):
        assert compute_betweenness(empty_graph) == {}


# ── Degree ─────────────────────────────────────────────────────────────────
class TestDegreeFeatures:
    def test_correctness(self, simple_graph):
        in_deg, out_deg = compute_degree_features(simple_graph)
        assert in_deg["C"] == 1
        assert out_deg["C"] == 2
        assert in_deg["D"] == 1
        assert out_deg["D"] == 0


# ── Fan-in / Fan-out (degree-based) ───────────────────────────────────────
class TestFanIn:
    def test_detects_hub(self, fan_in_graph):
        assert "hub" in detect_fan_in(fan_in_graph)

    def test_senders_not_flagged(self, fan_in_graph):
        nodes = detect_fan_in(fan_in_graph)
        for i in range(11):
            assert f"sender_{i}" not in nodes

    def test_empty(self, empty_graph):
        assert detect_fan_in(empty_graph) == []


class TestFanOut:
    def test_detects_source(self, fan_out_graph):
        assert "source" in detect_fan_out(fan_out_graph)

    def test_receivers_not_flagged(self, fan_out_graph):
        nodes = detect_fan_out(fan_out_graph)
        for i in range(11):
            assert f"receiver_{i}" not in nodes

    def test_empty(self, empty_graph):
        assert detect_fan_out(empty_graph) == []


# ── Cycle detection ───────────────────────────────────────────────────────
class TestCycles:
    def test_finds_triangle(self, simple_graph):
        cycles, nodes = detect_cycles(simple_graph)
        assert len(cycles) >= 1
        cycle_sets = [set(c) for c in cycles]
        assert {"A", "B", "C"} in cycle_sets

    def test_nodes_in_cycles(self, simple_graph):
        _, nodes = detect_cycles(simple_graph)
        assert set(nodes) == {"A", "B", "C"}

    def test_no_cycles(self, fan_in_graph):
        cycles, nodes = detect_cycles(fan_in_graph)
        assert cycles == []
        assert nodes == []


# ── 72h Smurfing ──────────────────────────────────────────────────────────
class TestFanInOut72h:
    def test_fan_out_72h_detected(self):
        """12 unique receivers in 1 hour should trigger fan-out 72h."""
        G = nx.DiGraph()
        base = datetime(2025, 1, 1, 10, 0)
        rows = []
        for i in range(12):
            G.add_edge("SMURF", f"R{i}", total_amount=50, transaction_count=1)
            rows.append({
                "sender_id": "SMURF", "receiver_id": f"R{i}",
                "amount": 50, "timestamp": (base + timedelta(minutes=i*5)).isoformat(),
            })
        tx_df = pd.DataFrame(rows)
        result = detect_fan_in_out_72h(G, tx_df)
        assert "SMURF" in result["fan_out_nodes_72h"]

    def test_fan_in_72h_detected(self):
        """12 unique senders to one receiver in 1 hour."""
        G = nx.DiGraph()
        base = datetime(2025, 1, 1, 10, 0)
        rows = []
        for i in range(12):
            G.add_edge(f"S{i}", "COLLECTOR", total_amount=50, transaction_count=1)
            rows.append({
                "sender_id": f"S{i}", "receiver_id": "COLLECTOR",
                "amount": 50, "timestamp": (base + timedelta(minutes=i*5)).isoformat(),
            })
        tx_df = pd.DataFrame(rows)
        result = detect_fan_in_out_72h(G, tx_df)
        assert "COLLECTOR" in result["fan_in_nodes_72h"]

    def test_no_flag_below_threshold(self):
        """Only 3 unique senders < 10 threshold."""
        G = nx.DiGraph()
        rows = []
        for i in range(3):
            G.add_edge(f"S{i}", "RCV", total_amount=100, transaction_count=1)
            rows.append({
                "sender_id": f"S{i}", "receiver_id": "RCV",
                "amount": 100, "timestamp": "2025-01-01 10:00:00",
            })
        tx_df = pd.DataFrame(rows)
        result = detect_fan_in_out_72h(G, tx_df)
        assert "RCV" not in result["fan_in_nodes_72h"]

    def test_empty_df(self):
        G = nx.DiGraph()
        result = detect_fan_in_out_72h(G, pd.DataFrame())
        assert result["fan_in_nodes_72h"] == []
        assert result["fan_out_nodes_72h"] == []


# ── Shell Chain Detection ─────────────────────────────────────────────────
class TestShellChains:
    def test_detects_chain(self):
        """A->B->C->D where B,C have degree 2 -> shell chain."""
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=100, transaction_count=1)
        G.add_edge("B", "C", total_amount=100, transaction_count=1)
        G.add_edge("C", "D", total_amount=100, transaction_count=1)
        result = detect_layered_shell_chains(G)
        assert len(result["shell_chains"]) >= 1
        assert "B" in result["shell_nodes"] or "C" in result["shell_nodes"]

    def test_no_chain_high_degree(self):
        """Nodes with high degree shouldn't be shell candidates."""
        G = nx.DiGraph()
        G.add_edge("A", "B", total_amount=100, transaction_count=1)
        for i in range(10):
            G.add_edge(f"X{i}", "B", total_amount=50, transaction_count=1)
            G.add_edge("B", f"Y{i}", total_amount=50, transaction_count=1)
        G.add_edge("B", "C", total_amount=100, transaction_count=1)
        result = detect_layered_shell_chains(G)
        assert "B" not in result.get("shell_nodes", [])


# ── Velocity Features ─────────────────────────────────────────────────────
class TestVelocity:
    def test_high_velocity(self):
        """12 txns in 1 hour = very high velocity."""
        base = datetime(2025, 1, 1, 10, 0)
        rows = [{
            "sender_id": "FAST", "receiver_id": f"R{i}",
            "amount": 50, "timestamp": (base + timedelta(minutes=i*5)).isoformat(),
        } for i in range(12)]
        tx_df = pd.DataFrame(rows)
        vel = compute_velocity_features(tx_df)
        assert vel.get("FAST", 0) > 10  # > 10 tx/day

    def test_empty(self):
        assert compute_velocity_features(pd.DataFrame()) == {}


# ── Cycle Metadata ────────────────────────────────────────────────────────
class TestCycleMetadata:
    def test_single_cycle(self, simple_graph):
        cycles, _ = detect_cycles(simple_graph)
        meta = compute_cycle_metadata(cycles, simple_graph)
        # A, B, C should all have metadata
        for node in ["A", "B", "C"]:
            assert node in meta
            assert meta[node]["cycle_count"] >= 1
            assert meta[node]["max_cycle_amount"] > 0

    def test_no_cycles(self):
        G = nx.DiGraph()
        G.add_edge("A", "B")
        meta = compute_cycle_metadata([], G)
        assert meta == {}


# ── Forwarding Ratios ─────────────────────────────────────────────────────
class TestForwardingRatios:
    def test_payroll_like(self):
        """Source sends to 10 receivers who don't forward."""
        G = nx.DiGraph()
        for i in range(10):
            G.add_edge("PAYROLL", f"EMP{i}", total_amount=1000, transaction_count=1)
        ratios = compute_forwarding_ratios(G)
        assert ratios["PAYROLL"] == 0.0  # no receiver forwards

    def test_mule_like(self):
        """Source sends to receivers who DO forward."""
        G = nx.DiGraph()
        for i in range(10):
            G.add_edge("MULE", f"R{i}", total_amount=100, transaction_count=1)
            G.add_edge(f"R{i}", f"DEST{i}", total_amount=80, transaction_count=1)
        ratios = compute_forwarding_ratios(G)
        assert ratios["MULE"] == 1.0  # all forward


# ── Community detection ───────────────────────────────────────────────────
class TestCommunities:
    def test_all_nodes_assigned(self, simple_graph):
        comms = detect_communities(simple_graph)
        assert set(comms.keys()) == set(simple_graph.nodes())

    def test_ids_are_ints(self, simple_graph):
        for v in detect_communities(simple_graph).values():
            assert isinstance(v, int)

    def test_empty(self, empty_graph):
        assert detect_communities(empty_graph) == {}


# ── Unified extractor ─────────────────────────────────────────────────────
class TestExtractGraphFeatures:
    def test_returns_all_keys(self, simple_graph):
        features = extract_graph_features(simple_graph)
        expected = {
            "pagerank", "betweenness", "in_degree", "out_degree",
            "fan_in_nodes", "fan_out_nodes", "cycles", "nodes_in_cycles",
            "communities", "cycle_metadata", "shell_data", "fan_72h",
            "velocity", "forwarding_ratios",
        }
        assert set(features.keys()) == expected

    def test_types(self, simple_graph):
        f = extract_graph_features(simple_graph)
        assert isinstance(f["pagerank"], dict)
        assert isinstance(f["cycles"], list)
        assert isinstance(f["shell_data"], dict)
        assert isinstance(f["fan_72h"], dict)
        assert isinstance(f["velocity"], dict)
        assert isinstance(f["forwarding_ratios"], dict)
        assert isinstance(f["cycle_metadata"], dict)

    def test_empty_graph(self, empty_graph):
        f = extract_graph_features(empty_graph)
        assert f["pagerank"] == {}
        assert f["cycles"] == []
        assert f["communities"] == {}
