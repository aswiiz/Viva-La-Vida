// Learning progress only. Signed-in users sync sign ids to Django; guests keep them in this browser.
import { LS, csrf, isAuth } from './common.js';
const KEY = 'vlv_learned';
export function initialLearned() {
  if (isAuth()) { try { return JSON.parse(document.getElementById('learned-data')?.textContent || '[]'); } catch { return []; } }
  return LS.get(KEY, []);
}
export async function markLearned(id) {
  if (isAuth()) {
    try {
      const r = await fetch(document.body.dataset.progressUrl, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() }, body: JSON.stringify({ sign_id: id }) });
      if (r.ok) return (await r.json()).learned;
    } catch {}
    return null;
  }
  const l = new Set(LS.get(KEY, [])); l.add(id); LS.set(KEY, [...l]); return [...l];
}
