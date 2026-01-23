// quick-actions.js — quick nav buttons wiring (ES module)

import { App } from './app-context.js';
import { openAddStudentModal } from './ui.js';

export function initQuickActions() {
  document.getElementById('quick-signout')?.addEventListener('click', () => App.nav.showSignOut());
  document.getElementById('quick-students')?.addEventListener('click', () => App.nav.showStudents());
  document.getElementById('quick-import')?.addEventListener('click', () => App.nav.showCSVImport());

  document.getElementById('addStudentBtn')?.addEventListener('click', () => {
    openAddStudentModal();
  });
}
