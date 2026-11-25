// app.js — JobCard AI UI. All AI calls go through HybridAI (ai.js).
// Views: Jobs / New Job / Weekly Digest / Hybrid Routing.

import { getConfig } from './config.js';
import { HybridAI } from './ai.js';
import { loadJobs, saveJob, deleteJob, newId, isSeeded, markSeeded } from './store.js';
import { SAMPLE_JOBS } from './samples.js';

const ai = new HybridAI();

// ---- routing state (single source of truth for the whole app) ----
const routing = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineSimulated: false,
  nanoSimulatedUnavailable: false,
  nanoAvailable: true, // mock default: device model simulated as available
};

const callLog = [];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function badge(engine, fallback) {
  if (engine === 'on-device') {
    return `<span class="badge badge-device" title="Ran on-device with Gemini Nano">ON-DEVICE</span>`;
  }
  if (engine === 'cloud') {
    return fallback
      ? `<span class="badge badge-fallback" title="Device model unavailable — fell back to the cloud">CLOUD · FALLBACK</span>`
      : `<span class="badge badge-cloud" title="Ran in the cloud">CLOUD</span>`;
  }
  return `<span class="badge badge-none">NO ENGINE</span>`;
}

function logCall(feature, res) {
  callLog.unshift({
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    feature,
    engine: res.engine,
    fallback: res.fallback,
    latencyMs: res.latencyMs,
    ok: res.ok,
  });
  renderCallLog();
  renderRoutingPanel();
}

// ---- view switching ----
let currentView = 'jobs';
let selectedJobId = null;

function showView(name) {
  currentView = name;
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.view === name);
  });
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.toggle('active', v.id === `view-${name}`);
  });
  if (name === 'jobs') renderJobs();
  if (name === 'digest') renderDigestPlaceholder();
  if (name === 'routing') renderRoutingPanel();
}

// ---- jobs view ----
function renderJobs() {
  const jobs = loadJobs();
  const listEl = document.getElementById('job-list');
  const detailEl = document.getElementById('job-detail');
  if (!jobs.length) {
    listEl.innerHTML = `<div class="empty">No jobs yet. Create one, or load a sample job — no typing needed.</div>`;
    detailEl.innerHTML = '';
    return;
  }
  listEl.innerHTML = jobs
    .map(
      (j) => `
    <button class="job-card ${j.id === selectedJobId ? 'selected' : ''}" data-id="${j.id}">
      <span class="job-card-top">
        <strong>${esc(j.customer)}</strong>
        <span class="trade-chip">${esc(j.trade)}</span>
      </span>
      <span class="job-card-sub">${esc(j.address || '')}</span>
      <span class="job-card-meta">
        ${fmtDate(j.createdAt)}
        ${j.sample ? '<span class="sample-tag">SAMPLE</span>' : ''}
        ${j.result ? `<span class="done-tag">Processed · ${money(j.result.total)}</span>` : '<span class="todo-tag">Not processed</span>'}
      </span>
    </button>`,
    )
    .join('');
  listEl.querySelectorAll('.job-card').forEach((el) => {
    el.addEventListener('click', () => {
      selectedJobId = el.dataset.id;
      renderJobs();
    });
  });
  const selected = jobs.find((j) => j.id === selectedJobId) || jobs[0];
  if (selected) {
    selectedJobId = selected.id;
    detailEl.innerHTML = renderJobDetail(selected);
    wireDetail(selected);
  }
}

