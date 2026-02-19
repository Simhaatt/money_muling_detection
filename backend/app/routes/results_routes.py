"""
results_routes.py — Detection Results Endpoints
==================================================
Handles:
    GET /api/results      — Full detection results (scores, rings, graph)
    GET /api/risk-scores  — Per-account risk scores and tiers
    GET /api/download     — Download results as JSON file

Data is produced by:
    • app.services.fraud_detection.run_detection_pipeline()
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Results"])


@router.get("/results")
async def get_results():
    """
    Return the complete detection results from the most recent analysis.

    Response includes:  suspicious_accounts, fraud_rings, graph_json, summary
    """
    # TODO: Return cached pipeline results
    return {"results": None}


@router.get("/risk-scores")
async def get_risk_scores():
    """
    Return per-account risk scores and tiers.

    Response format:
        {"scores": [{"account_id": "A", "risk_score": 85, "risk_tier": "CRITICAL"}]}
    """
    # TODO: Return scored account list from cached results
    return {"scores": []}


@router.get("/download")
async def download_results():
    """
    Download the latest detection results as a JSON file.

    Allows judges / analysts to save the output locally.
    """
    # TODO: Return cached results as downloadable JSON attachment
    return JSONResponse(
        content={"message": "No results available yet"},
        headers={"Content-Disposition": "attachment; filename=results.json"},
    )
