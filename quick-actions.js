// quick-actions.js (ES module)

let _navigate = null;

export function setQuickActionsConfig({ navigate }) {
  _navigate = navigate;
}

export function initQuickActions() {
  document.getElementById('quick-signout')?.addEventListener('click', () => _navigate?.showSignOut?.());
  document.getElementById('quick-students')?.addEventListener('click', () => _navigate?.showStudents?.());
  document.getElementById('quick-import')?.addEventListener('click', () => _navigate?.showCSVImport?.());

  document.getElementById('addStudentBtn')?.addEventListener('click', openAddStudentModal);
}

function openAddStudentModal() {
  const modalEl = document.getElementById('editStudentModal');
  const form = document.getElementById('editStudentForm');
  if (!modalEl || !form) return;

  form.reset();
  delete form.dataset.studentId;
  modalEl.querySelector('.modal-title').textContent = 'Add New Student';

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}
