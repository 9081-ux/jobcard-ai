// mock.js — Mock AI engine for JobCard AI (used until Firebase config arrives).
//
// It implements the exact same interface as the real Firebase AI Logic engine
// (see firebase-engine.js), so swapping engines changes nothing else.
// Two things are REAL even in mock mode:
//   1. The routing decision — PREFER_ON_DEVICE vs ONLY_IN_CLOUD, offline
//      forcing, and cloud fallback when the device model is unavailable.
//   2. The latency — measured with performance.now() around a real async
//      delay, not a hardcoded number.
// The generated text is a deterministic parse of the note (extract.js), so
// outputs are traceable to what the technician actually wrote.

import { parseNote, buildDigest } from './extract.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Simulated processing time windows (ms). On-device is fast because the
// model is already on the phone; cloud pays a network round trip.
const LATENCY = {
  onDevice: [320, 950],
  cloud: [950, 2400],
};

function jitter([min, max]) {
  return min + Math.random() * (max - min);
}

/**
 * Routing decision, mirroring Firebase AI Logic InferenceMode semantics:
 * - PREFER_ON_DEVICE: device model if available, else cloud fallback.
 *   Offline (real or simulated) forces on-device — the whole point of the app.
 * - ONLY_IN_CLOUD: cloud only; honestly unavailable when offline.
 */
export function decideEngine(mode, state) {
  const offline = state.offlineSimulated || !state.online;
  if (mode === 'ONLY_IN_CLOUD') {
    if (offline) {
      return {
        available: false,
        engine: null,
        reason: offline
          ? (state.offlineSimulated
            ? 'Offline simulation is on — the weekly digest needs the cloud.'
            : 'You are offline — the weekly digest needs the cloud.')
          : 'Cloud unavailable.',
      };
    }
    return { available: true, engine: 'cloud', fallback: false, reason: 'Cloud-only task.' };
  }
  // PREFER_ON_DEVICE
  if (offline) {
    return {
      available: true,
      engine: 'on-device',
      fallback: false,
      reason: 'Offline — processed on-device, no network needed.',
    };
  }
  if (state.nanoAvailable) {
    return {
      available: true,
      engine: 'on-device',
      fallback: false,
      reason: 'Gemini Nano is available on this device.',
    };
  }
  return {
    available: true,
    engine: 'cloud',
    fallback: true,
    reason: 'Device model unavailable here — fell back to the cloud.',
  };
}

/**
 * Probe the real Prompt API surface if the browser has it. In mock mode we
 * never call the model, we only detect whether it exists — so the routing
 * panel can show an honest status instead of pretending.
 * Returns { apiDetected, availability } where availability is one of
 * 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown'.
 */
export async function probeDeviceModel() {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  if (!g.window || !('LanguageModel' in g.window)) {
    return { apiDetected: false, availability: 'unknown' };
  }
  try {
    const status = await g.window.LanguageModel.availability();
    return { apiDetected: true, availability: String(status) };
  } catch {
    return { apiDetected: true, availability: 'unknown' };
  }
}

export class MockEngine {
  constructor() {
    this.kind = 'mock';
  }

  async processJob(note, state) {
    const route = decideEngine('PREFER_ON_DEVICE', state);
    if (!route.available) {
      return { ok: false, mode: 'PREFER_ON_DEVICE', ...route, latencyMs: 0 };
    }
    const t0 = performance.now();
    await sleep(jitter(LATENCY[route.engine === 'on-device' ? 'onDevice' : 'cloud']));
    const result = parseNote(note);
    const latencyMs = Math.round(performance.now() - t0);
    return {
      ok: true,
      mode: 'PREFER_ON_DEVICE',
      engine: route.engine,
      fallback: route.fallback,
      reason: route.reason,
      latencyMs,
      result,
    };
  }

  async weeklyDigest(jobs, state) {
    const route = decideEngine('ONLY_IN_CLOUD', state);
    if (!route.available) {
      return { ok: false, mode: 'ONLY_IN_CLOUD', ...route, latencyMs: 0 };
    }
    const t0 = performance.now();
    await sleep(jitter(LATENCY.cloud));
    const digest = buildDigest(jobs);
    const latencyMs = Math.round(performance.now() - t0);
    return {
      ok: true,
      mode: 'ONLY_IN_CLOUD',
      engine: 'cloud',
      fallback: false,
      reason: route.reason,
      latencyMs,
      digest,
    };
  }
}
