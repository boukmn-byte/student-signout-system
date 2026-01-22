let dbPromise = null;

function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("StudentSignOutDB", 1);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      const store = db.createObjectStore("students", { keyPath: "id" });
      store.createIndex("status", "status");
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function getAllStudents() {
  const db = await initDB();
  return new Promise(resolve => {
    const tx = db.transaction("students", "readonly");
    const req = tx.objectStore("students").getAll();
    req.onsuccess = () => resolve(req.result);
  });
}

async function saveStudents(students) {
  const db = await initDB();
  const tx = db.transaction("students", "readwrite");
  const store = tx.objectStore("students");
  students.forEach(s => store.put(s));
  return tx.complete;
}

async function updateStudent(student) {
  const db = await initDB();
  const tx = db.transaction("students", "readwrite");
  tx.objectStore("students").put(student);
  return tx.complete;
}
