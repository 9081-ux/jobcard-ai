// store.js — Job persistence in localStorage (v1; no login, no backend).
// Jobs are the technician's own data on their own device.

const KEY = 'jobcard.jobs.v1';
const SEEDED_KEY = 'jobcard.seeded.v1';

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(jobs) {
  localStorage.setItem(KEY, JSON.stringify(jobs));
}

export function loadJobs() {
  return readRaw();
}

export function saveJob(job) {
  const jobs = readRaw();
  const existing = jobs.findIndex((j) => j.id === job.id);
  if (existing >= 0) jobs[existing] = job;
  else jobs.unshift(job);
  writeRaw(jobs);
  return job;
}

export function deleteJob(id) {
  writeRaw(readRaw().filter((j) => j.id !== id));
}

export function clearAllJobs() {
  writeRaw([]);
  localStorage.removeItem(SEEDED_KEY);
}

export function isSeeded() {
  return localStorage.getItem(SEEDED_KEY) === '1';
}

export function markSeeded() {
  localStorage.setItem(SEEDED_KEY, '1');
}

export function newId() {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
