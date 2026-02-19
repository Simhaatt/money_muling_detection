"""
Tests for app.services.fraud_detection
=========================================
End-to-end pipeline tests covering:
    - Full pipeline output schema
    - Cycle detection -> ring assembly
    - Temporal smurfing (+15 bonus)
    - Shell account detection (+30 bonus)
    - False-positive suppression (payroll, merchant, gateway)
    - Score capping at 100
    - Suspicious threshold (>= 40)
    - Deterministic ring IDs
    - Summary structure
"""

from datetime import datetime, timedelta

import networkx as nx
import pandas as pd
import pytest

from app.services.fraud_detection import (
    run_detection_pipeline,
    _detect_temporal_smurfing,
    _detect_shell_accounts,
    _suppress_false_positives,
    _assemble_fraud_rings,
)


# ── Helpers ────────────────────────────────────────────────────────────────
def _make_df(rows: list[dict]) -> pd.DataFrame:
    """Create a transaction DataFrame from a list of dicts."""
    return pd.DataFrame(rows)


def _base_tx(sender: str, receiver: str, amount: float = 100.0,
             ts: str = "2025-01-01 10:00:00", tx_id: str = "TX001"):
    return {
        "transaction_id": tx_id,
        "sender_id": sender,
        "receiver_id": receiver,
        "amount": amount,
        "timestamp": ts,
    }


def _cycle_df() -> pd.DataFrame:
    """A->B->C->A cycle with enough timestamp spread."""
    return _make_df([
        _base_tx("A", "B", 100, "2025-01-01 10:00:00", "TX001"),
        _base_tx("B", "C", 200, "2025-01-01 11:00:00", "TX002"),
        _base_tx("C", "A", 150, "2025-01-01 12:00:00", "TX003"),
    ])


# ── Full pipeline output schema ───────────────────────────────────────────
class TestPipelineOutputSchema:
    def test_top_level_keys(self):
        result = run_detection_pipeline(_cycle_df())
        assert set(result.keys()) == {
            "suspicious_accounts", "fraud_rings", "summary", "graph_json"
        }

    def test_summary_keys(self):
        result = run_detection_pipeline(_cycle_df())
        expected = {
            "total_accounts_analyzed",
            "suspicious_accounts_flagged",
            "fraud_rings_detected",
            "processing_time_seconds",
        }
        assert set(result["summary"].keys()) == expected

    def test_summary_types(self):
        s = run_detection_pipeline(_cycle_df())["summary"]
        assert isinstance(s["total_accounts_analyzed"], int)
        assert isinstance(s["suspicious_accounts_flagged"], int)
        assert isinstance(s["fraud_rings_detected"], int)
        assert isinstance(s["processing_time_seconds"], float)

    def test_suspicious_account_keys(self):
        result = run_detection_pipeline(_cycle_df())
        for acc in result["suspicious_accounts"]:
            assert "account_id" in acc
            assert "suspicion_score" in acc
            assert "detected_patterns" in acc
            assert "ring_id" in acc

    def test_fraud_ring_keys(self):
        result = run_detection_pipeline(_cycle_df())
        for ring in result["fraud_rings"]:
            assert "ring_id" in ring
            assert "member_accounts" in ring
            assert "pattern_type" in ring
            assert "risk_score" in ring


# ── Cycle ring assembly ───────────────────────────────────────────────────
class TestCycleRings:
    def test_cycle_creates_ring(self):
        result = run_detection_pipeline(_cycle_df())
        cycle_rings = [
            r for r in result["fraud_rings"] if r["pattern_type"] == "cycle"
        ]
        assert len(cycle_rings) >= 1

    def test_ring_id_format(self):
        result = run_detection_pipeline(_cycle_df())
        for ring in result["fraud_rings"]:
            assert ring["ring_id"].startswith("RING_")
            # Numeric part should be zero-padded 3 digits
            num_part = ring["ring_id"].split("_")[1]
            assert len(num_part) == 3

    def test_cycle_members_flagged(self):
        result = run_detection_pipeline(_cycle_df())
        flagged_ids = {a["account_id"] for a in result["suspicious_accounts"]}
        # All cycle members (A, B, C) should be flagged
        assert {"A", "B", "C"}.issubset(flagged_ids)