function renderResultSections(result, aiMeta) {
  const meta = aiMeta
    ? `<div class="ai-meta">${badge(aiMeta.engine, aiMeta.fallback)}
       <span class="latency">${aiMeta.latencyMs} ms</span>
       <span class="mode-tag">${esc(aiMeta.mode)}</span>
       <span class="reason">${esc(aiMeta.reason || '')}</span></div>`
    : '';
  return `
  ${meta}
  <div class="result-block"><h4>Summary</h4><p>${esc(result.summary)}</p></div>
  <div class="result-block"><h4>Work completed</h4>
    ${result.completed.length ? `<ul>${result.completed.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '<p class="muted">Nothing detected as completed in the notes.</p>'}
  </div>
  <div class="result-block"><h4>Parts &amp; materials</h4>
    ${result.parts.length ? `<ul>${result.parts.map((p) => `<li>${p.qty}× ${esc(p.name)}</li>`).join('')}</ul>` : '<p class="muted">No parts mentioned in the notes.</p>'}
  </div>
  <div class="result-block"><h4>Follow-ups</h4>
    ${result.followUps.length ? `<ul>${result.followUps.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="muted">No follow-ups detected.</p>'}
  </div>
  <div class="result-block"><h4>Invoice lines <span class="muted small">— only amounts written in the notes</span></h4>
    ${result.invoiceLines.length
      ? `<table class="invoice"><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
         ${result.invoiceLines.map((l) => `<tr><td>${esc(l.description)}</td><td>${l.qty}</td><td>${money(l.amount)}</td></tr>`).join('')}
         </tbody><tfoot><tr><td colspan="2">Total</td><td>${money(result.total)}</td></tr></tfoot></table>`
      : '<p class="muted">No amounts in the notes — nothing billed. Add a price to the notes to see invoice lines.</p>'}
  </div>
  <div class="result-block"><h4>Customer message <button class="btn btn-small" data-copy="msg">Copy</button></h4>
    <p class="message-draft">${esc(result.message)}</p>
  </div>`;
}

function renderJobDetail(job) {
  const resultHtml = job.result
    ? renderResultSections(job.result, job.aiMeta)
    : `<div class="empty">Not processed yet. The AI summary, parts list, invoice and customer message will appear here.</div>`;
  return `
  <div class="detail-head">
    <div>
      <h3>${esc(job.customer)} ${job.sample ? '<span class="sample-tag">SAMPLE</span>' : ''}</h3>
      <p class="muted">${esc(job.address || '')} · ${esc(job.trade)} · ${fmtDate(job.createdAt)}</p>
    </div>
    <div class="detail-actions">
      <button class="btn btn-primary" id="btn-reprocess">Process with AI</button>
      <button class="btn btn-danger-ghost" id="btn-delete-job">Delete</button>
    </div>
  </div>
  <div class="notes-box"><h4>Field notes</h4><p>${esc(job.text).replace(/\n/g, '<br>')}</p></div>
  <div id="detail-result">${resultHtml}</div>`;
}

function wireDetail(job) {
  const reprocess = document.getElementById('btn-reprocess');
  if (reprocess) {
    reprocess.addEventListener('click', async () => {
      reprocess.disabled = true;
      reprocess.textContent = 'Processing…';
      const res = await ai.processJob(job, routing);
      logCall('Instant job processing', res);
      if (res.ok) {
        job.result = res.result;
        job.aiMeta = { engine: res.engine, fallback: res.fallback, latencyMs: res.latencyMs, mode: res.mode, reason: res.reason };
        saveJob(job);
      } else {
        toast(`Processing failed: ${res.reason}`);
      }
      renderJobs();
    });
  }
  const del = document.getElementById('btn-delete-job');
  if (del) {
    del.addEventListener('click', () => {
      if (confirm(`Delete the job for ${job.customer}?`)) {
        deleteJob(job.id);
        selectedJobId = null;
        renderJobs();
      }
    });
  }
  document.querySelectorAll('[data-copy="msg"]').forEach((b) => {
    b.addEventListener('click', () => {
      navigator.clipboard?.writeText(job.result.message).then(() => toast('Customer message copied.'));
    });
  });
}

// ---- new job view ----
function wireNewJob() {
  const form = document.getElementById('job-form');
  const samplesEl = document.getElementById('sample-buttons');
  samplesEl.innerHTML = SAMPLE_JOBS.map(
    (s, i) => `<button type="button" class="btn sample-btn" data-i="${i}">${esc(s.trade)} — ${esc(s.customer)} <span class="sample-tag">SAMPLE</span></button>`,
  ).join('');
  samplesEl.querySelectorAll('.sample-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const s = SAMPLE_JOBS[Number(b.dataset.i)];
      document.getElementById('f-customer').value = s.customer;
      document.getElementById('f-address').value = s.address;
      document.getElementById('f-trade').value = s.trade;
      document.getElementById('f-text').value = s.text;
      document.getElementById('f-sample').checked = true;
      toast('Sample job loaded — press “Process with AI”.');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const job = {
      id: newId(),
      customer: document.getElementById('f-customer').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      trade: document.getElementById('f-trade').value,
      text: document.getElementById('f-text').value.trim(),
      sample: document.getElementById('f-sample').checked,
      createdAt: Date.now(),
      result: null,
      aiMeta: null,
    };
    if (!job.customer || !job.text) {
      toast('Customer name and field notes are required.');
      return;
    }
    const btn = document.getElementById('btn-process-new');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    const out = document.getElementById('new-job-result');
    out.innerHTML = '<div class="processing">AI is processing the notes…</div>';
    const res = await ai.processJob(job, routing);
    logCall('Instant job processing', res);
    if (res.ok) {
      job.result = res.result;
      job.aiMeta = { engine: res.engine, fallback: res.fallback, latencyMs: res.latencyMs, mode: res.mode, reason: res.reason };
      saveJob(job);
      out.innerHTML = renderResultSections(job.result, job.aiMeta);
      out.querySelectorAll('[data-copy="msg"]').forEach((b) => {
        b.addEventListener('click', () => {
          navigator.clipboard?.writeText(job.result.message).then(() => toast('Customer message copied.'));
        });
      });
      toast('Job processed and saved to the job list.');
      form.reset();
    } else {
      out.innerHTML = `<div class="error-box">Processing failed: ${esc(res.reason)}</div>`;
    }
    btn.disabled = false;
    btn.textContent = 'Process with AI';
  });
}

