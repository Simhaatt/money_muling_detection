"""
results_routes.py — Detection Results Endpoints
==================================================
Handles:
    GET /api/results      — Full detection results (scores, rings, summary)
    GET /api/risk-scores  — Per-account risk scores and tiers
    GET /api/download     — Download results as JSON file

Data is produced by:
    • app.services.fraud_detection.run_detection_pipeline()
"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

router = APIRouter(tags=["Results"])


def _get_cached():
    """Return cached results or raise 404."""
    from app.routes.upload_routes import latest_result
    if latest_result is None:
        raise HTTPException(status_code=404, detail="No analysis available. Upload a CSV first.")
    return latest_result


@router.get("/results")
async def get_results():
    """
    Return the complete detection results from the most recent analysis.
    """
    return _get_cached()


@router.get("/risk-scores")
async def get_risk_scores():
    """
    Return per-account risk scores and tiers.
    """
    result = _get_cached()
    return {"scores": result.get("suspicious_accounts", [])}


@router.get("/download")
async def download_results():
    """
    Download the latest detection results as a JSON file attachment.
    Allows judges / analysts to save the output locally.
    """
    result = _get_cached()
    json_bytes = json.dumps(result, indent=2, ensure_ascii=False).encode("utf-8")
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=results.json"},
    )