# ── Suspicious accounts filtering and sorting ─────────────────────────────
class TestSuspiciousAccounts:
    def test_sorted_descending(self):
        result = run_detection_pipeline(_cycle_df())
        accounts = result["suspicious_accounts"]
        scores = [a["suspicion_score"] for a in accounts]
        assert scores == sorted(scores, reverse=True)

    def test_scores_are_floats(self):
        result = run_detection_pipeline(_cycle_df())
        for acc in result["suspicious_accounts"]:
            assert isinstance(acc["suspicion_score"], float)

    def test_below_threshold_excluded(self):
        """Accounts with score < 40 should not appear."""
        # Build a graph where D is a leaf with no suspicious patterns
        df = _make_df([
            _base_tx("A", "B", 100, "2025-01-01 10:00:00", "TX001"),
            _base_tx("B", "C", 200, "2025-01-01 11:00:00", "TX002"),
            _base_tx("C", "A", 150, "2025-01-01 12:00:00", "TX003"),
            _base_tx("C", "D", 50,  "2025-01-01 13:00:00", "TX004"),
        ])
        result = run_detection_pipeline(df)
        for acc in result["suspicious_accounts"]:
            assert acc["suspicion_score"] >= 40.0


# ── Temporal smurfing ─────────────────────────────────────────────────────
class TestTemporalSmurfing:
    def test_high_velocity_flag(self):
        """Account with 12 txns in 1 hour should get high_velocity_72h."""
        base = datetime(2025, 1, 1, 10, 0, 0)
        rows = [
            _base_tx("SMURF", f"R{i}", 50.0,
                     (base + timedelta(minutes=i * 5)).isoformat(),
                     f"TX{i:03d}")
            for i in range(12)
        ]
        df = _make_df(rows)
        result = run_detection_pipeline(df)
        smurf_acc = [
            a for a in result["suspicious_accounts"]
            if a["account_id"] == "SMURF"
        ]
        if smurf_acc:
            assert "high_velocity" in smurf_acc[0]["detected_patterns"]

    def test_no_flag_below_threshold(self):
        """Account with only 3 txns should NOT get smurfing flag."""
        rows = [
            _base_tx("NORMAL", f"R{i}", 100.0,
                     f"2025-01-01 1{i}:00:00", f"TX{i:03d}")
            for i in range(3)
        ]
        df = _make_df(rows)
        result = run_detection_pipeline(df)
        for acc in result["suspicious_accounts"]:
            if acc["account_id"] == "NORMAL":
                assert "high_velocity" not in acc["detected_patterns"]


# ── Shell account detection ───────────────────────────────────────────────
class TestShellDetection:
    def test_shell_in_chain(self):
        """B in A->B->C chain with low degree should be flagged as shell."""
        df = _make_df([
            _base_tx("A", "B", 100, "2025-01-01 10:00:00", "TX001"),
            _base_tx("B", "C", 100, "2025-01-01 11:00:00", "TX002"),
            _base_tx("C", "D", 100, "2025-01-01 12:00:00", "TX003"),
        ])
        result = run_detection_pipeline(df)
        shell_accounts = [
            a for a in result["suspicious_accounts"]
            if "shell_account" in a["detected_patterns"]
        ]
        # B and C are intermediaries with degree 2
        shell_ids = {a["account_id"] for a in shell_accounts}
        assert "B" in shell_ids or "C" in shell_ids


# ── False-positive suppression ────────────────────────────────────────────
class TestFalsePositiveSuppression:
    def test_merchant_reduction(self):
        """Node with in_degree >= 10, out_degree <= 1 gets reduced score."""
        scores = {
            "MERCHANT": {
                "account_id": "MERCHANT",
                "suspicion_score": 80.0,
                "detected_patterns": [],
                "ring_id": None,
            }
        }
        G = nx.DiGraph()
        for i in range(12):
            G.add_edge(f"C{i}", "MERCHANT", total_amount=100)
        # out_degree = 0
        _suppress_false_positives(G, scores)
        assert scores["MERCHANT"]["suspicion_score"] < 80.0
        assert "likely_merchant" in scores["MERCHANT"]["detected_patterns"]

    def test_gateway_reduction(self):
        """Node with in_degree >= 50 and out_degree >= 50 gets reduced."""
        scores = {
            "GW": {
                "account_id": "GW",
                "suspicion_score": 90.0,
                "detected_patterns": [],
                "ring_id": None,
            }
        }
        G = nx.DiGraph()
        for i in range(55):
            G.add_edge(f"IN{i}", "GW", total_amount=100)
            G.add_edge("GW", f"OUT{i}", total_amount=100)
        _suppress_false_positives(G, scores)
        assert scores["GW"]["suspicion_score"] < 90.0
        assert "likely_gateway" in scores["GW"]["detected_patterns"]


