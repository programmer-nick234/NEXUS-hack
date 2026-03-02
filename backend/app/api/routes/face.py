"""
Face Detection – PLACEHOLDER Endpoint
======================================
The actual OpenCV face detection model is handled by another team member.
This module provides an integration-ready structure with a dummy response.
"""

from fastapi import APIRouter, File, UploadFile

from app.api.deps import CurrentUser

router = APIRouter(prefix="/face", tags=["Face Detection"])


@router.post("/analyze")
async def analyze_face(
    _user: CurrentUser,
    file: UploadFile = File(..., description="Image file for face analysis"),
):
    """
    PLACEHOLDER – Accept an image file and return a dummy face detection response.

    Integration notes:
    ─────────────────
    • Replace the dummy response below with a call to the OpenCV processing service.
    • The uploaded file is available via `file.file` (SpooledTemporaryFile) or
      `await file.read()` for raw bytes.
    • Expected to return: facesDetected, confidence, emotion, bounding boxes, etc.
    """
    # Validate basic content type
    if file.content_type and not file.content_type.startswith("image/"):
        return {
            "success": False,
            "data": None,
            "message": "Uploaded file must be an image",
        }

    # ── Dummy response (replace with OpenCV integration) ──────────────────
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
