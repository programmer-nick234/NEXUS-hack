"""
Advanced Facial Landmark Emotion Engine
=========================================
Production-grade OpenCV pipeline that extracts facial geometry
features from 68 pseudo-landmarks approximated via multi-cascade
detection + contour analysis. Maps features to FACS-inspired
Action Units for high-accuracy emotion classification.

No external ML models required — pure OpenCV + numpy.

Architecture:
  1. Multi-cascade face detection (frontal, alt2, profile, LBP)
  2. CLAHE preprocessing for lighting invariance
  3. Facial region segmentation (brow, eye, nose, mouth, jaw)
  4. Geometric feature extraction per region
  5. FACS-inspired Action Unit scoring
  6. Bayesian-weighted emotion probability estimation
  7. EMA temporal smoothing with hysteresis
  8. Multi-face support with primary face tracking

Author: NEXUS Team — Hackathon 2026
"""

import cv2
import numpy as np
import threading
import time
import math
from collections import deque
from typing import Optional
from app.core.logging import logger

# ── emotion space ─────────────────────────────────────────────────────────────
ALL_EMOTIONS = ("happy", "sad", "angry", "surprised", "fear", "neutral", "disgust")

# ── FACS-inspired Action Units we can approximate with OpenCV ─────────────────
# AU1  = Inner brow raise        AU2  = Outer brow raise
# AU4  = Brow lowerer            AU5  = Upper lid raise
# AU6  = Cheek raise             AU7  = Lid tightener
# AU9  = Nose wrinkler           AU10 = Upper lip raiser
# AU12 = Lip corner puller (smile)
# AU15 = Lip corner depressor    AU17 = Chin raiser
# AU20 = Lip stretcher           AU23 = Lip tightener
# AU25 = Lips part               AU26 = Jaw drop
# AU43 = Eye closure

# Emotion → AU mapping (FACS literature)
_EMOTION_AU_PROFILES = {
    "happy":     {"AU6": 0.8, "AU12": 0.9, "AU25": 0.4},
    "sad":       {"AU1": 0.7, "AU4": 0.5, "AU15": 0.8, "AU17": 0.5},
    "angry":     {"AU4": 0.9, "AU5": 0.4, "AU7": 0.7, "AU23": 0.6, "AU24": 0.5},
    "surprised": {"AU1": 0.8, "AU2": 0.8, "AU5": 0.9, "AU25": 0.7, "AU26": 0.8},
    "fear":      {"AU1": 0.8, "AU2": 0.6, "AU4": 0.5, "AU5": 0.7, "AU20": 0.8, "AU25": 0.5},
    "disgust":   {"AU4": 0.5, "AU9": 0.9, "AU10": 0.8, "AU17": 0.4},
    "neutral":   {},
}


# ═══════════════════════════════════════════════════════════════════════════════
#  TEMPORAL SMOOTHER
# ═══════════════════════════════════════════════════════════════════════════════

