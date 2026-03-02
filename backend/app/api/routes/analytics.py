"""
Analytics routes — aggregated user mood data.
"""

from fastapi import APIRouter, Depends, Query
from app.api.deps import OptionalUser
from app.services.session_service import session_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
async def overview(user: OptionalUser):
    """Full analytics overview — works for both auth and anonymous users."""
    if user:
        return await session_service.get_user_analytics(str(user["_id"]))
    # Anonymous: return analytics across all anonymous sessions
    return await session_service.get_user_analytics(None)
