"""
Relief Activity Service
========================
Selects and manages post-session stress relief activities based on
the user's detected emotional state, anxiety score, and stability.

Activities:
  1. Guided Breathing (box / 4-7-8 / extended exhale)
  2. 5-4-3-2-1 Grounding
  3. Gratitude Drop
  4. Pattern Tracing
  5. Emotion Garden
  6. Shake It Out

Also handles before/after mood comparison and relief-specific
gamification rewards.
"""

from __future__ import annotations
from datetime import datetime, timezone
from bson import ObjectId
from app.db import get_db
from app.core.logging import logger

# ── Activity definitions ──────────────────────────────────────────────────────

ACTIVITIES = {
    "breathing_box": {
        "id": "breathing_box",
        "name": "Box Breathing",
        "description": "Breathe in 4s → hold 4s → out 4s → hold 4s. Calms the nervous system.",
        "category": "breathing",
        "icon": "🫁",
        "durationSec": 96,
        "cycles": 6,
        "phases": [
            {"name": "Inhale", "duration": 4, "instruction": "Breathe in slowly through your nose"},
            {"name": "Hold", "duration": 4, "instruction": "Hold your breath gently"},
            {"name": "Exhale", "duration": 4, "instruction": "Release slowly through your mouth"},
            {"name": "Hold", "duration": 4, "instruction": "Pause before the next breath"},
        ],
    },
    "breathing_478": {
        "id": "breathing_478",
        "name": "4-7-8 Breathing",
        "description": "Inhale 4s → hold 7s → exhale 8s. Deep relaxation technique.",
        "category": "breathing",
        "icon": "🌬️",
        "durationSec": 114,
        "cycles": 6,
        "phases": [
            {"name": "Inhale", "duration": 4, "instruction": "Breathe in through your nose"},
            {"name": "Hold", "duration": 7, "instruction": "Hold your breath comfortably"},
            {"name": "Exhale", "duration": 8, "instruction": "Exhale slowly through your mouth"},
        ],
    },
    "breathing_exhale": {
        "id": "breathing_exhale",
        "name": "Extended Exhale",
        "description": "Inhale 3s → exhale 6s. Activates your parasympathetic system.",
        "category": "breathing",
        "icon": "💨",
        "durationSec": 72,
        "cycles": 8,
        "phases": [
            {"name": "Inhale", "duration": 3, "instruction": "Gentle breath in"},
            {"name": "Exhale", "duration": 6, "instruction": "Long, slow exhale — let everything go"},
        ],
    },
    "grounding_54321": {
        "id": "grounding_54321",
        "name": "5-4-3-2-1 Grounding",
        "description": "Engage all five senses to anchor yourself in the present moment.",
        "category": "grounding",
        "icon": "🌳",
        "durationSec": 120,
        "steps": [
            {"sense": "see", "count": 5, "prompt": "Name 5 things you can SEE", "icon": "👁️"},
            {"sense": "touch", "count": 4, "prompt": "Name 4 things you can TOUCH", "icon": "✋"},
            {"sense": "hear", "count": 3, "prompt": "Name 3 things you can HEAR", "icon": "👂"},
            {"sense": "smell", "count": 2, "prompt": "Name 2 things you can SMELL", "icon": "👃"},
            {"sense": "taste", "count": 1, "prompt": "Name 1 thing you can TASTE", "icon": "👅"},
        ],
    },
    "gratitude_drop": {
        "id": "gratitude_drop",
        "name": "Gratitude Drop",
        "description": "Drop three things you're grateful for into the light.",
        "category": "cognitive",
        "icon": "💧",
        "durationSec": 60,
        "dropCount": 3,
    },
    "pattern_trace": {
        "id": "pattern_trace",
        "name": "Pattern Tracing",
        "description": "Trace calming patterns on screen. Bilateral stimulation calms the brain.",
        "category": "somatic",
        "icon": "🎯",
        "durationSec": 90,
        "patterns": ["infinity", "spiral", "figure8"],
    },
    "emotion_garden": {
        "id": "emotion_garden",
        "name": "Emotion Garden",
        "description": "Plant your emotions as flowers. Every feeling deserves a place.",
        "category": "creative",
        "icon": "🌻",
        "durationSec": 120,
        "emotionPlants": {
            "happy": {"plant": "Sunflower", "emoji": "🌻"},
            "sad": {"plant": "Rain Lily", "emoji": "🌧️"},
            "angry": {"plant": "Cactus", "emoji": "🌵"},
            "fear": {"plant": "Venus Flytrap", "emoji": "🪴"},
            "surprised": {"plant": "Snapdragon", "emoji": "🌺"},
            "neutral": {"plant": "Stone", "emoji": "🪨"},
            "disgust": {"plant": "Mushroom", "emoji": "🍄"},
        },
    },
    "shake_it_out": {
        "id": "shake_it_out",
        "name": "Shake It Out",
        "description": "Physical movement to release tension from your body.",
        "category": "physical",
        "icon": "💃",
        "durationSec": 90,
        "movements": [
            {"action": "Shake your hands vigorously", "duration": 10, "icon": "🤲"},
            {"action": "Roll your shoulders 5 times", "duration": 10, "icon": "🔄"},
            {"action": "Stretch your arms overhead", "duration": 8, "icon": "🙆"},
            {"action": "Twist your torso left and right", "duration": 10, "icon": "🔀"},
            {"action": "Take 3 deep sighs", "duration": 12, "icon": "😮‍💨"},
            {"action": "Shake out your whole body!", "duration": 10, "icon": "🕺"},
        ],
    },
}

