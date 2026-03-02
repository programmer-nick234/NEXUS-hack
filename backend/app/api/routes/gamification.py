"""
Gamification routes — stats, badges, leaderboard.
"""

from fastapi import APIRouter, Depends
from app.api.deps import CurrentUser
from app.services.gamification_service import gamification_service

router = APIRouter(prefix="/gamification", tags=["Gamification"])


@router.get("/stats")
async def get_stats(user: CurrentUser):
    stats = await gamification_service.get_stats(str(user["_id"]))
    return stats


@router.get("/badges")
async def get_earned_badges(user: CurrentUser):
    badges = await gamification_service.get_badges(str(user["_id"]))
    return {"badges": badges}


@router.get("/badges/all")
async def get_all_badges(user: CurrentUser):
    badges = await gamification_service.get_all_badges(str(user["_id"]))
    return {"badges": badges}
