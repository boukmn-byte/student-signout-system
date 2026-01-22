// app-context.js — shared app state, no window globals

const _state = {
  config: {
    TEACHER_OVERRIDE_PIN: '2468',
    ADMIN_PASSWORD: 'admin123',
    APP_DEV_MODE: true, // set false when you want to hide dev tools
  },
  isAdmin: false,
  currentView: 'dashboard',

  // injected by main.js
  showError: (msg) => alert(msg),
  showSuccess: (msg) => alert(msg),
  refreshAll: async () => {},
  navigate: (view) => {},
};

export const App = {
  get config() { return _state.config; },
  setConfig(partial) { _state.config = { ..._state.config, ...partial }; },

  get isAdmin() { return _state.isAdmin; },
  setAdmin(v) { _state.isAdmin = !!v; },

  get currentView() { return _state.currentView; },
  setView(v) { _state.currentView = v; },

  bindUI({ showError, showSuccess, refreshAll, navigate }) {
    if (showError) _state.showError = showError;
    if (showSuccess) _state.showSuccess = showSuccess;
    if (refreshAll) _state.refreshAll = refreshAll;
    if (navigate) _state.navigate = navigate;
  },

  showError(msg) { _state.showError(msg); },
  showSuccess(msg) { _state.showSuccess(msg); },

  async refreshAll() { return _state.refreshAll(); },
  navigate(view) { return _state.navigate(view); },
};
