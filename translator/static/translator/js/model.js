// Trained gesture model (small MLP, 40 landmark numbers -> 17 signs + "none"), run locally in the browser.
// Trained by ml/train.py on ml/data/synthetic_landmarks.npz (+ optional real recordings from /collect/).
// Feature vector = x,y of the 20 landmarks (without the wrist), wrist-centred, divided by the palm length.
// Depth (z) is deliberately not used: it is the noisiest output of the hand tracker.
export function vectorOf(lm, W, H) {
  const P = lm.map(p => [p.x * W, p.y * H, (p.z || 0) * W]), w = P[0];
  const size = Math.hypot(P[9][0] - w[0], P[9][1] - w[1], P[9][2] - w[2]) || 1e-6;   // 3D palm length (same as in training)
  const v = new Float32Array(40); let j = 0;
  for (let i = 1; i < 21; i++) { v[j++] = (P[i][0] - w[0]) / size; v[j++] = (P[i][1] - w[1]) / size; }
  return v;
}

export const mlp = {
  ready: false, net: null,
  async load(url) {
    if (this.ready || !url) return this.ready;
    try { this.setNet(await (await fetch(url)).json()); } catch (e) { console.warn('gesture model not loaded, using rules only', e); }
    return this.ready;
  },
  setNet(net) { this.net = net; this.ready = true; },
  predict(lm, W, H) {
    if (!this.ready) return null;
    let h = vectorOf(lm, W, H);
    this.net.layers.forEach((L, li) => {
      const o = new Float32Array(L.out);
      for (let j = 0; j < L.out; j++) { let s = L.b[j]; const base = j * L.in; for (let i = 0; i < L.in; i++) s += L.W[base + i] * h[i]; o[j] = (li < this.net.layers.length - 1) ? Math.max(0, s) : s; }
      h = o;
    });
    const mx = Math.max(...h); let sum = 0; const e = Array.from(h, x => { const v = Math.exp(x - mx); sum += v; return v; });
    let k = 0; for (let i = 1; i < e.length; i++) if (e[i] > e[k]) k = i;
    return { label: this.net.classes[k], p: e[k] / sum };
  }
};
