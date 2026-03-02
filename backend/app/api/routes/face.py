"""
Face Detection – Advanced Emotion + Gesture Analysis
=====================================================
Accepts a JPEG/PNG frame from the browser webcam and returns
FACS-based Action-Unit emotion classification + camera-based
hand gesture detection + head pose + micro-expression data.
"""

import numpy as np
import cv2
from fastapi import APIRouter, File, UploadFile
from app.services.advanced_emotion_engine import advanced_emotion_engine
from app.services.gesture_engine import gesture_engine

router = APIRouter(prefix="/face", tags=["Face Detection"])


@router.post("/analyze")
async def analyze_face(
    file: UploadFile = File(..., description="Webcam frame (JPEG/PNG)"),
):
    """
    Accept an image captured by the *browser's* webcam and run:
      1. FACS Action-Unit emotion classification (advanced engine)
      2. Hand gesture detection (skin segmentation + convex hull)
      3. Head pose estimation
      4. Micro-expression detection
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

    # Decode image
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return {
            "success": False,
            "emotion": "neutral",
            "confidence": 0,
            "message": "Could not decode image",
        }

    # ── Advanced emotion analysis ─────────────────────────────────────
    emotion_result = advanced_emotion_engine.analyze_frame(frame)

    face_rect = emotion_result.get("faceRect")

    # ── Gesture analysis (hand + head + micro-expression) ─────────────
    gesture_result = gesture_engine.analyze_frame(frame, face_rect)

    # ── Merge results ─────────────────────────────────────────────────
    return {
        **emotion_result,
        "gestures": gesture_result,
    }
