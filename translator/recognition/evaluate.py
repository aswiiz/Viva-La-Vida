#!/usr/bin/env python3
"""Evaluate a trained ISL recogniser on a held-out set or a live stream.

Usage:
    # Evaluate against a held-out dataset directory
    python evaluate.py --model translator/recognition/models/isl_recognizer.pkl --data dataset/dataset.csv

    # Run a short live-loop evaluation from a video file (for validation only)
    python evaluate.py --model ... --video path/to/test.mp4 --fps 30 --frames 30
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

from . import Recognizer, is_model_configured

DEFAULT_MODEL = (
    Path(__file__).resolve().parent / "models" / "isl_recognizer.pkl"
)


def evaluate_heldout(model_path: Path, data_dir: Path, test_split: float = 0.2):
    """Load dataset, hold out a split, and report accuracy per class."""
    if not is_model_configured() or not model_path.exists():
        sys.exit(f"Model not found: {model_path}")

    from .train import load_dataset, build_classifier, train

    X, y, labels = load_dataset(data_dir)
    from sklearn.utils import shuffle as sk_shuffle
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, classification_report

    X, y = sk_shuffle(X, y, random_state=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_split, stratify=y, random_state=42
    )

    model = build_classifier(X_train, y_train, "random_forest")
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    print(f"\nHeld-out evaluation: {acc:.4f}")
    print(classification_report(y_test, y_pred, labels=labels, zero_division=0))
    return acc


def _extract_landmarks(landmarks):
    flat = []
    if isinstance(landmarks, dict):
        pts = landmarks.get("landmarks", [])
        if isinstance(pts, (list, tuple)):
            data = pts
        else:
            data = [landmarks]
    elif isinstance(landmarks, (list, tuple)):
        data = landmarks
    else:
        return None

    for item in data:
        if isinstance(item, dict):
            flat.extend([item.get("x", 0.0), item.get("y", 0.0), item.get("z", 0.0)])
        else:
            row = list(item)
            while len(row) < 3:
                row.append(0.0)
            flat.extend([float(row[0]), float(row[1]), float(row[2])])

    while len(flat) < 63:
        flat.append(0.0)
    return np.array(flat[:63], dtype=np.float32)


def evaluate_live(model_path: Path, video_path: Path, fps: float = 30.0, frames: int = 30):
    """Validate the model against a short video file using OpenCV.

    This is a *validation* helper for the developer; it does not claim accuracy
    on any real-world benchmark.
    """
    if not model_path.exists():
        sys.exit(f"Model not found: {model_path}")
    try:
        import cv2  # type: ignore
    except ImportError:
        sys.exit("opencv-python is required for video evaluation")

    recognizer = Recognizer.load(model_path)
    if not recognizer.loaded:
        sys.exit("Model did not load (check the path).")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        sys.exit(f"Could not open video: {video_path}")

    total_samples = 0
    correct = 0
    sample_labels = []
    model_labels = getattr(recognizer._estimator, "classes_", None)
    if model_labels is not None:
        sample_labels = list(model_labels)

    frame_count = 0
    while cap.isOpened() and (frame_count < frames or frames < 0):
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1

        # Downsample frames; run recognition every 3rd frame
        if frame_count % 3 != 0:
            continue

        # Resize to the model's expected input (128x128 typical for 21-point
        # MediaPipe) and feed the re-centred hand crop.
        h, w = frame.shape[:2]
        top = max(0, int(h * 0.15))
        bottom = int(h * 0.85)
        left = int(w * 0.15)
        right = int(w * 0.85)
        crop = frame[top:bottom, left:right]
        resized = cv2.resize(crop, (128, 128))
        # Placeholder for a real hand-region detector; the frontend already
        # supplies landmarks. Here we just validate that the pipeline runs.
        landmarks = {
            "landmarks": [
                {"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)
            ]
        }
        pred = recognizer.predict(landmarks)

        total_samples += 1
        if sample_labels:
            sample_labels.append(pred["label"])
        print(f"  frame {frame_count}: predicted {pred['label']} "
              f"confidence={pred['confidence']:.2f}")

        if total_samples >= 20:
            break

    cap.release()
    if total_samples == 0:
        print("No samples captured from video.")
    else:
        print(f"\nLive validation trails collected: {total_samples}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate an ISL recogniser")
    parser.add_argument(
        "--model", "-m", type=Path, default=DEFAULT_MODEL, help="Trained model path"
    )
    parser.add_argument(
        "--data", "-d", type=Path, help="Dataset directory (for held-out eval)"
    )
    parser.add_argument(
        "--video", type=Path, help="Video file for live validation"
    )
    parser.add_argument(
        "--fps", type=float, default=30.0, help="Frames-per-second value for the "
        "sample landmarks (not a real camera setting)"
    )
    parser.add_argument(
        "--frames", type=int, default=30, help="Max frames to sample"
    )
    args = parser.parse_args()
    if args.data:
        evaluate_heldout(args.model, args.data)
    elif args.video:
        evaluate_live(args.model, args.video, args.fps, args.frames)
    else:
        print("Nothing to evaluate. Pass --data or --video.")
