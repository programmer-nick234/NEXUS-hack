"""
Advanced Gesture Recognition Engine
=====================================
Multi-modal gesture analysis system:
  1. Camera-based hand gesture detection (OpenCV skin + contour)
  2. Pointer/touch gesture pattern recognition
  3. Head pose estimation from face rect
  4. Micro-expression detection via frame differencing
  5. Gesture → emotional state mapping

Architecture:
  - HandGestureDetector: skin-color segmentation + convex hull + defect counting
  - PointerGestureClassifier: classifies pointer patterns (tap, swipe, circle, hold, shake)
  - HeadPoseEstimator: approximate head tilt/nod from face rect changes
  - MicroExpressionDetector: detect rapid facial changes between frames
  - GestureEngine: orchestrates all sub-systems

Author: NEXUS Team — Hackathon 2026
"""

import cv2
import numpy as np
import math
import time
import threading
from collections import deque
from typing import Optional
from app.core.logging import logger

# ═══════════════════════════════════════════════════════════════════════════════
#  HAND GESTURE DETECTOR (camera-based)
# ═══════════════════════════════════════════════════════════════════════════════

class HandGestureDetector:
    """
    Detects hand gestures from webcam frames using:
    - YCrCb + HSV skin-color segmentation
    - Morphological cleanup
    - Contour analysis + convex hull
    - Convexity defect counting for finger detection
    - Gesture classification: open_palm, fist, pointing, peace, thumbs_up, wave, none
    """

    GESTURES = ("open_palm", "fist", "pointing", "peace", "thumbs_up", "wave", "none")

    def __init__(self):
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=120, varThreshold=50, detectShadows=False
        )
        self._prev_contour_area = 0
        self._wave_history: deque[float] = deque(maxlen=15)
        self._gesture_history: deque[str] = deque(maxlen=8)

    def detect(self, frame: np.ndarray, face_rect: Optional[tuple] = None) -> dict:
        """
        Detect hand gesture from a BGR frame.
        face_rect: (x,y,w,h) to exclude face region from skin detection.
        """
        h, w = frame.shape[:2]
        result = {
            "gesture": "none",
            "confidence": 0.0,
            "fingerCount": 0,
            "handRect": None,
            "handCenter": None,
            "isMoving": False,
        }

        # ── Skin segmentation ─────────────────────────────────────────────
        skin_mask = self._segment_skin(frame, face_rect)

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        skin_mask = cv2.GaussianBlur(skin_mask, (5, 5), 0)
        _, skin_mask = cv2.threshold(skin_mask, 127, 255, cv2.THRESH_BINARY)

        # ── Find hand contour ─────────────────────────────────────────────
        contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return result

        # Filter: hand contour should be reasonably large and not the face
        min_area = (w * h) * 0.005   # at least 0.5% of frame
        max_area = (w * h) * 0.40    # not more than 40%
        valid = [c for c in contours if min_area < cv2.contourArea(c) < max_area]

        if not valid:
            return result

        hand = max(valid, key=cv2.contourArea)
        area = cv2.contourArea(hand)

        # ── Convex hull + defects ─────────────────────────────────────────
        hull = cv2.convexHull(hand)
        hull_area = cv2.contourArea(hull) or 1
        solidity = area / hull_area

        hull_indices = cv2.convexHull(hand, returnPoints=False)
        try:
            defects = cv2.convexityDefects(hand, hull_indices)
        except cv2.error:
            defects = None

        # Count significant defects (fingers)
        finger_count = 0
        if defects is not None:
            for i in range(defects.shape[0]):
                s, e, f, d = defects[i, 0]
                start = tuple(hand[s][0])
                end = tuple(hand[e][0])
                far = tuple(hand[f][0])

                # Angle between start-far-end
                a = math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2)
                b = math.sqrt((far[0] - start[0]) ** 2 + (far[1] - start[1]) ** 2)
                c = math.sqrt((end[0] - far[0]) ** 2 + (end[1] - far[1]) ** 2)

                if b * c > 0:
                    angle = math.acos(max(-1, min(1, (b ** 2 + c ** 2 - a ** 2) / (2 * b * c))))
                else:
                    angle = math.pi

                # Count only deep defects with acute angle
                if angle < math.radians(80) and d > 6000:
                    finger_count += 1

        finger_count = min(finger_count + 1, 5)  # +1 for the first finger, cap at 5

        # Bounding rect
        bx, by, bw, bh = cv2.boundingRect(hand)
        hand_ar = bh / bw if bw > 0 else 1.0

        # Moments for centroid
        M = cv2.moments(hand)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
        else:
            cx, cy = bx + bw // 2, by + bh // 2

        # Movement detection
        area_delta = abs(area - self._prev_contour_area) / max(area, 1)
        self._wave_history.append(area_delta)
        self._prev_contour_area = area
        is_moving = area_delta > 0.1

        # Wave detection: oscillating area changes
        is_wave = False
        if len(self._wave_history) >= 6:
            deltas = list(self._wave_history)
            sign_changes = sum(
                1 for i in range(1, len(deltas))
                if (deltas[i] > 0.05) != (deltas[i - 1] > 0.05)
            )
            is_wave = sign_changes >= 4

        # ── Classify gesture ──────────────────────────────────────────────
        gesture = "none"
        conf = 0.0

        if is_wave:
            gesture = "wave"
            conf = 0.75 + min(finger_count / 5, 1) * 0.15
        elif finger_count >= 5 and solidity > 0.6:
            gesture = "open_palm"
            conf = 0.7 + solidity * 0.2
        elif finger_count == 2:
            gesture = "peace"
            conf = 0.65 + (1 - abs(hand_ar - 1.5)) * 0.2
        elif finger_count == 1 and hand_ar > 1.4:
            gesture = "pointing"
            conf = 0.6 + min(hand_ar / 3, 0.3)
        elif finger_count <= 1 and solidity > 0.8:
            gesture = "fist"
            conf = 0.6 + solidity * 0.3
        elif finger_count == 1 and hand_ar < 1.2:
            gesture = "thumbs_up"
            conf = 0.55 + solidity * 0.2

        conf = min(conf, 0.98)

        # Smooth gesture
        self._gesture_history.append(gesture)
        if len(self._gesture_history) >= 3:
            from collections import Counter
            most_common = Counter(list(self._gesture_history)[-5:]).most_common(1)[0]
            if most_common[1] >= 2:
                gesture = most_common[0]

        result["gesture"] = gesture
        result["confidence"] = round(conf, 3)
        result["fingerCount"] = finger_count
        result["handRect"] = [bx, by, bw, bh]
        result["handCenter"] = [cx, cy]
        result["isMoving"] = is_moving
        result["solidity"] = round(solidity, 3)

        return result

    def _segment_skin(self, frame: np.ndarray, face_rect: Optional[tuple] = None) -> np.ndarray:
        """Multi-colorspace skin detection."""
        h, w = frame.shape[:2]

        # YCrCb skin range
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        mask_ycrcb = cv2.inRange(ycrcb, (0, 133, 77), (255, 173, 127))

        # HSV skin range
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask_hsv = cv2.inRange(hsv, (0, 30, 60), (20, 150, 255))

        # Combine
        skin_mask = cv2.bitwise_or(mask_ycrcb, mask_hsv)

        # Exclude face region
        if face_rect is not None:
            fx, fy, fw, fh = face_rect
            # Expand face mask slightly
            margin = int(fw * 0.15)
            x1 = max(0, fx - margin)
            y1 = max(0, fy - margin)
            x2 = min(w, fx + fw + margin)
            y2 = min(h, fy + fh + margin)
            skin_mask[y1:y2, x1:x2] = 0

        return skin_mask


