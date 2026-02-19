"""
Tests for POST /api/upload endpoint.
Covers: valid upload, invalid extension, empty file, missing columns,
        bad CSV content, and pipeline execution.
"""

import io
import pytest
from fastapi.testclient import TestClient

from app.routes.upload_routes import latest_result as _  # ensure importable


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def client():
    """TestClient backed by the real FastAPI app."""
    from main import app  # noqa: WPS433 — local import for test isolation
    return TestClient(app)


VALID_CSV = (
    "transaction_id,sender_id,receiver_id,amount,timestamp\n"
    "T1,A,B,100,2024-01-01 10:00:00\n"
    "T2,B,C,200,2024-01-01 11:00:00\n"
    "T3,C,A,150,2024-01-01 12:00:00\n"
)


def _upload(client, content: str | bytes, filename: str = "txns.csv"):
    """Helper to POST a file to /api/upload."""
    if isinstance(content, str):
        content = content.encode()
    return client.post(
        "/api/upload",
        files={"file": (filename, io.BytesIO(content), "text/csv")},
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------
class TestUploadSuccess:
    def test_valid_csv_returns_200(self, client):
        resp = _upload(client, VALID_CSV)
        assert resp.status_code == 200

    def test_response_has_required_keys(self, client):
        resp = _upload(client, VALID_CSV)
        body = resp.json()
        assert "suspicious_accounts" in body
        assert "fraud_rings" in body
        assert "summary" in body

    def test_suspicious_accounts_is_list(self, client):
        body = _upload(client, VALID_CSV).json()
        assert isinstance(body["suspicious_accounts"], list)

    def test_fraud_rings_is_list(self, client):
        body = _upload(client, VALID_CSV).json()
        assert isinstance(body["fraud_rings"], list)

    def test_summary_is_dict(self, client):
        body = _upload(client, VALID_CSV).json()
        assert isinstance(body["summary"], dict)

    def test_summary_contains_expected_fields(self, client):
        summary = _upload(client, VALID_CSV).json()["summary"]
        for key in (
            "total_accounts_analyzed",
            "suspicious_accounts_flagged",
            "fraud_rings_detected",
            "processing_time_seconds",
        ):
            assert key in summary, f"Missing summary key: {key}"


# ---------------------------------------------------------------------------
# Invalid extension
# ---------------------------------------------------------------------------
class TestInvalidExtension:
    def test_txt_extension_rejected(self, client):
        resp = _upload(client, VALID_CSV, filename="data.txt")
        assert resp.status_code == 400
        assert "csv" in resp.json()["detail"].lower()

    def test_xlsx_extension_rejected(self, client):
        resp = _upload(client, VALID_CSV, filename="data.xlsx")
        assert resp.status_code == 400

    def test_no_extension_rejected(self, client):
        resp = _upload(client, VALID_CSV, filename="data")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Empty file
# ---------------------------------------------------------------------------
class TestEmptyFile:
    def test_zero_bytes_rejected(self, client):
        resp = _upload(client, b"")
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"].lower()

    def test_whitespace_only_rejected(self, client):
        resp = _upload(client, "   \n  \n  ")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Missing / bad columns
# ---------------------------------------------------------------------------
class TestMissingColumns:
    def test_missing_required_column(self, client):
        bad_csv = "sender_id,receiver_id,amount\nA,B,100\n"
        resp = _upload(client, bad_csv)
        assert resp.status_code == 400
        assert "column" in resp.json()["detail"].lower()

    def test_completely_wrong_headers(self, client):
        bad_csv = "foo,bar,baz\n1,2,3\n"
        resp = _upload(client, bad_csv)
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Bad CSV content
# ---------------------------------------------------------------------------
class TestBadContent:
    def test_non_csv_binary(self, client):
        resp = _upload(client, b"\x00\x01\x02\x03\xff\xfe")
        assert resp.status_code == 400

    def test_header_only_no_rows(self, client):
        header_only = "transaction_id,sender_id,receiver_id,amount,timestamp\n"
        resp = _upload(client, header_only)
        # After cleaning, df is empty → 400
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Result caching
# ---------------------------------------------------------------------------
class TestResultCaching:
    def test_latest_result_populated(self, client):
        import app.routes.upload_routes as mod
        mod.latest_result = None
        _upload(client, VALID_CSV)
        assert mod.latest_result is not None
        assert "suspicious_accounts" in mod.latest_result
