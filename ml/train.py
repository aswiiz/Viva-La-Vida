"""Train the gesture model, evaluate on unseen simulated people, and export for browser inference.
Can be executed from any directory:
    python ml/train.py
    python ml/train.py --real ml/data/real/*.json --real-weight 3
Outputs:
    translator/static/translator/model/gesture_mlp.json
    ml/report.txt
"""
import argparse
import glob
import json
import os
from pathlib import Path
import sys
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    confusion_matrix, log_loss
)

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

ap = argparse.ArgumentParser(description="Train and export gesture MLP")
ap.add_argument('--data', default=str(BASE_DIR / 'data' / 'synthetic_landmarks.npz'), help="Path to synthetic_landmarks.npz")
ap.add_argument('--real', nargs='*', default=[], help="Real sample JSON paths")
ap.add_argument('--real-weight', type=int, default=3, help="Weight multiplier for real samples")
ap.add_argument('--out', default=str(REPO_ROOT / 'translator' / 'static' / 'translator' / 'model' / 'gesture_mlp.json'), help="Path to exported model JSON")
ap.add_argument('--report', default=str(BASE_DIR / 'report.txt'), help="Path to evaluation report output")
a = ap.parse_args()

print(f"Loading dataset from: {a.data}")
d = np.load(a.data)
X, y, person, classes = d['X'], d['y'].astype(int), d['person'].astype(int), [str(c) for c in d['classes']]
cid = {c: i for i, c in enumerate(classes)}

# Group-based split: last 6 simulated people (20%) held out as independent test set
test_people = set(range(person.max() - 5, person.max() + 1))
te = np.isin(person, list(test_people))
tr = ~te
Xtr, ytr, Xte, yte = X[tr], y[tr], X[te], y[te]

real_n = 0
for path in [p for g in a.real for p in glob.glob(g)]:
    for s in json.load(open(path))['samples']:
        if s['label'] in cid and len(s['v']) == 40:
            for _ in range(a.real_weight):
                Xtr = np.vstack([Xtr, np.array(s['v'], np.float32)])
                ytr = np.append(ytr, cid[s['label']])
            real_n += 1

# Standardize features on train split only (strictly avoiding test leakage)
scaler = StandardScaler()
Xtr_s = scaler.fit_transform(Xtr)
Xte_s = scaler.transform(Xte)

# Optimized MLP Architecture with L2 regularization
clf = MLPClassifier(
    hidden_layer_sizes=(256, 128),
    alpha=2e-4,
    batch_size=256,
    learning_rate_init=0.001,
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=12,
    max_iter=300,
    random_state=42
)
clf.fit(Xtr_s, ytr)

# Fold StandardScaler into layer 0 weights and biases for zero-overhead, 100% compatible browser deployment:
# W0_folded = W0 / sigma
# b0_folded = b0 - (mu / sigma) @ W0
W0 = clf.coefs_[0].copy()
b0 = clf.intercepts_[0].copy()
mu = scaler.mean_
sigma = scaler.scale_

W0_folded = W0 / sigma[:, None]
b0_folded = b0 - (mu / sigma) @ W0

# Export layers
exported_layers = [
    {
        'in': int(W0_folded.shape[0]),
        'out': int(W0_folded.shape[1]),
        'W': np.round(W0_folded, 5).T.reshape(-1).tolist(),
        'b': np.round(b0_folded, 5).tolist()
    }
]
for i in range(1, len(clf.coefs_)):
    W_i = clf.coefs_[i]
    b_i = clf.intercepts_[i]
    exported_layers.append({
        'in': int(W_i.shape[0]),
        'out': int(W_i.shape[1]),
        'W': np.round(W_i, 5).T.reshape(-1).tolist(),
        'b': np.round(b_i, 5).tolist()
    })

# Verify folded layer inference directly on raw Xte (exact match to browser engine)
def forward_pass_exported(X_in, layers):
    h = X_in.copy()
    for li, L in enumerate(layers):
        W = np.array(L['W']).reshape((L['out'], L['in']))
        b = np.array(L['b'])
        s = h @ W.T + b
        h = np.maximum(0, s) if li < len(layers) - 1 else s
    exp_h = np.exp(h - np.max(h, axis=1, keepdims=True))
    probs = exp_h / np.sum(exp_h, axis=1, keepdims=True)
    preds = np.argmax(probs, axis=1)
    return preds, probs

pred, prob = forward_pass_exported(Xte, exported_layers)

# Calculate metrics
test_acc = accuracy_score(yte, pred)
p_macro, r_macro, f1_macro, _ = precision_recall_fscore_support(yte, pred, average='macro')
p_weighted, r_weighted, f1_weighted, _ = precision_recall_fscore_support(yte, pred, average='weighted')
loss_val = log_loss(yte, prob)
cm = confusion_matrix(yte, pred, labels=range(len(classes)))

lines = [
    f"train samples {len(Xtr)} (real recordings: {real_n})  |  test samples {len(Xte)} from {len(test_people)} unseen simulated people",
    f"accuracy on unseen simulated people: {test_acc * 100:.2f}%",
    f"macro precision: {p_macro * 100:.2f}%  |  macro recall: {r_macro * 100:.2f}%  |  macro F1: {f1_macro * 100:.2f}%",
    f"weighted F1: {f1_weighted * 100:.2f}%  |  log loss: {loss_val:.4f}",
    "\nper-class recall / precision / F1:"
]

for i, c in enumerate(classes):
    rec = cm[i, i] / max(cm[i].sum(), 1)
    prec = cm[i, i] / max(cm[:, i].sum(), 1)
    f1 = 2 * prec * rec / max(prec + rec, 1e-6)
    lines.append(f"  {c:10s} recall {rec * 100:5.1f}%  precision {prec * 100:5.1f}%  F1 {f1 * 100:5.1f}%")

conf = [(cm[i, j], classes[i], classes[j]) for i in range(len(classes)) for j in range(len(classes)) if i != j and cm[i, j]]
lines.append("\nmost frequent confusions (true -> predicted):")
for n, t, p in sorted(conf, reverse=True)[:8]:
    lines.append(f"  {t} -> {p}: {n}")

conf90 = prob.max(1) >= 0.9
lines.append(f"\nwhen the model is >= 90% sure ({conf90.mean() * 100:.1f}% of frames) it is right {np.mean(pred[conf90] == yte[conf90]) * 100:.2f}% of the time")

rep = '\n'.join(lines)
print(rep)

os.makedirs(os.path.dirname(a.report), exist_ok=True)
with open(a.report, 'w') as f:
    f.write(rep + '\n')

os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump({
    'classes': classes,
    'input': 40,
    'activation': 'relu',
    'layers': exported_layers
}, open(a.out, 'w'), separators=(',', ':'))

print('exported', a.out, round(os.path.getsize(a.out) / 1024), 'KB')
