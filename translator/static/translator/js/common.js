// Shared page chrome: icons, drawer, toast, Django messages, small helpers.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const LS = {
  get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
export const csrf = () => document.body.dataset.csrf || '';
export const isAuth = () => document.body.dataset.auth === '1';

const ICON = {home:'<path d="M3 11l9-8 9 8v10H3z"/>',hand:'<path d="M8 13V5a1.5 1.5 0 013 0v6m0-6.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V15c0 4-3 6-6 6s-5-2-6.5-5L3 12a1.5 1.5 0 012.5-1.5L8 13"/>',book:'<path d="M2 4h7a3 3 0 013 3v14a2 2 0 00-2-2H2zM22 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8z"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.5-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.6a7 7 0 00-2 1.2l-2.3-1-2 3.5 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.5 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.6a7 7 0 002-1.2l2.3 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"/>',share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4M12 17h.01"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',out:'<path d="M9 21H4V3h5M16 17l5-5-5-5M21 12H9"/>',x:'<path d="M5 5l14 14M19 5L5 19"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',bell:'<path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/>',play:'<path d="M7 4l13 8-13 8z"/>',vol:'<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',pause:'<path d="M8 5v14M16 5v14"/>',skip:'<path d="M5 4l10 8-10 8zM19 5v14"/>',reset:'<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.5M3 4v5h5"/>',check:'<path d="M5 12l5 5 9-10"/>'};
$$('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', `<svg class="i" viewBox="0 0 24 24">${ICON[el.dataset.i]}</svg>`));

export function toast(t) {
  const e = $('#toast'); if (!e) return;
  e.textContent = t; e.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2400);
}

const drawer = $('#drawer');
const setDrawer = open => drawer?.classList.toggle('off', !open);
$('#menuBtn')?.addEventListener('click', () => setDrawer(true));
$('#closeD')?.addEventListener('click', () => setDrawer(false));
$('#drawer .sh')?.addEventListener('click', () => setDrawer(false));
$('#bell')?.addEventListener('click', () => { $('.dot')?.remove(); toast('Keep one hand in frame with good light.'); });
$('#mShare')?.addEventListener('click', async () => {
  try { await navigator.share({ title: 'viva la vida', url: location.origin }); }
  catch { navigator.clipboard?.writeText(location.origin); toast('Link copied'); }
});
$('#mHelp')?.addEventListener('click', () => { setDrawer(false); toast('Hold a sign steady for 2 s. Release or change pose to repeat it.'); });
$('#mAbout')?.addEventListener('click', () => { setDrawer(false); toast('viva la vida · custom gesture translator · MediaPipe HandLandmarker'); });
$$('#msgs span').forEach((m, i) => setTimeout(() => toast(m.textContent), i * 2600));
