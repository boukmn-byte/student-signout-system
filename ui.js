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

// Quarter configuration (optional)
const QUARTERS = [];

function getCurrentQuarterRange(now = new Date()) {
  if (QUARTERS.length === 4) {
    for (const q of QUARTERS) {
      const start = new Date(q.start + 'T00:00:00');
      const end = new Date(q.end + 'T23:59:59');
      if (now >= start && now <= end) return { ...q, startISO: start.toISOString(), endISO: end.toISOString() };
    }
  }

  const year = now.getFullYear();
  const schoolYearStart = (now.getMonth() < 7) ? year - 1 : year;

  const ranges = [
    { label: 'Q1', start: `${schoolYearStart}-08-01`, end: `${schoolYearStart}-10-15` },
    { label: 'Q2', start: `${schoolYearStart}-10-16`, end: `${schoolYearStart + 1}-01-15` },
    { label: 'Q3', start: `${schoolYearStart + 1}-01-16`, end: `${schoolYearStart + 1}-03-31` },
    { label: 'Q4', start
