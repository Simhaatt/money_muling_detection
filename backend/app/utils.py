"""
utils.py — Shared Helper Utilities
=====================================
Common functions used across the backend:

  • CSV validation and parsing
  • File I/O helpers (save / load uploads)
  • Logging configuration
  • Constants and configuration values
"""

import os
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
ALLOWED_EXTENSIONS = {".csv"}
MAX_FILE_SIZE_MB = 50

# Ensure the uploads directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)


def validate_csv(filename: str) -> bool:
    """Check that the uploaded file has an allowed extension."""
    # TODO: Add deeper validation (column checks, encoding, etc.)
    _, ext = os.path.splitext(filename)
    return ext.lower() in ALLOWED_EXTENSIONS


def parse_csv(filepath: str) -> pd.DataFrame:
    """
    Read a CSV file and return a cleaned DataFrame.

    Expected columns: sender, receiver, amount, timestamp (optional)
    """
    # TODO: Implement robust CSV parsing with error handling
    df = pd.read_csv(filepath)
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
