"""
WebSocket — real-time emotion + gesture streaming.
====================================================
Client sends JPEG frames, server replies with FACS-based
emotion data + gesture analysis + suggestions in real time.
"""

import asyncio
import json
import time
import numpy as np
import cv2
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.advanced_emotion_engine import advanced_emotion_engine
from app.services.gesture_engine import gesture_engine
from app.services.suggestion_service import suggestion_service
from app.core.logging import logger

router = APIRouter(tags=["WebSocket"])

# Track active connections
_active: set[WebSocket] = set()


@router.websocket("/ws/emotion")
async def emotion_stream(ws: WebSocket):
    await ws.accept()
    _active.add(ws)
    logger.info(f"WS connected — {len(_active)} active")

    recent_emotions: list[str] = []
    used_interventions: list[str] = []
    frame_count = 0
    last_suggestion_time = 0.0

    try:
        while True:
            data = await ws.receive_bytes()
            frame_count += 1

            # Decode JPEG
            arr = np.frombuffer(data, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            # ── Advanced emotion analysis ─────────────────────────────
            result = advanced_emotion_engine.analyze_frame(frame)

            emotion = result.get("emotion", "neutral")
            confidence = result.get("confidence", 0)
            recent_emotions.append(emotion)
            if len(recent_emotions) > 20:
                recent_emotions = recent_emotions[-20:]

            face_rect = result.get("faceRect")

            # ── Gesture analysis ──────────────────────────────────────
            gesture_result = gesture_engine.analyze_frame(frame, face_rect)

            # Include suggestion every 5 seconds
            now = time.time()
            suggestion = None
            if now - last_suggestion_time >= 5.0:
                suggestion = suggestion_service.get_suggestion(
                    emotion=emotion,
                    confidence=confidence,
                    anxiety_score=0,
                    recent_emotions=recent_emotions[-10:],
                    used_interventions=used_interventions,
                )
                last_suggestion_time = now

            payload = {
                "type": "emotion",
                "frame": frame_count,
                "emotion": emotion,
                "confidence": confidence,
                "distribution": result.get("distribution", {}),
                "faceRect": result.get("faceRect"),
                "actionUnits": result.get("actionUnits", {}),
                "stability": result.get("stability", 0),
                "gestures": gesture_result,
            }
            if suggestion:
                payload["suggestion"] = suggestion

            await ws.send_text(json.dumps(payload))

    except WebSocketDisconnect:
        logger.info("WS disconnected")
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        _active.discard(ws)
        logger.info(f"WS cleanup — {len(_active)} active")