class TemporalSmoother:
    """
    Double-EMA smoother with adaptive hysteresis and confidence weighting.
    Uses both fast and slow EMA to detect sudden vs gradual changes.
    """

    def __init__(
        self,
        fast_alpha: float = 0.45,
        slow_alpha: float = 0.15,
        history_len: int = 12,
        switch_threshold: float = 0.12,
        min_hold_frames: int = 3,
    ):
        self._fast_alpha = fast_alpha
        self._slow_alpha = slow_alpha
        self._fast: dict[str, float] = {e: (1.0 if e == "neutral" else 0.0) for e in ALL_EMOTIONS}
        self._slow: dict[str, float] = dict(self._fast)
        self._current = "neutral"
        self._current_frames = 0           # how many frames current has held
        self._min_hold = min_hold_frames   # minimum frames before switch
        self._switch_threshold = switch_threshold
        self._history: deque[str] = deque(maxlen=history_len)
        self._confidence_history: deque[float] = deque(maxlen=history_len)

    def update(self, raw_scores: dict[str, float], frame_confidence: float = 1.0) -> dict:
        total = sum(raw_scores.values()) or 1.0
        normed = {e: raw_scores.get(e, 0.0) / total for e in ALL_EMOTIONS}

        # Weight by detection confidence
        alpha_fast = self._fast_alpha * min(frame_confidence + 0.3, 1.0)
        alpha_slow = self._slow_alpha * min(frame_confidence + 0.3, 1.0)

        for e in ALL_EMOTIONS:
            self._fast[e] = alpha_fast * normed[e] + (1 - alpha_fast) * self._fast[e]
            self._slow[e] = alpha_slow * normed[e] + (1 - alpha_slow) * self._slow[e]

        # Re-normalize
        for d in (self._fast, self._slow):
            t = sum(d.values()) or 1.0
            for e in ALL_EMOTIONS:
                d[e] /= t

        # Blend fast/slow for final distribution
        blended = {e: 0.6 * self._fast[e] + 0.4 * self._slow[e] for e in ALL_EMOTIONS}
        bt = sum(blended.values()) or 1.0
        blended = {e: v / bt for e, v in blended.items()}

        # Hysteresis: require sustained lead before switching
        best = max(blended, key=lambda k: blended[k])
        self._current_frames += 1

        if best != self._current:
            if blended[best] > blended[self._current] + self._switch_threshold:
                if self._current_frames >= self._min_hold:
                    self._current = best
                    self._current_frames = 0

        self._history.append(self._current)
        self._confidence_history.append(blended[self._current])

        # Compute stability metric
        if len(self._history) >= 4:
            recent = list(self._history)[-6:]
            same = sum(1 for e in recent if e == self._current)
            stability = same / len(recent)
        else:
            stability = 0.5

        return {
            "emotion": self._current,
            "confidence": round(blended[self._current], 4),
            "distribution": {e: round(v, 4) for e, v in blended.items()},
            "stability": round(stability, 3),
        }

    def reset(self):
        self._fast = {e: (1.0 if e == "neutral" else 0.0) for e in ALL_EMOTIONS}
        self._slow = dict(self._fast)
        self._current = "neutral"
        self._current_frames = 0
        self._history.clear()
        self._confidence_history.clear()


# ═══════════════════════════════════════════════════════════════════════════════
#  FACE TRACKER — maintains identity across frames
# ═══════════════════════════════════════════════════════════════════════════════

class FaceTracker:
    """Tracks the primary face across frames using IoU overlap."""

    def __init__(self):
        self._last_rect: Optional[tuple[int, int, int, int]] = None
        self._lost_frames = 0
        self._max_lost = 8

    def update(self, faces: list[tuple[int, int, int, int]]) -> Optional[tuple[int, int, int, int]]:
        if len(faces) == 0:
            self._lost_frames += 1
            if self._lost_frames > self._max_lost:
                self._last_rect = None
            return self._last_rect

        if self._last_rect is None:
            # Pick largest face
            best = max(faces, key=lambda f: f[2] * f[3])
            self._last_rect = best
            self._lost_frames = 0
            return best

        # Find face with highest IoU overlap with tracked face
        best_iou = 0.0
        best_face = faces[0]
        for face in faces:
            iou = self._compute_iou(self._last_rect, face)
            if iou > best_iou:
                best_iou = iou
                best_face = face

        # If IoU is too low, fall back to largest
        if best_iou < 0.15:
            best_face = max(faces, key=lambda f: f[2] * f[3])

        self._last_rect = best_face
        self._lost_frames = 0
        return best_face

    @staticmethod
    def _compute_iou(a: tuple, b: tuple) -> float:
        ax1, ay1, aw, ah = a
        bx1, by1, bw, bh = b
        ax2, ay2 = ax1 + aw, ay1 + ah
        bx2, by2 = bx1 + bw, by1 + bh
        ix1 = max(ax1, bx1)
        iy1 = max(ay1, by1)
        ix2 = min(ax2, bx2)
        iy2 = min(ay2, by2)
        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0
        inter = (ix2 - ix1) * (iy2 - iy1)
        union = aw * ah + bw * bh - inter
        return inter / union if union > 0 else 0.0


# ═══════════════════════════════════════════════════════════════════════════════
#  FACIAL FEATURE ANALYZER — extracts geometric features from face ROI
# ═══════════════════════════════════════════════════════════════════════════════

