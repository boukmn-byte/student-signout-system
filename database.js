// database.js — IndexedDB layer (ES module)

const DB_NAME = 'StudentSignOutDB';
const DB_VERSION = 3;

let dbPromise = null;

export function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // students
      if (!db.objectStoreNames.contains('students')) {
        const s = db.createObjectStore('students', { keyPath: 'id' });
        s.createIndex('studentId', 'studentId', { unique: true });
        s.createIndex('isSignedOut', 'isSignedOut', { unique: false });
        s.createIndex('name', 'name', { unique: false });
      } else {
        const s = req.transaction.objectStore('students');
        if (!s.indexNames.contains('studentId')) s.createIndex('studentId', 'studentId', { unique: true });
        if (!s.indexNames.contains('isSignedOut')) s.createIndex('isSignedOut', 'isSignedOut', { unique: false });
        if (!s.indexNames.contains('name')) s.createIndex('name', 'name', { unique: false });
      }

      // signouts (activity log)
      if (!db.objectStoreNames.contains('signouts')) {
        const so = db.createObjectStore('signouts', { keyPath: 'id' });
        so.createIndex('studentId', 'studentId', { unique: false });
        so.createIndex('type', 'type', { unique: false });
        so.createIndex('timestamp', 'timestamp', { unique: false });
        so.createIndex('date', 'date', { unique: false });
      } else {
        const so = req.transaction.objectStore('signouts');
        if (!so.indexNames.contains('studentId')) so.createIndex('studentId', 'studentId', { unique: false });
        if (!so.indexNames.contains('type')) so.createIndex('type', 'type', { unique: false });
        if (!so.indexNames.contains('timestamp')) so.createIndex('timestamp', 'timestamp', { unique: false });
        if (!so.indexNames.contains('date')) so.createIndex('date', 'date', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function txStore(db, storeName, mode = 'readonly') {
  // If storeName is wrong/missing, this throws NotFoundError — better error message:
  if (!db.objectStoreNames.contains(storeName)) {
    throw new Error(`IndexedDB store "${storeName}" not found. (Did the DB upgrade run?)`);
  }
  return db.transaction(storeName, mode).objectStore(storeName);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function cursorToArray(req, limit = Infinity) {
  return new Promise((resolve, reject) => {
    const out = [];
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) return resolve(out);
      out.push(cursor.value);
      cursor.continue();
    };
  });
}

// ---------- Students ----------
export async function getAllStudents() {
  const db = await initDB();
  const store = txStore(db, 'students', 'readonly');
  const all = await reqToPromise(store.getAll());
  return Array.isArray(all) ? all : [];
}

export async function getStudentByStudentId(studentId) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readonly');
  const idx = store.index('studentId');
  return await reqToPromise(idx.get(String(studentId)));
}

export async function saveStudent(student) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readwrite');
  await reqToPromise(store.put(student));
  return student;
}

export async function deleteStudentById(id) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readwrite');
  await reqToPromise(store.delete(id));
}

export async function batchSaveStudents(students) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readwrite');

  await new Promise((resolve, reject) => {
    let i = 0;
    const putNext = () => {
      if (i >= students.length) return resolve();
      const r = store.put(students[i]);
      r.onerror = () => reject(r.error);
      r.onsuccess = () => { i++; putNext(); };
    };
    putNext();
  });
}

// ---------- Signout records ----------
export async function addSignoutRecord(record) {
  const db = await initDB();
  const store = txStore(db, 'signouts', 'readwrite');
  await reqToPromise(store.put(record));
  return record;
}

export async function getRecentRecords(limit = 10) {
  const db = await initDB();
  const store = txStore(db, 'signouts', 'readonly');
  const idx = store.index('timestamp');

  // newest first
  const req = idx.openCursor(null, 'prev');
  const rows = await cursorToArray(req, limit);
  return rows;
}

export async function getActiveSignouts() {
  // active signouts are in students store: isSignedOut === true
  const students = await getAllStudents();
  return students.filter(s => !!s.isSignedOut);
}

// Bathroom passes within date range (quarter)
export async function getBathroomSignoutsForStudentInRange(studentId, startISO, endISO) {
  const db = await initDB();
  const store = txStore(db, 'signouts', 'readonly');
  const idx = store.index('studentId');

  const allForStudent = await cursorToArray(idx.openCursor(IDBKeyRange.only(String(studentId))));
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();

  return allForStudent.filter(r => {
    if (r.type !== 'signout') return false;
    if (r.destination !== 'Bathroom') return false;
    const t = r.timestamp ? new Date(r.timestamp).getTime() : 0;
    return t >= startMs && t <= endMs;
  });
}

// ---------- Dev tools ----------
export async function resetDatabase() {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch {}
    dbPromise = null;
  }
  await new Promise((resolve, reject) => {
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
    del.onblocked = () => resolve();
  });
}
