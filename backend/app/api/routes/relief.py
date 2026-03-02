"""
Relief Activities – API Routes
================================
POST /relief/plan          — get 3-activity relief plan
POST /relief/complete      — record a completed activity
POST /relief/journey-done  — record full journey completion
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from app.services.relief_service import relief_service
from app.api.deps import OptionalUser

router = APIRouter(prefix="/relief", tags=["Relief Activities"])


class PlanRequest(BaseModel):
    dominantEmotion: str = "neutral"
    anxietyScore: float = 0.0
    stability: float = 0.5


class MoodSnapshot(BaseModel):
    emotion: str = "neutral"
    confidence: float = 0.5
    moodScore: float = 50.0
    anxietyScore: float = 0.0


class CompleteRequest(BaseModel):
    activityId: str
    beforeMood: Optional[MoodSnapshot] = None
    afterMood: Optional[MoodSnapshot] = None
    extra: Optional[dict] = None


@router.post("/plan")
async def get_relief_plan(payload: PlanRequest):
    """Get a personalized 3-activity relief plan based on session data."""
    plan = await relief_service.get_plan(
        dominant_emotion=payload.dominantEmotion,
        anxiety_score=payload.anxietyScore,
        stability=payload.stability,
    )
    return plan


@router.post("/complete")
async def complete_activity(
    payload: CompleteRequest,
    user: OptionalUser = None,
):
    """Record a completed relief activity."""
    user_id = str(user.id) if user else None
    result = await relief_service.complete_activity(
        user_id=user_id,
        activity_id=payload.activityId,
        before_mood=payload.beforeMood.model_dump() if payload.beforeMood else None,
        after_mood=payload.afterMood.model_dump() if payload.afterMood else None,
        extra=payload.extra,
    )
    return result


@router.post("/journey-done")
async def journey_done(user: OptionalUser = None):
    """Record completion of the full 3-activity relief journey."""
    user_id = str(user.id) if user else None
    result = await relief_service.complete_journey(user_id)
    return result
