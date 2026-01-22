async function loadDashboard() {
  const students = await getAllStudents();
  const signedOut = students.filter(s => s.status === "out").length;

  document.getElementById("totalStudents").textContent = students.length;
  document.getElementById("signedOutCount").textContent = signedOut;
  document.getElementById("signedInCount").textContent = students.length - signedOut;
}

async function loadStudentsTable() {
  const students = await getAllStudents();
  const tbody = document.getElementById("studentsTable");
  tbody.innerHTML = "";

  students.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.id}</td>
      <td>${s.name}</td>
      <td>${s.grade}</td>
      <td>${s.status}</td>
      <td>
        <button class="btn btn-sm btn-secondary" data-id="${s.id}">
          ${s.status === "out" ? "Sign In" : "Sign Out"}
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function setupTabs() {
  document.querySelectorAll(".nav-link").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".tab-section").forEach(s => s.classList.add("d-none"));
      document.getElementById(tab.dataset.tab).classList.remove("d-none");
    });
  });
}
