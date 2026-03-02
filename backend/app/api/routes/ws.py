"""
WebSocket — real-time emotion streaming.
==========================================
Client sends JPEG frames, server replies with smoothed
emotion data + suggestions in real time.
"""

import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.emotion_service import emotion_service
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

            # Analyse emotion from JPEG bytes
            result = emotion_service.detect_emotion_from_image(data)

            emotion = result.get("emotion", "neutral")
            confidence = result.get("confidence", 0)
            recent_emotions.append(emotion)
            if len(recent_emotions) > 20:
                recent_emotions = recent_emotions[-20:]

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
