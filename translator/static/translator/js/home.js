import { $, LS, toast } from './common.js';
import { createCamera } from './camera.js';
import { BY_ID } from './signs.js';

let sentence = [];
const render = () => $('#sentence').textContent = sentence.join(' ');
const speak = t => { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch {} };
const cam = createCamera({
  stage: $('#stage'),
  onState: st => {
    const s = BY_ID[st.stable];
    $('#detE').textContent = s ? s.e : '🍉';
    $('#detN').textContent = s ? s.n : (st.tracking ? 'Unknown' : '—');
    $('#conf').textContent = Math.round(st.share * 100) + '%';
    $('#confBar').style.width = st.progress * 100 + '%';
  },
  onAccept: s => { sentence.push(s.w); render(); if (LS.get('vlv_speech', true)) speak(s.w); }
});
$('#enableCam').onclick = () => cam.start();
$('#clearTxt').onclick = $('#clearAll').onclick = () => { sentence = []; render(); };
$('#speakBtn').onclick = () => sentence.length ? speak(sentence.join(' ')) : toast('Nothing to speak yet');
$('#pauseBtn').onclick = () => {
  if (!cam.running) return cam.start();
  $('#pauseBtn span').textContent = cam.togglePause() ? 'Resume Camera' : 'Pause Camera';
};
render();
