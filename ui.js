// ui.js — UI rendering + signout logic + bathroom pass enforcement (ES module)

import { App } from './app-context.js';
import { $, escapeHtml } from './dom.js';
import {
  getAllStudents,
  getStudentByStudentId,
  saveStudent,
  deleteStudentById,
  getActiveSignouts,
  addSignoutRecord,
  getRecentRecords,
  getBathroomSignoutsForStudentInRange,
} from './database.js';

let _overrideContext = null;

// Optional hard-coded quarter ranges (leave empty to use computed)
const QUARTERS = [];

function getCurrentQuarterRange(now = new Date()) {
  if (QUARTERS.length === 4) {
    for (const q of QUARTERS) {
      const start = new Date(q.start + 'T00:00:00');
      const end = new Date(q.end + 'T23:59:59');
      if (now >= start && now <= end) {
        return { ...q, startISO: start.toISOString(), endISO: end.toISOString() };
      }
    }
  }

  const year = now.getFullYear();
  const schoolYearStart = (now.getMonth() < 7) ? year - 1 : year;

  const ranges = [
    { label: 'Q1', start: `${schoolYearStart}-08-01`, end: `${schoolYearStart}-10-15` },
    { label: 'Q2', start: `${schoolYearStart}-10-16`, end: `${schoolYearStart + 1}-01-15` },
    { label: 'Q3', start: `${schoolYearStart + 1}-01-16`, end: `${schoolYearStart + 1}-03-31` },
    { label: 'Q4', start: `${schoolYearStart + 1}-04-01`, end: `${schoolYearStart + 1}-06-30` },
  ];

  for (const q of ranges) {
    const start = new Date(q.start + 'T00:00:00');
    const end = new Date(q.end + 'T23:59:59');
    if (now >= start && now <= end) {
      return { ...q, startISO: start.toISOString(), endISO: end.toISOString() };
    }
  }

  const fallback = ranges[3];
  return {
    ...fallback,
    startISO: new Date(fallback.start + 'T00:00:00').toISOString(),
    endISO: new Date(fallback.end + 'T23:59:59').toISOString(),
  };
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function uuid() {
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

// ---------------- Dashboard ----------------
export async function loadDashboardStats() {
  const students = await getAllStudents();
  const signedOut = students.filter(s => s.isSignedOut).length;
  const bathroomOut = students.filter(s => s.isSignedOut && s.signOutDestination === 'Bathroom').length;
  const q = getCurrentQuarterRange(new Date());

  if ($('statTotalStudents')) $('statTotalStudents').textContent = String(students.length);
  if ($('statSignedOut')) $('statSignedOut').textContent = String(signedOut);
  if ($('statBathroomOut')) $('statBathroomOut').textContent = String(bathroomOut);
  if ($('statQuarterLabel')) $('statQuarterLabel').textContent = `${q.label} (${q.start} → ${q.end})`;
}

// ---------------- Students Table ----------------
export async function loadStudentsTable() {
  const students = await getAllStudents();
  const tbody = $('studentsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const isAdmin = App.isAdmin;

  students
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .forEach(student => {
      const tr = document.createElement('tr');

      const statusBadge = student.isSignedOut
        ? `<span class="badge text-bg-danger badge-wide">OUT</span>`
        : `<span class="badge text-bg-success badge-wide">IN</span>`;

      const actions = isAdmin ? `
        <button class="btn btn-sm btn-outline-primary me-2" data-action="edit" data-id="${student.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${student.id}">Delete</button>
      ` : '';

      tr.innerHTML = `
        <td class="mono">${escapeHtml(student.studentId || '')}</td>
        <td>${escapeHtml(student.name || '')}</td>
        <td>${escapeHtml(student.grade || '')}</td>
        <td>${escapeHtml(student.course || '')}</td>
        <td>
          ${statusBadge}
          ${student.isSignedOut && student.signOutTime
            ? `<div class="small-muted">Since ${new Date(student.signOutTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>`
            : ''}
        </td>
        <td class="admin-only ${isAdmin ? '' : 'd-none'}">${actions}</td>
      `;

      tbody.appendChild(tr);
    });

  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (!id) return;

      if (action === 'edit') {
        await openEditStudentModal(id);
      } else if (action === 'delete') {
        if (confirm('Delete this student?')) {
          await deleteStudentById(id);
          App.showSuccess('Student deleted');
          await refreshUIAfterRosterChange();
        }
      }
    });
  });
}

export async function refreshUIAfterRosterChange() {
  await loadStudentsTable();
  await loadDashboardStats();
  await loadSignOutForm();
  await loadCurrentlyOutList();
  await loadQuickAccessStudents();
  await loadRecentSignouts();
}

export function filterStudentsTable(term) {
  const tbody = $('studentsTableBody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => {
    const text = (tr.textContent || '').toLowerCase();
    tr.style.display = text.includes(term) ? '' : 'none';
  });
}

