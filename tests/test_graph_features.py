"""
Tests for app.services.graph_features
======================================
Covers centrality, degree, fan-in/out, cycle detection,
community detection, and the unified extract_graph_features() entry-point.
"""

import networkx as nx
import pytest

from app.services.graph_features import (
    compute_betweenness,
    compute_degree_features,
    compute_pagerank,
    detect_communities,
    detect_cycles,
    detect_fan_in,
    detect_fan_out,
    extract_graph_features,
)


# ── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture
def empty_graph() -> nx.DiGraph:
    """An empty directed graph (0 nodes, 0 edges)."""
    return nx.DiGraph()


@pytest.fixture
def simple_graph() -> nx.DiGraph:
    """A small graph with a cycle A→B→C→A and a spur C→D."""
    G = nx.DiGraph()
    G.add_edge("A", "B", total_amount=100, transaction_count=1)
    G.add_edge("B", "C", total_amount=200, transaction_count=2)
    G.add_edge("C", "A", total_amount=150, transaction_count=1)
    G.add_edge("C", "D", total_amount=50, transaction_count=1)
    return G


@pytest.fixture
def fan_in_graph() -> nx.DiGraph:
    """A graph where node 'hub' receives from 11 senders and sends to 1."""
    G = nx.DiGraph()
    for i in range(11):
        G.add_edge(f"sender_{i}", "hub", total_amount=100, transaction_count=1)
    G.add_edge("hub", "exit", total_amount=500, transaction_count=1)
    return G


@pytest.fixture
def fan_out_graph() -> nx.DiGraph:
    """A graph where node 'source' sends to 11 receivers from 1 sender."""
    G = nx.DiGraph()
    G.add_edge("origin", "source", total_amount=1000, transaction_count=1)
    for i in range(11):
        G.add_edge("source", f"receiver_{i}", total_amount=100, transaction_count=1)
    return G


# ── Centrality tests ──────────────────────────────────────────────────────
class TestPageRank:
    def test_returns_all_nodes(self, simple_graph: nx.DiGraph):
        pr = compute_pagerank(simple_graph)
        assert set(pr.keys()) == set(simple_graph.nodes())

    def test_values_sum_to_one(self, simple_graph: nx.DiGraph):
        pr = compute_pagerank(simple_graph)
        assert pytest.approx(sum(pr.values()), abs=1e-6) == 1.0

    def test_empty_graph(self, empty_graph: nx.DiGraph):
        assert compute_pagerank(empty_graph) == {}


class TestBetweenness:
    def test_returns_all_nodes(self, simple_graph: nx.DiGraph):
        bc = compute_betweenness(simple_graph)
        assert set(bc.keys()) == set(simple_graph.nodes())

    def test_values_in_range(self, simple_graph: nx.DiGraph):
        bc = compute_betweenness(simple_graph)
        for v in bc.values():
            assert 0.0 <= v <= 1.0

    def test_empty_graph(self, empty_graph: nx.DiGraph):
        assert compute_betweenness(empty_graph) == {}


# ── Degree tests ──────────────────────────────────────────────────────────
class TestDegreeFeatures:
    def test_degree_correctness(self, simple_graph: nx.DiGraph):
        in_deg, out_deg = compute_degree_features(simple_graph)
        # C has edges from B and sends to A, D → in=1, out=2
        assert in_deg["C"] == 1
        assert out_deg["C"] == 2
        # D is a leaf → in=1, out=0
        assert in_deg["D"] == 1
        assert out_deg["D"] == 0


# ── Fan-in / Fan-out tests ────────────────────────────────────────────────
class TestFanIn:
    def test_detects_hub(self, fan_in_graph: nx.DiGraph):
        nodes = detect_fan_in(fan_in_graph)
        assert "hub" in nodes

    def test_senders_not_flagged(self, fan_in_graph: nx.DiGraph):
        nodes = detect_fan_in(fan_in_graph)
        for i in range(11):
            assert f"sender_{i}" not in nodes

    def test_empty_graph(self, empty_graph: nx.DiGraph):
        assert detect_fan_in(empty_graph) == []


class TestFanOut:
    def test_detects_source(self, fan_out_graph: nx.DiGraph):
        nodes = detect_fan_out(fan_out_graph)
        assert "source" in nodes

    def test_receivers_not_flagged(self, fan_out_graph: nx.DiGraph):
        nodes = detect_fan_out(fan_out_graph)
        for i in range(11):
            assert f"receiver_{i}" not in nodes

    def test_empty_graph(self, empty_graph: nx.DiGraph):
        assert detect_fan_out(empty_graph) == []


# ── Cycle detection tests ─────────────────────────────────────────────────
class TestCycles:
    def test_finds_triangle(self, simple_graph: nx.DiGraph):
        cycles, nodes = detect_cycles(simple_graph)
        assert len(cycles) >= 1
        # Verify the A-B-C cycle is present (order may vary)
        cycle_sets = [set(c) for c in cycles]
        assert {"A", "B", "C"} in cycle_sets

    def test_nodes_in_cycles(self, simple_graph: nx.DiGraph):
        _, nodes = detect_cycles(simple_graph)
        assert set(nodes) == {"A", "B", "C"}

    def test_no_cycles(self, fan_in_graph: nx.DiGraph):
        cycles, nodes = detect_cycles(fan_in_graph)
        assert cycles == []
        assert nodes == []


# ── Community detection tests ──────────────────────────────────────────────
class TestCommunities:
    def test_all_nodes_assigned(self, simple_graph: nx.DiGraph):
        comms = detect_communities(simple_graph)
        assert set(comms.keys()) == set(simple_graph.nodes())

    def test_community_ids_are_ints(self, simple_graph: nx.DiGraph):
        comms = detect_communities(simple_graph)
        for v in comms.values():
            assert isinstance(v, int)

    def test_empty_graph(self, empty_graph: nx.DiGraph):
        assert detect_communities(empty_graph) == {}


# ── Unified extractor tests ───────────────────────────────────────────────
class TestExtractGraphFeatures:
    def test_returns_all_keys(self, simple_graph: nx.DiGraph):
        features = extract_graph_features(simple_graph)
        expected_keys = {
            "pagerank", "betweenness",
            "in_degree", "out_degree",
            "fan_in_nodes", "fan_out_nodes",
            "cycles", "nodes_in_cycles",
            "communities",
        }
        assert set(features.keys()) == expected_keys

    def test_types(self, simple_graph: nx.DiGraph):
        f = extract_graph_features(simple_graph)
        assert isinstance(f["pagerank"], dict)
        assert isinstance(f["betweenness"], dict)
        assert isinstance(f["in_degree"], dict)
        assert isinstance(f["out_degree"], dict)
        assert isinstance(f["fan_in_nodes"], list)
        assert isinstance(f["fan_out_nodes"], list)
        assert isinstance(f["cycles"], list)
        assert isinstance(f["nodes_in_cycles"], list)
        assert isinstance(f["communities"], dict)

    def test_empty_graph(self, empty_graph: nx.DiGraph):
        f = extract_graph_features(empty_graph)
        assert f["pagerank"] == {}
        assert f["cycles"] == []
        assert f["communities"] == {}
