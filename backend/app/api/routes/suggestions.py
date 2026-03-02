"""
Suggestion routes — AI-driven intervention recommendations.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from app.services.suggestion_service import suggestion_service

router = APIRouter(prefix="/suggestions", tags=["Suggestions"])


class SuggestionReq(BaseModel):
    emotion: str = "neutral"
    confidence: float = 0.5
    anxietyScore: float = 0.0
    recentEmotions: list[str] = []
    usedInterventions: list[str] = []


@router.post("/recommend")
async def recommend(req: SuggestionReq):
    result = suggestion_service.get_suggestion(
        emotion=req.emotion,
        confidence=req.confidence,
        anxiety_score=req.anxietyScore,
        recent_emotions=req.recentEmotions,
        used_interventions=req.usedInterventions,
    )
    return result
