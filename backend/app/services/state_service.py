"""
State Classification Service
==============================
Rule-based emotional state classifier.
Maps interaction metrics → emotional state → intervention parameters.

This is deliberately rule-based (no ML) for hackathon reliability.
Can be swapped for a trained model later.
"""

from app.schemas.state import (
    InteractionMetrics,
    StateAnalysisResponse,
    InterventionParameters,
)


# ── Thresholds (tuned for orb interaction) ────────────────────────────────────

# Hold duration ranges (seconds)
SHORT_HOLD = 1.5
LONG_HOLD = 5.0

# Movement variance thresholds
LOW_VARIANCE = 0.15
HIGH_VARIANCE = 0.6

# Release speed thresholds
GENTLE_RELEASE = 0.3
FAST_RELEASE = 0.8

# Rhythm (lower = more erratic)
STEADY_RHYTHM = 0.6


# ── Classification Rules ──────────────────────────────────────────────────────

def classify_state(metrics: InteractionMetrics) -> StateAnalysisResponse:
    """
    Rule-based classification:
    ┌────────────────────┬───────────────────────────────────────────┐
    │ State              │ Signal                                    │
    ├────────────────────┼───────────────────────────────────────────┤
    │ overstimulated     │ Short hold, high variance, fast release   │
    │ anxious            │ Medium hold, erratic rhythm, high move    │
    │ fatigued           │ Long hold, low variance, slow release     │
    │ calm               │ Steady rhythm, moderate everything        │
    └────────────────────┴───────────────────────────────────────────┘
    """
    hd = metrics.hold_duration
    mv = metrics.movement_variance
    rs = metrics.release_speed
    ir = metrics.interaction_rhythm

    # ── Score each state ──────────────────────────────────────────────────
    scores: dict[str, float] = {
        "overstimulated": 0.0,
        "anxious": 0.0,
        "fatigued": 0.0,
        "calm": 0.0,
    }

    # Overstimulated: quick, jittery, fast release
    if hd < SHORT_HOLD:
        scores["overstimulated"] += 0.35
    if mv > HIGH_VARIANCE:
        scores["overstimulated"] += 0.35
    if rs > FAST_RELEASE:
        scores["overstimulated"] += 0.30

    # Anxious: erratic rhythm, moderate-high movement
    if ir < STEADY_RHYTHM:
        scores["anxious"] += 0.40
    if mv > LOW_VARIANCE:
        scores["anxious"] += 0.30
    if SHORT_HOLD <= hd <= LONG_HOLD:
        scores["anxious"] += 0.15
    if rs > GENTLE_RELEASE:
        scores["anxious"] += 0.15

    # Fatigued: long hold, low energy
    if hd > LONG_HOLD:
        scores["fatigued"] += 0.40
    if mv < LOW_VARIANCE:
        scores["fatigued"] += 0.30
    if rs < GENTLE_RELEASE:
        scores["fatigued"] += 0.30

    # Calm: steady everything
    if ir >= STEADY_RHYTHM:
        scores["calm"] += 0.35
    if LOW_VARIANCE <= mv <= HIGH_VARIANCE:
        scores["calm"] += 0.25
    if GENTLE_RELEASE <= rs <= FAST_RELEASE:
        scores["calm"] += 0.20
    if SHORT_HOLD <= hd <= LONG_HOLD:
        scores["calm"] += 0.20

    # Pick the winner
    state = max(scores, key=lambda k: scores[k])
    intensity = round(min(1.0, scores[state]), 2)

    # ── Map to intervention ───────────────────────────────────────────────
    params = _get_intervention(state, intensity)
    intervention_type = _get_intervention_type(state)

    return StateAnalysisResponse(
        emotional_state=state,
        intensity=intensity,
        intervention_type=intervention_type,
        parameters=params,
    )


def _get_intervention_type(state: str) -> str:
    return {
        "overstimulated": "breathing",
        "anxious": "breathing",
        "fatigued": "grounding",
        "calm": "stillness",
    }.get(state, "breathing")


def _get_intervention(state: str, intensity: float) -> InterventionParameters:
    """Return scene-morphing parameters tailored to the emotional state."""
    presets: dict[str, dict] = {
        "overstimulated": {
            "breath_speed": 5.5,
            "color": "#4A90E2",        # calming blue
            "particle_speed": 0.15,
            "camera_distance": 8.0,
            "orb_scale": 0.9,
            "ambient_intensity": 0.3,
        },
        "anxious": {
            "breath_speed": 4.5,
            "color": "#2DD4BF",        # teal – breathing association
            "particle_speed": 0.2,
            "camera_distance": 7.5,
            "orb_scale": 0.95,
            "ambient_intensity": 0.35,
        },
        "fatigued": {
            "breath_speed": 6.5,
            "color": "#A78BFA",        # soft lavender
            "particle_speed": 0.4,
            "camera_distance": 6.0,
            "orb_scale": 1.1,
            "ambient_intensity": 0.5,
        },
        "calm": {
            "breath_speed": 5.0,
            "color": "#4A90E2",
            "particle_speed": 0.25,
            "camera_distance": 7.0,
            "orb_scale": 1.0,
            "ambient_intensity": 0.4,
        },
    }

    base = presets.get(state, presets["calm"])

    # Modulate slightly by intensity
    base["breath_speed"] = round(base["breath_speed"] + (1 - intensity) * 0.5, 1)
    base["particle_speed"] = round(base["particle_speed"] * (1 - intensity * 0.3), 2)

    return InterventionParameters(**base)
