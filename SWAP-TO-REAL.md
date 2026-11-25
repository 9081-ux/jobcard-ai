# SWAP-TO-REAL.md — From the mock engine to real Firebase AI Logic

Current state (2026-11-25): the app runs on the **real Firebase AI Logic
engine on the live site** (deployed 2026-11-25, deployment
`8ec9ca9e-69f2-45ac-9658-4676724a00ce`, valid to 2026-12-25T10:41:57Z).
Real calls verified end-to-end (see "Verification results 2026-11-25
(round 2)" below). The mock engine stays in the repo for offline demos
only — the live site no longer uses it.

## Verification results 2026-11-25 (SDK firebase 12.5.0 / @firebase/ai 2.5.0)

Checked against the installed SDK's own `.d.ts` types, ESM runtime, and the
official Firebase docs — not from memory:

- `getAI(app, { backend: new GoogleAIBackend() })`, import path `firebase/ai` — exact. ✓
- `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })` — hybrid
  params. **`generationConfig` does NOT belong at top level**: the runtime
  builds the model from `inCloudParams` only, so a top-level generationConfig
  is silently dropped. It must live inside `inCloudParams` (ModelParams).
  `ModelParams.model` is required; the hybrid default cloud model in SDK
  12.5.0 is `gemini-2.0-flash-lite` — BUT the backend retired that model
  on/before 2026-11-25 (generateContent → 404 "no longer available, use
  models/gemini-3.5-flash-lite"), so the engine pins `gemini-3.5-flash-lite`
  instead (see CLOUD_MODEL in js/firebase-engine.js; round-2 verification
  above). The docs' `gemini-3.5-flash-lite` default applies from SDK v13.0.0,
  but the backend requires it already. ✓
- **`model.initializeDeviceModel()` DOES NOT EXIST in SDK 12.5.0** — no such
  symbol in types or runtime. On-device model downloads automatically on
  first use via the Chrome Prompt API. `warmUpDeviceModel()` is an honest
  no-op returning false. ✓
- `generationConfig.responseSchema` accepts a plain JS object matching
  `SchemaRequest` (per .d.ts). Applies to the cloud path only (inCloudParams);
  the on-device Prompt API path has no schema support in this SDK — on-device
  output is parsed best-effort and falls back to deterministic local parse;
  money is never invented either way. ✓
- **Serving-engine signal is `response.inferenceSource`** ('ON_DEVICE' /
  'IN_CLOUD', available since SDK v12.5.0). `usageMetadata` carries only token
  counts — no inference-mode field. ✓
- `getGenerativeModel` must be called after/on a user interaction — satisfied:
  `_init()` runs lazily inside processJob/weeklyDigest, always from button
  clicks. ✓
- **App Check is ENFORCED for this project** (the AI Logic guided setup turns
  enforcement on). Proven by a real server call: `generateContent` with no
  App Check token returns HTTP 401 `{"error":{"code":401,"message":"Firebase
  App Check token is invalid.","status":"UNAUTHENTICATED"}}`. The project,
  API, model, and key all work — only the token is missing. ✓ (verified
  2026-11-25 via curl to the exact endpoint the SDK calls:
  `firebasevertexai.googleapis.com/v1beta/projects/jobcard-ai/models/gemini-3.5-flash-lite:generateContent`
  (was gemini-2.0-flash-lite — retired, see round-2 note above)
- **Debug token generated in a real browser** (official flow): with
  `appCheckDebug: true`, `initializeAppCheck` prints
  `App Check debug token: <uuid>. You will need to add it to your app's App
  Check settings in the Firebase console for it to work.` The token value is
  **not written in any file** — it is in the test-run output handed to the
  operator, and it lives in the test browser profile's IndexedDB
  (`~/workspace/autonomous-income/buildhybridai-2026-test/pw-profile/`) so
  the same token is reused on re-tests. **Register it in the Firebase console
  (Security > App Check > Apps > Manage debug tokens) before re-testing.**
- **Browser-side wiring verified to the network boundary** (headless Chromium
  has no external network in this sandbox, so the live call could not complete
  there): the SDK's outgoing requests were captured by route interception —
  `exchangeDebugToken` POST to `content-firebaseappcheck.googleapis.com` with
  `{"debug_token": ...}`, and `generateContent` POST to the endpoint above
  with headers `x-goog-api-key`, `X-Firebase-Appid`, `X-Firebase-AppCheck`,
  and a body carrying `generationConfig.responseMimeType: "application/json"`
  + the full `responseSchema` + the Priya sample notes. The app failed
  honestly ("Processing failed: AI call failed: … Failed to fetch") with no
  fake success. Pill reads `LIVE · FIREBASE AI LOGIC`.
- **Import map is required**: bare specifiers `firebase/app`, `firebase/ai`,
  `firebase/app-check` in dynamic imports cannot resolve in browsers without
  one — index.html now maps them to the pinned gstatic 12.5.0 URLs (verified
  200). There was no import map before; that was a latent bug.
- **Model retirement (found 2026-11-25, round 2): `gemini-2.0-flash-lite` is
  GONE from the backend** — `generateContent` returns HTTP 404 "This model
  models/gemini-2.0-flash-lite is no longer available. Please update your code
  to use models/gemini-3.5-flash-lite". The engine now pins
  `gemini-3.5-flash-lite` (js/firebase-engine.js CLOUD_MODEL). All three real
  calls below use it.
- **Real end-to-end calls verified 2026-11-25 (round 2, shell + Node):**
  debug-token exchange → HTTP 200 (TTL 3600s) for BOTH registered tokens
  (test token + fixed deployed token). `generateContent` with the real JOB
  prompt + JOB_SCHEMA → HTTP 200 + valid JSON for all 3 samples, invoice
  totals exactly as in the notes: Maria $188.50 ($68.50 + $120), James
  $24.99, Priya $50.50 ($18.00 + $32.50). Real repo engine in Node
  (js/firebase-engine.js, appCheckDebugToken path): all 3 jobs ok=true,
  engine=cloud, fallback=true (no Nano in Node — honest cloud fallback),
  latencies 5.9–6.9s; weekly digest ok=true, engine=cloud, 18.1s, total
  $263.99. Summaries are complete sentences.
- **Sandbox browser cannot run a live call** (headless Chromium has no
  external network: example.com → ERR_TUNNEL_CONNECTION_FAILED, gstatic SDK
  fetch fails). Browser check confirms: pill reads `LIVE · FIREBASE AI
  LOGIC`, no mock. Full browser E2E must be verified in real Chrome with
  Nano (video step).
- **Init-failure hang fixed 2026-11-25:** `processJob` used to `await _init()`
  BEFORE its try block, so a failed SDK import rejected the promise and the
  UI stuck on "AI is processing the notes…" forever (app.js has no
  try/catch). `_init()` is now inside the try — a load failure resolves
  ok:false with an honest error message instead.
- **Deployed-site App Check story DECIDED: fixed debug token** (contest
  rules explicitly allow debug tokens in submissions). The engine supports
  `appCheckDebugToken` in config (verified in the @firebase/app-check 0.11.0
  runtime: a string FIREBASE_APPCHECK_DEBUG_TOKEN is used verbatim as the
  token). The deployed config.local.js carries the console-created fixed
  token; it never enters the repo.
  `~/workspace/autonomous-income/buildhybridai-2026-test/` — vendored-SDK test
  copy (`app/`, import map pointed at local `./vendor/` files identical to the
  CDN bytes), `token-test.mjs` (token generation + request capture),
  `pw-profile/` (persistent browser profile holding the debug token).
  `/tmp` is wiped on every service restart — never keep scripts there.

## Remaining steps before the live site can go real

All done 2026-11-25 (kept for the record):

1. ~~Register the debug token~~ — done: test token + fixed deployed token
   both registered in the Firebase console; both exchange → HTTP 200.
2. ~~Re-test end-to-end~~ — done: shell + Node engine tests all pass (see
   round-2 results above).
3. ~~Deploy~~ — done: deployment `8ec9ca9e-69f2-45ac-9658-4676724a00ce`
   (2026-12-25T10:41:57Z expiry); live verification passed (calculator
   JSON md5 unchanged, jobcard files match local except the Sakupa
   injected script line, deployed bundle shows the LIVE pill with the
   fixed token loaded).
4. ~~Decide the deployed-site App Check story~~ — decided: ONE fixed debug
   token in the console, shipped as `appCheckDebugToken` in the *deployed*
   `config.local.js` (never in the repo; contest rules explicitly allow
   debug tokens in submissions).

Still open (not a deploy blocker): true on-device routing can only be
verified in real Chrome 139+ with Nano downloaded — do it during the demo
video recording.

## Step 1 — Create the Firebase project (user, in the Firebase console)

1. Create a project (or reuse one) at https://console.firebase.google.com/
2. Enable **Firebase AI Logic** (choose the **Gemini Developer API** backend —
   free tier covers text inference; no quota request needed for this app).
3. Register a **Web app** in the project and copy its config:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`.

## Step 2 — Put the config in the untracked local file (one place)

```bash
cp config.local.example.js config.local.js
# edit config.local.js and paste the values from Step 1
```

`config.local.js` is git-ignored and is **never** committed. The Firebase web
`apiKey` is a public identifier, but even it stays out of the repo by policy.

## Step 3 — App Check (required by AI Logic — enforcement is ON)

- **App Check enforcement is ON for this project** (verified 2026-11-25:
  token-less `generateContent` → HTTP 401 "Firebase App Check token is
  invalid."). No real AI call works without a valid App Check token.
- **Local dev:** set `appCheckDebug: true` in `config.local.js`. The browser
  generates a debug token on first run and prints it in the console —
  register it in the Firebase console (App Check → Manage debug tokens).
  **Never paste a debug token into any file or commit one.** A debug token
  has been generated (2026-11-25, in the operator's handoff); register it,
  then re-test — see "Remaining steps" at the top of this file.
- **Deployed demo:** a per-browser debug token does NOT work for judges
  (each visitor generates their own unregistered token). Either ship one
  fixed console-created debug token as `appCheckDebugToken` in the *deployed*
  `config.local.js` (never in the repo), or create a reCAPTCHA Enterprise
  site key, put it in `config.local.js` as `appCheckSiteKey`, and set
  `appCheckDebug: false`.

## Step 4 — Verify the real engine before the demo (do not skip)

`js/firebase-engine.js` was written from the Firebase AI Logic JS SDK docs
(`firebase/ai` v12.x). **Verified 2026-11-25 against the installed SDK
(firebase 12.5.0 / @firebase/ai 2.5.0) — see "Verification results" at the top
of this file; every item below is now checked:**

- [x] `getAI(app, { backend: new GoogleAIBackend() })` — import path `firebase/ai`
- [x] `getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })` for
      instant jobs; `{ mode: InferenceMode.ONLY_IN_CLOUD }` for the digest —
      with `generationConfig` inside `inCloudParams`, cloud model pinned to
      `gemini-3.5-flash-lite` (backend retired the SDK 12.5.0 default
      gemini-2.0-flash-lite; verified 2026-11-25)
- [x] `model.initializeDeviceModel(progress => …)` — **does not exist in
      12.5.0**; `warmUpDeviceModel()` is a documented honest no-op
- [x] `generationConfig: { responseMimeType: 'application/json', responseSchema }`
      as a plain JS object inside `inCloudParams` — confirmed in the captured
      outgoing request body
- [x] Serving engine read from `response.inferenceSource` (not usageMetadata)
- [ ] Run once in Chrome 139+ with the Prompt API flag on
      (`chrome://flags` → "Gemma 4 for Built-in AI"), process a sample job
      online, then with **Simulate offline** on, then generate the digest —
      the badges must read ON-DEVICE / CLOUD / CLOUD · FALLBACK truthfully.
      **Still pending**: blocked on App Check token registration (Step 3);
      headless Chromium here has no Prompt API model and no external network,
      so true on-device can only be verified in real Chrome with Nano
      downloaded (parent's PC, for the video).

If any call differs, fix it in `js/firebase-engine.js` only — the rest of the
app is engine-agnostic.

## Step 5 — Confirm what changes (and what does not)

| Changes | Does not change |
|---|---|
| `config.local.js` (new, untracked) | `js/ai.js` engine switch — it already reads `CONFIG.mode` |
| App Check setup (Step 3) | UI, store, samples, routing logic, tests |
| Possibly one SDK call name in `firebase-engine.js` (Step 4) | The mock engine — it stays in the repo for offline demos |

After the swap, the header pill reads `LIVE · FIREBASE AI LOGIC`, the routing
panel reports real device availability, and the mock engine is never loaded.

## Rollback

Delete (or rename) `config.local.js` and reload — the app is back on the mock
engine immediately. Nothing else to undo.
