"""
State Analysis – Route
=======================
POST /analyze-state
Accepts interaction metrics, classifies emotional state, returns intervention params.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

from app.schemas.state import InteractionMetrics, StateAnalysisResponse, SessionLogEntry
from app.services.state_service import classify_state
from app.db import get_db
from app.core.logging import logger

router = APIRouter(prefix="/state", tags=["State Analysis"])


@router.post("/analyze-state")
async def analyze_state(metrics: InteractionMetrics):
    """
    Core endpoint: receives interaction data from the 3D orb and returns
    an emotional state classification with intervention parameters.
    """
    # 1. Classify
    result: StateAnalysisResponse = classify_state(metrics)

    # 2. Log to MongoDB (fire-and-forget for latency)
    try:
        db = get_db()
        await db["session_logs"].insert_one({
            "metrics": metrics.model_dump(),
            "result": result.model_dump(),
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"Failed to log session: {e}")

    # 3. Return
    return {
        "success": True,
        "data": {
            "emotionalState": result.emotional_state,
            "intensity": result.intensity,
            "interventionType": result.intervention_type,
            "parameters": {
                "breathSpeed": result.parameters.breath_speed,
                "color": result.parameters.color,
                "particleSpeed": result.parameters.particle_speed,
                "cameraDistance": result.parameters.camera_distance,
                "orbScale": result.parameters.orb_scale,
                "ambientIntensity": result.parameters.ambient_intensity,
            },
        },
        "message": "State analysis complete",
    }
