"""
Anxiety Detection – Combined Face + Gesture Analysis
=====================================================
Accepts gesture metrics **and** the latest face emotion from the
frontend, then returns a weighted anxiety score with intervention
parameters that blend both signals for higher accuracy.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/anxiety", tags=["Anxiety Detection"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class GesturePayload(BaseModel):
    duration: float = Field(..., description="Total gesture duration in ms")
    avgSpeed: float = Field(..., description="Average pointer speed in px/s")
    directionChanges: int = Field(..., description="Number of direction changes")
    variance: float = Field(..., description="Movement variance (0-1 normalized)")
    holdDuration: float = Field(..., description="Hold duration in ms")
    # NEW — optional face emotion forwarded from the browser webcam analysis
    faceEmotion: Optional[str] = Field(
        None, description="Latest detected face emotion (happy, sad, angry …)"
    )
    faceConfidence: Optional[float] = Field(
        None, description="Confidence of the face emotion (0-1)"
    )


class InterventionParams(BaseModel):
    breathSpeed: float
    color: str
    particleSpeed: float


class AnalysisResponse(BaseModel):
    emotionalState: str
    intensity: float
    anxietyScore: float
    interventionType: str
    parameters: InterventionParams


# ── Helpers ───────────────────────────────────────────────────────────────────


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


# Face-emotion → anxiety modifier (positive = increases anxiety)
_FACE_ANXIETY_MAP: dict[str, float] = {
    "angry": 0.85,
    "fear": 0.80,
    "sad": 0.60,
    "disgust": 0.55,
    "surprised": 0.35,
    "neutral": 0.15,
    "happy": -0.10,
}


def _compute_anxiety_score(
    norm_speed: float,
    direction_changes: int,
    variance: float,
    hold_stability: float,
    face_emotion: Optional[str] = None,
    face_confidence: Optional[float] = None,
) -> float:
    """
    Blended anxiety score.

    When face emotion is available the weights are:
      gesture-speed    0.22
      direction        0.18
      variance         0.18
      hold             0.12
      face-emotion     0.30   ← new

    Without face emotion the original gesture-only weights apply:
      speed 0.30, dir 0.25, var 0.25, hold 0.20
    """
    dir_norm = _clamp(direction_changes / 20.0)
    var_norm = _clamp(variance)

    if face_emotion and face_emotion.lower() in _FACE_ANXIETY_MAP:
        face_val = _FACE_ANXIETY_MAP[face_emotion.lower()]
        conf = _clamp(face_confidence if face_confidence is not None else 0.5)
        # Scale the face contribution by confidence
        face_component = _clamp(face_val) * conf
        score = (
            norm_speed * 0.22
            + dir_norm * 0.18
            + var_norm * 0.18
            + (1 - hold_stability) * 0.12
            + face_component * 0.30
        )
    else:
        score = (
            norm_speed * 0.30
            + dir_norm * 0.25
            + var_norm * 0.25
            + (1 - hold_stability) * 0.20
        )
    return round(_clamp(score), 3)


def _classify(
    anxiety: float,
    payload: "GesturePayload",
    norm_speed: float,
    hold_stability: float,
) -> tuple[str, str, InterventionParams]:
    """Return (state, intervention, params) using face+gesture evidence."""

    face = (payload.faceEmotion or "").lower()

    # ── Strong face signals can override pure-gesture classification ──────
    if face in ("angry", "fear") and anxiety > 0.35:
        return (
            "overstimulated",
            "deceleration",
            InterventionParams(breathSpeed=6.0, color="#EF4444", particleSpeed=0.3),
        )

    if face == "sad" and anxiety > 0.25:
        return (
            "anxious",
            "breathing",
            InterventionParams(breathSpeed=5.2, color="#4A90E2", particleSpeed=0.4),
        )

    if face == "happy" and anxiety < 0.35:
        return (
            "regulated",
            "maintenance",
            InterventionParams(breathSpeed=7.0, color="#10B981", particleSpeed=0.2),
        )

    # ── Gesture-dominant rules (original) ─────────────────────────────────
    if payload.duration < 300:
        return (
            "impulsive",
            "grounding",
            InterventionParams(breathSpeed=3.0, color="#F59E0B", particleSpeed=2.0),
        )

    if norm_speed > 0.7 and payload.directionChanges > 8:
        return (
            "overstimulated",
            "deceleration",
            InterventionParams(breathSpeed=6.0, color="#EF4444", particleSpeed=0.3),
        )

    if norm_speed > 0.3 and payload.variance > 0.4:
        return (
            "anxious",
            "breathing",
            InterventionParams(breathSpeed=5.2, color="#4A90E2", particleSpeed=0.4),
        )

    if hold_stability > 0.7:
        return (
            "regulated",
            "maintenance",
            InterventionParams(breathSpeed=7.0, color="#10B981", particleSpeed=0.2),
        )

    return (
        "neutral",
        "none",
        InterventionParams(breathSpeed=4.0, color="#F8FAFC", particleSpeed=1.0),
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/analyze-state", response_model=AnalysisResponse)
async def analyze_state(payload: GesturePayload):
    """
    Receive swipe gesture metrics + optional face emotion and return
    a blended anxiety analysis with a recommended breathing intervention.
    """

    # Normalize inputs
    norm_speed = _clamp(payload.avgSpeed / 1200.0)
    hold_stability = _clamp(payload.holdDuration / 2000.0)

    anxiety = _compute_anxiety_score(
        norm_speed,
        payload.directionChanges,
        _clamp(payload.variance),
        hold_stability,
        face_emotion=payload.faceEmotion,
        face_confidence=payload.faceConfidence,
    )

    state, intervention, params = _classify(
        anxiety, payload, norm_speed, hold_stability
    )

    return AnalysisResponse(
        emotionalState=state,
        intensity=round(anxiety, 2),
        anxietyScore=round(anxiety, 3),
        interventionType=intervention,
        parameters=params,
    )
