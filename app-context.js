// app-context.js — shared app state + cross-module helpers (ES module)

export const App = {
  // runtime config injected by main.js
  config: {
    TEACHER_OVERRIDE_PIN: '2468',
    ADMIN_PASSWORD: 'admin123',

    // Scanner behavior:
    // 'select' => just navigate to Sign Out and select the student
    // 'toggle' => if student is OUT -> sign in; else sign out (Bathroom)
    SCANNER_MODE: 'select',
    SCANNER_DEFAULT_DESTINATION: 'Bathroom',
  },

  // navigation hooks injected by main.js
  nav: {
    showDashboard: () => {},
    showStudents: () => {},
    showSignOut: () => {},
    showCSVImport: () => {},
    refreshAll: async () => {},
  },

  // admin flag
  isAdmin: false,

  // toast hooks injected by main.js
  showError: (msg) => alert(msg),
  showSuccess: (msg) => alert(msg),

  setAdmin(enabled) {
    this.isAdmin = !!enabled;
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('d-none', !this.isAdmin);
    });
  },
};