// ---------------- Signout View ----------------
export async function loadSignOutForm() {
  const select = $('signoutStudentSelect');
  if (!select) return;

  const students = await getAllStudents();
  select.innerHTML = '';

  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Select a student...';
  select.appendChild(opt0);

  students
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.studentId;
      opt.textContent = `${s.name} (${s.studentId})${s.isSignedOut ? ' - OUT' : ''}`;
      select.appendChild(opt);
    });

  await loadCurrentlyOutList();
}

export function filterSignOutStudents(term) {
  const select = $('signoutStudentSelect');
  if (!select) return;
  const options = Array.from(select.options);
  options.forEach((opt, idx) => {
    if (idx === 0) return;
    const text = (opt.textContent || '').toLowerCase();
    opt.hidden = !text.includes(term);
  });
}

export async function loadCurrentlyOutList() {
  const container = $('signoutCurrentlyOut');
  if (!container) return;

  const out = await getActiveSignouts();
  container.innerHTML = '';

  if (out.length === 0) {
    container.innerHTML = `<div class="list-group-item text-muted">No students currently signed out</div>`;
    return;
  }

  out
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .forEach(s => {
      const since = s.signOutTime ? new Date(s.signOutTime) : null;
      const mins = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 60000)) : 0;

      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center';
      item.innerHTML = `
        <div>
          <div class="fw-semibold">${escapeHtml(s.name || '')} <span class="small-muted mono">(${escapeHtml(s.studentId || '')})</span></div>
          <div class="small-muted">Destination: <b>${escapeHtml(s.signOutDestination || 'Unknown')}</b>${s.signOutReason ? ` • Reason: ${escapeHtml(s.signOutReason)}` : ''}</div>
        </div>
        <div class="text-end">
          <div class="badge text-bg-secondary">${mins}m</div>
          <div><button class="btn btn-sm btn-success mt-2" data-action="quickSignIn" data-studentid="${escapeHtml(s.studentId)}">Sign In</button></div>
        </div>
      `;
      container.appendChild(item);
    });

  container.querySelectorAll('button[data-action="quickSignIn"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const studentId = btn.getAttribute('data-studentid');
      if (!studentId) return;
      await quickSignInByStudentId(studentId);
    });
  });
}

export async function attemptSignOut() {
  const studentId = $('signoutStudentSelect')?.value || '';
  const destination = $('signoutDestination')?.value || 'Bathroom';
  const reason = $('signoutReason')?.value || '';

  if (!studentId) return App.showError('Please select a student.');

  const student = await getStudentByStudentId(studentId);
  if (!student) return App.showError('Student not found.');
  if (student.isSignedOut) return App.showError(`${student.name} is already signed out.`);

  if (destination === 'Bathroom') {
    const q = getCurrentQuarterRange(new Date());
    const passes = await getBathroomSignoutsForStudentInRange(student.studentId, q.startISO, q.endISO);

    if (passes.length >= 2) {
      showViolationAlert();
      _overrideContext = { student, destination, reason };
      showOverrideModal();
      return;
    }
  }

  await performSignOut(student, destination, reason, { override: false });
}

export async function confirmOverride() {
  const input = $('overridePinInput');
  const err = $('overridePinError');
  if (!input || !err) return;

  const pin = input.value || '';
  if (pin !== (App.config.TEACHER_OVERRIDE_PIN || '')) {
    err.classList.remove('d-none');
    input.focus();
    input.select?.();
    return;
  }

  err.classList.add('d-none');

  const modalEl = $('overrideModal');
  const modal = window.bootstrap?.Modal.getInstance(modalEl);
  modal?.hide();

  if (!_overrideContext) return;
  const { student, destination, reason } = _overrideContext;
  _overrideContext = null;
  input.value = '';

  await performSignOut(student, destination, reason, { override: true });
}

function showOverrideModal() {
  const input = $('overridePinInput');
  const err = $('overridePinError');
  if (err) err.classList.add('d-none');
  if (input) input.value = '';

  const modalEl = $('overrideModal');
  if (!modalEl) return;
  const modal = new window.bootstrap.Modal(modalEl);
  modal.show();
  setTimeout(() => input?.focus(), 150);
}

