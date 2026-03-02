import cv2
import numpy as np
import threading
from deepface import DeepFace
from app.core.logging import logger

class EmotionService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EmotionService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.cap = None
        self.frame_scale = 0.5
        self._initialized = True
        logger.info("EmotionService initialized")

    def _get_cap(self):
        if self.cap is None or not self.cap.isOpened():
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                logger.error("Could not open webcam")
                return None
        return self.cap

    def load_models(self):
        """Pre-load models to avoid runtime initialization errors."""
        try:
            logger.info("Pre-loading DeepFace models...")
            # Use a dummy image to trigger model loading
            dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
            DeepFace.analyze(
                img_path=dummy_img,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="opencv",
                silent=True
            )
            logger.info("DeepFace models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to pre-load models: {e}")

    def detect_emotion(self):
        """Capture one frame and detect emotion."""
        with self._lock:
            cap = self._get_cap()
            if cap is None:
                return {"success": False, "message": "Camera not available"}

            ret, frame = cap.read()
            if not ret:
                logger.warning("Failed to grab frame")
                return {"success": False, "message": "Failed to grab frame"}

            # Standard mirroring for natural feeling
            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            
            # Analyze a smaller frame for speed
            small = cv2.resize(frame, (int(w * self.frame_scale), int(h * self.frame_scale)))
            
            try:
                # Use DeepFace analyze
                results = DeepFace.analyze(
                    img_path=small,
                    actions=["emotion"],
                    enforce_detection=False,
                    detector_backend="opencv",
                    silent=True,
                )
                
                if isinstance(results, list):
                    result = results[0]
                else:
                    result = results

                dominant_emotion = result.get("dominant_emotion", "neutral")
                confidence = result.get("emotion", {}).get(dominant_emotion, 0.0)

                return {
                    "success": True,
                    "emotion": dominant_emotion,
                    "confidence": confidence / 100.0,  # Normalize to 0-1
                }
            except Exception as e:
                logger.error(f"Emotion detection error: {e}")
                return {"success": False, "message": str(e)}

    def release(self):
        with self._lock:
            if self.cap is not None:
                self.cap.release()
                self.cap = None
                logger.info("Webcam released")

emotion_service = EmotionService()
