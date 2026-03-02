"""
Journal / Reflection routes
=============================
POST /journal/generate   — generate reflection from last session
GET  /journal/entries    — list past journal entries
GET  /journal/latest     — get most recent entry
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.api.deps import OptionalUser
from app.services.journal_service import journal_service
from app.services.session_service import session_service

router = APIRouter(prefix="/journal", tags=["Journal & Reflection"])


class GenerateReq(BaseModel):
    sessionId: Optional[str] = None


@router.post("/generate")
async def generate_reflection(payload: GenerateReq, user: OptionalUser):
    """Generate an AI-style reflection from a session."""
    user_id = str(user["_id"]) if user else None

    # If sessionId provided, use that; otherwise grab latest
    if payload.sessionId:
        session = await session_service.get_session_detail(payload.sessionId)
    else:
        sessions = await session_service.get_user_sessions(user_id, limit=1)
        session = sessions[0] if sessions else None

    if not session:
        return {"error": "No session found to reflect on."}

    reflection = await journal_service.generate_and_save(
        session_id=str(session.get("_id", "")),
        session=session,
        user_id=user_id,
    )
    return reflection


@router.get("/entries")
async def list_entries(user: OptionalUser, limit: int = 10):
    user_id = str(user["_id"]) if user else None
    entries = await journal_service.get_entries(user_id, limit)
    return {"entries": entries}


@router.get("/latest")
async def latest_entry(user: OptionalUser):
    user_id = str(user["_id"]) if user else None
    entry = await journal_service.get_latest(user_id)
    if not entry:
        return {"entry": None}
    return {"entry": entry}
