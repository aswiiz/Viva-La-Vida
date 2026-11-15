import { $, LS } from './common.js';
import { SIGNS } from './signs.js';
const learned = new Set(JSON.parse($('#learned-data').textContent || '[]'));
$('#learnedChips').innerHTML = learned.size
  ? SIGNS.filter(s => learned.has(s.id)).map(s => `<span class="chip ok">${s.e} ${s.n}</span>`).join('')
  : '<span class="chip">Nothing yet — try Practice</span>';
const sp = $('#setSpeech'); sp.checked = LS.get('vlv_speech', true);
sp.onchange = () => LS.set('vlv_speech', sp.checked);