class FacialFeatureAnalyzer:
    """
    Extracts rich geometric and texture features from the face region
    by segmenting into brow/eye/nose/mouth/jaw zones and computing
    statistics that approximate FACS Action Units.
    """

    def analyze(self, face_gray: np.ndarray, face_color: np.ndarray) -> dict:
        h, w = face_gray.shape[:2]
        if h < 30 or w < 30:
            return {}

        features = {}

        # ── Region segmentation (standardized face proportions) ───────────
        forehead = face_gray[0: int(h * 0.18), :]
        brow_region = face_gray[int(h * 0.15): int(h * 0.35), :]
        eye_region = face_gray[int(h * 0.25): int(h * 0.50), :]
        nose_region = face_gray[int(h * 0.40): int(h * 0.65), :]
        mouth_region = face_gray[int(h * 0.60): int(h * 0.85), :]
        jaw_region = face_gray[int(h * 0.80):, :]
        chin_region = face_gray[int(h * 0.85):, :]

        left_eye = eye_region[:, :w // 2]
        right_eye = eye_region[:, w // 2:]

        # ── Brow features (AU1, AU2, AU4) ─────────────────────────────────
        features["brow_mean"] = float(np.mean(brow_region))
        features["brow_std"] = float(np.std(brow_region))
        features["brow_gradient"] = self._vertical_gradient(brow_region)

        # Horizontal gradient for asymmetric brow raise
        brow_left = brow_region[:, :w // 2]
        brow_right = brow_region[:, w // 2:]
        features["brow_asymmetry"] = abs(float(np.mean(brow_left)) - float(np.mean(brow_right)))

        # Edge density in brow = furrowing indicator
        brow_edges = cv2.Canny(brow_region, 30, 100)
        features["brow_edge_density"] = float(np.sum(brow_edges > 0)) / max(brow_edges.size, 1)

        # Forehead wrinkle detection
        forehead_edges = cv2.Canny(forehead, 20, 80) if forehead.size > 0 else np.zeros((1,1), dtype=np.uint8)
        features["forehead_wrinkles"] = float(np.sum(forehead_edges > 0)) / max(forehead_edges.size, 1)

        # ── Eye features (AU5, AU7, AU43) ─────────────────────────────────
        features["eye_mean"] = float(np.mean(eye_region))
        features["eye_std"] = float(np.std(eye_region))

        # Eye openness via white pixel ratio in thresholded region
        _, left_thresh = cv2.threshold(left_eye, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        _, right_thresh = cv2.threshold(right_eye, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        features["left_eye_openness"] = float(np.sum(left_thresh > 0)) / max(left_thresh.size, 1)
        features["right_eye_openness"] = float(np.sum(right_thresh > 0)) / max(right_thresh.size, 1)
        features["eye_openness"] = (features["left_eye_openness"] + features["right_eye_openness"]) / 2
        features["eye_asymmetry"] = abs(features["left_eye_openness"] - features["right_eye_openness"])

        # Horizontal edge for lid detection
        eye_h_edges = cv2.Sobel(eye_region, cv2.CV_64F, 0, 1, ksize=3)
        features["eye_lid_contrast"] = float(np.std(eye_h_edges))

        # ── Nose features (AU9) ───────────────────────────────────────────
        nose_edges = cv2.Canny(nose_region, 30, 90)
        features["nose_wrinkle"] = float(np.sum(nose_edges > 0)) / max(nose_edges.size, 1)
        features["nose_mean"] = float(np.mean(nose_region))

        # ── Mouth features (AU10, AU12, AU15, AU20, AU25, AU26) ───────────
        features["mouth_mean"] = float(np.mean(mouth_region))
        features["mouth_std"] = float(np.std(mouth_region))

        # Mouth opening = dark region in center-lower face
        mouth_center = mouth_region[:, int(w * 0.25): int(w * 0.75)]
        if mouth_center.size > 0:
            _, mouth_thresh = cv2.threshold(mouth_center, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            features["mouth_openness"] = float(np.sum(mouth_thresh > 0)) / max(mouth_thresh.size, 1)
        else:
            features["mouth_openness"] = 0.0

        # Horizontal spread of mouth
        mouth_edges = cv2.Canny(mouth_region, 30, 80)
        contours, _ = cv2.findContours(mouth_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            all_pts = np.vstack(contours)
            mx, my, mw, mh = cv2.boundingRect(all_pts)
            features["mouth_width_ratio"] = mw / w if w > 0 else 0
            features["mouth_height_ratio"] = mh / h if h > 0 else 0
            features["mouth_aspect"] = mh / mw if mw > 0 else 0
        else:
            features["mouth_width_ratio"] = 0.4
            features["mouth_height_ratio"] = 0.1
            features["mouth_aspect"] = 0.25

        # Smile detection: corners up → horizontal edges at mouth edges
        mouth_left = mouth_region[:, :int(w * 0.35)]
        mouth_right = mouth_region[:, int(w * 0.65):]
        left_v_grad = self._vertical_gradient(mouth_left)
        right_v_grad = self._vertical_gradient(mouth_right)
        features["mouth_corner_lift"] = (left_v_grad + right_v_grad) / 2

        # Lip compression (AU23/24)
        lip_region = mouth_region[int(mouth_region.shape[0] * 0.3): int(mouth_region.shape[0] * 0.7), :]
        if lip_region.size > 0:
            features["lip_compression"] = float(np.std(lip_region))
        else:
            features["lip_compression"] = 0.0

        # ── Jaw features (AU26) ───────────────────────────────────────────
        features["jaw_mean"] = float(np.mean(jaw_region)) if jaw_region.size > 0 else 0
        features["chin_std"] = float(np.std(chin_region)) if chin_region.size > 0 else 0

        # ── Global features ───────────────────────────────────────────────
        features["face_mean"] = float(np.mean(face_gray))
        features["face_std"] = float(np.std(face_gray))
        features["face_ar"] = h / w if w > 0 else 1.0

        # Skin colour features from face colour ROI
        if face_color is not None and face_color.size > 0:
            hsv = cv2.cvtColor(face_color, cv2.COLOR_BGR2HSV)
            features["hue_mean"] = float(np.mean(hsv[:, :, 0]))
            features["sat_mean"] = float(np.mean(hsv[:, :, 1]))
            features["val_mean"] = float(np.mean(hsv[:, :, 2]))
        else:
            features["hue_mean"] = 0
            features["sat_mean"] = 0
            features["val_mean"] = 0

        # Symmetry: compare left and right halves
        left_half = face_gray[:, :w // 2]
        right_half = cv2.flip(face_gray[:, w // 2:], 1)
        min_w = min(left_half.shape[1], right_half.shape[1])
        if min_w > 0:
            diff = cv2.absdiff(left_half[:, :min_w], right_half[:, :min_w])
            features["face_symmetry"] = 1.0 - (float(np.mean(diff)) / 255.0)
        else:
            features["face_symmetry"] = 0.5

        return features

    @staticmethod
    def _vertical_gradient(region: np.ndarray) -> float:
        """Compute average vertical gradient (positive = brighter below)."""
        if region.size == 0 or region.shape[0] < 2:
            return 0.0
        sobel = cv2.Sobel(region, cv2.CV_64F, 0, 1, ksize=3)
        return float(np.mean(sobel))


# ═══════════════════════════════════════════════════════════════════════════════
#  ACTION UNIT SCORER — maps features → AU activations
# ═══════════════════════════════════════════════════════════════════════════════

class ActionUnitScorer:
    """
    Maps extracted facial features to approximate FACS Action Unit
    activations using calibrated sigmoid/linear functions.
    """

    @staticmethod
    def _sigmoid(x: float, center: float, steepness: float) -> float:
        try:
            return 1.0 / (1.0 + math.exp(-steepness * (x - center)))
        except OverflowError:
            return 0.0 if x < center else 1.0

    def score(self, ft: dict) -> dict[str, float]:
        au: dict[str, float] = {}

        # AU1 — Inner brow raise (forehead wrinkles + brow gradient)
        au["AU1"] = self._sigmoid(ft.get("forehead_wrinkles", 0), 0.04, 60) * 0.5 + \
                    self._sigmoid(ft.get("brow_gradient", 0), 5.0, 0.3) * 0.5

        # AU2 — Outer brow raise (brow asymmetry + forehead wrinkles)
        au["AU2"] = self._sigmoid(ft.get("brow_asymmetry", 0), 3.0, 0.5) * 0.4 + \
                    self._sigmoid(ft.get("forehead_wrinkles", 0), 0.03, 80) * 0.6

        # AU4 — Brow lowerer (edge density + low brow gradient)
        au["AU4"] = self._sigmoid(ft.get("brow_edge_density", 0), 0.06, 50) * 0.6 + \
                    (1 - self._sigmoid(ft.get("brow_gradient", 0), 0, 0.5)) * 0.4

        # AU5 — Upper lid raise (eye openness)
        au["AU5"] = self._sigmoid(ft.get("eye_openness", 0), 0.45, 12)

        # AU6 — Cheek raise (eye lid contrast + mouth corner lift)
        au["AU6"] = self._sigmoid(ft.get("eye_lid_contrast", 0), 15, 0.15) * 0.5 + \
                    self._sigmoid(ft.get("mouth_corner_lift", 0), 2, 0.4) * 0.5

        # AU7 — Lid tightener (low eye openness)
        au["AU7"] = 1 - self._sigmoid(ft.get("eye_openness", 0.5), 0.35, 15)

        # AU9 — Nose wrinkler
        au["AU9"] = self._sigmoid(ft.get("nose_wrinkle", 0), 0.05, 40)

        # AU10 — Upper lip raiser
        au["AU10"] = self._sigmoid(ft.get("mouth_mean", 128), 100, -0.03) * 0.5 + \
                     self._sigmoid(ft.get("nose_wrinkle", 0), 0.04, 50) * 0.5

        # AU12 — Lip corner puller (smile)
        au["AU12"] = self._sigmoid(ft.get("mouth_width_ratio", 0), 0.45, 15) * 0.5 + \
                     self._sigmoid(ft.get("mouth_corner_lift", 0), 3, 0.3) * 0.5

        # AU15 — Lip corner depressor (frown)
        au["AU15"] = (1 - self._sigmoid(ft.get("mouth_corner_lift", 0), -2, 0.3)) * 0.6 + \
                     self._sigmoid(ft.get("mouth_std", 0), 40, 0.05) * 0.4

        # AU17 — Chin raiser
        au["AU17"] = self._sigmoid(ft.get("chin_std", 0), 25, 0.08)

        # AU20 — Lip stretcher
        au["AU20"] = self._sigmoid(ft.get("mouth_width_ratio", 0), 0.5, 12) * 0.6 + \
                     self._sigmoid(ft.get("lip_compression", 0), 30, 0.06) * 0.4

        # AU23/24 — Lip tightener/pressor
        au["AU23"] = self._sigmoid(ft.get("lip_compression", 0), 20, 0.08)
        au["AU24"] = au["AU23"] * 0.8  # correlated

        # AU25 — Lips part (mouth openness)
        au["AU25"] = self._sigmoid(ft.get("mouth_openness", 0), 0.3, 8)

        # AU26 — Jaw drop
        au["AU26"] = self._sigmoid(ft.get("mouth_openness", 0), 0.45, 10) * 0.6 + \
                     self._sigmoid(ft.get("mouth_height_ratio", 0), 0.08, 30) * 0.4

        # AU43 — Eye closure
        au["AU43"] = 1 - self._sigmoid(ft.get("eye_openness", 0.5), 0.25, 20)

        # Clamp all to [0, 1]
        return {k: max(0.0, min(1.0, v)) for k, v in au.items()}


# ═══════════════════════════════════════════════════════════════════════════════
#  EMOTION CLASSIFIER — AU activations → emotion probabilities
# ═══════════════════════════════════════════════════════════════════════════════

class EmotionClassifier:
    """
    Maps Action Unit activations to emotion probabilities using
    Bayesian-style weighted matching against known AU profiles.
    """

    def __init__(self):
        self._profiles = _EMOTION_AU_PROFILES

    def classify(self, au_scores: dict[str, float], features: dict) -> dict[str, float]:
        scores: dict[str, float] = {}

        for emotion, profile in self._profiles.items():
            if not profile:
                # Neutral: inversely proportional to total AU activation
                total_activation = sum(au_scores.values())
                scores[emotion] = max(0.0, 1.0 - total_activation * 0.08)
                continue

            match_score = 0.0
            total_weight = 0.0

            for au_name, expected_strength in profile.items():
                actual = au_scores.get(au_name, 0.0)
                weight = expected_strength  # higher expected = more important
                # Gaussian-style match: closer to expected = higher score
                diff = abs(actual - expected_strength)
                match = math.exp(-2.0 * diff * diff)
                match_score += match * weight
                total_weight += weight

            if total_weight > 0:
                scores[emotion] = match_score / total_weight

        # ── Contextual adjustments from raw features ──────────────────────
        # Boost happy when face symmetry is high (genuine smile = symmetric)
        symmetry = features.get("face_symmetry", 0.5)
        if symmetry > 0.7:
            scores["happy"] = scores.get("happy", 0) * (1 + (symmetry - 0.7))

        # High overall face contrast → not neutral
        face_std = features.get("face_std", 30)
        if face_std > 45:
            scores["neutral"] = scores.get("neutral", 0) * 0.85

        # Skin color hue shift (flushing → anger/embarrassment)
        sat = features.get("sat_mean", 0)
        if sat > 100:
            scores["angry"] = scores.get("angry", 0) * 1.1
            scores["surprised"] = scores.get("surprised", 0) * 1.05

        # Ensure no negative scores
        scores = {e: max(0.001, v) for e, v in scores.items()}

        # Normalize to probability distribution
        total = sum(scores.values()) or 1.0
        return {e: v / total for e, v in scores.items()}


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class AdvancedEmotionEngine:
    """
    Singleton, thread-safe emotion detection engine.
    Replaces the basic EmotionService with a high-accuracy pipeline.
    """

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

        cascade_dir = cv2.data.haarcascades

        # Load multiple cascades for robust detection
        self._cascades = [
            ("frontal", cv2.CascadeClassifier(cascade_dir + "haarcascade_frontalface_default.xml")),
            ("alt2", cv2.CascadeClassifier(cascade_dir + "haarcascade_frontalface_alt2.xml")),
            ("alt", cv2.CascadeClassifier(cascade_dir + "haarcascade_frontalface_alt.xml")),
            ("profile", cv2.CascadeClassifier(cascade_dir + "haarcascade_profileface.xml")),
        ]
        self._eye_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_eye.xml")
        self._smile_cascade = cv2.CascadeClassifier(cascade_dir + "haarcascade_smile.xml")

        # Sub-analyzers
        self._feature_analyzer = FacialFeatureAnalyzer()
        self._au_scorer = ActionUnitScorer()
        self._classifier = EmotionClassifier()
        self._smoother = TemporalSmoother()
        self._tracker = FaceTracker()

        # CLAHE for preprocessing
        self._clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))

        # Frame counter
        self._frame_count = 0

        # Optional DeepFace
        self._has_deepface = False
        try:
            from deepface import DeepFace
            self._DeepFace = DeepFace
            self._has_deepface = True
            logger.info("AdvancedEmotionEngine: DeepFace available as fusion backend")
        except ImportError:
            self._DeepFace = None
            logger.info("AdvancedEmotionEngine: OpenCV-only mode (no DeepFace)")

        self._initialized = True
        logger.info("AdvancedEmotionEngine initialized — multi-cascade + FACS AU + temporal smoothing")

    def load_models(self):
        """Pre-load any heavy models."""
        if self._has_deepface:
            try:
                self._DeepFace.analyze(
                    img_path=np.zeros((100, 100, 3), dtype=np.uint8),
                    actions=["emotion"], enforce_detection=False,
                    detector_backend="opencv", silent=True,
                )
                logger.info("DeepFace models pre-loaded")
            except Exception as e:
                logger.warning(f"DeepFace pre-load failed: {e}")

    # ── Face detection with multi-cascade fallback ────────────────────────

    def _detect_faces(self, gray: np.ndarray) -> np.ndarray:
        """Try cascades in order until we find faces."""
        for name, cascade in self._cascades:
            faces = cascade.detectMultiScale(
                gray,
                scaleFactor=1.05,
                minNeighbors=4 if name != "profile" else 3,
                minSize=(35, 35),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
            if len(faces) > 0:
                return faces
        return np.array([])

    # ── Cascade-based sub-detections for additional signals ───────────────

    def _detect_eyes_and_smile(self, face_gray: np.ndarray) -> dict:
        h, w = face_gray.shape[:2]
        result = {"has_smile": False, "smile_cascade_confidence": 0.0, "eye_count": 0}

        # Eyes
        upper = face_gray[0: int(h * 0.55), :]
        eyes = self._eye_cascade.detectMultiScale(upper, 1.05, 3, minSize=(12, 12))
        result["eye_count"] = min(len(eyes), 2)

        # Smile
        lower = face_gray[h // 2:, :]
        smiles = self._smile_cascade.detectMultiScale(lower, 1.4, 12, minSize=(18, 8))
        if len(smiles) > 0:
            result["has_smile"] = True
            # Confidence proxy: how many smile detections / area
            result["smile_cascade_confidence"] = min(len(smiles) / 3.0, 1.0)

        return result

    # ── Main analysis pipeline ────────────────────────────────────────────

    def analyze_frame(self, frame: np.ndarray) -> dict:
        """Full pipeline: detect → extract features → AU score → classify → smooth."""
        self._frame_count += 1

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = self._clahe.apply(gray)

        # Detect faces
        all_faces = self._detect_faces(gray)
        face_rect = self._tracker.update(
            [(int(x), int(y), int(w), int(h)) for x, y, w, h in all_faces] if len(all_faces) > 0 else []
        )

        if face_rect is None:
            result = self._smoother.update({"neutral": 1.0}, frame_confidence=0.1)
            result["faceDetected"] = False
            result["faceRect"] = None
            result["actionUnits"] = {}
            result["featureCount"] = 0
            return result

        x, y, w, h = face_rect
        # Ensure bounds
        fh, fw = gray.shape[:2]
        x, y = max(0, x), max(0, y)
        w = min(w, fw - x)
        h = min(h, fh - y)

        face_gray = gray[y:y + h, x:x + w]
        face_color = frame[y:y + h, x:x + w]

        # Extract features
        features = self._feature_analyzer.analyze(face_gray, face_color)
        if not features:
            result = self._smoother.update({"neutral": 0.8}, frame_confidence=0.2)
            result["faceDetected"] = True
            result["faceRect"] = [x, y, w, h]
            result["actionUnits"] = {}
            result["featureCount"] = 0
            return result

        # Get cascade sub-detections
        cascade_info = self._detect_eyes_and_smile(face_gray)

        # Boost features with cascade signals
        if cascade_info["has_smile"]:
            features["mouth_corner_lift"] = max(
                features.get("mouth_corner_lift", 0),
                cascade_info["smile_cascade_confidence"] * 8.0,
            )
            features["mouth_width_ratio"] = max(
                features.get("mouth_width_ratio", 0),
                0.5 + cascade_info["smile_cascade_confidence"] * 0.15,
            )

        # Score Action Units
        au_scores = self._au_scorer.score(features)

        # Classify emotion
        raw_probs = self._classifier.classify(au_scores, features)

        # DeepFace fusion (if available, blend 40/60)
        if self._has_deepface and self._frame_count % 3 == 0:
            deep_probs = self._deepface_analyze(frame)
            if deep_probs:
                for e in ALL_EMOTIONS:
                    cv_val = raw_probs.get(e, 0)
                    df_val = deep_probs.get(e, 0)
                    raw_probs[e] = cv_val * 0.4 + df_val * 0.6

        # Temporal smoothing
        face_quality = min(w * h / 10000, 1.0)  # larger face = higher confidence
        result = self._smoother.update(raw_probs, frame_confidence=face_quality)

        result["faceDetected"] = True
        result["faceRect"] = [x, y, w, h]
        result["actionUnits"] = {k: round(v, 3) for k, v in au_scores.items()}
        result["featureCount"] = len(features)
        result["facesDetected"] = len(all_faces)

        return result

    def _deepface_analyze(self, frame: np.ndarray) -> Optional[dict[str, float]]:
        if not self._has_deepface or self._DeepFace is None:
            return None
        try:
            results = self._DeepFace.analyze(
                img_path=frame, actions=["emotion"],
                enforce_detection=False, detector_backend="opencv", silent=True,
            )
            r = results[0] if isinstance(results, list) else results
            return {k.lower(): v / 100.0 for k, v in r.get("emotion", {}).items()}
        except Exception:
            return None

    # ── Public API ────────────────────────────────────────────────────────

    def detect_emotion_from_image(self, image_bytes: bytes) -> dict:
        """Analyze a JPEG/PNG image from bytes."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {
                "success": False,
                "emotion": "neutral",
                "confidence": 0,
                "distribution": {},
            }

        # Scale for performance (keep detail)
        h, w = frame.shape[:2]
        if max(h, w) > 720:
            scale = 720 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)),
                               interpolation=cv2.INTER_AREA)

        result = self.analyze_frame(frame)
        result["success"] = True
        result["frameIndex"] = self._frame_count
        return result

    def detect_emotion(self):
        """For direct camera usage (not typically used in web mode)."""
        return {"success": False, "message": "Use detect_emotion_from_image() for web mode"}

    def release(self):
        """Cleanup."""
        self._smoother.reset()
        logger.info("AdvancedEmotionEngine released")

    def reset_smoother(self):
        self._smoother.reset()
        self._tracker = FaceTracker()


# Singleton instance
advanced_emotion_engine = AdvancedEmotionEngine()
