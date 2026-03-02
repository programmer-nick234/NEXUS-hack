"""
Anxiety Detection – Swipe-Based Analysis
=========================================
Accepts gesture metrics from the frontend and returns
a weighted anxiety score with intervention parameters.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/anxiety", tags=["Anxiety Detection"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class GesturePayload(BaseModel):
    duration: float = Field(..., description="Total gesture duration in ms")
    avgSpeed: float = Field(..., description="Average pointer speed in px/s")
    directionChanges: int = Field(..., description="Number of direction changes")
    variance: float = Field(..., description="Movement variance (0-1 normalized)")
    holdDuration: float = Field(..., description="Hold duration in ms")


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


def _compute_anxiety_score(
    norm_speed: float,
    direction_changes: int,
    variance: float,
    hold_stability: float,
) -> float:
    """
    Weighted anxiety score:
      speed        0.30
      direction    0.25
      variance     0.25
      hold         0.20
    """
    dir_norm = _clamp(direction_changes / 20.0)
    var_norm = _clamp(variance)
    score = (
        norm_speed * 0.30
        + dir_norm * 0.25
        + var_norm * 0.25
        + (1 - hold_stability) * 0.20
    )
    return round(_clamp(score), 3)


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/analyze-state", response_model=AnalysisResponse)
async def analyze_state(payload: GesturePayload):
    """
    Receive swipe gesture metrics and return an anxiety analysis
    with a recommended breathing intervention.
    """

    # Normalize inputs
    norm_speed = _clamp(payload.avgSpeed / 1200.0)  # 1200 px/s = max
    hold_stability = _clamp(payload.holdDuration / 2000.0)  # 2s = fully stable
    variance = _clamp(payload.variance)

    anxiety = _compute_anxiety_score(
        norm_speed, payload.directionChanges, variance, hold_stability
    )

    # ── Rule-based classification ─────────────────────────────────────────
    if payload.duration < 300:
        state = "impulsive"
        intervention = "grounding"
        params = InterventionParams(breathSpeed=3.0, color="#F59E0B", particleSpeed=2.0)
    elif norm_speed > 0.7 and payload.directionChanges > 8:
        state = "overstimulated"
        intervention = "deceleration"
        params = InterventionParams(breathSpeed=6.0, color="#EF4444", particleSpeed=0.3)
    elif norm_speed > 0.3 and variance > 0.4:
        state = "anxious"
        intervention = "breathing"
        params = InterventionParams(breathSpeed=5.2, color="#4A90E2", particleSpeed=0.4)
    elif hold_stability > 0.7:
        state = "regulated"
        intervention = "maintenance"
        params = InterventionParams(breathSpeed=7.0, color="#10B981", particleSpeed=0.2)
    else:
        state = "neutral"
        intervention = "none"
        params = InterventionParams(breathSpeed=4.0, color="#F8FAFC", particleSpeed=1.0)

    return AnalysisResponse(
        emotionalState=state,
        intensity=round(anxiety, 2),
        anxietyScore=round(anxiety, 3),
        interventionType=intervention,
        parameters=params,
    )
