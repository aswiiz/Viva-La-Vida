"""Train the gesture model and export it for the browser.
   python ml/train.py                              # synthetic data only
   python ml/train.py --real data/real/*.json      # + real recordings from the /collect/ page (weighted x3)
Output: translator/static/translator/model/gesture_mlp.json  +  ml/report.txt"""
import argparse, glob, json, sys
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import confusion_matrix

ap = argparse.ArgumentParser()
ap.add_argument('--real', nargs='*', default=[])
ap.add_argument('--real-weight', type=int, default=3)
ap.add_argument('--out', default='../translator/static/translator/model/gesture_mlp.json')
a = ap.parse_args()

d = np.load('data/synthetic_landmarks.npz')
X, y, person, classes = d['X'], d['y'].astype(int), d['person'].astype(int), [str(c) for c in d['classes']]
cid = {c: i for i, c in enumerate(classes)}
test_people = set(range(person.max() - 5, person.max() + 1))              # last 6 simulated people are never trained on
te = np.isin(person, list(test_people)); tr = ~te
Xtr, ytr, Xte, yte = X[tr], y[tr], X[te], y[te]

real_n = 0
for path in [p for g in a.real for p in glob.glob(g)]:
    for s in json.load(open(path))['samples']:
        if s['label'] in cid and len(s['v']) == 40:
            for _ in range(a.real_weight):
                Xtr = np.vstack([Xtr, np.array(s['v'], np.float32)]); ytr = np.append(ytr, cid[s['label']])
            real_n += 1

clf = MLPClassifier(hidden_layer_sizes=(128, 64), alpha=1e-4, early_stopping=True, n_iter_no_change=12,
                    max_iter=400, random_state=0)
clf.fit(Xtr, ytr)

lines = [f'train samples {len(Xtr)} (real recordings: {real_n})  |  test samples {len(Xte)} from {len(test_people)} unseen simulated people']
pred = clf.predict(Xte)
lines.append(f'accuracy on unseen simulated people: {np.mean(pred == yte) * 100:.1f}%')
cm = confusion_matrix(yte, pred, labels=range(len(classes)))
lines.append('\nper-class recall / precision:')
for i, c in enumerate(classes):
    rec = cm[i, i] / max(cm[i].sum(), 1); prec = cm[i, i] / max(cm[:, i].sum(), 1)
    lines.append(f'  {c:10s} recall {rec * 100:5.1f}%  precision {prec * 100:5.1f}%')
conf = [(cm[i, j], classes[i], classes[j]) for i in range(len(classes)) for j in range(len(classes)) if i != j and cm[i, j]]
lines.append('\nmost frequent confusions (true -> predicted):')
for n, t, p in sorted(conf, reverse=True)[:8]: lines.append(f'  {t} -> {p}: {n}')
prob = clf.predict_proba(Xte); conf90 = prob.max(1) >= 0.9
lines.append(f'\nwhen the model is >= 90% sure ({conf90.mean() * 100:.0f}% of frames) it is right {np.mean(pred[conf90] == yte[conf90]) * 100:.1f}% of the time')
rep = '\n'.join(lines); print(rep); open('report.txt', 'w').write(rep + '\n')

import os
os.makedirs(os.path.dirname(a.out), exist_ok=True)
json.dump({'classes': classes, 'input': 40, 'activation': 'relu',
           'layers': [{'in': W.shape[0], 'out': W.shape[1], 'W': np.round(W, 5).T.reshape(-1).tolist(), 'b': np.round(b, 5).tolist()}
                      for W, b in zip(clf.coefs_, clf.intercepts_)]}, open(a.out, 'w'), separators=(',', ':'))
print('exported', a.out, round(os.path.getsize(a.out) / 1024), 'KB')