# ═══════════════════════════════════════════════════════════════════════════════
#  POINTER GESTURE CLASSIFIER (mouse/touch)
# ═══════════════════════════════════════════════════════════════════════════════

class PointerGestureClassifier:
    """
    Classifies pointer movement patterns:
    - tap: very short with minimal movement
    - hold: long duration with low movement
    - swipe_left/right/up/down: directional fast movement
    - circle: circular movement detected via angle accumulation
    - shake: rapid back & forth
    - zigzag: many direction changes
    - spiral: circular + radial expansion
    """

    GESTURES = (
        "tap", "hold", "swipe_left", "swipe_right", "swipe_up", "swipe_down",
        "circle", "shake", "zigzag", "spiral", "unknown",
    )

    def classify(self, points: list[dict], duration_ms: float) -> dict:
        """
        points: [{x, y, t}, ...]
        duration_ms: total gesture duration in ms
        """
        n = len(points)
        result = {
            "gesture": "unknown",
            "confidence": 0.0,
            "direction": None,
            "speed": 0.0,
            "acceleration": 0.0,
            "curvature": 0.0,
            "angularVelocity": 0.0,
        }

        if n < 2:
            if duration_ms < 300:
                result["gesture"] = "tap"
                result["confidence"] = 0.85
            return result

        # ── Compute metrics ───────────────────────────────────────────────
        total_dist = 0.0
        speeds = []
        angles = []
        angle_accum = 0.0
        dir_changes = 0
        prev_angle = None

        for i in range(1, n):
            dx = points[i]["x"] - points[i - 1]["x"]
            dy = points[i]["y"] - points[i - 1]["y"]
            d = math.sqrt(dx * dx + dy * dy)
            dt = max((points[i]["t"] - points[i - 1]["t"]) / 1000, 0.001)
            total_dist += d
            speeds.append(d / dt)

            angle = math.atan2(dy, dx)
            angles.append(angle)

            if prev_angle is not None:
                delta = angle - prev_angle
                # Normalize to [-pi, pi]
                delta = (delta + math.pi) % (2 * math.pi) - math.pi
                angle_accum += delta

                if abs(delta) > math.pi / 4:
                    dir_changes += 1

            prev_angle = angle

        avg_speed = total_dist / max(duration_ms / 1000, 0.001)
        result["speed"] = round(avg_speed, 1)

        # Acceleration
        if len(speeds) >= 2:
            accels = [abs(speeds[i] - speeds[i - 1]) for i in range(1, len(speeds))]
            result["acceleration"] = round(sum(accels) / len(accels), 1)

        # Net displacement
        dx_net = points[-1]["x"] - points[0]["x"]
        dy_net = points[-1]["y"] - points[0]["y"]
        net_dist = math.sqrt(dx_net * dx_net + dy_net * dy_net)
        net_angle = math.atan2(dy_net, dx_net)

        # Curvature: how much total path exceeds straight line
        curvature = total_dist / max(net_dist, 1) - 1.0
        result["curvature"] = round(curvature, 3)
        result["angularVelocity"] = round(abs(angle_accum) / max(duration_ms / 1000, 0.001), 2)

        # ── Classification ────────────────────────────────────────────────

        # Tap: short duration, minimal movement
        if duration_ms < 250 and total_dist < 30:
            result["gesture"] = "tap"
            result["confidence"] = 0.9
            return result

        # Hold: long duration, minimal movement
        if duration_ms > 1000 and total_dist < 50:
            result["gesture"] = "hold"
            result["confidence"] = min(0.6 + duration_ms / 5000, 0.95)
            return result

        # Circle: large angular accumulation
        full_rotations = abs(angle_accum) / (2 * math.pi)
        if full_rotations > 0.6 and curvature > 1.5:
            result["gesture"] = "circle"
            result["confidence"] = min(0.5 + full_rotations * 0.3, 0.95)
            result["direction"] = "clockwise" if angle_accum < 0 else "counter_clockwise"
            return result

        # Spiral: circle + expanding radius
        if full_rotations > 0.4 and net_dist > total_dist * 0.2:
            result["gesture"] = "spiral"
            result["confidence"] = min(0.5 + full_rotations * 0.25, 0.9)
            return result

        # Shake: many direction changes, high speed
        if dir_changes >= 4 and avg_speed > 200:
            result["gesture"] = "shake"
            result["confidence"] = min(0.5 + dir_changes * 0.06, 0.92)
            return result

        # Zigzag: many direction changes, moderate speed
        if dir_changes >= 3 and curvature > 1.0:
            result["gesture"] = "zigzag"
            result["confidence"] = min(0.5 + dir_changes * 0.08, 0.88)
            return result

        # Swipe: fast directional movement
        if avg_speed > 150 and net_dist > 80:
            # Determine direction
            abs_dx = abs(dx_net)
            abs_dy = abs(dy_net)
            if abs_dx > abs_dy * 1.3:
                direction = "swipe_right" if dx_net > 0 else "swipe_left"
            elif abs_dy > abs_dx * 1.3:
                direction = "swipe_down" if dy_net > 0 else "swipe_up"
            else:
                direction = "swipe_right" if dx_net > 0 else "swipe_left"

            result["gesture"] = direction
            result["confidence"] = min(0.55 + avg_speed / 1000, 0.93)
            result["direction"] = direction.replace("swipe_", "")
            return result

        # Fallback
        result["gesture"] = "unknown"
        result["confidence"] = 0.3
        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  HEAD POSE ESTIMATOR
