# JobCard AI — Offline-first AI field notes for home-service pros

**Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/)** (Google / Devpost, $30,000 prize pool). Web app, Chrome 139+.

A technician in a basement with no signal is exactly when they need AI most.
JobCard AI turns rough field notes into a structured job card **on-device first**
(Gemini Nano via Firebase AI Logic, `PREFER_ON_DEVICE`), and rolls the week up
into a digest **in the cloud** (`ONLY_IN_CLOUD`). Every AI result is labeled
with the engine that actually ran it and the measured milliseconds.

**Live demo (real Firebase AI Logic, not mock): https://g0f3l-raw.sakupa.com/jobcard/**
— deployed 2026-11-25; three sample jobs + weekly digest verified end-to-end
against the real cloud model (HTTP 200, invoice totals exact). See
[SWAP-TO-REAL.md](SWAP-TO-REAL.md) for the verification results.

## What it does

- **Job cards** — customer, address, trade (HVAC / Plumbing / Electrical /
  Cleaning / Other), free-text field notes. Saved on the device (localStorage),
  view / reprocess / delete. Three labeled SAMPLE jobs included.
- **Instant processing (on-device first)** — one-tap AI turns notes into:
  summary, work completed, parts & materials list, follow-ups, invoice lines,
  and a customer message draft. Invoice lines use **only amounts written in
  the notes** — nothing is invented.
- **Weekly digest (cloud only)** — totals, most-used parts, open follow-ups,
  a customer report draft, next-week suggestions. Honestly refuses when
  offline instead of faking it.
- **Hybrid routing panel** — live device-model status (probes the real Prompt
  API surface when present), online/offline state, per-feature engine table,
  **offline simulation toggle**, **simulate-Nano-unavailable toggle**, and a
  session call log with real engines and measured latency.

## Run it

```bash
# from this directory
python3 -m http.server 8000
# open http://localhost:8000
```

Or any static server (`npx serve .`). No build step, no backend.
Without a local Firebase config the app runs end to end against the local
mock engine; the UI says `MOCK ENGINE · SIMULATED AI` in the header.

## Tests

```bash
npm test        # node tests/run-tests.mjs — 56 checks, no browser needed
```

Covers note parsing (all 3 sample jobs, exact totals), the no-invented-money
rule, every routing decision, mock-engine timing, and the weekly digest.

## Real Firebase AI Logic — already connected

The live demo runs the real engine (`js/firebase-engine.js`, Firebase SDK
12.5.0, `firebase/ai`): hybrid `PREFER_ON_DEVICE` for job cards, cloud-only
for the weekly digest, App Check enforced. **Verification results 2026-11-25**
(three sample jobs + weekly digest, all HTTP 200, invoice totals exact) are
in [SWAP-TO-REAL.md](SWAP-TO-REAL.md). To run the real engine locally, copy
`config.local.example.js` to `config.local.js` (git-ignored, never committed)
and fill in your Firebase web app config — that one file flips the single
engine switch in `js/ai.js`. No other code changes.

## Project layout

```
index.html            App shell (English UI)
css/style.css         Design system (mobile-first, system fonts)
js/config.js          Firebase config loader (untracked local file)
js/ai.js              THE abstraction layer — engine picked in ONE place
js/mock.js            Mock engine: real routing + measured latency
js/firebase-engine.js Real Firebase AI Logic engine (loaded only with config)
js/extract.js         Deterministic note parser (single source of truth for money)
js/store.js           localStorage job store
js/samples.js         3 labeled SAMPLE jobs
js/app.js             UI wiring
tests/run-tests.mjs   Node test suite (56 checks)
RULES.md              Competition rules, verified 2026-11-25
CONCEPT.md            Product concept + judging alignment
SWAP-TO-REAL.md       How to swap the mock engine for real Firebase
```

## Rules & honesty

- All AI inference goes through Firebase AI Logic — the real engine on the
  live site (see SWAP-TO-REAL.md), mock engine only for offline demos.
  No other model API is called.
- No secrets in this repo: no apiKey, no App Check debug token, no `.env`,
  no service account key. See `.gitignore`.
- Sample data is labeled SAMPLE. Invoice totals come only from amounts in
  the notes.
- License: Apache-2.0 (see `LICENSE`).