function showViolationAlert() {
  const overlay = $('violationOverlay');
  if (!overlay) return;

  overlay.classList.add('show');

  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance('Bathroom Pass Number VIOLATION!! Seek teacher approval!');
      window.speechSynthesis.speak(utter);
    }
  } catch {}

  setTimeout(() => overlay.classList.remove('show'), 1200);
}

async function performSignOut(student, destination, reason, { override }) {
  const now = new Date();
  const updated = {
    ...student,
    isSignedOut: true,
    signOutTime: now.toISOString(),
    signOutDestination: destination,
    signOutReason: reason || '',
    updatedAt: now.toISOString(),
  };

  await saveStudent(updated);

  await addSignoutRecord({
    id: uuid(),
    studentId: student.studentId,
    studentName: student.name,
    type: 'signout',
    destination,
    reason: reason || '',
    override: !!override,
    timestamp: now.toISOString(),
    date: todayISODate(),
  });

  App.showSuccess(`${student.name} signed out (${destination})${override ? ' [override]' : ''}`);
  await refreshAfterSignChange();
}

export async function signInSelectedStudent() {
  const studentId = $('signoutStudentSelect')?.value || '';
  if (!studentId) return App.showError('Please select a student.');
  await quickSignInByStudentId(studentId);
}

async function quickSignInByStudentId(studentId) {
  const student = await getStudentByStudentId(studentId);
  if (!student) return App.showError('Student not found.');
  if (!student.isSignedOut) return App.showError(`${student.name} is already signed in.`);

  const now = new Date();
  const updated = {
    ...student,
    isSignedOut: false,
    signOutTime: null,
    signOutDestination: null,
    signOutReason: '',
    updatedAt: now.toISOString(),
  };

  await saveStudent(updated);

  await addSignoutRecord({
    id: uuid(),
    studentId: student.studentId,
    studentName: student.name,
    type: 'signin',
    destination: '',
    reason: 'Sign In',
    override: false,
    timestamp: now.toISOString(),
    date: todayISODate(),
  });

  App.showSuccess(`${student.name} signed in`);
  await refreshAfterSignChange();
}

async function refreshAfterSignChange() {
  await loadDashboardStats();
  await loadStudentsTable();
  await loadSignOutForm();
  await loadCurrentlyOutList();
  await loadQuickAccessStudents();
  await loadRecentSignouts();
}

