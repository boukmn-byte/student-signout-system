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

      // Students
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

      // Signout records
      if (!db.objectStoreNames.contains('signouts')) {
        const r = db.createObjectStore('signouts', { keyPath: 'id' });
        r.createIndex('studentId', 'studentId', { unique: false });
        r.createIndex('timestamp', 'timestamp', { unique: false });
        r.createIndex('date', 'date', { unique: false });
        r.createIndex('type', 'type', { unique: false });
      } else {
        const r = req.transaction.objectStore('signouts');
        if (!r.indexNames.contains('studentId')) r.createIndex('studentId', 'studentId', { unique: false });
        if (!r.indexNames.contains('timestamp')) r.createIndex('timestamp', 'timestamp', { unique: false });
        if (!r.indexNames.contains('date')) r.createIndex('date', 'date', { unique: false });
        if (!r.indexNames.contains('type')) r.createIndex('type', 'type', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

export async function ensureDBInitialized() {
  return initDB();
}

function txStore(db, storeName, mode = 'readonly') {
  const tx = db.transaction(storeName, mode);
  return { tx, store: tx.objectStore(storeName) };
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Students ----------------

export async function getAllStudents() {
  const db = await initDB();
  const { store } = txStore(db, 'students', 'readonly');
  return reqToPromise(store.getAll());
}

export async function getStudentByStudentId(studentId) {
  const db = await initDB();
  const { store } = txStore(db, 'students', 'readonly');
  const idx = store.index('studentId');
  return reqToPromise(idx.get(studentId));
}

export async function saveStudent(student) {
  const db = await initDB();
  const { tx, store } = txStore(db, 'students', 'readwrite');
  store.put(student);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(student);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteStudentById(id) {
  const db = await initDB();
  const { tx, store } = txStore(db, 'students', 'readwrite');
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function batchSaveStudents(students) {
  const db = await initDB();
  const { tx, store } = txStore(db, 'students', 'readwrite');

  for (const s of students) store.put(s);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(students.length);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getActiveSignouts() {
  // easiest + reliable: query students, filter signed out
  const students = await getAllStudents();
  return students.filter(s => s.isSignedOut);
}

// ---------------- Signout records ----------------

export async function addSignoutRecord(record) {
  const db = await initDB();
  const { tx, store } = txStore(db, 'signouts', 'readwrite');
  store.put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getRecentRecords(limit = 10) {
  const db = await initDB();
  const { store } = txStore(db, 'signouts', 'readonly');

  // Use timestamp index if available
  const idx = store.index('timestamp');
  const out = [];

  return new Promise((resolve, reject) => {
    const cursorReq = idx.openCursor(null, 'prev'); // newest first
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || out.length >= limit) return resolve(out);
      out.push(cursor.value);
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function getBathroomSignoutsForStudentInRange(studentId, startISO, endISO) {
  const db = await initDB();
  const { store } = txStore(db, 'signouts', 'readonly');
  const idx = store.index('studentId');

  const records = [];
  return new Promise((resolve, reject) => {
    const cursorReq = idx.openCursor(IDBKeyRange.only(studentId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        // filter
        const filtered = records.filter(r => {
          if (r.type !== 'signout') return false;
          if (r.destination !== 'Bathroom') return false;
          const t = r.timestamp || '';
          return t >= startISO && t <= endISO;
        });
        return resolve(filtered);
      }
      records.push(cursor.value);
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

// Optional helper for Step 3/4 later
export async function resetDatabase() {
  const db = await initDB();
  db.close();
  dbPromise = null;

  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Delete blocked. Close other tabs using this site.'));
  });
}