# ═══════════════════════════════════════════════════════════════════════════════

class HeadPoseEstimator:
    """
    Estimates head pose changes (nod, shake, tilt) by tracking the
    face bounding box center over time.
    """

    def __init__(self, history_len: int = 20):
        self._positions: deque[tuple[float, float, float]] = deque(maxlen=history_len)  # (cx, cy, timestamp)
        self._sizes: deque[float] = deque(maxlen=history_len)

    def update(self, face_rect: Optional[list], frame_w: int, frame_h: int) -> dict:
        result = {
            "headPose": "neutral",
            "isNodding": False,
            "isShaking": False,
            "tilt": 0.0,
            "movement": 0.0,
        }

        if face_rect is None:
            return result

        x, y, w, h = face_rect
        cx = (x + w / 2) / frame_w
        cy = (y + h / 2) / frame_h
        now = time.time()

        self._positions.append((cx, cy, now))
        self._sizes.append(w * h)

        if len(self._positions) < 5:
            return result

        positions = list(self._positions)
        recent = positions[-8:]

        # Horizontal movement (head shake)
        x_vals = [p[0] for p in recent]
        x_range = max(x_vals) - min(x_vals)
        x_changes = sum(1 for i in range(1, len(x_vals)) if abs(x_vals[i] - x_vals[i - 1]) > 0.01)

        # Vertical movement (nod)
        y_vals = [p[1] for p in recent]
        y_range = max(y_vals) - min(y_vals)

        # Movement magnitude
        total_movement = x_range + y_range
        result["movement"] = round(total_movement, 4)

        if x_range > 0.06 and x_changes >= 3:
            result["isShaking"] = True
            result["headPose"] = "shaking"
        elif y_range > 0.05 and x_range < 0.03:
            result["isNodding"] = True
            result["headPose"] = "nodding"
        elif cx < 0.4:
            result["headPose"] = "turned_left"
            result["tilt"] = round((0.5 - cx) * 2, 2)
        elif cx > 0.6:
            result["headPose"] = "turned_right"
            result["tilt"] = round((cx - 0.5) * 2, 2)
        elif cy < 0.35:
            result["headPose"] = "tilted_up"
        elif cy > 0.65:
            result["headPose"] = "tilted_down"

        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  MICRO-EXPRESSION DETECTOR
