"""
main.py — FastAPI Entry Point
==============================
Bootstraps the FastAPI application, registers modular routers, and
configures CORS & static file serving for production deployment.

Run with:
    uvicorn main:app --reload --port 8000
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routes import upload_router, graph_router, results_router, summary_router

app = FastAPI(
    title="Money Muling Detection API",
    description="Graph-based fraud detection engine for identifying money mule networks",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS – allow all origins (hackathon requirement: no auth, publicly accessible)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register modular API routers — each handles a specific resource domain
# ---------------------------------------------------------------------------
app.include_router(upload_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(results_router, prefix="/api")
app.include_router(summary_router, prefix="/api")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    """Simple health-check endpoint."""
    return {"status": "ok", "service": "money-muling-detection"}


# ---------------------------------------------------------------------------
# Serve React frontend build in production (single-deploy on Railway)
# ---------------------------------------------------------------------------
FRONTEND_BUILD = Path(__file__).parent / "static"

if FRONTEND_BUILD.exists():
    # Serve Vite build assets (assets/) and legacy CRA (static/)
    assets_dir = FRONTEND_BUILD / "assets"
    static_dir = FRONTEND_BUILD / "static"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="asset-files")
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static-files")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        """Catch-all: serve React/Vite index.html for client-side routing."""
        file_path = FRONTEND_BUILD / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_BUILD / "index.html"))
