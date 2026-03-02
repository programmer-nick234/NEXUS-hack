"""
Session routes — start, snapshot, end, history, detail.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.api.deps import OptionalUser
from app.services.session_service import session_service
from app.services.gamification_service import gamification_service

router = APIRouter(prefix="/sessions", tags=["Sessions"])


class StartSessionReq(BaseModel):
    pass  # user_id comes from auth


class EmotionSnapshot(BaseModel):
    emotion: str = "neutral"
    confidence: float = 0.0
    distribution: dict = {}


class GestureSnapshotReq(BaseModel):
    anxietyScore: float = 0
    emotionalState: str = "neutral"
    interventionType: str = "none"


class EndSessionResp(BaseModel):
    sessionId: str
    moodScore: float | None
    stabilityIndex: float | None
    dominantEmotion: str | None
    durationSec: float
    totalSnapshots: int
    # gamification
    xp: int | None = None
    level: int | None = None
    sessionXp: int | None = None
    newBadges: list = []


@router.post("/start")
async def start_session(user: OptionalUser):
    user_id = str(user["_id"]) if user else None
    sid = await session_service.start_session(user_id=user_id)
    return {"sessionId": sid}


@router.post("/{session_id}/emotion")
async def add_emotion(session_id: str, snap: EmotionSnapshot):
    await session_service.add_emotion_snapshot(session_id, snap.model_dump())
    return {"ok": True}


@router.post("/{session_id}/gesture")
async def add_gesture(session_id: str, snap: GestureSnapshotReq):
    await session_service.add_gesture_snapshot(session_id, snap.model_dump())
    return {"ok": True}


@router.post("/{session_id}/end")
async def end_session(session_id: str, user: OptionalUser):
    result = await session_service.end_session(session_id)
    if "error" in result:
        return result

    # Trigger gamification only for authenticated users
    if user:
        gam = await gamification_service.record_session(
            user_id=str(user["_id"]),
            mood_score=result.get("moodScore", 60),
            stability=result.get("stabilityIndex", 0.5),
            dominant_emotion=result.get("dominantEmotion", "neutral"),
        )
        result.update({
            "xp": gam.get("xp"),
            "level": gam.get("level"),
            "sessionXp": gam.get("sessionXp"),
            "newBadges": gam.get("newBadges", []),
            "levelProgress": gam.get("levelProgress"),
        })

    return result


@router.get("/history")
async def get_history(user: OptionalUser, limit: int = 20):
    user_id = str(user["_id"]) if user else None
    sessions = await session_service.get_user_sessions(user_id, limit)
    return {"sessions": sessions}


@router.get("/{session_id}")
async def get_detail(session_id: str):
    doc = await session_service.get_session_detail(session_id)
    if not doc:
        return {"error": "not found"}
    return doc
