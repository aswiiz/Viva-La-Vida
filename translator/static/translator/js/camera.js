// Camera + Google AI Edge MediaPipe GestureRecognizer (hand landmarks for up to 2 hands + Google's gesture classifier
// trained on real hands) + our gesture engine. All local.
import { GestureRecognizer, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { GestureEngine } from './engine.js';
import { mlp } from './model.js';
import { BY_ID } from './signs.js';
import { $, toast } from './common.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
let landmarker = null;
const DEBUG = new URLSearchParams(location.search).has('debug');   // add ?debug=1 to the URL to see live readings
async function loadModel() {
  if (landmarker) return;
  toast('Loading hand model…');
  const fs = await FilesetResolver.forVisionTasks(WASM);
  const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { landmarker = await GestureRecognizer.createFromOptions(fs, opts('GPU')); }
  catch { landmarker = await GestureRecognizer.createFromOptions(fs, opts('CPU')); }
}

export function createCamera({ stage, onState, onAccept, onHands }) {
  const canvas = $('canvas', stage), ctx = canvas.getContext('2d'), ph = $('.ph', stage), badge = $('.cd', stage);
  const video = document.createElement('video'); video.playsInline = true; video.muted = true;
  const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
  const engine = new GestureEngine();
  let stream = null, running = false, paused = false, lastVT = -1, prev = [];
  // light exponential smoothing per hand slot (hands are ordered left -> right) removes jitter
  const ema = (prv, cur) => prv ? cur.map((p, i) => ({ x: prv[i].x + 0.6 * (p.x - prv[i].x), y: prv[i].y + 0.6 * (p.y - prv[i].y), z: (prv[i].z || 0) + 0.6 * ((p.z || 0) - (prv[i].z || 0)) })) : cur.map(p => ({ ...p }));

  function frame() {
    if (!running) return;
    if (!paused && video.readyState >= 2 && video.currentTime !== lastVT) {
      lastVT = video.currentTime;
      bctx.save(); bctx.translate(buf.width, 0); bctx.scale(-1, 1); bctx.drawImage(video, 0, 0, buf.width, buf.height); bctx.restore(); // one mirror convention
      const res = landmarker.recognizeForVideo(buf, performance.now());
      ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
      let hands = (res.landmarks || []).map((lm, i) => { const c = res.gestures?.[i]?.[0]; return { lm, wl: res.worldLandmarks?.[i], score: (res.handedness || res.handednesses)?.[i]?.[0]?.score, g: c ? { name: c.categoryName, score: c.score } : null }; }).filter(h => h.score === undefined || h.score >= 0.5).sort((a, b) => a.lm[0].x - b.lm[0].x);
      if (prev.length !== hands.length) prev = [];
      hands = hands.map((h, i) => { const lm = prev[i]?.lm ? ema(prev[i].lm, h.lm) : ema(null, h.lm); const wl = h.wl ? ema(prev[i]?.wl, h.wl) : null; prev[i] = { lm, wl }; return { lm, wl, g: h.g }; });
      for (const { lm } of hands) {
        ctx.lineWidth = 3; ctx.strokeStyle = '#22e56f';
        CONN.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height); ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height); ctx.stroke(); });
        ctx.fillStyle = '#ff4d6d'; lm.forEach(p => { ctx.beginPath(); ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 7); ctx.fill(); });
      }
      onHands?.(hands, buf.width, buf.height);
      const st = engine.update(performance.now(), { hands, W: buf.width, H: buf.height });
      if (DEBUG && st.dbg) { ctx.font = '13px monospace'; st.dbg.forEach((l, i) => { ctx.fillStyle = '#000a'; ctx.fillRect(4, 6 + i * 18, ctx.measureText(l).width + 8, 17); ctx.fillStyle = '#fff'; ctx.fillText(l, 8, 19 + i * 18); }); }
      let t = '';
      if (st.tracking) { if (st.blocked) t = 'Release to repeat'; else if (st.stable) t = `Hold ${(st.remain / 1000).toFixed(1)}s`; }
      badge.textContent = t; badge.classList.toggle('hidden', !t);
      onState?.(st);
      if (st.accepted) onAccept?.(BY_ID[st.accepted]);
    }
    requestAnimationFrame(frame);
  }
  return {
    get running() { return running; }, get paused() { return paused; },
    async start() {
      try {
        await Promise.all([loadModel(), mlp.load(document.body.dataset.modelUrl)]);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        video.srcObject = stream; await video.play();
        const vw = video.videoWidth || 640, vh = video.videoHeight || 480, k = Math.min(1, 640 / vw);   // cap work size: keeps the frame rate up on slow laptops
        buf.width = canvas.width = Math.round(vw * k); buf.height = canvas.height = Math.round(vh * k);
        stage.style.aspectRatio = `${vw} / ${vh}`;
        running = true; paused = false; lastVT = -1; prev = []; engine.reset(); ph.classList.add('hidden'); frame();
      } catch (e) { console.error(e); toast('Could not start (camera/model). Needs HTTPS or localhost + internet.'); }
    },
    togglePause() { paused = !paused; engine.reset(); return paused; },
    resetEngine() { engine.reset(); },
    stop() { running = false; stream?.getTracks().forEach(t => t.stop()); ph.classList.remove('hidden'); engine.reset(); }
  };
}
