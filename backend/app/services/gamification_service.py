"""
Gamification Service — streaks, XP, badges/achievements.
==========================================================
Rewards consistent emotional regulation practice with
points, streak tracking, and unlockable badges.
"""

from datetime import datetime, timezone, timedelta
from bson import ObjectId
from app.db import get_db
from app.core.logging import logger

# ── Badge definitions ─────────────────────────────────────────────────────────

BADGES = {
    "first_session": {
        "name": "First Steps",
        "description": "Complete your first mood session",
        "icon": "🌱",
        "xp": 50,
    },
    "streak_3": {
        "name": "Getting Started",
        "description": "3-day streak",
        "icon": "🔥",
        "xp": 100,
    },
    "streak_7": {
        "name": "Regularity",
        "description": "7-day streak",
        "icon": "⚡",
        "xp": 250,
    },
    "streak_14": {
        "name": "Committed",
        "description": "14-day streak",
        "icon": "🏆",
        "xp": 500,
    },
    "streak_30": {
        "name": "Master",
        "description": "30-day streak",
        "icon": "👑",
        "xp": 1000,
    },
    "mood_boost": {
        "name": "Mood Boost",
        "description": "Improve mood score by 15+ in a session",
        "icon": "🚀",
        "xp": 150,
    },
    "zen_master": {
        "name": "Zen Master",
        "description": "Maintain stability > 0.8 for 3 sessions",
        "icon": "🧘",
        "xp": 200,
    },
    "sessions_10": {
        "name": "Dedicated",
        "description": "Complete 10 sessions",
        "icon": "💪",
        "xp": 300,
    },
    "sessions_50": {
        "name": "Veteran",
        "description": "Complete 50 sessions",
        "icon": "🎖️",
        "xp": 750,
    },
    "happy_streak": {
        "name": "Positivity",
        "description": "Dominant happy emotion 3 sessions in a row",
        "icon": "😊",
        "xp": 200,
    },
}

# XP → Level formula: level = floor(sqrt(xp / 50))
import math


def _xp_to_level(xp: int) -> int:
    return max(1, int(math.sqrt(xp / 50)))


def _level_xp_bounds(level: int) -> tuple[int, int]:
    """Return (xp_start, xp_end) for a given level."""
    start = (level - 1) ** 2 * 50
    end = level ** 2 * 50
    return start, end


