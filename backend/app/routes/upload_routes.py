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

from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(tags=["Upload"])


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Accept a CSV file of transactions, persist it in uploads/,
    and trigger the detection pipeline.

    Expected CSV columns: sender_id, receiver_id, amount, timestamp
    """
    # TODO: Validate file extension & size via helpers.validate_csv()
    # TODO: Save file to uploads/ via helpers.save_upload()
    # TODO: Parse CSV into DataFrame via helpers.parse_csv()
    # TODO: Run fraud_detection.run_detection_pipeline(df)
    # TODO: Cache results for retrieval by other endpoints
    return {"message": "File uploaded successfully", "filename": file.filename}