// ---- weekly digest view ----
function renderDigestPlaceholder() {
  const el = document.getElementById('digest-output');
  if (!el.dataset.touched) {
    el.innerHTML = '<div class="empty">Generate the weekly digest to roll up every saved job — totals come only from amounts written in the notes.</div>';
  }
}

async function generateDigest() {
  const jobs = loadJobs();
  const out = document.getElementById('digest-output');
  const btn = document.getElementById('btn-generate-digest');
  out.dataset.touched = '1';
  btn.disabled = true;
  btn.textContent = 'Generating…';
  out.innerHTML = '<div class="processing">Asking the cloud to roll up the week…</div>';
  const res = await ai.weeklyDigest(jobs, routing);
  logCall('Weekly digest (cloud)', res);
  if (!res.ok) {
    out.innerHTML = `
      <div class="error-box">
        <strong>Digest unavailable.</strong><br>${esc(res.reason)}<br>
        <span class="muted">The weekly digest is a cloud-only task: it needs several jobs at once, which only the cloud model handles. Turn the offline simulation off and try again.</span>
      </div>`;
  } else {
    const d = res.digest;
    out.innerHTML = `
      <div class="ai-meta">${badge(res.engine, res.fallback)}
        <span class="latency">${res.latencyMs} ms</span>
        <span class="mode-tag">${esc(res.mode)}</span>
        <span class="reason">${esc(res.reason || '')}</span></div>
      <div class="stat-row">
        <div class="stat"><span class="stat-num">${d.jobCount}</span><span class="stat-label">Jobs processed</span></div>
        <div class="stat"><span class="stat-num">${money(d.total)}</span><span class="stat-label">Billed this week*</span></div>
        <div class="stat"><span class="stat-num">${d.openFollowUps.length}</span><span class="stat-label">Open follow-ups</span></div>
      </div>
      <p class="fineprint">*Total adds up only the amounts written in the job notes. Nothing is estimated or invented.</p>
      <div class="result-block"><h4>This week</h4><p>${esc(d.weekSummary)}</p></div>
      <div class="result-block"><h4>Most-used parts</h4>
        ${d.topParts.length ? `<ul>${d.topParts.map((p) => `<li>${p.qty}× ${esc(p.name)}</li>`).join('')}</ul>` : '<p class="muted">No parts recorded yet.</p>'}
      </div>
      <div class="result-block"><h4>Follow-up opportunities</h4>
        ${d.opportunities.length ? `<ul>${d.opportunities.map((o) => `<li>${esc(o.text)} <span class="muted">(${esc(o.job)})</span></li>`).join('')}</ul>` : '<p class="muted">No open follow-ups.</p>'}
      </div>
      <div class="result-block"><h4>Customer report draft <button class="btn btn-small" id="btn-copy-report">Copy</button></h4>
        <p class="message-draft" id="digest-report">${esc(d.customerReport)}</p>
      </div>
      <div class="result-block"><h4>Next week</h4>
        <ul>${d.nextWeek.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </div>`;
    document.getElementById('btn-copy-report').addEventListener('click', () => {
      navigator.clipboard?.writeText(d.customerReport).then(() => toast('Customer report copied.'));
    });
  }
  btn.disabled = false;
  btn.textContent = 'Generate weekly digest';
}

