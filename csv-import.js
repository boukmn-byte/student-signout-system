// csv-import.js - CSV import with preview + mapping + DB-safe import

let csvData = [];
let csvHeaders = [];
let columnMapping = { name: null, id: null, grade: null, gender: null, course: null };
let skipRows = 1;

document.addEventListener('DOMContentLoaded', initCSVImport);

function initCSVImport() {
  document.getElementById('csvFile')?.addEventListener('change', handleFileSelect);
  document.getElementById('skipRows')?.addEventListener('input', handleSkipRowsChange);
  document.getElementById('autoDetectBtn')?.addEventListener('click', autoDetectColumns);

  ['col-name','col-id','col-grade','col-gender','col-course'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', validateColumnMapping);
  });

  document.getElementById('startImportBtn')?.addEventListener('click', startDataImport);
  document.getElementById('resetImportBtn')?.addEventListener('click', resetCSVImport);

  // Initialize dropdowns empty
  resetCSVImport();
}

function handleSkipRowsChange(e) {
  skipRows = parseInt(e.target.value, 10);
  if (Number.isNaN(skipRows) || skipRows < 0) skipRows = 0;
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    parseCSVData(text);
  } catch (e) {
    showImportError('Failed to read file.');
  }
}

// Robust-ish CSV parsing for common cases (supports quoted commas)
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' ) {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCSVData(csvText) {
  csvData = [];
  csvHeaders = [];

  const rawLines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (rawLines.length === 0) {
    showImportError('CSV is empty.');
    return;
  }

  const rows = rawLines.map(parseCSVLine);

  csvHeaders = rows[0].map(h => h.replace(/^"|"$/g, '').trim());
  csvData = rows;

  updateCSVPreview();
  updateColumnDropdowns();
  autoDetectColumns();

  document.getElementById('csvPreview')?.classList.remove('d-none');
}

function updateCSVPreview() {
  const previewBody = document.getElementById('csvPreviewBody');
  const theadRow = document.querySelector('#csvPreview thead tr');
  if (!previewBody || !theadRow) return;

  previewBody.innerHTML = '';
  theadRow.innerHTML = '<th>#</th>';

  csvHeaders.forEach((h, idx) => {
    const th = document.createElement('th');
    th.textContent = `${h} (${idx})`;
    theadRow.appendChild(th);
  });

  const rowsToShow = Math.min(csvData.length, 10);
  for (let i = 0; i < rowsToShow; i++) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = String(i + 1);
    tr.appendChild(th);

    (csvData[i] || []).forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell ?? '';
      tr.appendChild(td);
    });

    previewBody.appendChild(tr);
  }

  const rowCountEl = document.getElementById('csvRowCount');
  if (rowCountEl) rowCountEl.textContent = `${csvData.length} rows, ${csvHeaders.length} columns`;
}

function updateColumnDropdowns() {
  const selects = ['col-name','col-id','col-grade','col-gender','col-course'];
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Select column...</option>';
    csvHeaders.forEach((header, index) => {
      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = `${header} (Column ${index + 1})`;
      select.appendChild(opt);
    });
  });
}

function autoDetectColumns() {
  const lower = csvHeaders.map(h => String(h || '').toLowerCase());

  const detected = { name: null, id: null, grade: null, gender: null, course: null };

  lower.forEach((h, idx) => {
    if (detected.name === null && (h.includes('name') || h.includes('student'))) detected.name = idx;
    if (detected.id === null && (h === 'id' || h.includes('studentid') || h.includes('student id'))) detected.id = idx;
    if (detected.grade === null && h.includes('grade')) detected.grade = idx;
    if (detected.gender === null && h.includes('gender') || h.includes('sex')) detected.gender = idx;
    if (detected.course === null && (h.includes('course') || h.includes('class') || h.includes('period'))) detected.course = idx;
  });

  setColumnMapping(detected);
}

function setColumnMapping(mapping) {
  columnMapping = { ...mapping };

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = (v === null || v === undefined) ? '' : String(v);
  };

  setVal('col-name', mapping.name);
  setVal('col-id', mapping.id);
  setVal('col-grade', mapping.grade);
  setVal('col-gender', mapping.gender);
  setVal('col-course', mapping.course);

  validateColumnMapping();
}

function validateColumnMapping() {
  const getSel = (id) => document.getElementById(id)?.value ?? '';

  const selections = {
    name: getSel('col-name'),
    id: getSel('col-id'),
    grade: getSel('col-grade'),
    gender: getSel('col-gender'),
    course: getSel('col-course'),
  };

  columnMapping = {
    name: selections.name !== '' ? parseInt(selections.name, 10) : null,
    id: selections.id !== '' ? parseInt(selections.id, 10) : null,
    grade: selections.grade !== '' ? parseInt(selections.grade, 10) : null,
    gender: selections.gender !== '' ? parseInt(selections.gender, 10) : null,
    course: selections.course !== '' ? parseInt(selections.course, 10) : null,
  };

  const missing = [];
  if (columnMapping.name === null) missing.push('Name');
  if (columnMapping.id === null) missing.push('Student ID');
  if (columnMapping.grade === null) missing.push('Grade');

  const msg = document.getElementById('validationMsg');
  const btn = document.getElementById('startImportBtn');

  if (missing.length > 0) {
    if (msg) {
      msg.textContent = `Missing required columns: ${missing.join(', ')}`;
      msg.className = 'alert alert-danger mt-3';
      msg.classList.remove('d-none');
    }
    if (btn) btn.disabled = true;
    return false;
  }

  if (msg) {
    msg.textContent = 'All required columns mapped. Ready to import.';
    msg.className = 'alert alert-success mt-3';
    msg.classList.remove('d-none');
  }
  if (btn) btn.disabled = false;
  return true;
}

