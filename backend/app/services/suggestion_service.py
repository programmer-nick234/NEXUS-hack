"""
Suggestion Service — AI-driven intervention engine.
=====================================================
Uses a rule-based decision tree to recommend breathing
exercises, grounding techniques, and coping strategies
based on current + recent emotional patterns.
"""

from __future__ import annotations
import random


# ── Intervention library ──────────────────────────────────────────────────────

INTERVENTIONS = {
    "box_breathing": {
        "name": "Box Breathing",
        "description": "Breathe in 4s → hold 4s → out 4s → hold 4s. Repeat 4 cycles.",
        "category": "breathing",
        "duration_sec": 64,
        "icon": "🫁",
        "animation": "box",
    },
    "478_breathing": {
        "name": "4-7-8 Breathing",
        "description": "Inhale 4s → hold 7s → exhale 8s. Repeat 3 cycles.",
        "category": "breathing",
        "duration_sec": 57,
        "icon": "🌬️",
        "animation": "slow_wave",
    },
    "grounding_54321": {
        "name": "5-4-3-2-1 Grounding",
        "description": "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.",
        "category": "grounding",
        "duration_sec": 120,
        "icon": "🌳",
        "animation": "earth",
    },
    "body_scan": {
        "name": "Quick Body Scan",
        "description": "Slowly move attention from toes to crown, noticing each area.",
        "category": "mindfulness",
        "duration_sec": 90,
        "icon": "🧘",
        "animation": "scan",
    },
    "positive_reframe": {
        "name": "Positive Reframe",
        "description": "Identify one positive thing about the current moment.",
        "category": "cognitive",
        "duration_sec": 60,
        "icon": "💡",
        "animation": "sparkle",
    },
    "progressive_relaxation": {
        "name": "Progressive Muscle Relaxation",
        "description": "Tense each muscle group for 5s, then release. Start with hands.",
        "category": "somatic",
        "duration_sec": 120,
        "icon": "💪",
        "animation": "pulse",
    },
    "mindful_pause": {
        "name": "Mindful Pause",
        "description": "Close your eyes, focus on 3 slow breaths. Notice without judging.",
        "category": "mindfulness",
        "duration_sec": 30,
        "icon": "🕊️",
        "animation": "gentle",
    },
    "celebration": {
        "name": "Celebrate!",
        "description": "You're doing great! Take a moment to acknowledge your progress.",
        "category": "positive",
        "duration_sec": 15,
        "icon": "🎉",
        "animation": "confetti",
    },
}

# ── Emotion → intervention mapping rules ──────────────────────────────────────

_EMOTION_RULES: dict[str, list[str]] = {
    "angry": ["box_breathing", "progressive_relaxation", "grounding_54321"],
    "fear": ["478_breathing", "grounding_54321", "body_scan"],
    "sad": ["positive_reframe", "mindful_pause", "body_scan"],
    "disgust": ["mindful_pause", "grounding_54321", "box_breathing"],
    "surprised": ["mindful_pause", "478_breathing"],
    "neutral": ["mindful_pause", "body_scan"],
    "happy": ["celebration", "mindful_pause"],
}


# ── Anxiety level → intervention priority ─────────────────────────────────────

def _anxiety_override(anxiety_score: float) -> list[str] | None:
    """High-anxiety states override emotion-based suggestions."""
    if anxiety_score >= 0.7:
        return ["478_breathing", "grounding_54321", "progressive_relaxation"]
    if anxiety_score >= 0.5:
        return ["box_breathing", "body_scan"]
    return None


# ── Pattern detection ─────────────────────────────────────────────────────────

def _detect_pattern(recent_emotions: list[str]) -> dict:
    """Analyse recent emotion sequence for patterns."""
    if not recent_emotions:
        return {"pattern": "none", "insight": "Start a session to see patterns."}

    n = len(recent_emotions)
    counts: dict[str, int] = {}
    for e in recent_emotions:
        counts[e] = counts.get(e, 0) + 1

    dominant = max(counts, key=lambda k: counts[k])
    ratio = counts[dominant] / n

    # Check for improvement trend
    neg = {"angry", "fear", "sad", "disgust"}
    if n >= 4:
        first_half_neg = sum(1 for e in recent_emotions[: n // 2] if e in neg)
        second_half_neg = sum(1 for e in recent_emotions[n // 2:] if e in neg)
        if first_half_neg > second_half_neg + 1:
            return {
                "pattern": "improving",
                "insight": "Your mood is trending positively! Keep going. 🌟",
            }
        if second_half_neg > first_half_neg + 1:
            return {
                "pattern": "declining",
                "insight": "Your mood is dropping — a breathing exercise might help.",
            }

    if ratio >= 0.7:
        return {
            "pattern": "stuck",
            "dominant": dominant,
            "insight": f"You've been mostly {dominant}. Let's try shifting that.",
        }

    changes = sum(1 for i in range(1, n) if recent_emotions[i] != recent_emotions[i - 1])
    if changes / max(n - 1, 1) > 0.7:
        return {
            "pattern": "volatile",
            "insight": "Your emotions are shifting frequently. Grounding can help stabilise.",
        }

    return {"pattern": "stable", "insight": "You're emotionally steady right now."}


# ── Public API ────────────────────────────────────────────────────────────────

class SuggestionService:

    def get_suggestion(
        self,
        emotion: str,
        confidence: float = 0.5,
        anxiety_score: float = 0.0,
        recent_emotions: list[str] | None = None,
        used_interventions: list[str] | None = None,
    ) -> dict:
        """
        Return a ranked suggestion with up to 3 interventions,
        a pattern analysis, and an insight message.
        """
        recent = recent_emotions or []
        used = set(used_interventions or [])

        # 1) Determine candidate pool
        anxiety_pool = _anxiety_override(anxiety_score)
        emotion_pool = _EMOTION_RULES.get(emotion.lower(), _EMOTION_RULES["neutral"])
        pool = anxiety_pool if anxiety_pool else emotion_pool

        # 2) De-duplicate recently used interventions (push to back)
        fresh = [i for i in pool if i not in used]
        stale = [i for i in pool if i in used]
        ranked = fresh + stale

        # 3) Build top-3
        top = ranked[:3]
        suggestions = [INTERVENTIONS[i] | {"id": i} for i in top if i in INTERVENTIONS]

        # 4) Pattern analysis
        pattern = _detect_pattern(recent)

        # 5) Urgency label
        if anxiety_score >= 0.7:
            urgency = "high"
        elif anxiety_score >= 0.4:
            urgency = "medium"
        else:
            urgency = "low"

        return {
            "suggestions": suggestions,
            "pattern": pattern,
            "urgency": urgency,
            "message": _build_message(emotion, anxiety_score, pattern),
        }


def _build_message(emotion: str, anxiety: float, pattern: dict) -> str:
    """Human-friendly coaching message."""
    em = emotion.lower()
    if anxiety >= 0.7:
        return "I notice some tension. Let's take a moment to breathe together."
    if em == "happy":
        return "You're feeling positive! A short mindful pause can deepen that."
    if em == "sad":
        return "It's okay to feel this way. A gentle exercise might bring some relief."
    if em in ("angry", "fear"):
        return "Strong emotions detected. Grounding yourself can bring clarity."
    if pattern.get("pattern") == "improving":
        return "Great progress! Keep the momentum going."
    if pattern.get("pattern") == "volatile":
        return "Your emotions are shifting — a stabilising exercise could help."
    return "Let's check in with how you're feeling right now."


suggestion_service = SuggestionService()
