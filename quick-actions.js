// quick-actions.js - Quick nav + Add Student button wiring

document.addEventListener('DOMContentLoaded', initializeQuickActions);

function initializeQuickActions() {
  document.getElementById('quick-signout')?.addEventListener('click', () => {
    if (typeof showSignOut === 'function') showSignOut();
  });

  document.getElementById('quick-students')?.addEventListener('click', () => {
    if (typeof showStudents === 'function') showStudents();
  });

  document.getElementById('quick-import')?.addEventListener('click', () => {
    if (typeof showCSVImport === 'function') showCSVImport();
  });

  document.getElementById('addStudentBtn')?.addEventListener('click', () => {
    openAddStudentModal();
  });
}

function openAddStudentModal() {
  const modalEl = document.getElementById('editStudentModal');
  const form = document.getElementById('editStudentForm');
  if (!modalEl || !form) return;

  // reset
  form.reset();
  delete form.dataset.studentId;
  modalEl.querySelector('.modal-title').textContent = 'Add New Student';

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}