# ═══════════════════════════════════════════════════════════════════════════════

class MicroExpressionDetector:
    """
    Detects rapid facial changes between consecutive frames
    that may indicate suppressed emotions (micro-expressions).
    Uses frame differencing on the face ROI.
    """

    def __init__(self, threshold: float = 0.015, cooldown_frames: int = 10):
        self._prev_face: Optional[np.ndarray] = None
        self._threshold = threshold
        self._cooldown = cooldown_frames
        self._frames_since_last = cooldown_frames
        self._history: deque[float] = deque(maxlen=30)

    def update(self, face_gray: Optional[np.ndarray]) -> dict:
        result = {
            "microExpressionDetected": False,
            "changeIntensity": 0.0,
            "recentVolatility": 0.0,
        }

        if face_gray is None or face_gray.size == 0:
            self._prev_face = None
            return result

        self._frames_since_last += 1

        # Resize to standard size for comparison
        std_size = (80, 80)
        face_std = cv2.resize(face_gray, std_size)
        face_float = face_std.astype(np.float32) / 255.0

        if self._prev_face is not None:
            diff = cv2.absdiff(face_float, self._prev_face)
            change = float(np.mean(diff))
            self._history.append(change)

            result["changeIntensity"] = round(change, 4)

            if len(self._history) >= 5:
                avg = sum(self._history) / len(self._history)
                result["recentVolatility"] = round(avg, 4)

                # Micro-expression: sudden spike above threshold, above recent average
                if change > self._threshold and change > avg * 2.5 and self._frames_since_last >= self._cooldown:
                    result["microExpressionDetected"] = True
                    self._frames_since_last = 0

        self._prev_face = face_float
        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  GESTURE → EMOTION MAPPER
# ═══════════════════════════════════════════════════════════════════════════════

# Combined signal → emotional state
_GESTURE_EMOTION_MAP = {
    "open_palm":   {"emotion_boost": {"happy": 0.15, "neutral": 0.10}, "anxiety_modifier": -0.15},
    "fist":        {"emotion_boost": {"angry": 0.25, "fear": 0.10}, "anxiety_modifier": 0.20},
    "pointing":    {"emotion_boost": {"angry": 0.10, "surprised": 0.10}, "anxiety_modifier": 0.05},
    "peace":       {"emotion_boost": {"happy": 0.20, "neutral": 0.05}, "anxiety_modifier": -0.10},
    "thumbs_up":   {"emotion_boost": {"happy": 0.25}, "anxiety_modifier": -0.20},
    "wave":        {"emotion_boost": {"happy": 0.15, "surprised": 0.10}, "anxiety_modifier": -0.08},
    "shake":       {"emotion_boost": {"angry": 0.15, "fear": 0.15}, "anxiety_modifier": 0.25},
    "circle":      {"emotion_boost": {"neutral": 0.10}, "anxiety_modifier": -0.05},
    "hold":        {"emotion_boost": {"neutral": 0.10, "sad": 0.05}, "anxiety_modifier": -0.10},
}

