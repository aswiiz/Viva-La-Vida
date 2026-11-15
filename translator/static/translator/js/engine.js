// Rule-based gesture engine on MediaPipe hand landmarks (up to 2 hands) + temporal validation.
// Finger/thumb shape uses MediaPipe's metric 3D "world" landmarks (independent of camera angle and distance);
// screen directions (up / left / ...) use the mirrored image landmarks. All processing is local.
export const CFG = {
  HOLD_MS: 2000,   // same stable gesture required for 2 s
  GRACE_MS: 400,   // a tracking dropout shorter than this does not restart the 2 s hold
  WINDOW: 10,      // rolling window of the last 10 predictions
  MIN_VOTES: 6     // at least 6 matching predictions
};
export const UNKNOWN = 'UNKNOWN';
import { mlp } from './model.js';

const deg = r => r * 180 / Math.PI;
const dirOf = (vx, vy, tol) => {           // screen coords, y grows downward
  const a = deg(Math.atan2(-vy, vx));
  if (Math.abs(a - 90) <= tol) return 'up';
  if (Math.abs(a + 90) <= tol) return 'down';
  if (Math.abs(a) <= tol) return 'right';
  if (Math.abs(Math.abs(a) - 180) <= tol) return 'left';
  return null;
};

export function features(lm, W, H, wl) {
  const P = lm.map(p => [p.x * W, p.y * H, (p.z || 0) * W]);                 // image space (pixels), mirrored
  const Q = wl ? wl.map(p => [p.x, p.y, p.z]) : P;                           // metric 3D if available
  const dq = (a, b) => Math.hypot(Q[a][0]-Q[b][0], Q[a][1]-Q[b][1], Q[a][2]-Q[b][2]);
  const size = dq(0, 9) || 1e-6;                                             // palm length
  const vec = (a, b) => [Q[b][0]-Q[a][0], Q[b][1]-Q[a][1], Q[b][2]-Q[a][2]];
  const angV = (u, v) => deg(Math.acos(Math.max(-1, Math.min(1, (u[0]*v[0]+u[1]*v[1]+u[2]*v[2]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1e-6)))));
  const ang = (a, b, c) => angV(vec(b, a), vec(b, c));                       // interior angle at b, degrees
  const finger = (mcp, pip, dip, tip) => {                                   // 1 extended, 0 folded
    const score = 0.25 * ang(0, mcp, pip) + 0.45 * ang(mcp, pip, dip) + 0.30 * ang(pip, dip, tip);   // ~175 straight, ~95 fist
    const ratio = dq(tip, 0) / dq(mcp, 0);
    if (score >= 140) return 1;                                              // clearly straight
    if (score <= 124) return 0;                                              // clearly bent
    return ratio >= 1.4 ? 1 : 0;                                             // in between: fingertip reach decides
  };
  // thumb: distance of its tip from the palm centre, with straightness as tie-break
  const pc = [0, 5, 9, 13, 17].reduce((a, i) => [a[0]+Q[i][0]/5, a[1]+Q[i][1]/5, a[2]+Q[i][2]/5], [0, 0, 0]);
  const dc = Math.hypot(Q[4][0]-pc[0], Q[4][1]-pc[1], Q[4][2]-pc[2]) / size;
  const straight = (ang(1, 2, 3) + ang(2, 3, 4)) / 2;
  const thumb = dc >= 0.6 ? 1 : dc <= 0.5 ? 0 : (straight >= 155 ? 1 : 0);
  // angles between finger directions (knuckle -> tip): robust measure of how the fingers are spread
  const fd = [[5,8],[9,12],[13,16],[17,20]].map(([a, b]) => vec(a, b));
  const mid = (u, v) => { const a = Math.hypot(...u) || 1, b = Math.hypot(...v) || 1; return [u[0]/a+v[0]/b, u[1]/a+v[1]/b, u[2]/a+v[2]/b]; };
  const spread = [angV(fd[0], fd[1]), angV(fd[2], fd[3]), angV(mid(fd[0], fd[1]), mid(fd[2], fd[3]))];   // index-middle, ring-pinky, pair-to-pair (averaged = less noisy)
  const sizeImg = Math.hypot(P[9][0]-P[0][0], P[9][1]-P[0][1]) || 1e-6;
  return {
    t: thumb, i: finger(5,6,7,8), m: finger(9,10,11,12), r: finger(13,14,15,16), p: finger(17,18,19,20),
    axis: [P[9][0] - P[0][0], P[9][1] - P[0][1]],                            // wrist -> middle knuckle on screen
    pointDir: dirOf(P[8][0] - P[5][0], P[8][1] - P[5][1], 40),
    thumbDir: dirOf(P[4][0] - P[2][0], P[4][1] - P[2][1], 50),
    crossed: (() => { const ra = vec(5, 17), dot = (a, b) => (Q[a][0]-Q[b][0])*ra[0] + (Q[a][1]-Q[b][1])*ra[1] + (Q[a][2]-Q[b][2])*ra[2];
      return dot(8, 12) * dot(5, 9) < 0; })(),                               // index/middle tips swapped sides (rotation-proof)
    dc, straight, spread,
    gap: (a, b) => dq(a, b) / size,
    cx: P[9][0], cy: P[9][1], sizeImg, tip: [P[12][0], P[12][1]], wrist: [P[0][0], P[0][1]]
  };
}