# ── Selection algorithm ───────────────────────────────────────────────────────

def select_activities(
    dominant_emotion: str,
    anxiety_score: float,
    stability: float,
) -> list[dict]:
    """
    Pick 3 activities tailored to the user's session data.
    Returns activity defs in recommended order.
    """
    emo = (dominant_emotion or "neutral").lower()
    anx = anxiety_score or 0
    stab = stability or 0.5

    if anx > 0.7:
        picks = ["breathing_exhale", "shake_it_out", "gratitude_drop"]
    elif anx > 0.5 and emo in ("angry", "fear"):
        picks = ["breathing_box", "pattern_trace", "gratitude_drop"]
    elif stab < 0.35:
        picks = ["grounding_54321", "emotion_garden", "gratitude_drop"]
    elif emo == "sad":
        picks = ["breathing_478", "gratitude_drop", "grounding_54321"]
    elif emo == "angry":
        picks = ["shake_it_out", "breathing_478", "pattern_trace"]
    elif emo == "fear":
        picks = ["breathing_exhale", "grounding_54321", "gratitude_drop"]
    elif emo == "disgust":
        picks = ["grounding_54321", "breathing_box", "gratitude_drop"]
    else:
        # neutral / happy / surprised
        picks = ["emotion_garden", "gratitude_drop", "pattern_trace"]

    return [ACTIVITIES[aid] for aid in picks]


# ── Relief-specific badges ────────────────────────────────────────────────────

RELIEF_BADGES = {
    "first_breath": {
        "name": "First Breath",
        "description": "Complete your first breathing exercise",
        "icon": "🌬️",
        "xp": 50,
    },
    "zen_garden": {
        "name": "Zen Garden",
        "description": "Plant 10 emotion flowers total",
        "icon": "🌻",
        "xp": 100,
    },
    "shaker": {
        "name": "Shaker",
        "description": "Complete 5 Shake It Out sessions",
        "icon": "💃",
        "xp": 80,
    },
    "gratitude_guru": {
        "name": "Gratitude Guru",
        "description": "Drop 30 gratitude items total",
        "icon": "📝",
        "xp": 120,
    },
    "pattern_pro": {
        "name": "Pattern Pro",
        "description": "Trace 3 perfect patterns",
        "icon": "🎯",
        "xp": 80,
    },
    "relief_streak_3": {
        "name": "Relief Streak",
        "description": "3 consecutive days with relief activities",
        "icon": "🔥",
        "xp": 100,
    },
    "full_journey": {
        "name": "Full Journey",
        "description": "Complete all 3 activities in one session",
        "icon": "🏆",
        "xp": 100,
    },
    "mood_lifter": {
        "name": "Mood Lifter",
        "description": "Post-relief mood improved at least once",
        "icon": "📈",
        "xp": 75,
    },
}