async function startDataImport() {
  if (!validateColumnMapping()) {
    showImportError('Please map required columns.');
    return;
  }

  try {
    await ensureDBInitialized();

    const btn = document.getElementById('startImportBtn');
    const original = btn.textContent;
    btn.textContent = 'Importing...';
    btn.disabled = true;

    const studentsToSave = [];
    const errors = [];

    for (let i = skipRows; i < csvData.length; i++) {
      const row = csvData[i] || [];
      if (row.every(c => !String(c || '').trim())) continue;

      try {
        const name = (columnMapping.name !== null ? row[columnMapping.name] : '').trim();
        const studentId = (columnMapping.id !== null ? row[columnMapping.id] : '').trim();
        const grade = (columnMapping.grade !== null ? row[columnMapping.grade] : '').trim();
        const gender = (columnMapping.gender !== null ? row[columnMapping.gender] : '').trim();
        const course = (columnMapping.course !== null ? row[columnMapping.course] : '').trim();

        if (!name) throw new Error('Name is required');
        if (!studentId) throw new Error('Student ID is required');
        if (!grade) throw new Error('Grade is required');

        // If student exists, update roster fields but preserve signout state
        const existing = await getStudentByStudentId(studentId);

        const now = new Date().toISOString();
        const student = existing ? {
          ...existing,
          name,
          grade,
          gender: gender || existing.gender || '',
          course: course || existing.course || '',
          updatedAt: now,
        } : {
          id: 'stu-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 6),
          name,
          studentId,
          grade,
          gender: gender || '',
          course: course || '',
          isSignedOut: false,
          signOutTime: null,
          signOutDestination: null,
          signOutReason: '',
          createdAt: now,
          updatedAt: now,
        };

        studentsToSave.push(student);
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    if (studentsToSave.length === 0) {
      throw new Error('No valid student data found.');
    }

    await batchSaveStudents(studentsToSave);

    if (errors.length > 0) {
      showImportError(`Imported with ${errors.length} row error(s). First 3:\n${errors.slice(0, 3).join('\n')}`);
    } else {
      showImportSuccess(`Successfully imported ${studentsToSave.length} students.`);
    }

    btn.textContent = original;
    btn.disabled = false;

    // Refresh UI and navigate back to dashboard
    if (window.APP_CONFIG?.refreshAll) {
      await window.APP_CONFIG.refreshAll();
      if (typeof showDashboard === 'function') showDashboard();
    }

  } catch (e) {
    console.error(e);
    showImportError(`Import failed: ${e.message}`);
    const btn = document.getElementById('startImportBtn');
    if (btn) {
      btn.textContent = 'Import Students';
      btn.disabled = false;
    }
  }
}

function resetCSVImport() {
  const fileInput = document.getElementById('csvFile');
  if (fileInput) fileInput.value = '';

  csvData = [];
  csvHeaders = [];
  columnMapping = { name: null, id: null, grade: null, gender: null, course: null };

  skipRows = 1;
  const skipRowsInput = document.getElementById('skipRows');
  if (skipRowsInput) skipRowsInput.value = '1';

  document.getElementById('csvPreview')?.classList.add('d-none');

  const msg = document.getElementById('validationMsg');
  if (msg) msg.classList.add('d-none');

  ['col-name','col-id','col-grade','col-gender','col-course'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Select column...</option>';
  });

  const btn = document.getElementById('startImportBtn');
  if (btn) btn.disabled = true;

  document.getElementById('importErrorAlert')?.classList.add('d-none');
  document.getElementById('importSuccessAlert')?.classList.add('d-none');
}

function showImportError(message) {
  const el = document.getElementById('importErrorAlert');
  const ok = document.getElementById('importSuccessAlert');
  if (ok) ok.classList.add('d-none');

  if (el) {
    el.textContent = message;
    el.classList.remove('d-none');
  } else {
    alert(message);
  }
}

function showImportSuccess(message) {
  const el = document.getElementById('importSuccessAlert');
  const err = document.getElementById('importErrorAlert');
  if (err) err.classList.add('d-none');

  if (el) {
    el.textContent = message;
    el.classList.remove('d-none');
    setTimeout(() => el.classList.add('d-none'), 3000);
  } else {
    alert(message);
  }
}

window.resetCSVImport = resetCSVImport;
