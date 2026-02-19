"""Pytest configuration for project-level tests."""

from pathlib import Path
import sys


# Ensure `app` package is importable (backend/app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_PATH = PROJECT_ROOT / "backend"

if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))
