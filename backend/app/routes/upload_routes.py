"""
upload_routes.py — CSV File Upload Endpoints
===============================================
Handles:
    POST /api/upload  — Accept a CSV transaction file, validate it,
                        persist to uploads/, and trigger the detection pipeline.

The heavy lifting is delegated to:
    • app.utils.helpers   — file validation & saving
    • app.services.fraud_detection — full pipeline orchestration
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from app.utils.helpers import validate_csv, save_upload, parse_csv
from app.services.fraud_detection import run_detection_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Upload"])

# Module-level cache so other routes can retrieve the latest results
latest_result: dict[str, Any] | None = None


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Accept a CSV file of transactions, persist it in uploads/,
    and trigger the full money-muling detection pipeline.

    Expected CSV columns: sender_id, receiver_id, amount, timestamp

    Returns the pipeline result exactly as produced by
    ``run_detection_pipeline()``::

        {
            "suspicious_accounts": [...],
            "fraud_rings": [...],
            "summary": {...}
        }

    Raises:
        HTTPException 400 — invalid extension, empty file, bad CSV,
                            or missing required columns.
    """
    global latest_result

    # ── 1. Validate file extension ----------------------------------------
    if not file.filename or not validate_csv(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .csv files are accepted.",
        )

    # ── 2. Read file bytes & reject empty uploads -------------------------
    contents = await file.read()
    if not contents or len(contents.strip()) == 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    # ── 3. Persist to uploads/ --------------------------------------------
    try:
        filepath = save_upload(contents, file.filename)
    except OSError as exc:
        logger.exception("Failed to save uploaded file")
        raise HTTPException(
            status_code=500,
            detail=f"Could not save file: {exc}",
        )

    # ── 4. Parse CSV into DataFrame ---------------------------------------
    try:
        df = parse_csv(filepath)
    except ValueError as exc:
        # Missing required columns or unparseable data
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("CSV parsing failed")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="CSV file contains no valid transaction rows after cleaning.",
        )

    # ── 5. Run detection pipeline -----------------------------------------
    try:
        result = run_detection_pipeline(df)
    except Exception as exc:
        logger.exception("Detection pipeline failed")
        raise HTTPException(
            status_code=500,
            detail=f"Detection pipeline error: {exc}",
        )

    # ── 6. Cache & return -------------------------------------------------
    latest_result = result
    return JSONResponse(content=result)
