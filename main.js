// main.js — App startup + navigation + admin mode + scanner (ES module)

import { App } from './app-context.js';
import { $ } from './dom.js';
import { initDB } from './database.js';

import {
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
  refreshUIAfterRosterChange,
  handleScannedStudentId,
} from './ui.js';

import { initCSVImport, resetCSVImport } from './csv-import.js';
import { initQuickActions } from './quick-actions.js';

// ---------------- Safe storage helpers ----------------
function safeGetItem(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function safeRemoveItem(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ---------------- Toast helpers ----------------
function showErrorMessage(message) {
  console.error(message);
  const toastEl = $('errorToast');
  if (toastEl && window.bootstrap) {
    const body = toastEl.querySelector('.toast-body');
    if (body) body.textContent = message;
    new window.bootstrap.Toast(toastEl).show();
  } else {
    alert(message);
  }
}
function showSuccessMessage(message) {
  console.log(message);
  const toastEl = $('successToast');
  if (toastEl && window.bootstrap) {
    const body = toastEl.querySelector('.toast-body');
    if (body) body.textContent = message;
    new window.bootstrap.Toast(toastEl).show();
  } else {
    alert(message);
  }
}

App.showError = showErrorMessage;
App.showSuccess = showSuccessMessage;

// ---------------- Views / Navigation ----------------
let currentView = 'dashboard';

function showOnlyView(viewId) {
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  $(viewId)?.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const navMap = {
    'dashboard-view': 'nav-dashboard',
    'students-view': 'nav-students',
    'signout-view': 'nav-signout',
    'csv-import-view': 'nav-csv-import',
  };

  const navId = navMap[viewId];
  if (navId) $(navId)?.classList.add('active');
}

function showDashboard() {
  currentView = 'dashboard';
  showOnlyView('dashboard-view');
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
  resetCSVImport();
}

// export nav hooks into App
App.nav.showDashboard = showDashboard;
App.nav.showStudents = showStudents;
App.nav.showSignOut = showSignOut;
App.nav.showCSVImport = showCSVImport;

// ---------------- Refresh / Init ----------------
async function refreshAll() {
  await loadDashboardStats();
  await loadStudentsTable();
  await loadSignOutForm();
  await loadCurrentlyOutList();
  await loadQuickAccessStudents();
  await loadRecentSignouts();
}
App.nav.refreshAll = refreshAll;

// ---------------- Admin UI ----------------
function loadAdminStatusFromStorage() {
  const enabled = safeGetItem('isAdmin') === 'true';
  App.setAdmin(enabled);
}

function toggleAdminMode() {
  if (App.isAdmin) {
    safeRemoveItem('isAdmin');
    App.setAdmin(false);
    App.showSuccess('Logged out of admin mode');
    loadStudentsTable();
    return;
  }

  const password = prompt('Enter admin password:');
  if (password === App.config.ADMIN_PASSWORD) {
    safeSetItem('isAdmin', 'true');
    App.setAdmin(true);
    App.showSuccess('Logged in as admin');
    loadStudentsTable();
  } else {
    App.showError('Incorrect password');
  }
}

// ---------------- Search ----------------
function handleSearch(term) {
  const t = (term || '').toLowerCase();
  if (currentView === 'students') filterStudentsTable(t);
  else filterSignOutStudents(t);
}

// ---------------- Scanner (barcode wedge support) ----------------
// Most scanners type digits fast then send Enter.
// We capture fast digit bursts and on Enter treat as studentId.
let scanBuf = '';
let scanLastTs = 0;

function isLikelyScanBurst(nowMs) {
  // if keys arrive very fast, treat as scanner stream
  return (nowMs - scanLastTs) < 50;
}

function setupScannerListener() {
  document.addEventListener('keydown', async (e) => {
    // ignore if user is typing into a text box / password, etc.
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const isTypingField =
      tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;

    const now = Date.now();

    if (e.key === 'Enter') {
      const candidate = scanBuf.trim();
      scanBuf = '';
      scanLastTs = 0;
      if (candidate.length >= 4) {
        // run scan action
        await handleScannedStudentId(candidate);
      }
      return;
    }

    // only collect digits (adjust if your IDs include letters)
    if (/^\d$/.test(e.key)) {
      if (!isTypingField || isLikelyScanBurst(now)) {
        scanBuf += e.key;
        scanLastTs = now;
      }
    } else {
      // reset if non-digit appears during scan
      if (isLikelyScanBurst(now)) {
        scanBuf = '';
      }
      scanLastTs = now;
    }
  });
}

// ---------------- Event listeners ----------------
function setupEventListeners() {
  // Nav
  $('nav-dashboard')?.addEventListener('click', showDashboard);
  $('nav-students')?.addEventListener('click', showStudents);
  $('nav-signout')?.addEventListener('click', showSignOut);
  $('nav-csv-import')?.addEventListener('click', showCSVImport);

  // Search
  $('searchInput')?.addEventListener('input', (e) => handleSearch(e.target.value || ''));

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

  // Sign out / sign in
  $('btnSignOut')?.addEventListener('click', attemptSignOut);
  $('btnSignIn')?.addEventListener('click', signInSelectedStudent);

  // Add/Edit student modal save
  $('editStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveStudentFromModal();
  });

  // Override modal confirm
  $('overrideConfirmBtn')?.addEventListener('click', confirmOverride);
}

async function initApp() {
  try {
    console.log('Initializing...');

    App.config.TEACHER_OVERRIDE_PIN = '2468';
    App.config.ADMIN_PASSWORD = 'admin123';
    App.config.SCANNER_MODE = 'select'; // change to 'toggle' if you want scan->auto sign in/out

    await initDB();

    setupEventListeners();
    initQuickActions();
    initCSVImport();
    setupScannerListener();

    loadAdminStatusFromStorage();

    await refreshAll();
    showDashboard();

    console.log('Initialized successfully');
  } catch (err) {
    console.error(err);
    showErrorMessage('Failed to initialize. Refresh the page.');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