_HEAD_POSE_MODIFIERS = {
    "nodding":       {"anxiety_modifier": -0.05, "engagement": 0.3},
    "shaking":       {"anxiety_modifier": 0.10, "engagement": 0.2},
    "turned_left":   {"anxiety_modifier": 0.05, "engagement": -0.1},
    "turned_right":  {"anxiety_modifier": 0.05, "engagement": -0.1},
    "tilted_up":     {"anxiety_modifier": -0.03, "engagement": 0.1},
    "tilted_down":   {"anxiety_modifier": 0.08, "engagement": -0.2},
}


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class GestureEngine:
    """
    Orchestrates all gesture sub-systems.
    Thread-safe singleton for use across the app.
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

        self._hand_detector = HandGestureDetector()
        self._pointer_classifier = PointerGestureClassifier()
        self._head_pose = HeadPoseEstimator()
        self._micro_expr = MicroExpressionDetector()

        self._initialized = True
        logger.info("GestureEngine initialized — hand/pointer/head/micro-expression")

    # ── Camera-based gesture analysis ─────────────────────────────────────

    def analyze_frame(self, frame: np.ndarray, face_rect: Optional[list] = None) -> dict:
        """
        Full gesture analysis from a single camera frame.
        Returns hand gesture + head pose + micro-expression data.
        """
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Hand gesture
        face_tuple = tuple(face_rect) if face_rect else None
        hand = self._hand_detector.detect(frame, face_tuple)

        # Head pose
        head = self._head_pose.update(face_rect, w, h)

        # Micro-expression
        face_gray = None
        if face_rect:
            fx, fy, fw, fh = face_rect
            fx, fy = max(0, fx), max(0, fy)
            fw = min(fw, w - fx)
            fh = min(fh, h - fy)
            face_gray = gray[fy:fy + fh, fx:fx + fw]
        micro = self._micro_expr.update(face_gray)

        # Combine
        return {
            "hand": hand,
            "headPose": head,
            "microExpression": micro,
            "gestureEmotionModifiers": self._compute_modifiers(hand, head),
        }

    def _compute_modifiers(self, hand: dict, head: dict) -> dict:
        """Compute combined emotion/anxiety modifiers from gesture signals."""
        emotion_boost: dict[str, float] = {}
        anxiety_mod = 0.0
        engagement = 0.5

        # Hand gesture modifier
        hand_gesture = hand.get("gesture", "none")
        hand_conf = hand.get("confidence", 0)
        if hand_gesture in _GESTURE_EMOTION_MAP:
            mapping = _GESTURE_EMOTION_MAP[hand_gesture]
            for emo, boost in mapping.get("emotion_boost", {}).items():
                emotion_boost[emo] = emotion_boost.get(emo, 0) + boost * hand_conf
            anxiety_mod += mapping.get("anxiety_modifier", 0) * hand_conf

        # Head pose modifier
        head_pose = head.get("headPose", "neutral")
        if head_pose in _HEAD_POSE_MODIFIERS:
            mapping = _HEAD_POSE_MODIFIERS[head_pose]
            anxiety_mod += mapping.get("anxiety_modifier", 0)
            engagement += mapping.get("engagement", 0)

        return {
            "emotionBoost": {k: round(v, 4) for k, v in emotion_boost.items()},
            "anxietyModifier": round(anxiety_mod, 4),
            "engagement": round(max(0, min(1, engagement)), 3),
        }

    # ── Pointer-based gesture analysis ────────────────────────────────────

    def classify_pointer_gesture(self, points: list[dict], duration_ms: float) -> dict:
        """Classify a pointer/touch gesture from point data."""
        return self._pointer_classifier.classify(points, duration_ms)

    # ── Combined gesture + emotion analysis ───────────────────────────────

    def analyze_combined(
        self,
        frame: np.ndarray,
        face_rect: Optional[list],
        pointer_points: Optional[list[dict]] = None,
        pointer_duration: Optional[float] = None,
    ) -> dict:
        """Full multi-modal gesture analysis."""
        frame_result = self.analyze_frame(frame, face_rect)

        pointer_result = None
        if pointer_points and pointer_duration:
            pointer_result = self.classify_pointer_gesture(pointer_points, pointer_duration)

        return {
            **frame_result,
            "pointerGesture": pointer_result,
        }


# Singleton
gesture_engine = GestureEngine()