// ---------------- Dashboard lists ----------------
export async function loadQuickAccessStudents() {
  const container = $('quickAccessStudents');
  if (!container) return;

  const students = await getAllStudents();
  const out = students
    .filter(s => s.isSignedOut)
    .slice()
    .sort((a, b) => (a.signOutTime || '').localeCompare(b.signOutTime || ''))
    .slice(0, 6);

  container.innerHTML = '';
  if (out.length === 0) {
    container.innerHTML = `<div class="list-group-item text-muted">No students currently signed out</div>`;
    return;
  }

  out.forEach(s => {
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex justify-content-between align-items-center';
    const since = s.signOutTime ? new Date(s.signOutTime) : null;
    const mins = since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 60000)) : 0;

    item.innerHTML = `
      <div>
        <div class="fw-semibold">${escapeHtml(s.name || '')}</div>
        <div class="small-muted">${escapeHtml(s.signOutDestination || '')} • <span class="mono">${escapeHtml(s.studentId || '')}</span></div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge text-bg-secondary" title="Minutes out">${mins}m</span>
        <button class="btn btn-sm btn-success" data-action="quickSignIn" data-studentid="${escapeHtml(s.studentId)}">Sign In</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('button[data-action="quickSignIn"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const studentId = btn.getAttribute('data-studentid');
      if (!studentId) return;
      await quickSignInByStudentId(studentId);
    });
  });
}

export async function loadRecentSignouts() {
  const container = $('recentSignouts');
  if (!container) return;

  const records = await getRecentRecords(8);
  container.innerHTML = '';

  if (records.length === 0) {
    container.innerHTML = `<div class="list-group-item text-muted">No recent activity</div>`;
    return;
  }

  records.forEach(r => {
    const item = document.createElement('div');
    item.className = 'list-group-item';

    const time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    const badge = r.type === 'signout'
      ? `<span class="badge text-bg-danger">OUT</span>`
      : `<span class="badge text-bg-success">IN</span>`;

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          ${badge}
          <span class="fw-semibold ms-2">${escapeHtml(r.studentName || '')}</span>
          <span class="small-muted mono ms-2">(${escapeHtml(r.studentId || '')})</span>
          ${r.destination ? `<span class="small-muted ms-2">→ ${escapeHtml(r.destination)}</span>` : ''}
          ${r.override ? `<span class="badge text-bg-warning ms-2" title="Teacher override">OVERRIDE</span>` : ''}
        </div>
        <div class="small-muted mono">${time}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// ---------------- Add/Edit student modal ----------------
async function openEditStudentModal(studentInternalId) {
  const modalEl = $('editStudentModal');
  const form = $('editStudentForm');
  if (!modalEl || !form) return;

  const students = await getAllStudents();
  const existing = students.find(s => s.id === studentInternalId);
  if (!existing) return;

  form.dataset.studentId = existing.id;
  modalEl.querySelector('.modal-title').textContent = 'Edit Student';

  $('studentNameInput').value = existing.name || '';
  $('studentIdInput').value = existing.studentId || '';
  $('studentGradeInput').value = existing.grade || '';
  $('studentGenderInput').value = existing.gender || '';
  $('studentCourseInput').value = existing.course || '';

  new window.bootstrap.Modal(modalEl).show();
}

export function openAddStudentModal() {
  const modalEl = $('editStudentModal');
  const form = $('editStudentForm');
  if (!modalEl || !form) return;

  form.reset();
  delete form.dataset.studentId;
  modalEl.querySelector('.modal-title').textContent = 'Add New Student';

  new window.bootstrap.Modal(modalEl).show();
}

export async function saveStudentFromModal() {
  const form = $('editStudentForm');
  const modalEl = $('editStudentModal');
  if (!form || !modalEl) return;

  const isEdit = !!form.dataset.studentId;
  const now = new Date();

  const name = ($('studentNameInput').value || '').trim();
  const studentId = ($('studentIdInput').value || '').trim();
  const grade = ($('studentGradeInput').value || '').trim();
  const gender = ($('studentGenderInput').value || '').trim();
  const course = ($('studentCourseInput').value || '').trim();

  if (!name || !studentId || !grade) return App.showError('Name, Student ID, and Grade are required.');

  const existing = await getStudentByStudentId(studentId);
  if (existing && (!isEdit || existing.id !== form.dataset.studentId)) {
    return App.showError('That Student ID already exists.');
  }

  let student;
  if (isEdit) {
    const all = await getAllStudents();
    const current = all.find(s => s.id === form.dataset.studentId);
    if (!current) return App.showError('Student record not found.');

    student = { ...current, name, studentId, grade, gender, course, updatedAt: now.toISOString() };
  } else {
    student = {
      id: uuid(),
      name, studentId, grade,
      gender: gender || '',
      course: course || '',
      isSignedOut: false,
      signOutTime: null,
      signOutDestination: null,
      signOutReason: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  await saveStudent(student);

  const modal = window.bootstrap.Modal.getInstance(modalEl);
  modal?.hide();

  form.reset();
  delete form.dataset.studentId;
  modalEl.querySelector('.modal-title').textContent = 'Add New Student';

  App.showSuccess(isEdit ? 'Student updated' : 'Student added');
  await refreshUIAfterRosterChange();
}

// ---------------- Scanner hook ----------------
export async function handleScannedStudentId(scannedId) {
  const id = String(scannedId || '').trim();
  if (!id) return;

  // Always bring user to the Sign Out view for speed
  App.nav.showSignOut();

  // Ensure dropdown is loaded and select the student
  await loadSignOutForm();
  const select = $('signoutStudentSelect');
  if (select) select.value = id;

  const student = await getStudentByStudentId(id);
  if (!student) {
    App.showError(`Scanned ID not found: ${id}`);
    return;
  }

  if (App.config.SCANNER_MODE === 'toggle') {
    // toggle action: OUT -> sign in; IN -> sign out (default destination)
    if (student.isSignedOut) {
      await (async () => {
        // mimic selecting
        if (select) select.value = id;
        await signInSelectedStudent();
      })();
    } else {
      if ($('signoutDestination')) $('signoutDestination').value = App.config.SCANNER_DEFAULT_DESTINATION || 'Bathroom';
      if ($('signoutReason')) $('signoutReason').value = '';
      await attemptSignOut();
    }
  } else {
    // 'select' mode: just select student and stop
    // (teacher clicks Sign Out/Sign In)
  }
}
