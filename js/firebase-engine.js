// firebase-engine.js — Real Firebase AI Logic engine for JobCard AI.
//
// VERIFIED against the installed Firebase JS SDK v12.5.0 (firebase 12.5.0,
// @firebase/ai 2.5.0, @firebase/app-check 0.11.0) — its .d.ts types and ESM
// runtime — plus the official Firebase AI Logic docs (get-started, hybrid
// inference web get-started + configuration-options), 2026-11-25.
//
// Checklist results (SWAP-TO-REAL.md Step 4):
// - getAI(app, { backend: new GoogleAIBackend() }) — exact. Import path
//   'firebase/ai'. ✓
// - getGenerativeModel(ai, { mode }) — hybrid params. generationConfig does
//   NOT belong at the top level of a hybrid call: the runtime builds the
//   model from inCloudParams only, so a top-level generationConfig is
//   silently dropped. It must live inside inCloudParams (ModelParams).
//   inCloudParams.model defaults to 'gemini-2.0-flash-lite' in SDK 12.5.0,
//   BUT the backend retired that model on/before 2026-11-25 — the engine
//   pins 'gemini-3.5-flash-lite' instead (see CLOUD_MODEL below). ✓
// - model.initializeDeviceModel() — DOES NOT EXIST in SDK 12.5.0. No
//   initialize/download method exists anywhere in @firebase/ai 2.5.0: the
//   on-device model (Gemini Nano via the Chrome Prompt API) downloads
//   automatically on first use. warmUpDeviceModel() is kept as an honest
//   no-op returning false. ✓
// - generationConfig.responseSchema — accepts a plain JS object matching
//   SchemaRequest (docs: "or it can be a plain JS object matching the
//   SchemaRequest interface"). The JOB_SCHEMA / DIGEST_SCHEMA literals
//   below are valid. They apply to the CLOUD path only (inCloudParams);
//   the on-device Prompt API path has no schema support in this SDK, so
//   on-device output is parsed best-effort and falls back to the
//   deterministic local parse — money is never invented either way. ✓
// - Which engine served a call: response.inferenceSource ('ON_DEVICE' /
//   'IN_CLOUD', available since SDK v12.5.0) — NOT usageMetadata, which
//   only carries token counts and has no inference-mode field. ✓
// - getGenerativeModel must be called after/on a user interaction (docs)
//   — _init() runs lazily inside processJob/weeklyDigest, which are always
//   triggered by button clicks. ✓
// - App Check: the AI Logic guided setup auto-enforces App Check, so calls
//   without a valid token fail. Debug flow (official, web): set
//   self.FIREBASE_APPCHECK_DEBUG_TOKEN = true BEFORE initializeAppCheck;
//   the SDK then uses the debug provider, prints the token to the console
//   ("App Check debug token: ..."), and the token must be registered in
//   the Firebase console (Security > App Check > Apps > Manage debug
//   tokens) before calls succeed. In debug mode the provider passed to
//   initializeAppCheck is never invoked (verified in the SDK runtime), so
//   a CustomProvider whose getToken throws is used as the inert placeholder
//   when no reCAPTCHA site key is configured. Never paste a token here.
//
// Interface (identical to MockEngine):
//   processJob(note, routingState) -> { ok, mode, engine, fallback, reason, latencyMs, result }
//   weeklyDigest(jobs, routingState) -> { ok, mode, engine, fallback, reason, latencyMs, digest }
//   deviceStatus(routingState) -> { label, detail, availability, simulated: false }

import { parseNote, buildDigest } from './extract.js';

// Free-tier cloud model used for the cloud path and as the PREFER_ON_DEVICE
// fallback. NOTE 2026-11-25: the backend retired gemini-2.0-flash-lite
// (generateContent returns 404 "This model ... is no longer available.
// Please update your code to use models/gemini-3.5-flash-lite") —
// gemini-3.5-flash-lite is the current model and is required now, even
// though SDK 12.5.0's own default was gemini-2.0-flash-lite.
const CLOUD_MODEL = 'gemini-3.5-flash-lite';

// Structured-output schemas (Firebase AI Logic responseSchema, JSON mode).
// The model fills these fields; extract.js stays the single source of truth
// for totals — the UI never trusts a model-invented number for money.
const JOB_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    completed: { type: 'array', items: { type: 'string' } },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
        },
      },
    },
    followUps: { type: 'array', items: { type: 'string' } },
    invoiceLines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          qty: { type: 'number' },
          amount: { type: 'number' },
        },
      },
    },
    customerMessage: { type: 'string' },
  },
};

const DIGEST_SCHEMA = {
  type: 'object',
  properties: {
    weekSummary: { type: 'string' },
    customerReport: { type: 'string' },
    nextWeek: { type: 'array', items: { type: 'string' } },
  },
};

