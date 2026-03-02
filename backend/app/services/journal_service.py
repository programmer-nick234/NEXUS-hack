"""
Journal / Reflection Service
=============================
Generates AI-style post-session reflections from session data.
Uses rule-based NLG (natural-language generation) — sounds AI-written
but needs no external API. Easily upgradeable to OpenAI if a key is available.
"""

import random
from datetime import datetime, timezone

from app.db import get_db

_OPENERS = [
    "Your session today revealed some interesting patterns.",
    "Taking time to understand your emotions is a powerful step.",
    "Let's reflect on what your emotional journey showed us today.",
    "Here's what stood out from your recent session.",
    "Every session is a window into your inner world.",
]

_MOOD_HIGH = [
    "Your mood score of {score} indicates a positively grounded state — you're in a great place right now.",
    "With a mood score of {score}, you showed strong emotional positivity today.",
    "A {score} mood score is excellent — your emotional baseline is healthy and resilient.",
]

_MOOD_MID = [
    "Your mood score of {score} sits in the balanced zone — neither too high nor too low, which is perfectly normal.",
    "At {score}, your mood suggests a calm, steady state with room for gentle upward movement.",
    "A {score} mood score shows you're managing well, even if things feel complex inside.",
]

_MOOD_LOW = [
    "Your mood score of {score} suggests you might be carrying some weight — that's okay, it's a signal worth listening to.",
    "At {score}, your emotional state is signaling that some self-care could really help right now.",
    "A lower mood score of {score} doesn't define you — it's just data pointing you toward what needs attention.",
]

_STABILITY_HIGH = [
    "Your emotional stability was remarkably consistent ({stab}%) — this suggests strong self-regulation.",
    "With {stab}% stability, your emotions stayed relatively even throughout the session.",
]

_STABILITY_LOW = [
    "Your stability of {stab}% shows emotional fluctuation during the session — this often indicates processing or heightened awareness.",
    "At {stab}% stability, you experienced some emotional shifts — that's your mind working through things actively.",
]

_EMOTION_INSIGHTS = {
    "happy": "Happiness showed up prominently — notice what was happening in those moments and remember you can return to that state.",
    "sad": "Sadness was present in your session — it's an emotion that often signals deep caring about something important to you.",
    "angry": "Anger emerged during your session — this forceful emotion often protects deeper feelings worth exploring.",
    "neutral": "A neutral baseline dominated your session — this can indicate a calm state or emotional guardedness.",
    "fear": "Fear appeared in your emotional landscape — acknowledging it is the first step to understanding what it's protecting you from.",
    "surprised": "Surprise was detected — moments of surprise show your brain is actively engaging with novel stimuli.",
    "disgust": "Discomfort signals appeared — these are your mind's way of establishing boundaries.",
    "anxious": "Anxiety was present — remember that anxiety is often excitement without breath. Try breathing exercises.",
    "regulated": "You showed strong emotional regulation — this is a skill that strengthens with practice.",
}

_CLOSERS = [
    "Remember: understanding your emotions is the first step to mastering them. See you next session. 🌿",
    "Every session builds your emotional awareness. Keep going — you're doing important work. ✨",
    "Take this insight with you today. Small moments of awareness create lasting change. 🧠",
    "You showed up for yourself today — that matters more than any score. 💛",
    "Emotional intelligence isn't about feeling good all the time — it's about understanding what you feel. You're on that path. 🌱",
]


def _utcnow():
    return datetime.now(timezone.utc)


def generate_reflection(session: dict) -> dict:
    """Generate a structured reflection from session data."""
    mood = session.get("moodScore") or 50
    stab = round((session.get("stabilityIndex") or 0.5) * 100)
    dominant = session.get("dominantEmotion") or "neutral"
    duration = session.get("durationSec") or 0
    snaps = session.get("totalSnapshots") or 0

    paras = []

    # Opener
    paras.append(random.choice(_OPENERS))

    # Duration context
    mins = round(duration / 60, 1)
    paras.append(
        f"During your {mins}-minute session ({snaps} emotional snapshots captured), "
        f"your dominant emotion was **{dominant}**."
    )

    # Mood insight
    if mood >= 70:
        paras.append(random.choice(_MOOD_HIGH).format(score=mood))
    elif mood >= 40:
        paras.append(random.choice(_MOOD_MID).format(score=mood))
    else:
        paras.append(random.choice(_MOOD_LOW).format(score=mood))

    # Stability
    if stab >= 60:
        paras.append(random.choice(_STABILITY_HIGH).format(stab=stab))
    else:
        paras.append(random.choice(_STABILITY_LOW).format(stab=stab))

    # Emotion-specific insight
    if dominant in _EMOTION_INSIGHTS:
        paras.append(_EMOTION_INSIGHTS[dominant])

    # Actionable tip
    if mood < 50:
        paras.append("💡 **Tip:** Consider trying the Relief Journey — breathing exercises and grounding can shift your state in just a few minutes.")
    elif stab < 50:
        paras.append("💡 **Tip:** Emotional variability can be tiring. A grounding exercise or pattern tracing activity might help stabilize your mood.")
    else:
        paras.append("💡 **Tip:** You're in a good place. Consider journaling about what contributed to today's positive state so you can recreate it.")

    # Closer
    paras.append(random.choice(_CLOSERS))

    return {
        "title": f"Session Reflection — {dominant.capitalize()} Journey",
        "paragraphs": paras,
        "mood": mood,
        "stability": stab,
        "dominant": dominant,
        "generatedAt": _utcnow().isoformat(),
    }


class JournalService:
    COLLECTION = "journal_entries"

    async def generate_and_save(self, session_id: str, session: dict, user_id: str | None = None) -> dict:
        reflection = generate_reflection(session)
        reflection["sessionId"] = session_id
        reflection["userId"] = user_id
        reflection["createdAt"] = _utcnow()

        db = get_db()
        await db[self.COLLECTION].insert_one(reflection)
        reflection.pop("_id", None)
        return reflection

    async def get_entries(self, user_id: str | None, limit: int = 10) -> list[dict]:
        db = get_db()
        query = {"userId": user_id}
        cursor = db[self.COLLECTION].find(query).sort("createdAt", -1).limit(limit)
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            results.append(doc)
        return results

    async def get_latest(self, user_id: str | None) -> dict | None:
        entries = await self.get_entries(user_id, limit=1)
        return entries[0] if entries else None


journal_service = JournalService()
