"""
Face Detection – PLACEHOLDER Endpoint
======================================
The actual OpenCV face detection model is handled by another team member.
This module provides an integration-ready structure with a dummy response.
"""

from fastapi import APIRouter, File, UploadFile
from app.api.deps import CurrentUser
from app.services.emotion_service import emotion_service

router = APIRouter(prefix="/face", tags=["Face Detection"])

@router.get("/detect-emotion")
async def detect_realtime_emotion():
    """
    Perform real-time emotion detection using the server's webcam.
    (Alternative UI Polling Endpoint)
    """
    result = emotion_service.detect_emotion()
    return result

@router.post("/analyze")
async def analyze_face(
    _user: CurrentUser,
    file: UploadFile = File(..., description="Image file for face analysis"),
):
    """
    PLACEHOLDER – Accept an image file and return a dummy face detection response.
    """
    # ... existing code ...
    if file.content_type and not file.content_type.startswith("image/"):
        return {
            "success": False,
            "data": None,
            "message": "Uploaded file must be an image",
        }

    return {
        "success": True,
        "data": {
            "facesDetected": 1,
            "confidence": 0.92,
            "emotion": "neutral",
            "note": "OpenCV logic handled externally",
        },
        "message": "Face analysis complete (placeholder)",
    }
