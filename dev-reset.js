// dev-reset.js — dev-only “Reset DB” button handler

import { resetDB } from './database.js';

export function attachDevResetDB() {
  // Only show on localhost/codespaces previews
  const isDev =
    location.hostname === 'localhost' ||
    location.hostname.endsWith('.app.github.dev');

  const btn = document.getElementById('devResetDBBtn');
  if (!btn) return;

  btn.classList.toggle('d-none', !isDev);

  btn.addEventListener('click', async () => {
    if (!confirm('Reset DB? This deletes ALL students/signouts stored in this browser.')) return;
    await resetDB();
    location.reload();
  });
}
