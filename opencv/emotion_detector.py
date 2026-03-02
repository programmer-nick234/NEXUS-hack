"""
Real-Time Facial Expression Detection System
=============================================
Uses OpenCV for webcam capture and face detection,
and DeepFace for emotion recognition.

Detected emotions: Angry, Disgust, Fear, Happy, Sad, Surprise, Neutral

Usage:
    cd opencv
    python emotion_detector.py

Dependencies:
    pip install opencv-python deepface tensorflow keras

Author: Auto-generated
"""

import cv2
import numpy as np
from deepface import DeepFace

# ─── Configuration ────────────────────────────────────────────────────────────
FRAME_SCALE = 0.5          # Scale factor for analysis frame (smaller = faster)
ANALYSIS_INTERVAL = 5      # Analyse every N frames (skip intermediate for speed)
BOX_COLOR = (0, 255, 0)    # Bounding-box colour (BGR - green)
TEXT_COLOR = (255, 255, 255)
BG_COLOR = (0, 0, 0)
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.8
FONT_THICKNESS = 2
WINDOW_NAME = "NEXUS - Emotion Detector"


def draw_label(frame, text, x, y, bg_color=BG_COLOR, text_color=TEXT_COLOR):
    """Draw a text label with a filled background rectangle."""
    (tw, th), baseline = cv2.getTextSize(text, FONT, FONT_SCALE, FONT_THICKNESS)
    cv2.rectangle(frame, (x, y - th - 10), (x + tw + 10, y), bg_color, -1)
    cv2.putText(frame, text, (x + 5, y - 5), FONT, FONT_SCALE, text_color, FONT_THICKNESS)


def analyse_frame(small_frame):
    """
    Run DeepFace emotion analysis on a down-scaled BGR frame.
    Returns a list of result dicts or an empty list on failure.
    """
    try:
        results = DeepFace.analyze(
            img_path=small_frame,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
        # DeepFace may return a single dict or a list of dicts
        if isinstance(results, dict):
            results = [results]
        return results
    except Exception:
        return []


def main():
    # ── Open webcam ───────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Could not open webcam. Check your camera connection.")
        return

    print(f"[INFO] Webcam opened successfully.")
    print(f"[INFO] Press 'q' to quit.")

    frame_count = 0
    cached_results = []  # Store latest analysis between intervals

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARN] Failed to grab frame. Retrying...")
            continue

        frame = cv2.flip(frame, 1)  # Mirror for natural interaction
        h, w = frame.shape[:2]

        # ── Run analysis periodically ─────────────────────────────────────────
        if frame_count % ANALYSIS_INTERVAL == 0:
            small = cv2.resize(frame, (int(w * FRAME_SCALE), int(h * FRAME_SCALE)))
            cached_results = analyse_frame(small)

        # ── Draw results ──────────────────────────────────────────────────────
        if cached_results:
            for result in cached_results:
                # --- Bounding box ---
                region = result.get("region", {})
                rx = int(region.get("x", 0) / FRAME_SCALE)
                ry = int(region.get("y", 0) / FRAME_SCALE)
                rw = int(region.get("w", 0) / FRAME_SCALE)
                rh = int(region.get("h", 0) / FRAME_SCALE)

                # Skip if region looks invalid (entire frame or zero-area)
                if rw < 30 or rh < 30:
                    continue

                cv2.rectangle(frame, (rx, ry), (rx + rw, ry + rh), BOX_COLOR, 2)

                # --- Emotion info ---
                dominant = result.get("dominant_emotion", "N/A")
                emotions = result.get("emotion", {})
                confidence = emotions.get(dominant, 0.0)

                label_emotion = f"{dominant.capitalize()}"
                label_conf = f"{confidence:.1f}%"

                draw_label(frame, label_emotion, rx, ry - 10)
                draw_label(frame, label_conf, rx, ry - 40, bg_color=(50, 50, 50))

                # --- Mini emotion bar (optional visual) ---
                bar_x = rx + rw + 10
                bar_y = ry
                for i, (emo, score) in enumerate(sorted(emotions.items(),
                                                         key=lambda e: e[1],
                                                         reverse=True)):
                    bar_w = int(score * 1.5)  # scale bar width
                    color = BOX_COLOR if emo == dominant else (100, 100, 100)
                    cy = bar_y + i * 22
                    if cy + 18 > h:
                        break
                    cv2.rectangle(frame, (bar_x, cy), (bar_x + bar_w, cy + 16), color, -1)
                    cv2.putText(frame, f"{emo[:3].upper()} {score:.0f}%",
                                (bar_x + bar_w + 5, cy + 13),
                                FONT, 0.45, TEXT_COLOR, 1)
        else:
            # No face detected
            draw_label(frame, "No face detected", 10, 30, bg_color=(0, 0, 180))

        # ── HUD ───────────────────────────────────────────────────────────────
        cv2.putText(frame, "Press 'q' to quit", (10, h - 15),
                    FONT, 0.5, (200, 200, 200), 1)

        cv2.imshow(WINDOW_NAME, frame)
        frame_count += 1

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    # ── Cleanup ───────────────────────────────────────────────────────────────
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Emotion detector stopped.")


if __name__ == "__main__":
    main()
