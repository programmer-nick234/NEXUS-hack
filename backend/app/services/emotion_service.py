"""
Emotion detection service — OpenCV-only (no TensorFlow required).
Uses Haar cascades for face / eye / smile detection and a multi-feature
heuristic for emotion classification.
DeepFace is used when available; otherwise falls back to OpenCV-only.
"""

import cv2
import numpy as np
import threading
from app.core.logging import logger

# Try to import DeepFace (requires TensorFlow which needs Python <3.14)
try:
    from deepface import DeepFace
    HAS_DEEPFACE = True
    logger.info("DeepFace available — using deep learning emotion detection")
except ImportError:
    HAS_DEEPFACE = False
    logger.warning("DeepFace not available (Python 3.14?) — using OpenCV-only fallback")


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

        # Load multiple Haar cascades for richer feature extraction
        cascade_dir = cv2.data.haarcascades
        self.face_cascade = cv2.CascadeClassifier(
            cascade_dir + "haarcascade_frontalface_default.xml"
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cascade_dir + "haarcascade_eye.xml"
        )
        self.smile_cascade = cv2.CascadeClassifier(
            cascade_dir + "haarcascade_smile.xml"
        )

        # Smoothing buffer — keeps last N results for temporal stability
        self._history: list[str] = []
        self._history_max = 5

        self._initialized = True
        logger.info("EmotionService initialized (multi-cascade)")

    # ── internal helpers ──────────────────────────────────────────────────

    def _smooth_emotion(self, raw_emotion: str) -> str:
        """Return the most common emotion over the last N frames."""
        self._history.append(raw_emotion)
        if len(self._history) > self._history_max:
            self._history = self._history[-self._history_max:]
        from collections import Counter
        return Counter(self._history).most_common(1)[0][0]

    # ── public API ────────────────────────────────────────────────────────

    def load_models(self):
        """Pre-load models to avoid runtime initialisation errors."""
        if HAS_DEEPFACE:
            try:
                logger.info("Pre-loading DeepFace models…")
                dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
                DeepFace.analyze(
                    img_path=dummy_img,
                    actions=["emotion"],
                    enforce_detection=False,
                    detector_backend="opencv",
                    silent=True,
                )
                logger.info("DeepFace models loaded successfully")
            except Exception as e:
                logger.error(f"Failed to pre-load DeepFace models: {e}")
        else:
            logger.info("Using OpenCV-only fallback — no models to pre-load")

    # ── OpenCV multi-cascade fallback ─────────────────────────────────────

    def _opencv_fallback_emotion(self, frame: np.ndarray) -> dict:
        """
        Multi-feature emotion estimation:
         1. Detect face → crop ROI
         2. Detect eyes (count, openness ratio)
         3. Detect smile (presence, width)
         4. Compute brightness / contrast of face ROI
         5. Combine features into a rule score for each emotion
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # histogram equalisation for better feature detection
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=6, minSize=(60, 60)
        )

        if len(faces) == 0:
            return {"success": True, "emotion": self._smooth_emotion("neutral"), "confidence": 0.3}

        # take the largest face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        face_gray = gray[y: y + h, x: x + w]
        face_bgr = frame[y: y + h, x: x + w]

        # ── feature: eyes ────────────────────────────────────────────────
        upper_half = face_gray[0: h // 2, :]
        eyes = self.eye_cascade.detectMultiScale(
            upper_half, scaleFactor=1.05, minNeighbors=4, minSize=(20, 20)
        )
        n_eyes = min(len(eyes), 2)

        # average eye-openness (height/width ratio of eye bounding box)
        eye_openness = 0.0
        if n_eyes > 0:
            ratios = [eh / ew for (_, _, ew, eh) in eyes[:2] if ew > 0]
            eye_openness = sum(ratios) / len(ratios) if ratios else 0

        # ── feature: smile ───────────────────────────────────────────────
        lower_half = face_gray[h // 2:, :]
        smiles = self.smile_cascade.detectMultiScale(
            lower_half, scaleFactor=1.7, minNeighbors=20, minSize=(25, 15)
        )
        has_smile = len(smiles) > 0
        smile_width_ratio = 0.0
        if has_smile:
            sx, sy, sw, sh = max(smiles, key=lambda s: s[2] * s[3])
            smile_width_ratio = sw / w  # relative to face width

        # ── feature: brightness / contrast ───────────────────────────────
        mean_val = float(np.mean(face_gray))
        std_val = float(np.std(face_gray))

        # ── feature: face aspect ratio (furrowed brow → taller) ─────────
        face_ar = h / w if w > 0 else 1.0

        # ── scoring ──────────────────────────────────────────────────────
        scores: dict[str, float] = {
            "happy": 0, "sad": 0, "angry": 0,
            "surprised": 0, "fear": 0, "neutral": 0, "disgust": 0,
        }

        # smile presence → happy
        if has_smile:
            scores["happy"] += 0.45 + smile_width_ratio * 0.3
        else:
            scores["sad"] += 0.10
            scores["angry"] += 0.08

        # wide-open eyes → surprised or fear
        if eye_openness > 0.55:
            scores["surprised"] += 0.35
            scores["fear"] += 0.20
        elif eye_openness < 0.25 and n_eyes >= 1:
            scores["angry"] += 0.20
            scores["disgust"] += 0.10

        # high contrast → more expressive
        if std_val > 55:
            scores["surprised"] += 0.15
            scores["angry"] += 0.10
        elif std_val < 28:
            scores["sad"] += 0.15
            scores["fear"] += 0.10

        # low brightness → negative valence
        if mean_val < 90:
            scores["sad"] += 0.15
            scores["fear"] += 0.10
        elif mean_val > 170:
            scores["happy"] += 0.10

        # taller face AR → furrowed/tense
        if face_ar > 1.35:
            scores["angry"] += 0.12
            scores["fear"] += 0.08

        # baseline neutral
        scores["neutral"] += 0.30

        # pick winner
        raw_emotion = max(scores, key=lambda k: scores[k])
        max_score = scores[raw_emotion]
        total = sum(scores.values()) or 1.0
        raw_conf = max_score / total

        # temporal smoothing
        smoothed = self._smooth_emotion(raw_emotion)
        conf = round(min(raw_conf + 0.10, 0.95), 2)  # small confidence boost

        return {"success": True, "emotion": smoothed, "confidence": conf}

    # ── DeepFace helper ───────────────────────────────────────────────────

    def _deepface_analyze(self, frame: np.ndarray) -> dict | None:
        if not HAS_DEEPFACE:
            return None
        try:
            results = DeepFace.analyze(
                img_path=frame,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="opencv",
                silent=True,
            )
            result = results[0] if isinstance(results, list) else results
            dominant = result.get("dominant_emotion", "neutral")
            conf = result.get("emotion", {}).get(dominant, 0.0)
            return {
                "success": True,
                "emotion": dominant,
                "confidence": round(conf / 100.0, 2),
            }
        except Exception as e:
            logger.error(f"DeepFace error: {e}")
            return None

    # ── public: detect from uploaded image bytes ──────────────────────────

    def detect_emotion_from_image(self, image_bytes: bytes) -> dict:
        """Detect emotion from an uploaded image (bytes)."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"success": False, "emotion": "neutral", "confidence": 0, "message": "Could not decode image"}

        deep = self._deepface_analyze(frame)
        if deep:
            return deep

        return self._opencv_fallback_emotion(frame)

    # ── public: detect from server webcam (kept for backward compat) ──────

    def detect_emotion(self):
        """Capture one frame from the server webcam and detect emotion."""
        with self._lock:
            cap = self._get_cap()
            if cap is None:
                return {"success": False, "message": "Camera not available"}

            ret, frame = cap.read()
            if not ret:
                logger.warning("Failed to grab frame")
                return {"success": False, "message": "Failed to grab frame"}

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            small = cv2.resize(
                frame, (int(w * self.frame_scale), int(h * self.frame_scale))
            )

            deep = self._deepface_analyze(small)
            if deep:
                return deep
            return self._opencv_fallback_emotion(small)

    def _get_cap(self):
        if self.cap is None or not self.cap.isOpened():
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                logger.error("Could not open webcam")
                return None
        return self.cap

    def release(self):
        with self._lock:
            if self.cap is not None:
                self.cap.release()
                self.cap = None
                logger.info("Webcam released")


emotion_service = EmotionService()