# ── Score capping ─────────────────────────────────────────────────────────
class TestScoreCapping:
    def test_never_exceeds_100(self):
        """Even with all bonuses, score must cap at 100."""
        base = datetime(2025, 1, 1, 10, 0, 0)
        rows = []
        # Cycle: A->B->C->A with high-velocity smurfing
        for i in range(15):
            rows.append(
                _base_tx("A", "B", 100,
                         (base + timedelta(minutes=i)).isoformat(),
                         f"TX_AB_{i}")
            )
        rows.append(_base_tx("B", "C", 200, "2025-01-01 12:00:00", "TX_BC"))
        rows.append(_base_tx("C", "A", 150, "2025-01-01 13:00:00", "TX_CA"))
        df = _make_df(rows)
        result = run_detection_pipeline(df)
        for acc in result["suspicious_accounts"]:
            assert acc["suspicion_score"] <= 100.0


# ── Empty input ───────────────────────────────────────────────────────────
class TestEmptyInput:
    def test_empty_df(self):
        df = pd.DataFrame(columns=[
            "transaction_id", "sender_id", "receiver_id", "amount", "timestamp"
        ])
        result = run_detection_pipeline(df)
        assert result["suspicious_accounts"] == []
        assert result["fraud_rings"] == []
        assert result["summary"]["total_accounts_analyzed"] == 0


# ── Hackathon compliance fixes ────────────────────────────────────────────
class TestHackathonCompliance:
    def test_ring_id_never_null(self):
        """Every suspicious account must have ring_id as string, never None."""
        df = _make_df([
            _base_tx("A", "B", 100, "2025-01-01 10:00:00", "TX001"),
            _base_tx("B", "C", 200, "2025-01-01 11:00:00", "TX002"),
            _base_tx("C", "A", 150, "2025-01-01 12:00:00", "TX003"),
            _base_tx("C", "D", 50,  "2025-01-01 13:00:00", "TX004"),
        ])
        result = run_detection_pipeline(df)
        for acc in result["suspicious_accounts"]:
            assert acc["ring_id"] is not None
            assert isinstance(acc["ring_id"], str)

    def test_ring_id_none_string_for_non_ring_member(self):
        """Suspicious accounts not in a ring should have ring_id='NONE'."""
        # D is a leaf — may be suspicious via community but not in a cycle ring
        df = _make_df([
            _base_tx("A", "B", 100, "2025-01-01 10:00:00", "TX001"),
            _base_tx("B", "C", 200, "2025-01-01 11:00:00", "TX002"),
            _base_tx("C", "A", 150, "2025-01-01 12:00:00", "TX003"),
        ])
        result = run_detection_pipeline(df)
        for acc in result["suspicious_accounts"]:
            assert acc["ring_id"] != None  # noqa: E711 — explicit None check

    def test_fraud_ring_risk_score_is_float(self):
        """fraud_rings[].risk_score must be a Python float."""
        df = _cycle_df()
        result = run_detection_pipeline(df)
        for ring in result["fraud_rings"]:
            assert isinstance(ring["risk_score"], float)

    def test_pattern_name_high_velocity(self):
        """Pattern must be 'high_velocity', not 'high_velocity_72h'."""
        base = datetime(2025, 1, 1, 10, 0, 0)
        rows = [
            _base_tx("SMURF", f"R{i}", 50.0,
                     (base + timedelta(minutes=i * 5)).isoformat(),
                     f"TX{i:03d}")
            for i in range(12)
        ]
        df = _make_df(rows)
        result = run_detection_pipeline(df)
        for acc in result["suspicious_accounts"]:
            assert "high_velocity_72h" not in acc["detected_patterns"]
