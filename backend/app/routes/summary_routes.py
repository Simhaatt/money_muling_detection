"""
summary_routes.py — Summary Statistics Endpoints
===================================================
Handles:
    GET /api/summary  — High-level detection summary statistics

Designed for the Dashboard summary cards in the frontend.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Summary"])


@router.get("/summary")
async def get_summary():
    """
    Return high-level summary statistics from the latest detection run.
    """
    from app.routes.upload_routes import latest_result

    if latest_result is None:
        raise HTTPException(status_code=404, detail="No analysis available. Upload a CSV first.")

    return latest_result.get("summary", {})
