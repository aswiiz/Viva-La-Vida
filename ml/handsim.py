"""Synthetic hand-landmark generator (3D forward-kinematics hand, cm) used to build the training dataset.

Every sample = the 21 MediaPipe landmarks of one simulated hand, after random person proportions, left/right hand,
palm/back facing, rotation, camera scale, z-scale error and landmark noise, turned into the same 40-number feature
vector the browser computes (see `feature_vector`, mirrored in static/translator/js/model.js).
"""
import numpy as np

rad = np.deg2rad

# ---- hand skeleton (cm). local axes: u = along the fingers, r = across the palm (index -> pinky), n = palm normal
FING = [  # mcp (u, r), segment lengths
    ((8.6, -2.8), (4.5, 2.6, 2.0)), ((9.0, -0.6), (5.0, 3.0, 2.2)),
    ((8.4, 1.5), (4.6, 2.8, 2.1)), ((7.4, 3.3), (3.7, 2.2, 1.9))]
TH_CMC, TH_SEG = np.array([2.0, -2.5, 0.0]), (4.0, 3.2, 2.6)

SINGLE = ['fist', 'fist_l', 'thumb_up', 'thumb_dn', 'one_up', 'one_dn', 'one_l', 'one_r', 'victory', 'cross',
          'love', 'horns', 'call', 'three', 'four', 'palm', 'vulcan', 'left_hand']
CLASSES = SINGLE + ['none']


class Person:
    """Per-person anatomy and habits, so train/test can be split by person."""
    def __init__(self, rng):
        self.scale = rng.uniform(0.85, 1.15)
        self.fl = rng.uniform(0.92, 1.08, 4)           # finger length multipliers
        self.width = rng.uniform(0.9, 1.1)             # palm width multiplier
        self.thumb = rng.uniform(0.9, 1.1)
        self.bias = rng.normal(0, 6)                   # habit: fingers a bit more / less curled
        self.noise = rng.uniform(0.15, 0.5)            # landmark noise (cm) for this person/camera


