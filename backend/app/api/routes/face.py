"""
Face Detection – Image Upload Endpoint
=======================================
Accepts a JPEG/PNG frame from the browser webcam and returns
emotion classification via OpenCV (or DeepFace when available).
"""

from fastapi import APIRouter, File, UploadFile
from app.services.emotion_service import emotion_service

router = APIRouter(prefix="/face", tags=["Face Detection"])


@router.post("/analyze")
async def analyze_face(
    file: UploadFile = File(..., description="Webcam frame (JPEG/PNG)"),
):
    """
    Accept an image captured by the *browser's* webcam and run
    face-detection + emotion classification on it.
    """
    if file.content_type and not file.content_type.startswith("image/"):
        return {
            "success": False,
            "emotion": "neutral",
            "confidence": 0,
            "message": "Uploaded file must be an image",
        }

    image_bytes = await file.read()
    if not image_bytes:
        return {
            "success": False,
            "emotion": "neutral",
            "confidence": 0,
            "message": "Empty file",
        }

    result = emotion_service.detect_emotion_from_image(image_bytes)
    return result
