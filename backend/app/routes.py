"""
routes.py — FastAPI Route Definitions
========================================
Exposes the following API endpoints:

  POST /api/upload        – Upload a CSV transaction file
  GET  /api/results       – Retrieve latest detection results
  GET  /api/graph         – Get serialised graph data for visualisation
  GET  /api/risk-scores   – Get risk scores for all accounts
  GET  /api/summary       – Get high-level detection summary statistics
"""

from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Accept a CSV file of transactions, persist it in uploads/,
    and trigger the detection pipeline.
    """
    # TODO: Validate file type, save to uploads/, parse, run pipeline
    return {"message": "File uploaded successfully", "filename": file.filename}


@router.get("/results")
async def get_results():
    """Return the full detection results from the most recent analysis."""
    # TODO: Return cached / stored pipeline results
    return {"results": None}


@router.get("/graph")
async def get_graph():
    """Return graph data (nodes + edges) for frontend visualisation."""
    # TODO: Return serialised graph JSON
    return {"nodes": [], "edges": []}


@router.get("/risk-scores")
async def get_risk_scores():
    """Return per-account risk scores and tiers."""
    # TODO: Return scored account list
    return {"scores": []}


@router.get("/summary")
async def get_summary():
    """Return high-level summary statistics of the latest detection run."""
    # TODO: Return summary dict
    return {
        "total_accounts": 0,
        "total_transactions": 0,
        "flagged_accounts": 0,
        "critical_accounts": 0,
    }
