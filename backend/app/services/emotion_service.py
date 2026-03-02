"""
Emotion detection service — production-grade OpenCV pipeline.
=============================================================
Multi-cascade face/eye/smile detection + EMA smoothing +
confidence calibration + all-emotion probability distribution.

DeepFace used when available; OpenCV-only fallback for Python 3.14.
"""

import cv2
import numpy as np
import threading
import time
from collections import deque
from app.core.logging import logger

# ── optional deep-learning backend ────────────────────────────────────────────
try:
    from deepface import DeepFace

    HAS_DEEPFACE = True
    logger.info("DeepFace available — deep learning emotion detection active")
except ImportError:
    HAS_DEEPFACE = False
    logger.warning("DeepFace unavailable — using OpenCV-only fallback")

# ── emotion constants ─────────────────────────────────────────────────────────
ALL_EMOTIONS = ("happy", "sad", "angry", "surprised", "fear", "neutral", "disgust")


class EmotionSmoother:
    """
    Exponential-moving-average smoother with hysteresis.
    Prevents flickering between emotions on consecutive frames.
    """

    def __init__(self, alpha: float = 0.35, history_len: int = 8, switch_threshold: float = 0.15):
        self._alpha = alpha
        self._probs: dict[str, float] = {e: 0.0 for e in ALL_EMOTIONS}
        self._probs["neutral"] = 1.0
        self._current = "neutral"
        self._history: deque[str] = deque(maxlen=history_len)
        self._switch_threshold = switch_threshold

    def update(self, raw_scores: dict[str, float]) -> dict:
        """Feed a new frame's raw scores and get smoothed result."""
        total = sum(raw_scores.values()) or 1.0
        normed = {e: raw_scores.get(e, 0.0) / total for e in ALL_EMOTIONS}

        for e in ALL_EMOTIONS:
            self._probs[e] = self._alpha * normed[e] + (1 - self._alpha) * self._probs[e]

        ptotal = sum(self._probs.values()) or 1.0
        for e in ALL_EMOTIONS:
            self._probs[e] /= ptotal

        best = max(self._probs, key=lambda k: self._probs[k])
        if self._probs[best] > self._probs[self._current] + self._switch_threshold:
            self._current = best

        self._history.append(self._current)

        return {
            "emotion": self._current,
            "confidence": round(self._probs[self._current], 3),
            "distribution": {e: round(v, 3) for e, v in self._probs.items()},
        }

    def reset(self):
        self._probs = {e: 0.0 for e in ALL_EMOTIONS}
        self._probs["neutral"] = 1.0
        self._current = "neutral"
        self._history.clear()