const JOB_PROMPT = (note) => `You are a field-service assistant. Turn these rough job notes into a structured job card.
Rules: only list amounts that appear in the notes — never invent prices. Only list parts the notes mention. Keep the customer message short and friendly.
Customer: ${note.customer || 'Unknown'}
Address: ${note.address || '—'}
Trade: ${note.trade || 'Other'}
Notes:
${note.text}
Return JSON matching the schema.`;

const DIGEST_PROMPT = (jobs) => `You are a field-service office assistant. Summarize this week's completed jobs into a short weekly digest.
Rules: the billed total is the sum of the invoice amounts already in the job cards — never invent money. Flag follow-up opportunities only from the follow-ups listed in the cards.
Jobs (JSON):
${JSON.stringify(jobs.map((j) => ({ customer: j.customer, trade: j.trade, result: j.result })), null, 2)}
Return a JSON object: { weekSummary, customerReport, nextWeek: string[] }.`;

export class FirebaseEngine {
  constructor(firebaseConfig) {
    this.kind = 'firebase';
    this.firebaseConfig = firebaseConfig;
    this._ready = null;
  }

  async _init() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      // Dynamic imports: the Firebase SDK is only fetched when a real
      // config exists, so the mock build makes zero network calls.
      // Bare specifiers resolve via the import map in index.html
      // (firebase 12.5.0 CDN builds, pinned).
      const { initializeApp } = await import('firebase/app');
      const {
        getAI,
        getGenerativeModel,
        GoogleAIBackend,
        InferenceMode,
      } = await import('firebase/ai');

      const app = initializeApp(this.firebaseConfig);

