"""
routes — FastAPI Router Package
=================================
Each module defines an APIRouter for a specific resource domain.
All routers are aggregated and re-exported here for clean import
in main.py.

Usage in main.py:
    from app.routes import upload_router, graph_router, results_router, summary_router
"""

from app.routes.upload_routes import router as upload_router
from app.routes.graph_routes import router as graph_router
from app.routes.results_routes import router as results_router
from app.routes.summary_routes import router as summary_router

__all__ = ["upload_router", "graph_router", "results_router", "summary_router"]
