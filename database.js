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

      // students store
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

      // signouts store (audit log / recent activity)
      if (!db.objectStoreNames.contains('signouts')) {
        const so = db.createObjectStore('signouts', { keyPath: 'id' });
        so.createIndex('studentId', 'studentId', { unique: false });
        so.createIndex('timestamp', 'timestamp', { unique: false });
        so.createIndex('type', 'type', { unique: false });
      } else {
        const so = req.transaction.objectStore('signouts');
        if (!so.indexNames.contains('studentId')) so.createIndex('studentId', 'studentId', { unique: false });
        if (!so.indexNames.contains('timestamp')) so.createIndex('timestamp', 'timestamp', { unique: false });
        if (!so.indexNames.contains('type')) so.createIndex('type', 'type', { unique: false });
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
  // will throw NotFoundError if schema mismatch — which is GOOD during debugging
  return db.transaction(storeName, mode).objectStore(storeName);
}

// ---------- Students ----------
export async function getAllStudents() {
  const db = await initDB();
  const store = txStore(db, 'students', 'readonly');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getStudentByStudentId(studentId) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readonly');
  const index = store.index('studentId');

  return new Promise((resolve, reject) => {
    const req = index.get(String(studentId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveStudent(student) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readwrite');

  return new Promise((resolve, reject) => {
    const req = store.put(student);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStudentById(id) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readwrite');

  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function batchSaveStudents(students) {
  const db = await initDB();
  const store = txStore(db, 'students', 'readwrite');

  return new Promise((resolve, reject) => {
    let i = 0;

    function next() {
      if (i >= students.length) return resolve(true);
      const req = store.put(students[i]);
      req.onsuccess = () => { i++; next(); };
      req.onerror = () => reject(req.error);
    }

    next();
  });
}

export async function getActiveSignouts() {
  const students = await getAllStudents();
  return students.filter(s => !!s.isSignedOut);
}

// ---------- Signout records ----------
export async function addSignoutRecord(record) {
  const db = await initDB();
  const store = txStore(db, 'signouts', 'readwrite');

  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getRecentRecords(limit = 10) {
  const db = await initDB();
  const store = txStore(db, 'signouts', 'readonly');
  const index = store.index('timestamp');

  // Pull all and sort desc by timestamp (simple + reliable for small DB)
  return new Promise((resolve, reject) => {
    const req = index.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      all.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      resolve(all.slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getBathroomSignoutsForStudentInRange(studentId, startISO, endISO) {
  const db = await initDB();
  const store = txStore(db, 'signouts', 'readonly');
  const index = store.index('studentId');

  return new Promise((resolve, reject) => {
    const req = index.getAll(String(studentId));
    req.onsuccess = () => {
      const all = req.result || [];
      const out = all.filter(r => {
        const ts = r.timestamp ? new Date(r.timestamp).toISOString() : '';
        const inRange = ts >= startISO && ts <= endISO;
        const isBathroom = (r.destination || '') === 'Bathroom';
        const isSignout = (r.type || '') === 'signout';
        return inRange && isBathroom && isSignout;
      });
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}