def _unit(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def finger_pts(p, k, flex, phi):
    (mu, mr), seg = FING[k]
    pos = np.array([mu, mr * p.width, 0.0]) * p.scale
    out, cum = [pos], 0.0
    for s in range(3):
        cum += rad(flex[s])
        d = np.array([np.cos(rad(phi)) * np.cos(cum), np.sin(rad(phi)) * np.cos(cum), np.sin(cum)])
        pos = pos + d * seg[s] * p.fl[k] * p.scale
        out.append(pos)
    return out  # mcp, pip, dip, tip


def thumb_pts(p, al, be, f0, f1):
    d0 = np.array([np.cos(rad(be)) * np.cos(rad(al)), -np.cos(rad(be)) * np.sin(rad(al)), np.sin(rad(be))])
    pos, out = TH_CMC * p.scale, [TH_CMC * p.scale]
    for s, f in enumerate([0, f0, f1]):
        d = _unit(d0 * np.cos(rad(f)) + np.array([0, 0, 1.0]) * np.sin(rad(f)))
        pos = pos + d * TH_SEG[s] * p.thumb * p.scale
        out.append(pos)
    return out  # cmc, mcp, ip, tip


# ---- thumb pose pools: tucked across the palm / wrapped over the fingers (found by random search once)
def _thumb_tip_batch(P):
    al, be, f0, f1 = (rad(P[:, i]) for i in range(4))
    d0 = np.stack([np.cos(be) * np.cos(al), -np.cos(be) * np.sin(al), np.sin(be)], 1)
    pos = np.tile(TH_CMC, (len(P), 1))
    for s, f in enumerate([np.zeros_like(f0), f0, f1]):
        d = d0 * np.cos(f)[:, None] + np.array([0, 0, 1.0]) * np.sin(f)[:, None]
        pos = pos + _unit(d) * TH_SEG[s]
    return pos


def _pool(center, n=600_000, keep=600, seed=0):
    """thumb poses whose tip lands closest to `center` (cm, local u/r/n) - i.e. folded across / over the palm"""
    r = np.random.default_rng(seed)
    P = np.stack([r.uniform(-80, 80, n), r.uniform(-10, 70, n), r.uniform(0, 90, n), r.uniform(0, 90, n)], 1)
    d = np.linalg.norm(_thumb_tip_batch(P) - np.array(center), axis=1)
    return P[np.argsort(d)[:keep]]


POOL = {'tuck': _pool((5.5, 0.5, 1.6)), 'wrap': _pool((7.0, -0.5, 3.6), seed=1)}


def thumb_params(kind, rng):
    if kind in POOL:
        return POOL[kind][rng.integers(len(POOL[kind]))]
    if kind == 'abd':   return np.array([rng.uniform(40, 70), rng.uniform(0, 25), rng.uniform(0, 15), rng.uniform(0, 15)])
    if kind == 'along': return np.array([rng.uniform(5, 30), rng.uniform(0, 25), rng.uniform(0, 15), rng.uniform(0, 15)])
    return np.array([rng.uniform(-60, 70), rng.uniform(-10, 60), rng.uniform(0, 70), rng.uniform(0, 70)])   # 'any'


def flex(state, p, rng):
    b = p.bias
    if state == 'E': return np.array([rng.uniform(-4, 8), rng.uniform(-5, 8), rng.uniform(-5, 10)]) - np.array([b, b, b]) * 0.4 * (b < 0)
    if state == 'F': return np.array([rng.uniform(70, 95), rng.uniform(85, 110), rng.uniform(45, 75)]) + b
    return np.array([rng.uniform(15, 70), rng.uniform(20, 85), rng.uniform(5, 55)])   # 'R' relaxed / half-curled


# ---- sign specs: finger states (index..pinky), thumb pose, roll centres (deg, 0 = fingers up), jitter, or 'any' range
SPEC = {
    'fist':      dict(f='FFFF', th='wrap',  roll=[0, 180], jit=25),
    'fist_l':    dict(f='FFFF', th='wrap',  roll=[-90], jit=25),
    'thumb_up':  dict(f='FFFF', th='along', roll=[0], jit=20),
    'thumb_dn':  dict(f='FFFF', th='along', roll=[180], jit=20),
    'one_up':    dict(f='EFFF', th='tuck',  roll=[0], jit=25),
    'one_dn':    dict(f='EFFF', th='tuck',  roll=[180], jit=25),
    'one_l':     dict(f='EFFF', th='tuck',  roll=[-90], jit=25),
    'one_r':     dict(f='EFFF', th='tuck',  roll=[90], jit=25),
    'victory':   dict(f='EEFF', th='tuck',  any=60),
    'cross':     dict(f='EEFF', th='tuck',  any=60),
    'love':      dict(f='EFFE', th='abd',   any=60),
    'horns':     dict(f='EFFE', th='tuck',  any=60),
    'call':      dict(f='FFFE', th='abd',   any=60),
    'three':     dict(f='EEEF', th='tuck',  any=60),
    'four':      dict(f='EEEE', th='tuck',  any=45),
    'palm':      dict(f='EEEE', th='abd',   roll=[0], jit=30),
    'vulcan':    dict(f='EEEE', th='abd',   roll=[0], jit=30),
    'left_hand': dict(f='EEEE', th='abd',   roll=[-90], jit=25),
}


def phis(cls, rng):
    if cls == 'victory':
        a = rng.uniform(7, 20); return [-a, a, 0, 0]
    if cls == 'cross':
        if rng.random() < 0.25: return [rng.uniform(-1, 1), rng.uniform(-1, 1), 0, 0]      # touching, not crossed
        a = rng.uniform(4, 10); return [a, -a, 0, 0]
    if cls == 'vulcan':
        b = rng.uniform(9, 18); return [-b + rng.normal(0, 2), -b + rng.normal(0, 2), b + rng.normal(0, 2), b + rng.normal(0, 2)]
    if cls in ('palm', 'left_hand', 'four'):
        return [rng.uniform(-8, -1), rng.uniform(-3, 2), rng.uniform(0, 6), rng.uniform(3, 10)]
    return [rng.normal(0, 2) for _ in range(4)]


def Rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.0]])
def Rx(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def Ry(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def build_local(p, fstates, th, phi, rng, thumb_p=None):
    tp = thumb_params(th, rng) if thumb_p is None else thumb_p
    pts = [np.zeros(3)] + thumb_pts(p, *tp)
    for k in range(4):
        pts += finger_pts(p, k, flex(fstates[k], p, rng) if isinstance(fstates[k], str) else fstates[k], phi[k])
    return np.array(pts)    # 21 x 3 in the order of the MediaPipe landmarks


def feature_vector(R, rng, p):
    """R: 21x3 cm in camera axes (x right, y down, z away) -> the 40-number feature used by the browser model."""
    R = R + rng.normal(0, p.noise, R.shape) * np.array([1, 1, 1.5])
    R[:, 2] *= rng.uniform(0.5, 1.4)                 # MediaPipe z is only roughly scaled
    wrist, size = R[0], np.linalg.norm(R[9] - R[0])
    v = (R[1:, :2] - wrist[:2]) / size                # image x,y only: the camera's depth (z) is too noisy to trust
    return v.reshape(-1).astype(np.float32)


def place(local, rng, roll_deg):
    chir, face = rng.choice([-1, 1]), rng.choice([-1, 1])
    pts = np.stack([chir * local[:, 1], -local[:, 0], -face * local[:, 2]], 1)      # u -> up, r -> x, n -> toward/away camera
    rot = Rz(rad(roll_deg)) @ Ry(rad(rng.normal(0, 10))) @ Rx(rad(rng.normal(0, 10)))
    return pts @ rot.T


def roll_for(spec, rng):
    if 'any' in spec: return rng.uniform(-spec['any'], spec['any'])
    return rng.choice(spec['roll']) + rng.normal(0, spec['jit'] / 2)


def _circ(a, b): return abs((a - b + 180) % 360 - 180)


def in_zone(cls, roll):
    s = SPEC[cls]
    if 'any' in s: return abs(roll) < s['any'] + 10 or True      # any-roll classes: their shape is never "none"
    return any(_circ(roll, c) < 55 for c in s['roll'])


def sample_class(cls, p, rng):
    s = SPEC[cls]
    local = build_local(p, list(s['f']), s['th'], phis(cls, rng), rng)
    return feature_vector(place(local, rng, roll_for(s, rng)), rng, p)


def sample_none(p, rng):
    kind = rng.choice(['combo', 'relaxed', 'blend'], p=[0.5, 0.3, 0.2])
    while True:
        if kind == 'combo':
            f = ''.join(rng.choice(['E', 'F'], 4)); th = rng.choice(['abd', 'tuck', 'along', 'wrap'])
            roll = rng.uniform(-180, 180)
            clash = [c for c, s in SPEC.items() if s['f'] == f and s['th'] == th and
                     ('any' in s or any(_circ(roll, r) < 55 for r in s['roll']))]
            if th == 'wrap' and f == 'FFFF' and (_circ(roll, 0) < 55 or _circ(roll, 180) < 55): clash.append('fist')
            if clash: continue
            local = build_local(p, list(f), th, [rng.normal(0, 3) for _ in range(4)], rng)
        elif kind == 'relaxed':
            roll = rng.uniform(-180, 180)
            local = build_local(p, ['R'] * 4, rng.choice(['abd', 'tuck', 'any']), [rng.normal(0, 4) for _ in range(4)], rng)
        else:   # blend: halfway between two different poses
            a, b = rng.choice(SINGLE, 2, replace=False)
            lam = rng.uniform(0.35, 0.65)
            fa = [flex(c, p, rng) for c in SPEC[a]['f']]; fb = [flex(c, p, rng) for c in SPEC[b]['f']]
            roll = roll_for(SPEC[a], rng)
            local = build_local(p, [(1 - lam) * x + lam * y for x, y in zip(fa, fb)], 'any', [rng.normal(0, 4) for _ in range(4)], rng)
        return feature_vector(place(local, rng, roll), rng, p)
