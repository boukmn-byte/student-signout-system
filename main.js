// main.js (ES module) — App startup + navigation + admin mode

import { initDB } from './database.js';
import { App } from './app-context.js';
import { $ } from './dom.js';

import {
  setUIConfig,
  loadDashboardStats,
  loadStudentsTable,
  loadSignOutForm,
  loadCurrentlyOutList,
  loadQuickAccessStudents,
  loadRecentSignouts,
  filterStudentsTable,
  filterSignOutStudents,
  attemptSignOut,
  signInSelectedStudent,
  saveStudentFromModal,
  confirmOverride,
  enableScannerMode, // optional export (we’ll add in ui.js if not there yet)
} from './ui.js';

import { initCSVImport } from './csv-import.js';
import { initQuickActions } from './quick-actions.js';
import { attachDevResetDB } from './dev-reset.js';

// ---- Config (you can change later) ----
const TEACHER_OVERRIDE_PIN = '2468';
const ADMIN_PASSWORD = 'admin123';

// ---- App State ----
let currentView = 'dashboard';

// ---- Small helpers ----
function showOnlyView(viewId) {
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const navMap = {
    'dashboard-view': 'nav-dashboard',
    'students-view': 'nav-students',
    'signout-view': 'nav-signout',
    'csv-import-view': 'nav-csv-import',
  };
  const navId = navMap[viewId];
  if (navId) document.getElementById(navId)?.classList.add('active');
}

async function refreshAll() {
  await loadDashboardStats();
  await loadStudentsTable();
  await loadSignOutForm();
  await loadCurrentlyOutList();
  await loadQuickAccessStudents();
  await loadRecentSignouts();
}

function showDashboard() {
  currentView = 'dashboard';
  showOnlyView('dashboard-view');
  // dashboard widgets are outside view container; refresh quickly
  loadDashboardStats();
  loadQuickAccessStudents();
  loadRecentSignouts();
}

function showStudents() {
  currentView = 'students';
  showOnlyView('students-view');
  loadStudentsTable();
}

async function showSignOut() {
  currentView = 'signout';
  showOnlyView('signout-view');
  await loadSignOutForm();
  await loadCurrentlyOutList();
}

function showCSVImport() {
  currentView = 'csv-import';
  showOnlyView('csv-import-view');
  initCSVImport(); // safe to call; it should wire listeners once
}

// ---- Admin login ----
function toggleAdminMode() {
  if (App.isAdmin) {
    App.setAdmin(false);
    App.showSuccess('Logged out of admin mode');
    loadStudentsTable();
    return;
  }

  const password = prompt('Enter admin password:');
  if (password === ADMIN_PASSWORD) {
    App.setAdmin(true);
    App.showSuccess('Logged in as admin');
    loadStudentsTable();
  } else {
    App.showError('Incorrect password');
  }
}

// ---- Search ----
function handleSearch(term) {
  const t = (term || '').toLowerCase();

  if (currentView === 'students') {
    filterStudentsTable(t);
  } else if (currentView === 'signout') {
    filterSignOutStudents(t);
  } else {
    // convenience: filter signout dropdown from dashboard too
    filterSignOutStudents(t);
  }
}

// ---- Wire events ----
function setupEventListeners() {
  // Nav
  $('nav-dashboard')?.addEventListener('click', showDashboard);
  $('nav-students')?.addEventListener('click', showStudents);
  $('nav-signout')?.addEventListener('click', showSignOut);
  $('nav-csv-import')?.addEventListener('click', showCSVImport);

  // Search
  $('searchInput')?.addEventListener('input', (e) => handleSearch(e.target.value));

  // Refresh buttons
  $('refreshDashboard')?.addEventListener('click', async () => {
    await loadDashboardStats();
    await loadQuickAccessStudents();
    await loadRecentSignouts();
  });

  $('refreshStudents')?.addEventListener('click', async () => {
    await loadStudentsTable();
  });

  // Admin toggle
  $('adminToggle')?.addEventListener('click', toggleAdminMode);

  // Sign out / in
  $('btnSignOut')?.addEventListener('click', async () => attemptSignOut());
  $('btnSignIn')?.addEventListener('click', async () => signInSelectedStudent());

  // Add/Edit modal submit
  $('editStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveStudentFromModal();
  });

  // Override confirm
  $('overrideConfirmBtn')?.addEventListener('click', async () => confirmOverride());

  // Scanner mode toggle (we’ll add the button in index.html in a later step)
  $('scanToggleBtn')?.addEventListener('click', () => enableScannerMode?.());
}

// ---- Init ----
async function initApp() {
  try {
    // set shared config once
    App.setConfig({ TEACHER_OVERRIDE_PIN });

    // UI hooks
    setUIConfig({
      onRosterChanged: refreshAll,
    });

    // DB
    await initDB();

    // optional dev tools
    attachDevResetDB();

    // other modules
    initQuickActions();
    initCSVImport();

    setupEventListeners();

    // first render
    await refreshAll();
    showDashboard();
  } catch (err) {
    console.error(err);
    App.showError('Failed to initialize. Refresh the page.');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
