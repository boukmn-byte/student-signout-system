// app-context.js — shared app state + toast helpers

let _config = {};
let _isAdmin = false;

function toast(kind, message) {
  const id = kind === 'error' ? 'errorToast' : 'successToast';
  const toastEl = document.getElementById(id);

  // bootstrap is a global created by bootstrap.bundle.min.js
  if (toastEl && window.bootstrap) {
    const body = toastEl.querySelector('.toast-body');
    if (body) body.textContent = message;
    new window.bootstrap.Toast(toastEl).show();
  } else {
    alert(message);
  }
}

export const App = {
  get config() { return _config; },
  setConfig(next) { _config = { ..._config, ...next }; },

  get isAdmin() { return _isAdmin; },
  setAdmin(v) {
    _isAdmin = !!v;
    try { localStorage.setItem('isAdmin', String(_isAdmin)); } catch {}
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('d-none', !_isAdmin));
  },
  loadAdminFromStorage() {
    try { _isAdmin = localStorage.getItem('isAdmin') === 'true'; } catch { _isAdmin = false; }
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('d-none', !_isAdmin));
  },

  showError(msg) { console.error(msg); toast('error', msg); },
  showSuccess(msg) { console.log(msg); toast('success', msg); },
};
