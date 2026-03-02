import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import cv2
from deepface import DeepFace
import numpy as np

def test():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam")
        return
    
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        print("Error: Failed to grab frame")
        return

    try:
        results = DeepFace.analyze(
            img_path=frame,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True
        )
        print("Success:", results)
    except Exception as e:
        print("Error type:", type(e))
        print("Error:", e)

if __name__ == "__main__":
    test()
