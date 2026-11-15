import { $$ } from './common.js';
document.getElementById('showPw')?.addEventListener('click', () =>
  $$('input[type=password],input[data-pw]').forEach(i => { i.type = i.type === 'password' ? 'text' : 'password'; i.dataset.pw = '1'; }));
