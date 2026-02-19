"""
main.py — FastAPI Entry Point
==============================
Bootstraps the FastAPI application, registers routers, and configures
CORS so the React frontend can communicate with this server.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router

app = FastAPI(
    title="Money Muling Detection API",
    description="Graph-based fraud detection engine for identifying money mule networks",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS – allow the React dev server (port 3000) to reach the API
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register API routes
# ---------------------------------------------------------------------------
app.include_router(router, prefix="/api")


@app.get("/")
async def health_check():
    """Simple health-check endpoint."""
    return {"status": "ok", "service": "money-muling-detection"}
