// Records real hand-landmark samples (numbers only) for ml/train.py. Not linked from the menu: open /collect/.
import { $, LS, toast } from './common.js';
import { createCamera } from './camera.js';
import { SIGNS, BY_ID } from './signs.js';
import { vectorOf } from './model.js';

const KEY = 'vlv_collect', PER_TAKE = 40;
const CLASSES = [...SIGNS.filter(s => !s.two).map(s => ({ id: s.id, e: s.e, n: s.n, how: s.how })),
  { id: 'none', e: '🚫', n: 'None (not a sign)', how: 'Relaxed hand, half-formed signs, hands in transition, random gestures, hand turned the wrong way.' }];
let sel = CLASSES[0].id, busy = false, latest = null, data = LS.get(KEY, []);
const cam = createCamera({ stage: $('#stage'), onHands: (hands, W, H) => { latest = hands.length === 1 ? { lm: hands[0].lm, W, H } : null; } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const count = id => data.filter(d => d.label === id).length;

function render() {
  const c = CLASSES.find(x => x.id === sel);
  $('#selE').textContent = c.e; $('#selN').textContent = c.n; $('#selHow').textContent = c.how; $('#selC').textContent = count(sel);
  $('#tiles').innerHTML = CLASSES.map(x => `<button class="sc tile${x.id === sel ? ' sel' : ''}" data-id="${x.id}" style="text-align:left;width:100%${x.id === sel ? ';border-color:var(--g)' : ''}"><span class="em">${x.e}</span><div><b>${x.n}</b><span class="m" style="color:var(--mut)">${count(x.id)} samples</span></div></button>`).join('');
  document.querySelectorAll('.tile').forEach(b => b.onclick = () => { sel = b.dataset.id; render(); });
}
async function record() {
  if (!cam.running) return toast('Enable the camera first');
  if (!$('#person').value.trim()) return toast('Enter your name / ID first');
  if (busy) return; busy = true; const btn = $('#recBtn'), person = $('#person').value.trim();
  for (let n = 3; n > 0; n--) { btn.lastChild.textContent = ` Get ready… ${n}`; await sleep(1000); }
  let got = 0; const t0 = performance.now();
  while (got < PER_TAKE && performance.now() - t0 < 15000) {
    if (latest) { data.push({ label: sel, person, v: Array.from(vectorOf(latest.lm, latest.W, latest.H), x => +x.toFixed(4)) }); got++; }
    btn.lastChild.textContent = ` Recording ${got}/${PER_TAKE}`; await sleep(120);
  }
  if (!LS.set(KEY, data)) toast('Browser storage is full — export, then delete.');
  busy = false; btn.lastChild.textContent = ' Record 40 samples';
  toast(got < PER_TAKE ? `Only ${got} samples — keep ONE hand in view` : `Recorded ${got} samples`); render();
}
$('#startC').onclick = () => cam.start(); $('#recBtn').onclick = record;
$('#exportBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, samples: data })], { type: 'application/json' })); a.download = `vivalavida-real-samples-${Date.now()}.json`; a.click(); };
$('#clearBtn').onclick = () => { if (confirm('Delete all recorded samples from this browser?')) { data = []; LS.set(KEY, data); render(); } };
render();
