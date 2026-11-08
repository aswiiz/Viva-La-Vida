#!/usr/bin/env python3
"""Train an ISL hand-sign recogniser from normalized MediaPipe landmarks.

Usage:
    python train.py --data dataset/ --output translator/recognition/models/isl_recognizer.pkl --test-split 0.2

Dataset format
--------------
``--data`` expects a directory containing *one JSON or CSV file per gesture* (or a
single "dataset.csv" with a ``label`` column):

    dataset/
        hello.json        (or .csv)
        thank_you.json
        ...
    # or dataset/dataset.csv
        x,y,z,label
        0.12,0.45,0.01,hello
        ...

Each landmark file is a list of 21 MediaPipe hand landmarks:

    [{"x":0.1,"y":0.2,"z":0.0}, ... ]

The script:
    1. Loads every file, normalises to a flat 63-d vector per sample.
    2. Trains a small classifier (RandomForest by default; XGBoost/LinearSVC
       options are available).
    3. Evaluates on a held-out split and reports per-class accuracy.
    4. Saves a ``{estimator, labels}`` dictionary to ``--output``.

Important: train on a representative, diverse dataset (multiple users, skins,
lighting conditions, both hands, palm and finger variations). The accuracy you
see here is *trained accuracy on your own data* — it is not a benchmark and
does not transfer to other datasets without retraining.
"""

from __future__ import annotations

import argparse
import json
import pickle
import sys
from pathlib import Path

import numpy as np

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, classification_report
    from sklearn.model_selection import train_test_split
    from sklearn.utils.class_weight import compute_class_weight
    from sklearn.utils import shuffle as sk_shuffle
except ImportError as exc:  # pragma: no cover
    sys.exit(f"Missing dependency: {exc.name}. Install e.g. `pip install scikit-learn`")


DEFAULT_OUTPUT = (
    Path(__file__).resolve().parent / "models" / "isl_recognizer.pkl"
)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def _load_flat_vector(payload):
    """Normalise a single landmark payload to a flat 63-d vector."""
    flat = []
    if isinstance(payload, dict):
        pts = payload.get("landmarks", [])
        if isinstance(pts, (list, tuple)):
            data = pts
        else:
            data = [payload]
    elif isinstance(payload, (list, tuple)):
        data = payload
    else:
        return None

    for item in data:
        if isinstance(item, dict):
            flat.extend([item.get("x", 0.0), item.get("y", 0.0), item.get("z", 0.0)])
        else:
            row = list(item)
            # Pad/truncate to 3
            while len(row) < 3:
                row.append(0.0)
            flat.extend([float(row[0]), float(row[1]), float(row[2])])

    while len(flat) < 63:
        flat.append(0.0)
    return np.array(flat[:63], dtype=np.float32)


def _load_file(path: Path):
    """Return (X_sample, label) or (None, None) for a single landmark file."""
    suffix = path.suffix.lower()
    try:
        if suffix in {".json"}:
            payload = json.loads(path.read_text(encoding="utf-8"))
        elif suffix in {".csv"}:
            import csv

            rows = list(csv.DictReader(path.open(newline="", encoding="utf-8")))
            flat = []
            for row in rows:
                flat.extend([float(row.get("x", 0)), float(row.get("y", 0)),
                             float(row.get("z", 0))])
            while len(flat) < 63:
                flat.append(0.0)
            return np.array(flat[:63], dtype=np.float32), None
        else:
            # Unknown format: try our custom JSON first
            return None, None
    except Exception as exc:
        print(f"  [warn] could not read {path}: {exc}", file=sys.stderr)
        return None, None

    # payload is a list of landmarks (=> dataset.json per gesture)
    if isinstance(payload, (list, tuple)):
        X = _load_flat_vector(payload)
        if X is None or len(X) != 63:
            return None, None
        return X, None

    # payload may be a dict with a "landmarks" list
    X = _load_flat_vector(payload)
    if X is None or len(X) != 63:
        return None, None
    return X, None


