import { $, toast } from './common.js';
import { createCamera } from './camera.js';
import { SIGNS } from './signs.js';
import { COMPAT } from './engine.js';
import { initialLearned, markLearned } from './progress.js';

let idx = 0, correct = 0, learned = new Set(initialLearned());
function render() {
  const s = SIGNS[idx];
  $('#pEm').textContent = s.e; $('#pName').textContent = s.m; $('#pHow').textContent = (s.two ? 'Two hands: ' : '') + s.how;
  $('#pStat').textContent = `${correct} correct · ${learned.size}/${SIGNS.length} learned`; $('#pbar').style.width = '0';
  $('#pSet').innerHTML = SIGNS.map((x, i) => `<span class="chip ${i === idx ? 'on' : learned.has(x.id) ? 'ok' : ''}">${x.e} ${x.n}</span>`).join('');
}
const cam = createCamera({
  stage: $('#stage'),
  onState: st => { $('#pbar').style.width = st.progress * 100 + '%'; if (DEBUG) record(st); },
  onAccept: async s => {
    if (s.id !== SIGNS[idx].id) return toast(`That was ${s.e} ${s.n}`);
    correct++; learned.add(s.id); toast('Correct! ' + s.e);
    idx = (idx + 1) % SIGNS.length; render();
    const saved = await markLearned(s.id); if (saved) { learned = new Set(saved); render(); }
  }
});
$('#startP').onclick = () => cam.start();
$('#skipP').onclick = () => { idx = (idx + 1) % SIGNS.length; render(); cam.resetEngine(); };
$('#resetP').onclick = () => { idx = 0; correct = 0; render(); cam.resetEngine(); };
render();

/* ---- ?debug=1 : per-sign report of which method (rules / Google / trained model / combined) read each sign correctly ---- */
const DEBUG = new URLSearchParams(location.search).has('debug');
const rep = {};
function record(st) {
  if (!st.tracking || !st.src) return;
  const t = SIGNS[idx].id, r = rep[t] ??= { n: 0, fused: 0, rule: 0, google: 0, gN: 0, mlp: 0, wrong: {} };
  r.n++;
  if (st.src.fused === t) r.fused++; else if (st.src.fused && st.src.fused !== 'UNKNOWN') r.wrong[st.src.fused] = (r.wrong[st.src.fused] || 0) + 1;
  if (st.src.rule === t) r.rule++;
  if (st.src.mlp === t) r.mlp++;
  if (st.src.google) { r.gN++; if (COMPAT[st.src.google]?.includes(t)) r.google++; }
  if (r.n % 15 === 0) showReport();
}
function showReport() {
  const pc = (a, n) => n ? Math.round(a / n * 100) + '%' : '-';
  $('#dbgOut').textContent = SIGNS.filter(s => rep[s.id]).map(s => { const r = rep[s.id];
    const w = Object.entries(r.wrong).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k}x${v}`).join(',');
    return `${s.id.padEnd(10)} n=${String(r.n).padEnd(4)} combined ${pc(r.fused, r.n).padEnd(5)} rules ${pc(r.rule, r.n).padEnd(5)} google ${pc(r.google, r.gN).padEnd(5)} model ${pc(r.mlp, r.n).padEnd(5)} ${w ? 'wrong: ' + w : ''}`; }).join('\n');
}
if (DEBUG) {
  $('#dbgPanel').style.display = 'block';
  $('#dbgCopy').onclick = () => { showReport(); navigator.clipboard?.writeText($('#dbgOut').textContent); toast('Report copied'); };
}
