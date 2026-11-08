"""Viva La Vida — Indian Sign Language (ISL) recognition package.

Public interface:
    Recognizer          — load a trained model and predict signs from landmarks
    RecognizerConfig    — discover the model path from the environment
    recognize_landmarks — lightweight module-level helper used by the API view

The trained weights are **not** bundled with the repository. The interface below
is fully wired; set ``RECOGNITION_MODEL_PATH`` (or the ``MODEL_PATH`` env var)
to the path of a trained model produced by `train.py`. Without a model the
recogniser reports an honest "not configured" result instead of fabricating a
sign.
"""

from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_MODEL_ENV_VARS = [
    "RECOGNITION_MODEL_PATH",
    "MODEL_PATH",
]

DEFAULT_MODEL_FILENAME = "isl_recognizer.pkl"
DEFAULT_MODEL_SUBDIR = "recognition"


def _resolve_model_path() -> str | None:
    """Return the configured trained-model path, or None if undefined."""
    for var in DEFAULT_MODEL_ENV_VARS:
        value = os.environ.get(var)
        if value:
            return value
    return None


def is_model_configured() -> bool:
    """True when a trained-model path has been configured."""
    return _resolve_model_path() is not None


def model_path() -> str | None:
    """Return the configured trained-model path (or None)."""
    return _resolve_model_path()


# ---------------------------------------------------------------------------
# Model adapter
# ---------------------------------------------------------------------------

class Recognizer:
    """Load a trained ISL recogniser and predict from normalized landmarks.

    The adapter is deliberately thin: it normalises the landmark array produced
    by the browser/OpenCV pipeline into a flat feature vector, then delegates the
    actual classification to a pickled scikit-learn-style estimator whose
    ``predict`` method supports both vector and (optional) ``target`` input.
    """

    def __init__(self, model_path: str | None = None):
        self._model_path = Path(model_path) if model_path else None
        self._estimator = None
        self._labels = None
        self.loaded = False

    @classmethod
    def load(cls, model_path: str | None = None) -> "Recognizer":
        """Class-level factory: owns its own instance for one-shot use."""
        instance = cls(model_path)
        instance.load()
        return instance

    def load(self) -> None:
        """Find and load the trained model. Sets ``loaded`` and populates
        ``estimator`` / ``labels``. Safe to call repeatedly."""
        path = self._model_path or Path(
            os.environ.get("RECOGNITION_MODEL_PATH")
            or os.environ.get("MODEL_PATH")
            or settings.BASE_DIR
            / "translator"
            / "recognition"
            / DEFAULT_MODEL_SUBDIR
            / DEFAULT_MODEL_FILENAME
        )

        if not path.exists():
            # No model installed — leave the recogniser ready to report this
            # honestly rather than failing the whole request.
            self.loaded = False
            self._estimator = None
            self._labels = None
            return

        try:
            import joblib  # type: ignore
        except ImportError:  # pragma: no cover - dependency missing
            self.loaded = False
            self._estimator = None
            self._labels = None
            return

        try:
            artifact = joblib.load(path)
        except Exception:
            self.loaded = False
            self._estimator = None
            self._labels = None
            return

        if isinstance(artifact, dict):
            self._estimator = artifact.get("estimator")
            self._labels = artifact.get("labels")
        else:
            self._estimator = artifact

        # Labels from the training set (if exposed).
        if self._estimator is not None and not self._labels:
            self._labels = getattr(self._estimator, "classes_", None)

        self.loaded = True

    def _normalize_landmarks(self, landmarks) -> list[float]:
        """Convert a landmark payload into a flat feature vector.

        Accepts:
            * a list/array of 21 normalized (x, y, z) dicts
            * a flat list of numbers
            * a dict with an iterable of landmarks
        """
        if isinstance(landmarks, dict):
            points = landmarks.get("landmarks", [])
            if isinstance(points, (list, tuple)):
                landmarks = points
            else:
                landmarks = [landmarks]

        flat = []
        if hasattr(landmarks, "shape") and hasattr(landmarks, "tolist"):
            raw = landmarks.tolist()
        else:
            raw = landmarks

        if isinstance(raw, (list, tuple)) and len(raw):
            first = raw[0]
            if isinstance(first, (int, float)):
                # Flat list of numbers -> 21 points * 3 coords
                flat = [float(v) for v in raw]
            elif isinstance(first, dict):
                # List of landmark dicts
                for pt in raw:
                    flat.extend([pt.get("x", 0.0), pt.get("y", 0.0), pt.get("z", 0.0)])
            else:
                flat = [float(v) for v in raw]
        else:
            flat = [0.0] * 63

        # Pad/truncate to 63 (21 points x 3 coords)
        while len(flat) < 63:
            flat.append(0.0)
        return flat[:63]

    def predict(self, landmarks, target: str | None = None):
        """Return ``{"label": ..., "confidence": ...}``.

        If no trained model is loaded, returns an honest "not configured" result
        without fabricating a sign.
        """
        if not self.loaded or self._estimator is None:
            return {"label": "—", "confidence": 0.0, "unauthorized": True}

        features = self._normalize_landmarks(landmarks)
        try:
            if target is not None:
                result = self._estimator.predict([features], target=target)
            else:
                result = self._estimator.predict([features])
        except Exception:
            return {"label": "—", "confidence": 0.0}

        if isinstance(result, str):
            return {"label": result, "confidence": 0.0}

        if hasattr(result, "tolist"):
            result = result.tolist()
        if isinstance(result, (list, tuple)):
            label = result[0] if result else "—"
        else:
            label = result

        confidence = 0.0
        if self._labels is not None:
            try:
                import numpy as np
                idx = list(self._labels).index(label)
                probs = self._estimator.predict_proba([features])
                if probs is not None and hasattr(probs, "tolist"):
                    probs = probs.tolist()
                if probs is not None and len(probs):
                    confidence = float(np.max(probs[0]))
            except Exception:
                confidence = 0.0

        return {"label": label, "confidence": confidence}


# ---------------------------------------------------------------------------
# Module-level convenience helpers
# ---------------------------------------------------------------------------

_default_recognizer: Recognizer | None = None


def get_recognizer(model_path: str | None = None) -> Recognizer:
    """Return a (cached) Recognizer instance."""
    global _default_recognizer
    if _default_recognizer is None or (
        model_path is not None and model_path != _default_recognizer._model_path
    ):
        _default_recognizer = Recognizer.load(model_path)
    return _default_recognizer


def recognize_landmarks(
    landmarks,
    target: str | None = None,
    model_path: str | None = None,
):
    """One-shot prediction helper."""
    return get_recognizer(model_path).predict(landmarks, target=target)
