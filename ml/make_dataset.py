"""Build the synthetic training dataset:  python ml/make_dataset.py [--persons 30] [--per-class 40]
Output: ml/data/synthetic_landmarks.npz  (X float32 [N,40], y int8, person int16, classes)"""
import argparse, json, time
import numpy as np
from handsim import CLASSES, SINGLE, Person, sample_class, sample_none

ap = argparse.ArgumentParser()
ap.add_argument('--persons', type=int, default=30)
ap.add_argument('--per-class', type=int, default=40)
ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args()
rng = np.random.default_rng(a.seed)
X, y, who = [], [], []
t0 = time.time()
for pid in range(a.persons):
    p = Person(rng)
    for ci, c in enumerate(SINGLE):
        for _ in range(a.per_class):
            X.append(sample_class(c, p, rng)); y.append(ci); who.append(pid)
    for _ in range(a.per_class * 6):                       # 'none' = everything that is not a sign
        X.append(sample_none(p, rng)); y.append(len(SINGLE)); who.append(pid)
    print(f'person {pid + 1}/{a.persons}  {len(X)} samples  {time.time() - t0:.0f}s', flush=True)
np.savez_compressed('data/synthetic_landmarks.npz', X=np.array(X, np.float32), y=np.array(y, np.int8),
                    person=np.array(who, np.int16), classes=np.array(CLASSES))
json.dump({'classes': CLASSES, 'samples': len(X), 'persons': a.persons, 'features': 40}, open('data/synthetic_meta.json', 'w'), indent=1)
print('saved', len(X), 'samples')
