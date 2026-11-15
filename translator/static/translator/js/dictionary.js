import { $ } from './common.js';
import { SIGNS } from './signs.js';
const cats = [...new Set(SIGNS.map(s => s.c))];
$('#dictList').innerHTML = `<p style="color:var(--mut);font-size:13px;margin:0 4px">${SIGNS.length} custom gestures — not asserted to be standard ISL.</p>` +
  cats.map(c => `<div class="sec">${c}</div><div class="grid">` + SIGNS.filter(s => s.c === c).map(s =>
    `<div class="sc"><span class="em">${s.e}</span><div><b>${s.n}</b>${s.two ? ' <span style="font-size:11px;color:var(--blue)">· 2 hands</span>' : ''}<span class="m">${s.m}</span></div><p>${s.how}</p>${s.note ? `<p style="color:#e0b14a">⚠ ${s.note}</p>` : ''}</div>`).join('') + '</div>').join('');
