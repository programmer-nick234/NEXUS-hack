"""
Session Service — tracks mood sessions in MongoDB.
====================================================
Each session captures a timeline of emotion snapshots,
produces a mood score, stability index, and duration.
"""

from datetime import datetime, timezone
from bson import ObjectId
from app.db import get_db
from app.core.logging import logger


def _utcnow() -> datetime:
    """Naive UTC now — consistent with what Motor stores/returns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

ALL_EMOTIONS = ("happy", "sad", "angry", "surprised", "fear", "neutral", "disgust")

# Weight each emotion for overall "mood score" (0 = worst, 100 = best)
_MOOD_WEIGHTS = {
    "happy": 95,
    "neutral": 60,
    "surprised": 55,
    "disgust": 30,
    "sad": 20,
    "fear": 15,
    "angry": 10,
}


class SessionService:
    """CRUD for mood sessions stored in MongoDB."""

    COLLECTION = "sessions"

    # ── create ────────────────────────────────────────────────────────────

    async def start_session(self, user_id: str | None = None) -> str:
        """Create a new session doc and return its _id as string."""
        db = get_db()
        doc = {
            "userId": user_id,
            "startedAt": _utcnow(),
            "endedAt": None,
            "timeline": [],          # [{ts, emotion, confidence, distribution}]
            "gestureSnapshots": [],   # [{ts, anxietyScore, emotionalState}]
            "moodScore": None,
            "stabilityIndex": None,
            "dominantEmotion": None,
            "durationSec": 0,
        }
        result = await db[self.COLLECTION].insert_one(doc)
        sid = str(result.inserted_id)
        logger.info(f"Session started: {sid}")
        return sid

    # ── append snapshot ───────────────────────────────────────────────────

    async def add_emotion_snapshot(self, session_id: str, snapshot: dict) -> None:
        """Append an emotion detection result to the session timeline."""
        db = get_db()
        entry = {
            "ts": _utcnow(),
            "emotion": snapshot.get("emotion", "neutral"),
            "confidence": snapshot.get("confidence", 0),
            "distribution": snapshot.get("distribution", {}),
        }
        await db[self.COLLECTION].update_one(
            {"_id": ObjectId(session_id)},
            {"$push": {"timeline": entry}},
        )

    async def add_gesture_snapshot(self, session_id: str, snapshot: dict) -> None:
        db = get_db()
        entry = {
            "ts": _utcnow(),
            "anxietyScore": snapshot.get("anxietyScore", 0),
            "emotionalState": snapshot.get("emotionalState", "neutral"),
            "interventionType": snapshot.get("interventionType", "none"),
        }
        await db[self.COLLECTION].update_one(
            {"_id": ObjectId(session_id)},
            {"$push": {"gestureSnapshots": entry}},
        )

    # ── end session + compute aggregates ──────────────────────────────────

    async def end_session(self, session_id: str) -> dict:
        """Finalise a session: compute mood score, stability, dominant emotion."""
        db = get_db()
        doc = await db[self.COLLECTION].find_one({"_id": ObjectId(session_id)})
        if not doc:
            return {"error": "session not found"}

        timeline = doc.get("timeline", [])
        started = doc.get("startedAt", _utcnow())
        ended = _utcnow()
        # Ensure both are naive UTC for safe subtraction
        if hasattr(started, 'tzinfo') and started.tzinfo is not None:
            started = started.replace(tzinfo=None)
        duration_sec = (ended - started).total_seconds()

        mood_score = 60.0
        stability = 1.0
        dominant = "neutral"

        if timeline:
            # Mood score = weighted average of detected emotions
            scores = [_MOOD_WEIGHTS.get(e["emotion"], 50) for e in timeline]
            mood_score = round(sum(scores) / len(scores), 1)

            # Stability = 1 - normalised number of emotion switches
            changes = sum(1 for i in range(1, len(timeline)) if timeline[i]["emotion"] != timeline[i - 1]["emotion"])
            stability = round(1 - min(changes / max(len(timeline), 1), 1.0), 2)

            # Dominant emotion = most frequent
            counts: dict[str, int] = {}
            for e in timeline:
                em = e["emotion"]
                counts[em] = counts.get(em, 0) + 1
            dominant = max(counts, key=lambda k: counts[k])

        update = {
            "endedAt": ended,
            "durationSec": round(duration_sec, 1),
            "moodScore": mood_score,
            "stabilityIndex": stability,
            "dominantEmotion": dominant,
        }
        await db[self.COLLECTION].update_one(
            {"_id": ObjectId(session_id)}, {"$set": update}
        )

        return {**update, "sessionId": session_id, "totalSnapshots": len(timeline)}

    # ── history ───────────────────────────────────────────────────────────

    async def get_user_sessions(self, user_id: str | None, limit: int = 20) -> list[dict]:
        db = get_db()
        query = {"userId": user_id, "endedAt": {"$ne": None}}
        cursor = (
            db[self.COLLECTION]
            .find(query)
            .sort("endedAt", -1)
            .limit(limit)
        )
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            results.append(doc)
        return results

    async def get_session_detail(self, session_id: str) -> dict | None:
        db = get_db()
        doc = await db[self.COLLECTION].find_one({"_id": ObjectId(session_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    # ── analytics aggregates ──────────────────────────────────────────────

    async def get_user_analytics(self, user_id: str | None) -> dict:
        """Return aggregate stats for a user's mood history."""
        db = get_db()
        sessions = await self.get_user_sessions(user_id, limit=100)
        if not sessions:
            return {
                "totalSessions": 0, "avgMoodScore": 0, "avgStability": 0,
                "totalMinutes": 0, "moodTrend": [], "emotionBreakdown": {},
            }

        mood_scores = [s["moodScore"] for s in sessions if s.get("moodScore") is not None]
        stabilities = [s["stabilityIndex"] for s in sessions if s.get("stabilityIndex") is not None]
        total_sec = sum(s.get("durationSec", 0) for s in sessions)

        # Emotion breakdown across all sessions
        breakdown: dict[str, int] = {}
        for s in sessions:
            em = s.get("dominantEmotion", "neutral")
            breakdown[em] = breakdown.get(em, 0) + 1

        # Mood trend (last 10 sessions, chronological)
        trend = [
            {
                "date": s.get("endedAt", "").isoformat() if hasattr(s.get("endedAt", ""), "isoformat") else str(s.get("endedAt", "")),
                "moodScore": s.get("moodScore", 0),
                "stability": s.get("stabilityIndex", 0),
            }
            for s in reversed(sessions[:10])
        ]

        return {
            "totalSessions": len(sessions),
            "avgMoodScore": round(sum(mood_scores) / len(mood_scores), 1) if mood_scores else 0,
            "avgStability": round(sum(stabilities) / len(stabilities), 2) if stabilities else 0,
            "totalMinutes": round(total_sec / 60, 1),
            "moodTrend": trend,
            "emotionBreakdown": breakdown,
        }


session_service = SessionService()