class GamificationService:
    STATS_COLLECTION = "user_stats"
    BADGES_COLLECTION = "user_badges"

    # ── ensure user stats doc exists ──────────────────────────────────────

    async def _ensure_stats(self, user_id: str) -> dict:
        db = get_db()
        stats = await db[self.STATS_COLLECTION].find_one({"userId": user_id})
        if not stats:
            stats = {
                "userId": user_id,
                "xp": 0,
                "level": 1,
                "currentStreak": 0,
                "longestStreak": 0,
                "totalSessions": 0,
                "lastSessionDate": None,
                "consecutiveHighStability": 0,
                "consecutiveHappyDominant": 0,
            }
            await db[self.STATS_COLLECTION].insert_one(stats)
            stats = await db[self.STATS_COLLECTION].find_one({"userId": user_id})
        return stats

    # ── record a completed session ────────────────────────────────────────

    async def record_session(
        self,
        user_id: str,
        mood_score: float,
        stability: float,
        dominant_emotion: str,
    ) -> dict:
        """
        Called after a session ends. Updates XP, streaks, badges.
        Returns the new stats + any newly earned badges.
        """
        db = get_db()
        stats = await self._ensure_stats(user_id)

        now = datetime.now(timezone.utc)
        today = now.date()
        new_badges: list[dict] = []

        # ── Streak logic ──────────────────────────────────────────────────
        last_date = stats.get("lastSessionDate")
        current_streak = stats.get("currentStreak", 0)
        if last_date:
            if hasattr(last_date, "date"):
                last_day = last_date.date()
            else:
                last_day = last_date
            delta = (today - last_day).days
            if delta == 1:
                current_streak += 1
            elif delta > 1:
                current_streak = 1
            # delta == 0 → same day, keep streak same
        else:
            current_streak = 1

        longest = max(stats.get("longestStreak", 0), current_streak)
        total = stats.get("totalSessions", 0) + 1
        xp = stats.get("xp", 0)

        # ── Session XP ────────────────────────────────────────────────────
        session_xp = 25  # base
        if mood_score >= 75:
            session_xp += 15
        if stability >= 0.7:
            session_xp += 10
        xp += session_xp

        # ── Badge checks ─────────────────────────────────────────────────
        existing = set()
        async for b in db[self.BADGES_COLLECTION].find({"userId": user_id}):
            existing.add(b["badgeId"])

        async def _grant(badge_id: str):
            if badge_id not in existing and badge_id in BADGES:
                nonlocal xp
                badge = BADGES[badge_id]
                xp += badge["xp"]
                await db[self.BADGES_COLLECTION].insert_one({
                    "userId": user_id,
                    "badgeId": badge_id,
                    "earnedAt": now,
                })
                new_badges.append({**badge, "id": badge_id, "earnedAt": now.isoformat()})
                existing.add(badge_id)

        if total == 1:
            await _grant("first_session")
        if total >= 10:
            await _grant("sessions_10")
        if total >= 50:
            await _grant("sessions_50")

        for threshold, badge_id in [(3, "streak_3"), (7, "streak_7"), (14, "streak_14"), (30, "streak_30")]:
            if current_streak >= threshold:
                await _grant(badge_id)

        # Consecutive stability
        consec_stab = stats.get("consecutiveHighStability", 0)
        consec_stab = consec_stab + 1 if stability > 0.8 else 0
        if consec_stab >= 3:
            await _grant("zen_master")

        # Consecutive happy
        consec_happy = stats.get("consecutiveHappyDominant", 0)
        consec_happy = consec_happy + 1 if dominant_emotion == "happy" else 0
        if consec_happy >= 3:
            await _grant("happy_streak")

        level = _xp_to_level(xp)
        lvl_start, lvl_end = _level_xp_bounds(level)

        update = {
            "xp": xp,
            "level": level,
            "currentStreak": current_streak,
            "longestStreak": longest,
            "totalSessions": total,
            "lastSessionDate": now,
            "consecutiveHighStability": consec_stab,
            "consecutiveHappyDominant": consec_happy,
        }
        await db[self.STATS_COLLECTION].update_one(
            {"userId": user_id}, {"$set": update}
        )

        return {
            **update,
            "sessionXp": session_xp,
            "newBadges": new_badges,
            "levelProgress": {
                "current": xp - lvl_start,
                "required": lvl_end - lvl_start,
                "percent": round((xp - lvl_start) / max(lvl_end - lvl_start, 1) * 100, 1),
            },
        }

    # ── read ──────────────────────────────────────────────────────────────

    async def get_stats(self, user_id: str) -> dict:
        stats = await self._ensure_stats(user_id)
        stats.pop("_id", None)
        level = _xp_to_level(stats.get("xp", 0))
        lvl_start, lvl_end = _level_xp_bounds(level)
        stats["level"] = level
        stats["levelProgress"] = {
            "current": stats.get("xp", 0) - lvl_start,
            "required": lvl_end - lvl_start,
            "percent": round((stats.get("xp", 0) - lvl_start) / max(lvl_end - lvl_start, 1) * 100, 1),
        }
        return stats

    async def get_badges(self, user_id: str) -> list[dict]:
        db = get_db()
        result = []
        async for b in db[self.BADGES_COLLECTION].find({"userId": user_id}).sort("earnedAt", -1):
            badge_id = b["badgeId"]
            if badge_id in BADGES:
                result.append({
                    "id": badge_id,
                    **BADGES[badge_id],
                    "earnedAt": b["earnedAt"].isoformat() if hasattr(b["earnedAt"], "isoformat") else str(b["earnedAt"]),
                })
        return result

    async def get_all_badges(self, user_id: str) -> list[dict]:
        """Return all possible badges with earned status."""
        earned = {b["id"] for b in await self.get_badges(user_id)}
        return [
            {
                "id": bid,
                **bdata,
                "earned": bid in earned,
            }
            for bid, bdata in BADGES.items()
        ]


gamification_service = GamificationService()
