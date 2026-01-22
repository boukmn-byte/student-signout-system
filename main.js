// main.js - App startup + navigation + admin mode

// Config
const TEACHER_OVERRIDE_PIN = '2468'; // Change this PIN as desired
const ADMIN_PASSWORD = 'admin123';   // Admin UI (CSV import + roster edit)
let isAdmin = false;

let currentView = 'dashboard';
let studentsCache = [];

// Init
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  try {
    console.log('Initializing...');
    await initDB();
    console.log('DB ready');

    setupEventListeners();
    loadAdminStatusFromStorage();

    // Initial loads
    await refreshAll();

    // Default view
    showDashboard();

    console.log('Initialized successfully');
  } catch (err) {
    console.error(err);
    showErrorMessage('Failed to initialize. Refresh the page.');
  }
}

async function refreshAll() {
  studentsCache = await getAllStudents();
  await loadDashboardStats();
  await loadStudentsTable();
  await loadSignOutForm();
  await loadQuickAccessStudents();
  await loadRecentSignouts();
}

// Admin mode
function loadAdminStatusFromStorage() {
  isAdmin = localStorage.getItem('isAdmin') === 'true';
  setAdminUI(isAdmin);
}

function setAdminUI(enabled) {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('d-none', !enabled);
  });
}

function toggleAdminMode() {
  if (isAdmin) {
    localStorage.removeItem('isAdmin');
    isAdmin = false;
    setAdminUI(false);
    showSuccessMessage('Logged out of admin mode');
    return;
  }

  const password = prompt('Enter admin password:');
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem('isAdmin', 'true');
    isAdmin = true;
    setAdminUI(true);
    showSuccessMessage('Logged in as admin');
  } else {
    showErrorMessage('Incorrect password');
  }
}

// Navigation
function setupEventListeners() {
  document.getElementById('nav-dashboard')?.addEventListener('click', showDashboard);
  document.getElementById('nav-students')?.addEventListener('click', showStudents);
  document.getElementById('nav-signout')?.addEventListener('click', showSignOut);
  document.getElementById('nav-csv-import')?.addEventListener('click', showCSVImport);

  document.getElementById('refreshDashboard')?.addEventListener('click', async () => {
    await loadDashboardStats();
    await loadQuickAccessStudents();
    await loadRecentSignouts();
  });

  document.getElementById('refreshStudents')?.addEventListener('click', loadStudentsTable);

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const term = (e.target.value || '').toLowerCase();
    handleSearch(term);
  });

  document.getElementById('adminToggle')?.addEventListener('click', toggleAdminMode);

  // Signout buttons
  document.getElementById('btnSignOut')?.addEventListener('click', () => attemptSignOut());
  document.getElementById('btnSignIn')?.addEventListener('click', () => signInSelectedStudent());

  // Add/Edit student modal save
  document.getElementById('editStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveStudentFromModal();
  });

  // Override modal confirm
  document.getElementById('overrideConfirmBtn')?.addEventListener('click', () => confirmOverride());

  // Quick actions module initializes itself; CSV import module initializes itself
}

// Views
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

function showDashboard() {
  currentView = 'dashboard';
  showOnlyView('dashboard-view');
  // dashboard content is top cards; refresh those
  loadDashboardStats();
  loadQuickAccessStudents();
  loadRecentSignouts();
}

function showStudents() {
  currentView = 'students';
  showOnlyView('students-view');
  loadStudentsTable();
}

function showSignOut() {
  currentView = 'signout';
  showOnlyView('signout-view');
  loadSignOutForm();
  loadCurrentlyOutList();
}

function showCSVImport() {
  currentView = 'csv-import';
  showOnlyView('csv-import-view');
  resetCSVImport();
}

// Search
function handleSearch(term) {
  if (currentView === 'students') {
    filterStudentsTable(term);
  } else if (currentView === 'signout') {
    filterSignOutStudents(term);
  } else {
    // also filter signout dropdown for convenience
    filterSignOutStudents(term);
  }
}

// Utility messages
function showErrorMessage(message) {
  console.error(message);
  const toastEl = document.getElementById('errorToast');
  if (toastEl && window.bootstrap) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  } else {
    alert(message);
  }
}

function showSuccessMessage(message) {
  console.log(message);
  const toastEl = document.getElementById('successToast');
  if (toastEl && window.bootstrap) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  } else {
    alert(message);
  }
}

// Expose shared config/state
window.APP_CONFIG = {
  TEACHER_OVERRIDE_PIN: TEACHER_OVERRIDE_PIN,
  showErrorMessage,
  showSuccessMessage,
  refreshAll,
};


window.showDashboard = showDashboard;
window.showStudents = showStudents;
window.showSignOut = showSignOut;
window.showCSVImport = showCSVImport;
window.getIsAdmin = () => isAdmin;