// ---- one hand ----
export function classifyHand(f) {
  const { t, i, m, r, p } = f;
  const n = i + m + r + p;
  if (n === 0) {
    if (t === 1) {                                                          // thumb must be clearly out and straight
      if (f.dc < 0.65 || f.straight < 130) return UNKNOWN;
      return f.thumbDir === 'up' ? 'thumb_up' : f.thumbDir === 'down' ? 'thumb_dn' : UNKNOWN;
    }
    if (dirOf(f.axis[0], f.axis[1], 40) === 'left') return 'fist_l';          // 🤛 knuckles facing the left of the screen
    const v = dirOf(f.axis[0], f.axis[1], 45);
    return v === 'up' || v === 'down' ? 'fist' : UNKNOWN;                    // ✊ upright; a right-facing fist is not a sign
  }
  if (i && !m && !r && !p) return { up: 'one_up', down: 'one_dn', left: 'one_l', right: 'one_r' }[f.pointDir] || UNKNOWN;
  if (i && m && !r && !p) {
    const g = f.gap(8, 12);
    if (f.crossed || g < 0.18) return 'cross';
    return g > 0.28 ? 'victory' : UNKNOWN;
  }
  if (i && !m && !r && p) return t === 1 ? 'love' : 'horns';
  if (!i && !m && !r && p) return t === 1 ? 'call' : UNKNOWN;
  if (i && m && r && !p)   return t === 0 ? 'three' : UNKNOWN;
  if (n === 4) {
    if (dirOf(f.axis[0], f.axis[1], 40) === 'left') return 'left_hand';     // open hand held sideways, fingers to the left
    const up = dirOf(f.axis[0], f.axis[1], 55) === 'up';
    const [im, rp, pair] = f.spread;                                        // Vulcan: two finger pairs split apart, each pair held together
    if (up && pair >= 18 && Math.max(im, rp) <= Math.max(10, 0.7 * pair)) return 'vulcan';
    if (t === 0) return 'four';
    return up ? 'palm' : UNKNOWN;
  }
  return UNKNOWN;
}

// ---- two hands: a = hand on the left of the screen, b = hand on the right ----
// 🙌: both hands open, pointing up and clearly apart (the model's Open_Palm can stand in for a noisy finger reading).
export function classifyTwo(a, b) {
  const up = f => { const d = dirOf(f.axis[0], f.axis[1], 60); return d === 'up'; };
  const ext = f => f.i + f.m + f.r + f.p;
  const otherGesture = f => f.g && f.g.score >= 0.7 && COMPAT[f.g.name] && f.g.name !== 'Open_Palm';   // the model sees a different gesture
  const openModel = f => f.g && f.g.score >= 0.6 && f.g.name === 'Open_Palm';
  if (!up(a) || !up(b) || otherGesture(a) || otherGesture(b)) return UNKNOWN;
  const size = (a.sizeImg + b.sizeImg) / 2, d = (u, v) => Math.hypot(u[0]-v[0], u[1]-v[1]) / size;
  const sep = Math.hypot(a.cx - b.cx, a.cy - b.cy) / size, tips = d(a.tip, b.tip), wrists = d(a.wrist, b.wrist);
  if (sep >= 1.6 && (ext(a) === 4 || openModel(a)) && (ext(b) === 4 || openModel(b))) return 'both_palm';        // 🙌 two clean open hands, clearly apart
  return UNKNOWN;
}