def load_dataset(data_dir: Path, label_col: str = "label"):
    """Load all gesture files under ``data_dir``.

    Returns (X, y) arrays plus a sorted list of unique labels.
    """
    data_dir = Path(data_dir)
    if not data_dir.is_dir():
        sys.exit(f"Dataset directory not found: {data_dir}")

    # Collect candidate files
    candidates = sorted(data_dir.glob("*.json")) + sorted(data_dir.glob("*.csv"))
    if not candidates:
        # Fall back to a single "dataset.csv"/"dataset.json"
        for name in ("dataset/dataset.csv", "dataset/dataset.json"):
            p = data_dir / name
            if p.exists():
                candidates.append(p)

    if not candidates:
        sys.exit(f"No landmark files found in {data_dir}")

    X_list = []
    y_list = []

    print(f"Loading dataset from {data_dir} ...")
    for path in candidates:
        X, label = _load_file(path)
        if X is None:
            continue
        # Determine label: file name minus extension, OR the label column if csv
        if label is not None:
            y_list.append(label)
        else:
            y_list.append(path.stem)

        X_list.append(X)

        # Print a few examples so the user can verify the format in the log
        print(f"  loaded {path.name} -> label={y_list[-1]}")

    if not X_list:
        sys.exit("No samples loaded. Check your file format and dataset directory.")

    X = np.stack(X_list)
    y = np.array(y_list, dtype=object)

    labels = sorted(set(y))
    print(f"Loaded {X.shape[0]} samples across {len(labels)} classes: {labels}")
    return X, y, labels


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def build_classifier(X, y, strategy: str = "random_forest"):
    """Build a classifier from the training split."""
    if strategy == "random_forest":
        model = RandomForestClassifier(
            n_estimators=400,
            max_depth=None,
            min_samples_split=5,
            class_weight="balanced",
            n_jobs=-1,
            random_state=42,
        )
    elif strategy == "logistic":
        model = LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            n_jobs=-1,
            random_state=42,
        )
    elif strategy == "xgboost":
        try:
            from xgboost import XGBClassifier
        except ImportError:
            sys.exit("xgb strategy requires `pip install xgboost`")
        model = XGBClassifier(
            n_estimators=400,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="mlogloss",
            random_state=42,
        )
    else:
        sys.exit(f"Unknown strategy: {strategy}")

    return model


def train(
    data_dir,
    output: Path = DEFAULT_OUTPUT,
    test_split: float = 0.2,
    strategy: str = "random_forest",
    show_report: bool = True,
):
    X, y, labels = load_dataset(data_dir)
    X, y = sk_shuffle(X, y, random_state=42)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_split, stratify=y, random_state=42
    )

    classes = np.unique(y_train)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
    weight_map = dict(zip(classes, weights))

    model = build_classifier(X_train, y_train, strategy)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred))

    if show_report:
        print("\n--- Evaluation (held-out split) ---")
        print(f"Accuracy: {accuracy:.4f}")
        print(classification_report(y_test, y_pred, labels=classes, zero_division=0))

    # Persist estimator + labels
    artifact = {
        "estimator": model,
        "labels": list(labels),
        "class_weight": weight_map,
        "trained_at": "2026-11-08",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    import joblib  # type: ignore

    joblib.dump(artifact, output)
    print(f"\nSaved trained model to {output}")
    print("Verify the model works before deploying:")
    print(f"  python -c \"from translator.recognition import Recognizer; r = Recognizer.load('{output}'); print(r.loaded)\"")
    return artifact, accuracy


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train an ISL recogniser")
    parser.add_argument(
        "--data", "-d", required=True, help="Directory of gesture JSON/CSV files"
    )
    parser.add_argument(
        "--output", "-o", type=Path, default=DEFAULT_OUTPUT, help="Output model path"
    )
    parser.add_argument(
        "--test-split", type=float, default=0.2, help="Hold-out test fraction"
    )
    parser.add_argument(
        "--strategy",
        choices=["random_forest", "logistic", "xgboost"],
        default="random_forest",
        help="Classifier strategy",
    )
    args = parser.parse_args()
    train(args.data, args.output, args.test_split, args.strategy)
