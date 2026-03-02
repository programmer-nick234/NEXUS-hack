"""
Gesture Analysis – Pointer Gesture Classification
===================================================
Accepts pointer/touch movement data and returns classified
gesture type with emotional context mappings.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from app.services.gesture_engine import gesture_engine

router = APIRouter(prefix="/gestures", tags=["Gesture Recognition"])


class PointData(BaseModel):
    x: float
    y: float
    t: float = Field(..., description="Timestamp in ms")


class PointerGesturePayload(BaseModel):
    points: list[PointData]
    durationMs: float = Field(..., description="Total gesture duration in ms")


class PointerGestureResponse(BaseModel):
    gesture: str
    confidence: float
    direction: Optional[str] = None
    speed: float = 0.0
    acceleration: float = 0.0
    curvature: float = 0.0
    angularVelocity: float = 0.0


@router.post("/classify-pointer", response_model=PointerGestureResponse)
async def classify_pointer_gesture(payload: PointerGesturePayload):
    """Classify pointer/touch gestures from raw point data."""
    points = [{"x": p.x, "y": p.y, "t": p.t} for p in payload.points]
    result = gesture_engine.classify_pointer_gesture(points, payload.durationMs)
    return PointerGestureResponse(**result)
