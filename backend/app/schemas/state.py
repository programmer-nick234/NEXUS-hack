"""
Emotional State Analysis – Schemas
===================================
Pydantic models for the interaction→classification→intervention pipeline.
"""

from pydantic import BaseModel, Field


class InteractionMetrics(BaseModel):
    """Captured from the user's physical interaction with the 3D orb."""
    hold_duration: float = Field(..., ge=0, description="Seconds the user held the orb")
    movement_variance: float = Field(..., ge=0, description="Variance of pointer/touch movement during hold")
    release_speed: float = Field(..., ge=0, description="Speed of the release gesture")
    interaction_rhythm: float = Field(..., ge=0, description="Regularity metric – lower = more erratic")


class InterventionParameters(BaseModel):
    """Parameters the frontend uses to morph the 3D scene."""
    breath_speed: float = Field(..., description="Seconds per full breath cycle")
    color: str = Field(..., description="Hex color for the intervention glow")
    particle_speed: float = Field(0.3, description="Particle drift multiplier (0-1)")
    camera_distance: float = Field(7.0, description="Camera pull-back distance")
    orb_scale: float = Field(1.0, description="Orb base scale during intervention")
    ambient_intensity: float = Field(0.4, description="Ambient light intensity")


class StateAnalysisResponse(BaseModel):
    """Returned by POST /analyze-state."""
    emotional_state: str = Field(..., description="Classified state: calm | anxious | overstimulated | fatigued")
    intensity: float = Field(..., ge=0, le=1, description="Intensity 0-1")
    intervention_type: str = Field(..., description="breathing | grounding | stillness")
    parameters: InterventionParameters


class SessionLogEntry(BaseModel):
    """Stored in MongoDB for analytics."""
    user_id: str | None = None
    metrics: InteractionMetrics
    result: StateAnalysisResponse