COLLECTION = "relief_sessions"
STATS_COLLECTION = "relief_stats"


class ReliefService:

    async def _ensure_stats(self, user_id: str) -> dict:
        db = get_db()
        stats = await db[STATS_COLLECTION].find_one({"userId": user_id})
        if not stats:
            stats = {
                "userId": user_id,
                "totalReliefSessions": 0,
                "totalBreathingSessions": 0,
                "totalGratitudeDrops": 0,
                "totalFlowersPlanted": 0,
                "totalShakeOuts": 0,
                "totalPatternsTraced": 0,
                "totalPerfectPatterns": 0,
                "reliefStreak": 0,
                "lastReliefDate": None,
                "fullJourneyCount": 0,
                "moodLifts": 0,
            }
            await db[STATS_COLLECTION].insert_one(stats)
            stats = await db[STATS_COLLECTION].find_one({"userId": user_id})
        return stats

    async def get_plan(
        self,
        dominant_emotion: str,
        anxiety_score: float,
        stability: float,
    ) -> dict:
        """Return the 3-activity plan for the user."""
        activities = select_activities(dominant_emotion, anxiety_score, stability)
        return {
            "activities": activities,
            "totalDuration": sum(a["durationSec"] for a in activities),
            "message": _motivation_message(dominant_emotion, anxiety_score),
        }

    async def complete_activity(
        self,
        user_id: str | None,
        activity_id: str,
        before_mood: dict | None = None,
        after_mood: dict | None = None,
        extra: dict | None = None,
    ) -> dict:
        """Record a completed relief activity and return XP + badge updates."""
        db = get_db()
        now = datetime.now(timezone.utc)
        xp_earned = 30  # base per activity
        new_badges: list[dict] = []

        # Save record
        record = {
            "userId": user_id,
            "activityId": activity_id,
            "completedAt": now,
            "beforeMood": before_mood,
            "afterMood": after_mood,
            "extra": extra or {},
        }
        await db[COLLECTION].insert_one(record)

        if not user_id:
            return {"xpEarned": xp_earned, "newBadges": [], "message": "Activity completed!"}

        stats = await self._ensure_stats(user_id)

        # Update counters
        updates: dict = {"totalReliefSessions": stats.get("totalReliefSessions", 0) + 1}

        activity = ACTIVITIES.get(activity_id, {})
        cat = activity.get("category", "")

        if cat == "breathing":
            updates["totalBreathingSessions"] = stats.get("totalBreathingSessions", 0) + 1
        if activity_id == "gratitude_drop":
            drops = (extra or {}).get("dropCount", 3)
            updates["totalGratitudeDrops"] = stats.get("totalGratitudeDrops", 0) + drops
        if activity_id == "emotion_garden":
            flowers = (extra or {}).get("flowersPlanted", 0)
            updates["totalFlowersPlanted"] = stats.get("totalFlowersPlanted", 0) + flowers
        if activity_id == "shake_it_out":
            updates["totalShakeOuts"] = stats.get("totalShakeOuts", 0) + 1
        if activity_id == "pattern_trace":
            updates["totalPatternsTraced"] = stats.get("totalPatternsTraced", 0) + 1
            if (extra or {}).get("perfect"):
                updates["totalPerfectPatterns"] = stats.get("totalPerfectPatterns", 0) + 1

        # Mood improvement check
        mood_improved = False
        if before_mood and after_mood:
            before_score = before_mood.get("moodScore", 50)
            after_score = after_mood.get("moodScore", 50)
            if after_score > before_score:
                mood_improved = True
                updates["moodLifts"] = stats.get("moodLifts", 0) + 1
                xp_earned += 40

        # Relief streak
        today = now.date()
        last_date = stats.get("lastReliefDate")
        streak = stats.get("reliefStreak", 0)
        if last_date:
            if hasattr(last_date, "date"):
                last_day = last_date.date()
            else:
                last_day = last_date
            delta = (today - last_day).days
            if delta == 1:
                streak += 1
            elif delta > 1:
                streak = 1
        else:
            streak = 1
        updates["reliefStreak"] = streak
        updates["lastReliefDate"] = now

        await db[STATS_COLLECTION].update_one(
            {"userId": user_id}, {"$set": updates}
        )

        # Merge updates into stats for badge checking
        merged = {**stats, **updates}

        # Badge checks
        earned_ids = set()
        async for b in db["user_badges"].find({"userId": user_id}):
            earned_ids.add(b["badgeId"])

        async def _grant(badge_id: str):
            nonlocal xp_earned
            if badge_id not in earned_ids and badge_id in RELIEF_BADGES:
                badge = RELIEF_BADGES[badge_id]
                xp_earned += badge["xp"]
                await db["user_badges"].insert_one({
                    "userId": user_id,
                    "badgeId": badge_id,
                    "earnedAt": now,
                })
                new_badges.append({**badge, "id": badge_id, "earnedAt": now.isoformat()})
                earned_ids.add(badge_id)

        if merged.get("totalBreathingSessions", 0) >= 1:
            await _grant("first_breath")
        if merged.get("totalFlowersPlanted", 0) >= 10:
            await _grant("zen_garden")
        if merged.get("totalShakeOuts", 0) >= 5:
            await _grant("shaker")
        if merged.get("totalGratitudeDrops", 0) >= 30:
            await _grant("gratitude_guru")
        if merged.get("totalPerfectPatterns", 0) >= 3:
            await _grant("pattern_pro")
        if streak >= 3:
            await _grant("relief_streak_3")
        if mood_improved:
            await _grant("mood_lifter")

        # Update main user XP
        await db["user_stats"].update_one(
            {"userId": user_id},
            {"$inc": {"xp": xp_earned}},
            upsert=True,
        )

        return {
            "xpEarned": xp_earned,
            "newBadges": new_badges,
            "moodImproved": mood_improved,
            "message": "Great job! Activity completed." if not mood_improved else "Amazing! Your mood improved!",
        }

    async def complete_journey(self, user_id: str | None) -> dict:
        """Called when all 3 activities in a journey are done."""
        xp_bonus = 100
        new_badges: list[dict] = []

        if user_id:
            db = get_db()
            stats = await self._ensure_stats(user_id)
            count = stats.get("fullJourneyCount", 0) + 1
            await db[STATS_COLLECTION].update_one(
                {"userId": user_id},
                {"$set": {"fullJourneyCount": count}},
            )

            earned_ids = set()
            async for b in db["user_badges"].find({"userId": user_id}):
                earned_ids.add(b["badgeId"])

            if "full_journey" not in earned_ids:
                badge = RELIEF_BADGES["full_journey"]
                xp_bonus += badge["xp"]
                await db["user_badges"].insert_one({
                    "userId": user_id,
                    "badgeId": "full_journey",
                    "earnedAt": datetime.now(timezone.utc),
                })
                new_badges.append({**badge, "id": "full_journey"})

            await db["user_stats"].update_one(
                {"userId": user_id},
                {"$inc": {"xp": xp_bonus}},
                upsert=True,
            )

        return {
            "xpBonus": xp_bonus,
            "newBadges": new_badges,
            "message": "🏆 Full relief journey complete! You're amazing.",
        }


def _motivation_message(emotion: str, anxiety: float) -> str:
    emo = (emotion or "neutral").lower()
    if anxiety > 0.7:
        return "Your stress levels are elevated. Let's bring them down together."
    if emo == "angry":
        return "Let's channel that energy into something calming."
    if emo == "sad":
        return "It's okay to feel this way. Let's gently lift your spirits."
    if emo == "fear":
        return "You're safe here. Let's ground you in this moment."
    if emo == "happy":
        return "You're doing great! Let's build on this positive energy."
    return "Take a moment to care for yourself. You deserve it."


relief_service = ReliefService()
