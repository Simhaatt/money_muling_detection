"""
summary_routes.py — Summary Statistics Endpoints
===================================================
Handles:
    GET /api/summary  — High-level detection summary statistics
                        (total accounts, transactions, flagged, critical, etc.)

Designed for the Dashboard summary cards in the frontend.
"""

from fastapi import APIRouter

router = APIRouter(tags=["Summary"])


@router.get("/summary")
async def get_summary():
    """
    Return high-level summary statistics from the latest detection run.

    Response format:
        {
            "total_accounts": 150,
            "total_transactions": 420,
            "flagged_accounts": 12,
            "critical_accounts": 3,
            "fraud_rings_detected": 2,
            "total_volume": 1250000.00
        }
    """
    # TODO: Return summary dict from cached pipeline results
    return {
        "total_accounts": 0,
        "total_transactions": 0,
        "flagged_accounts": 0,
        "critical_accounts": 0,
        "fraud_rings_detected": 0,
        "total_volume": 0.0,
    }