class EmotionService:
    """Singleton emotion analyser — thread-safe."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.cap = None
        self.frame_scale = 0.75          # process at 75% to keep good detail

        cascade_dir = cv2.data.haarcascades
        self.face_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_frontalface_default.xml")
        self.face_alt_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_frontalface_alt2.xml")
        self.eye_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_eye.xml")
        self.smile_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_smile.xml")
        self.profile_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_profileface.xml")

        self.smoother = EmotionSmoother()
        self._frame_count = 0
        self._last_ts = time.time()

        self._initialized = True
        logger.info("EmotionService initialised (multi-cascade + EMA smoother)")

    def load_models(self):
        if HAS_DEEPFACE:
            try:
                logger.info("Pre-loading DeepFace models …")
                DeepFace.analyze(
                    img_path=np.zeros((100, 100, 3), dtype=np.uint8),
                    actions=["emotion"], enforce_detection=False,
                    detector_backend="opencv", silent=True,
                )
                logger.info("DeepFace models ready")
            except Exception as e:
                logger.error(f"DeepFace pre-load failed: {e}")
        else:
            logger.info("OpenCV-only — no models to pre-load")

    # ── OpenCV multi-cascade pipeline ─────────────────────────────────────

    def _extract_features(self, frame: np.ndarray) -> dict | None:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Apply CLAHE for better local contrast (works much better than equalizeHist)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        # Try primary cascade first, then fall back to alt2 cascade
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=4, minSize=(40, 40),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )
        if len(faces) == 0:
            faces = self.face_alt_cascade.detectMultiScale(
                gray, scaleFactor=1.05, minNeighbors=3, minSize=(40, 40),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
        if len(faces) == 0:
            # Try profile face as last resort
            faces = self.profile_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=3, minSize=(40, 40),
            )
        if len(faces) == 0:
            return None

        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        face = gray[y: y + h, x: x + w]

        # Eyes — scan upper 55% of face (forehead + eyes)
        upper = face[0: int(h * 0.55), :]
        eyes = self.eye_cascade.detectMultiScale(upper, 1.05, 3, minSize=(15, 15))
        n_eyes = min(len(eyes), 2)
        eye_openness = 0.0
        if n_eyes > 0:
            ratios = [eh / ew for (_, _, ew, eh) in eyes[:2] if ew > 0]
            eye_openness = sum(ratios) / len(ratios) if ratios else 0

        # Smile — scan lower 50% of face
        lower = face[h // 2:, :]
        smiles = self.smile_cascade.detectMultiScale(lower, 1.5, 15, minSize=(20, 10))
        has_smile = len(smiles) > 0
        smile_ratio = 0.0
        if has_smile:
            sw = max(smiles, key=lambda s: s[2] * s[3])[2]
            smile_ratio = sw / w

        # Mouth region analysis for more emotion cues
        mouth_region = face[int(h * 0.6):, :]
        mouth_mean = float(np.mean(mouth_region)) if mouth_region.size > 0 else 0
        mouth_std = float(np.std(mouth_region)) if mouth_region.size > 0 else 0

        # Brow region for furrowing detection
        brow_region = face[int(h * 0.15): int(h * 0.35), :]
        brow_std = float(np.std(brow_region)) if brow_region.size > 0 else 0

        mean_val = float(np.mean(face))
        std_val = float(np.std(face))
        face_ar = h / w if w else 1.0

        return {
            "n_eyes": n_eyes, "eye_openness": eye_openness,
            "has_smile": has_smile, "smile_ratio": smile_ratio,
            "mean": mean_val, "std": std_val, "face_ar": face_ar,
            "mouth_mean": mouth_mean, "mouth_std": mouth_std,
            "brow_std": brow_std,
            "face_rect": (int(x), int(y), int(w), int(h)),
        }

    def _score_emotions(self, ft: dict) -> dict[str, float]:
        s: dict[str, float] = {e: 0.0 for e in ALL_EMOTIONS}

        # ── Smile → happy ────────────────────────────────────────────
        if ft["has_smile"]:
            s["happy"] += 0.55 + ft["smile_ratio"] * 0.40
        else:
            s["sad"] += 0.06
            s["angry"] += 0.04

        # ── Eyes → surprised / fear / angry ──────────────────────────
        if ft["eye_openness"] > 0.50:
            s["surprised"] += 0.40
            s["fear"] += 0.20
        elif ft["eye_openness"] < 0.28 and ft["n_eyes"] >= 1:
            s["angry"] += 0.25
            s["disgust"] += 0.15

        # ── Brow furrowing → angry / disgust ─────────────────────────
        brow_std = ft.get("brow_std", 0)
        if brow_std > 45:
            s["angry"] += 0.18
            s["disgust"] += 0.10
        elif brow_std > 30:
            s["sad"] += 0.10
            s["fear"] += 0.08

        # ── Mouth activity → sad / fear ──────────────────────────────
        mouth_std = ft.get("mouth_std", 0)
        mouth_mean = ft.get("mouth_mean", 0)
        if mouth_std > 50 and not ft["has_smile"]:
            s["sad"] += 0.15
            s["fear"] += 0.10
        if mouth_mean < 80 and not ft["has_smile"]:
            s["sad"] += 0.10

        # ── Overall face contrast ────────────────────────────────────
        if ft["std"] > 55:
            s["surprised"] += 0.10
            s["angry"] += 0.06
        elif ft["std"] < 28:
            s["sad"] += 0.12
            s["fear"] += 0.08

        # ── Overall brightness ───────────────────────────────────────
        if ft["mean"] < 90:
            s["sad"] += 0.10
            s["fear"] += 0.06
        elif ft["mean"] > 170:
            s["happy"] += 0.06

        # ── Face aspect ratio ────────────────────────────────────────
        if ft["face_ar"] > 1.35:
            s["angry"] += 0.08
            s["fear"] += 0.05

        # ── Neutral baseline (lower to allow emotions to dominate) ───
        s["neutral"] += 0.18
        return s

    def _opencv_analyze(self, frame: np.ndarray) -> dict:
        ft = self._extract_features(frame)
        if ft is None:
            return self.smoother.update({"neutral": 1.0})
        raw = self._score_emotions(ft)
        result = self.smoother.update(raw)
        result["faceRect"] = ft["face_rect"]
        return result

    def _deepface_analyze(self, frame: np.ndarray) -> dict | None:
        if not HAS_DEEPFACE:
            return None
        try:
            results = DeepFace.analyze(
                img_path=frame, actions=["emotion"],
                enforce_detection=False, detector_backend="opencv", silent=True,
            )
            r = results[0] if isinstance(results, list) else results
            raw_scores = {k.lower(): v / 100.0 for k, v in r.get("emotion", {}).items()}
            return self.smoother.update(raw_scores)
        except Exception as e:
            logger.error(f"DeepFace error: {e}")
            return None

    # ── public API ────────────────────────────────────────────────────────

    def detect_emotion_from_image(self, image_bytes: bytes) -> dict:
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"success": False, "emotion": "neutral", "confidence": 0, "distribution": {}}

        # Scale down large images for perf while keeping good detail
        h, w = frame.shape[:2]
        if max(h, w) > 800:
            scale = 800 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        self._frame_count += 1
        deep = self._deepface_analyze(frame)
        result = deep if deep else self._opencv_analyze(frame)
        result["success"] = True
        result["frameIndex"] = self._frame_count
        return result

    def detect_emotion(self):
        with self._lock:
            cap = self._get_cap()
            if cap is None:
                return {"success": False, "message": "Camera not available"}
            ret, frame = cap.read()
            if not ret:
                return {"success": False, "message": "Failed to grab frame"}
            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            small = cv2.resize(frame, (int(w * self.frame_scale), int(h * self.frame_scale)))
            deep = self._deepface_analyze(small)
            result = deep if deep else self._opencv_analyze(small)
            result["success"] = True
            return result

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
            self.smoother.reset()
            logger.info("EmotionService released")


emotion_service = EmotionService()