      // App Check is enforced for AI Logic (the console guided setup turns
      // enforcement on). Calls without a valid token fail.
      if (this.firebaseConfig.appCheckDebugToken) {
        // Fixed debug token (deployed demo): verified in the
        // @firebase/app-check 0.11.0 runtime (initializeDebugMode) — when
        // FIREBASE_APPCHECK_DEBUG_TOKEN is a string, the debug provider
        // uses that exact token, which must already be registered in the
        // Firebase console (App Check > Manage debug tokens). The token
        // lives only in the untracked config.local.js, never in the repo.
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = this.firebaseConfig.appCheckDebugToken;
        const { initializeAppCheck, CustomProvider } = await import('firebase/app-check');
        initializeAppCheck(app, {
          provider: new CustomProvider({
            getToken: async () => {
              throw new Error('App Check is using a fixed debug token; this placeholder is never called.');
            },
          }),
          isTokenAutoRefreshEnabled: true,
        });
      } else if (this.firebaseConfig.appCheckDebug === true) {
        // Official debug flow (web): set the flag BEFORE initializeAppCheck.
        // The SDK then uses the debug provider, prints the token to the
        // console, and the token must be registered in the Firebase console
        // (App Check > Manage debug tokens) before calls succeed. The token
        // is generated by the browser and must never be committed.
        // In debug mode the provider below is never invoked (verified in
        // the SDK 12.5.0 runtime), so an inert CustomProvider stands in
        // for the reCAPTCHA provider until a site key is configured.
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        const { initializeAppCheck, CustomProvider } = await import('firebase/app-check');
        initializeAppCheck(app, {
          provider: new CustomProvider({
            getToken: async () => {
              throw new Error('App Check is in debug mode; the debug provider issues tokens, this placeholder is never called.');
            },
          }),
          isTokenAutoRefreshEnabled: true,
        });
      } else if (this.firebaseConfig.appCheckSiteKey) {
        const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(this.firebaseConfig.appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      }
      // No debug flag and no site key: App Check stays uninitialized and
      // AI Logic calls fail with a clear error while enforcement is on.
      // Add the debug flag (local dev) or a site key (deployed demo) per
      // SWAP-TO-REAL.md Step 3.

      const ai = getAI(app, { backend: new GoogleAIBackend() });

      // One model instance per routing mode (SDK requirement). NOTE: for
      // hybrid params, generationConfig belongs inside inCloudParams —
      // a top-level generationConfig is silently ignored by the SDK.
      const instantModel = getGenerativeModel(ai, {
        mode: InferenceMode.PREFER_ON_DEVICE,
        inCloudParams: {
          model: CLOUD_MODEL,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: JOB_SCHEMA,
          },
        },
      });
      const digestModel = getGenerativeModel(ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: CLOUD_MODEL,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: DIGEST_SCHEMA,
          },
        },
      });

      return { ai, instantModel, digestModel, InferenceMode };
    })();
    return this._ready;
  }

  /** Which engine actually served the call, from the SDK's own signal. */
  _engineFromResponse(response) {
    // response.inferenceSource is 'ON_DEVICE' or 'IN_CLOUD' (SDK >= 12.5.0).
    // usageMetadata carries only token counts — no inference-mode field.
    const src = response?.inferenceSource;
    if (src === 'ON_DEVICE') return 'on-device';
    if (src === 'IN_CLOUD') return 'cloud';
    return null;
  }

  async _generate(model, prompt) {
    const t0 = performance.now();
    const result = await model.generateContent(prompt);
    const latencyMs = Math.round(performance.now() - t0);
    const text = result.response.text();
    const engine = this._engineFromResponse(result.response);
    return { text, latencyMs, engine };
  }

  async processJob(note, state) {
    const offline = state.offlineSimulated || !state.online;
    try {
      // _init() is INSIDE the try on purpose: if the SDK import itself
      // fails (e.g. the CDN is unreachable), processJob must resolve with
      // ok:false so the UI shows an honest error — never reject and leave
      // the "processing…" spinner stuck forever. (Found 2026-11-25: the
      // old code awaited _init() before the try, and a failed dynamic
      // import left the UI hanging with no error message.)
      const { instantModel } = await this._init();
      const { text, latencyMs, engine } = await this._generate(instantModel, JOB_PROMPT(note));
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      // Trust the model for prose, but recompute money from the note so no
      // amount is ever invented. extract.js is the single source of truth.
      const ground = parseNote(note);
      const result = parsed
        ? {
            summary: parsed.summary || ground.summary,
            completed: parsed.completed?.length ? parsed.completed : ground.completed,
            parts: parsed.parts?.length ? parsed.parts : ground.parts,
            followUps: parsed.followUps?.length ? parsed.followUps : ground.followUps,
            invoiceLines: ground.invoiceLines,
            total: ground.total,
            message: parsed.customerMessage || ground.message,
          }
        : ground;
      // The SDK's inferenceSource is authoritative when present; the
      // heuristic below only covers SDK responses that omit it.
      const served = engine || (offline ? 'on-device' : state.nanoAvailable ? 'on-device' : 'cloud');
      const fallback = served === 'cloud';
      return {
        ok: true,
        mode: 'PREFER_ON_DEVICE',
        engine: served,
        fallback,
        reason: fallback
          ? 'Device model unavailable — fell back to the cloud.'
          : offline
            ? 'Offline — processed on-device, no network needed.'
            : 'Processed on-device with Gemini Nano.',
        latencyMs,
        result,
      };
    } catch (err) {
      return {
        ok: false,
        mode: 'PREFER_ON_DEVICE',
        engine: null,
        fallback: false,
        reason: `AI call failed: ${err?.message || err}`,
        latencyMs: 0,
      };
    }
  }

  async weeklyDigest(jobs, state) {
    const offline = state.offlineSimulated || !state.online;
    if (offline) {
      return {
        ok: false,
        mode: 'ONLY_IN_CLOUD',
        engine: null,
        reason: state.offlineSimulated
          ? 'Offline simulation is on — the weekly digest needs the cloud.'
          : 'You are offline — the weekly digest needs the cloud.',
        latencyMs: 0,
      };
    }
    try {
      const { digestModel } = await this._init();
      const { text, latencyMs } = await this._generate(digestModel, DIGEST_PROMPT(jobs));
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      // Ground the numbers: totals and counts always come from the local data.
      const ground = buildDigest(jobs);
      const digest = parsed
        ? {
            ...ground,
            weekSummary: parsed.weekSummary || ground.weekSummary,
            customerReport: parsed.customerReport || ground.customerReport,
            nextWeek: parsed.nextWeek?.length ? parsed.nextWeek : ground.nextWeek,
          }
        : ground;
      return {
        ok: true,
        mode: 'ONLY_IN_CLOUD',
        engine: 'cloud',
        fallback: false,
        reason: 'Cloud-only task.',
        latencyMs,
        digest,
      };
    } catch (err) {
      return {
        ok: false,
        mode: 'ONLY_IN_CLOUD',
        engine: null,
        reason: `AI call failed: ${err?.message || err}`,
        latencyMs: 0,
      };
    }
  }

  async deviceStatus() {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    let availability = 'unknown';
    if (g.window && 'LanguageModel' in g.window) {
      try {
        availability = String(await g.window.LanguageModel.availability());
      } catch {
        availability = 'unknown';
      }
    }
    return {
      label: `Firebase AI Logic connected — device availability: ${availability}`,
      detail: 'Real engine: instant tasks run PREFER_ON_DEVICE via Gemini Nano when available, with cloud fallback; the weekly digest runs ONLY_IN_CLOUD.',
      availability,
      simulated: false,
    };
  }

  /**
   * Pre-download the on-device model ahead of the demo.
   * HONEST NO-OP: the Firebase AI Logic JS SDK v12.5.0 exposes no
   * initializeDeviceModel / download API (verified in the installed
   * @firebase/ai 2.5.0 types and runtime — no such symbol exists). The
   * on-device model downloads automatically on the first generateContent
   * call that routes on-device. Returns false so callers know no
   * pre-download happened. Kept for interface compatibility; nothing
   * in the app calls it today.
   */
  async warmUpDeviceModel(/* onProgress */) {
    await this._init();
    return false;
  }
}