// ---- fusion with Google's gesture classifier (trained on real hands) ----
// The classifier only knows 7 gestures. Where it has a confident opinion it confirms or vetoes our rule result,
// and when our rules are unsure but it is very confident, it supplies the answer.
export const COMPAT = { Closed_Fist: ['fist', 'fist_l'], Thumb_Up: ['thumb_up'], Thumb_Down: ['thumb_dn'], Victory: ['victory', 'cross'],
                 ILoveYou: ['love'], Pointing_Up: ['one_up'], Open_Palm: ['palm', 'vulcan', 'left_hand', 'four'] };
const MODELED = new Set(Object.values(COMPAT).flat());
export function fuseHand(rule, g, f) {
  if (!g || g.score < 0.6 || !COMPAT[g.name]) return rule;                      // no confident opinion ("None" or low score)
  if (rule !== UNKNOWN) {
    if (COMPAT[g.name].includes(rule)) return rule;                              // both agree
    if (rule === 'horns' && g.name === 'ILoveYou') return 'love';               // thumb decides love vs horns
    return MODELED.has(rule) ? UNKNOWN : rule;                                   // contradicted -> UNKNOWN (rule-only signs are left alone)
  }
  if (g.score < 0.8) return UNKNOWN;                                             // rules unsure: only trust a very confident model
  const left = dirOf(f.axis[0], f.axis[1], 40) === 'left', up = dirOf(f.axis[0], f.axis[1], 55) === 'up';
  switch (g.name) {
    case 'Closed_Fist': { if (left) return 'fist_l'; const v = dirOf(f.axis[0], f.axis[1], 45); return v === 'up' || v === 'down' ? 'fist' : UNKNOWN; }
    case 'Thumb_Up': return 'thumb_up';
    case 'Thumb_Down': return 'thumb_dn';
    case 'Victory': return (f.crossed || f.gap(8, 12) < 0.18) ? 'cross' : 'victory';
    case 'ILoveYou': return 'love';
    case 'Pointing_Up': return f.pointDir === 'up' ? 'one_up' : UNKNOWN;
    case 'Open_Palm': return left ? 'left_hand' : up ? 'palm' : UNKNOWN;
  }
  return UNKNOWN;
}

// ---- fusion with our trained model (model.js): never overrules a confident disagreement, it turns it into UNKNOWN ----
export function fuseModel(r, m, g) {
  if (!m || m.p < 0.8) return r;                                                 // model unsure -> rules / Google decide
  if (m.label === 'none') return (m.p >= 0.9 && r !== UNKNOWN) ? UNKNOWN : r;    // "not one of the signs"
  if (r === UNKNOWN) {                                                           // rules unsure: accept only a very confident model
    if (m.p < 0.9) return UNKNOWN;
    if (g && g.score >= 0.6 && COMPAT[g.name] && !COMPAT[g.name].includes(m.label)) return UNKNOWN;   // Google disagrees
    return m.label;
  }
  return r === m.label ? r : UNKNOWN;                                            // agree -> keep, disagree -> UNKNOWN
}

export function classify(feats) {
  if (feats.length === 1) return fuseModel(fuseHand(classifyHand(feats[0]), feats[0].g, feats[0]), feats[0].mp, feats[0].g);
  if (feats.length === 2) {
    const two = classifyTwo(feats[0], feats[1]);
    if (two !== UNKNOWN) return two;
    // Not a two-hand sign. A spurious second detection (very common) must not block a sign made with the other hand,
    // so read each hand alone - but never turn a failed 🙌 attempt (two open hands) into a one-hand sign.
    const OPEN = new Set(['palm', 'four', 'vulcan', 'left_hand']);
    const ls = feats.map(f => fuseModel(fuseHand(classifyHand(f), f.g, f), f.mp, f.g));
    const openish = f => f.i + f.m + f.r + f.p >= 3;
    if (ls.some((l, i) => OPEN.has(l) && openish(feats[1 - i]))) return UNKNOWN;
    const known = ls.map((l, i) => [l, feats[i].sizeImg]).filter(([l]) => l !== UNKNOWN);
    if (!known.length) return UNKNOWN;
    if (known.every(([l]) => l === known[0][0])) return known[0][0];
    const [big, small] = known.sort((x, y) => y[1] - x[1]);                    // different signs: trust a clearly larger (closer) hand
    return big[1] >= 1.5 * small[1] ? big[0] : UNKNOWN;
  }
  return UNKNOWN;
}

