"""
graph_routes.py — Transaction Graph Endpoints
================================================
Handles:
    GET /api/graph  — Return serialised graph data (nodes + links)
                      for frontend force-directed visualisation.

Data is produced by:
    • app.services.graph_builder.graph_to_json()
"""

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Graph"])


@router.get("/graph")
async def get_graph():
    """
    Return the transaction graph as JSON for frontend visualisation.

    Response format:
        {
            "nodes": [{"id": "ACC_1", "degree": 5, ...}],
            "links": [{"source": "ACC_1", "target": "ACC_2", "amount": 500.0}]
        }
    """
    # TODO: Return cached graph_json from the latest detection run
    return {"nodes": [], "links": []}
