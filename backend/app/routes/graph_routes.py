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
            "nodes": [{"id": "ACC_1", "in_degree": 5, "out_degree": 3}],
            "links": [{"source": "ACC_1", "target": "ACC_2", "total_amount": 500.0}]
        }
    """
    from app.routes.upload_routes import latest_result

    if latest_result is None:
        raise HTTPException(status_code=404, detail="No analysis available. Upload a CSV first.")

    graph_json = latest_result.get("graph_json", {"nodes": [], "links": []})
    return graph_json
