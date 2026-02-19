"""
helpers.py — Shared Helper Functions
=======================================
Common utilities used across the backend:

    • CSV file validation (extension, size, columns)
    • File I/O (save uploads, read CSVs)
    • Constants (paths, thresholds, limits)

Located in: app/utils/helpers.py
Used by:    app/routes/upload_routes.py, app/services/*
"""

import os
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
ALLOWED_EXTENSIONS = {".csv"}
MAX_FILE_SIZE_MB = 50
REQUIRED_CSV_COLUMNS = {"sender_id", "receiver_id", "amount", "timestamp"}

# Ensure the uploads directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def validate_csv(filename: str) -> bool:
    """
    Check that the uploaded file has an allowed extension.

    Args:
        filename: Original name of the uploaded file

    Returns:
        True if extension is allowed, False otherwise
    """
    _, ext = os.path.splitext(filename)
    return ext.lower() in ALLOWED_EXTENSIONS


def validate_csv_columns(df: pd.DataFrame) -> list[str]:
    """
    Verify that the DataFrame contains all required columns.

    Returns:
        List of missing column names (empty if all present)
    """
    return list(REQUIRED_CSV_COLUMNS - set(df.columns))


def parse_csv(filepath: str) -> pd.DataFrame:
    """
    Read a CSV file and return a cleaned DataFrame.

    Expected columns: sender_id, receiver_id, amount, timestamp

    Raises:
        FileNotFoundError: If the file doesn't exist
        ValueError: If required columns are missing
    """
    df = pd.read_csv(filepath)

    missing = validate_csv_columns(df)
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    # Basic cleaning
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df.dropna(subset=["sender_id", "receiver_id", "amount"], inplace=True)

    return df


def save_upload(file_bytes: bytes, filename: str) -> str:
    """
    Persist uploaded file bytes to the uploads/ directory.

    Returns:
        Full path to the saved file
    """
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return filepath