// ---- routing view ----
async function renderRoutingPanel() {
  let status;
  try {
    status = await ai.deviceStatus(routing);
  } catch (err) {
    // Display-layer guard: in firebase mode deviceStatus() initializes the
    // engine, whose SDK loads from a CDN. If that load fails in this browser
    // the panel must still render something honest instead of going blank.
    // (Engine behavior is unchanged — this only affects the panel copy.)
    status = {
      label: 'Firebase AI Logic connected — device status could not be probed in this browser',
      detail: `The on-device model check did not complete here (${esc(err?.message || err)}). Instant tasks still run through Firebase AI Logic with cloud fallback; the weekly digest runs ONLY_IN_CLOUD.`,
      availability: 'unknown',
      simulated: false,
    };
  }
  const statusEl = document.getElementById('device-status');
  if (statusEl) {
    statusEl.innerHTML = `
      <div class="status-line"><strong>Device model:</strong> ${esc(status.label)}</div>
      <p class="muted">${esc(status.detail)}</p>
      <div class="status-line"><strong>Network:</strong> ${routing.offlineSimulated ? 'Simulated offline' : routing.online ? 'Online' : 'Offline (real)'}</div>
      <div class="status-line"><strong>Engine in use:</strong> ${getConfig().mode === 'firebase' ? 'Firebase AI Logic (live)' : 'Mock engine (local simulation)'} — ${esc(getConfig().mode === 'firebase' ? 'real Gemini Nano / cloud calls' : 'no network calls; see SWAP-TO-REAL.md to connect Firebase')}</div>`;
  }
  const tableEl = document.getElementById('engine-table');
  if (tableEl) {
    const offline = routing.offlineSimulated || !routing.online;
    tableEl.innerHTML = `
      <table class="invoice">
        <thead><tr><th>Feature</th><th>Mode</th><th>Where it runs</th><th>When offline</th></tr></thead>
        <tbody>
          <tr><td>Instant job processing</td><td>PREFER_ON_DEVICE</td><td>${offline ? 'On-device' : routing.nanoAvailable ? 'On-device (Gemini Nano)' : 'Cloud (fallback)'}</td><td>Still works — on-device</td></tr>
          <tr><td>Weekly digest</td><td>ONLY_IN_CLOUD</td><td>Cloud</td><td>Unavailable — honestly blocked</td></tr>
        </tbody>
      </table>`;
  }
}