export class GestureEngine {
  constructor() { this.reset(); this.lastAccepted = null; this.released = true; this.lastSeen = 0; }
  reset() { this.win = []; this.holdLabel = null; this.holdStart = 0; this.lostSince = null; }
  // det = { hands: [{lm, wl}] sorted left->right on screen, W, H } or null
  update(now, det) {
    if (!det || !det.hands.length) {
      if (this.holdLabel && now - this.lastSeen <= CFG.GRACE_MS) {           // brief dropout (hand not detected for a few frames): keep timing
        const held = now - this.holdStart;
        return { tracking: true, dbg: ['hand dropped out - holding...'], label: null, stable: this.holdLabel, share: 0, progress: Math.min(1, held / CFG.HOLD_MS), remain: Math.max(0, CFG.HOLD_MS - held), blocked: false, accepted: null };
      }
      this.reset();                           // tracking really lost: reset hold + allow repeat this.released = true; this.lastAccepted = null;
      return { tracking: false, label: null, stable: null, share: 0, progress: 0, remain: CFG.HOLD_MS, blocked: false, accepted: null };
    }
    this.lastSeen = now;
    const feats = det.hands.map(h => ({ ...features(h.lm, det.W, det.H, h.wl), g: h.g || null, mp: mlp.predict(h.lm, det.W, det.H) }));
    const label = classify(feats);
    const f0 = feats.length === 1 ? feats[0] : null;
    this.src = f0 ? { rule: classifyHand(f0), google: f0.g && f0.g.score >= 0.6 ? f0.g.name : null, mlp: f0.mp && f0.mp.p >= 0.8 ? f0.mp.label : null, fused: label } : { rule: null, google: null, mlp: null, fused: label };
    const dbg = [`raw: ${label}   hands: ${feats.length}`, ...(feats.length === 2 ? [(() => { const [a, b] = feats, sz = (a.sizeImg + b.sizeImg) / 2; return `sep ${(Math.hypot(a.cx-b.cx, a.cy-b.cy)/sz).toFixed(2)}  tips ${(Math.hypot(a.tip[0]-b.tip[0], a.tip[1]-b.tip[1])/sz).toFixed(2)}`; })()] : []), ...feats.map(f => `T${f.t} I${f.i} M${f.m} R${f.r} P${f.p} | thumb dc ${f.dc.toFixed(2)} str ${f.straight.toFixed(0)} | pair ${f.spread[2].toFixed(0)} im ${f.spread[0].toFixed(0)} rp ${f.spread[1].toFixed(0)} | pt ${f.pointDir} thumbDir ${f.thumbDir} | google ${f.g ? f.g.name + ' ' + f.g.score.toFixed(2) : '-'} | mlp ${f.mp ? f.mp.label + ' ' + f.mp.p.toFixed(2) : '-'}`)];
    this.win.push(label); if (this.win.length > CFG.WINDOW) this.win.shift();
    const counts = {}; this.win.forEach(l => counts[l] = (counts[l] || 0) + 1);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const majority = top[1] >= CFG.MIN_VOTES ? top[0] : null;
    const stable = majority && majority !== UNKNOWN ? majority : null;
    const share = stable ? counts[stable] / this.win.length : 0;
    if (majority && majority !== this.lastAccepted) this.released = true;   // different pose / neutral = release
    if (stable === this.holdLabel) this.lostSince = null;
    else if (!stable && this.holdLabel && (this.lostSince === null || now - this.lostSince <= CFG.GRACE_MS)) { if (this.lostSince === null) this.lostSince = now; }   // brief dropout: keep timing
    else { this.holdLabel = stable; this.holdStart = now; this.lostSince = null; }
    const blocked = !!stable && stable === this.lastAccepted && !this.released;
    const held = this.holdLabel && !blocked && (stable || this.lostSince !== null) ? now - this.holdStart : 0;
    let accepted = null;
    if (stable && stable === this.holdLabel && !blocked && held >= CFG.HOLD_MS) {
      accepted = stable; this.lastAccepted = stable; this.released = false; this.holdLabel = null;
    }
    return { tracking: true, dbg, label, stable, share, progress: Math.min(1, held / CFG.HOLD_MS), remain: Math.max(0, CFG.HOLD_MS - held), blocked, accepted };
  }
}
