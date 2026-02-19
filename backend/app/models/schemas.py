"""
schemas.py — Pydantic Request/Response Models
================================================
Defines typed data models for API endpoints.

These schemas ensure:
    • Automatic request validation
    • Clean Swagger/OpenAPI documentation
    • Type safety across the backend

Located in: app/models/schemas.py
Used by:    app/routes/*.py
"""

from pydantic import BaseModel
from typing import Optional


# ---------------------------------------------------------------------------
# Response: Individual Account Risk
# ---------------------------------------------------------------------------
class AccountRisk(BaseModel):
    """Risk assessment for a single account."""
    account_id: str
    risk_score: float
    risk_tier: str          # LOW | MEDIUM | HIGH | CRITICAL
    flags: list[str] = []   # e.g., ["cycle_member", "fan_out", "rapid_velocity"]


# ---------------------------------------------------------------------------
# Response: Fraud Ring
# ---------------------------------------------------------------------------
class FraudRing(BaseModel):
    """A detected fraud ring (group of suspicious accounts)."""
    ring_id: str            # e.g., "RING_001"
    members: list[str]      # List of account IDs
    ring_type: str          # "cycle" | "community" | "mixed"
    avg_risk_score: float


# ---------------------------------------------------------------------------
# Response: Detection Summary
# ---------------------------------------------------------------------------
class DetectionSummary(BaseModel):
    """High-level statistics from a detection run."""
    total_accounts: int = 0
    total_transactions: int = 0
    flagged_accounts: int = 0
    critical_accounts: int = 0
    fraud_rings_detected: int = 0
    total_volume: float = 0.0


# ---------------------------------------------------------------------------
# Response: Full Detection Output
# ---------------------------------------------------------------------------
class DetectionResult(BaseModel):
    """Complete output of the detection pipeline."""
    suspicious_accounts: list[AccountRisk] = []
    fraud_rings: list[FraudRing] = []
    graph_json: dict = {"nodes": [], "links": []}
    summary: DetectionSummary = DetectionSummary()


# ---------------------------------------------------------------------------
# Response: Upload Confirmation
# ---------------------------------------------------------------------------
class UploadResponse(BaseModel):
    """Response after successful CSV upload."""
    message: str
    filename: str
    rows_parsed: int = 0