function renderCallLog() {
  const el = document.getElementById('call-log');
  if (!el) return;
  if (!callLog.length) {
    el.innerHTML = '<p class="muted">No AI calls yet this session. Process a job or generate the digest and every call shows up here with its real engine and measured time.</p>';
    return;
  }
  el.innerHTML = `<table class="invoice"><thead><tr><th>Time</th><th>Feature</th><th>Engine</th><th>Latency</th></tr></thead><tbody>
    ${callLog.map((c) => `<tr><td>${esc(c.time)}</td><td>${esc(c.feature)}</td><td>${c.ok ? badge(c.engine, c.fallback) : '<span class="badge badge-none">FAILED</span>'}</td><td>${c.ok ? `${c.latencyMs} ms` : '—'}</td></tr>`).join('')}
    </tbody></table>`;
}

function renderHeaderState() {
  const modeEl = document.getElementById('engine-mode-pill');
  if (modeEl) {
    modeEl.textContent = getConfig().mode === 'firebase' ? 'LIVE · FIREBASE AI LOGIC' : 'MOCK ENGINE · SIMULATED AI';
    modeEl.className = `pill ${getConfig().mode === 'firebase' ? 'pill-live' : 'pill-mock'}`;
  }
  const footerEl = document.getElementById('footer-note');
  if (footerEl) {
    // The footer used to be static mock-mode copy, which contradicted the
    // LIVE pill once the real engine was deployed. Set it from the mode.
    footerEl.innerHTML = getConfig().mode === 'firebase'
      ? 'JobCard AI — built for #BuildHybridAI 2026 (Firebase AI Logic). Running live on real Firebase AI Logic — Gemini Nano on-device with cloud fallback. Sample jobs are labeled SAMPLE.'
      : 'JobCard AI — built for #BuildHybridAI 2026 (Firebase AI Logic). Runs on the local mock engine until a Firebase project config is added; see <code>SWAP-TO-REAL.md</code>. Sample jobs are labeled SAMPLE. No data leaves this device in mock mode.';
  }
  const netEl = document.getElementById('net-pill');
  if (netEl) {
    const offline = routing.offlineSimulated || !routing.online;
    netEl.textContent = offline ? (routing.offlineSimulated ? 'OFFLINE (SIMULATED)' : 'OFFLINE') : 'ONLINE';
    netEl.className = `pill ${offline ? 'pill-offline' : 'pill-online'}`;
  }
  const toggle = document.getElementById('toggle-offline');
  if (toggle) toggle.checked = routing.offlineSimulated;
  const nanoToggle = document.getElementById('toggle-nano-off');
  if (nanoToggle) nanoToggle.checked = routing.nanoSimulatedUnavailable;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function seedIfNeeded() {
  if (!isSeeded() && loadJobs().length === 0) {
    for (const s of SAMPLE_JOBS) {
      saveJob({ ...s, id: newId(), sample: true, createdAt: Date.now(), result: null, aiMeta: null });
    }
    markSeeded();
  }
}

function wireGlobal() {
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.addEventListener('click', () => showView(t.dataset.view));
  });
  document.getElementById('toggle-offline').addEventListener('change', (e) => {
    routing.offlineSimulated = e.target.checked;
    renderHeaderState();
    renderRoutingPanel();
    toast(e.target.checked ? 'Offline simulation ON — instant tasks stay on-device; the digest is blocked.' : 'Offline simulation off — back online.');
  });
  document.getElementById('toggle-nano-off').addEventListener('change', (e) => {
    routing.nanoSimulatedUnavailable = e.target.checked;
    routing.nanoAvailable = !e.target.checked;
    renderRoutingPanel();
    toast(e.target.checked ? 'Device model simulated as unavailable — instant tasks will fall back to the cloud.' : 'Device model available again.');
  });
  document.getElementById('btn-generate-digest').addEventListener('click', generateDigest);
  window.addEventListener('online', () => {
    routing.online = true;
    renderHeaderState();
    renderRoutingPanel();
  });
  window.addEventListener('offline', () => {
    routing.online = false;
    renderHeaderState();
    renderRoutingPanel();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  seedIfNeeded();
  wireGlobal();
  wireNewJob();
  renderHeaderState();
  renderCallLog();
  showView('jobs');
  await renderRoutingPanel();
});
