// ai.js — The single AI abstraction layer for JobCard AI.
//
// Every feature calls HybridAI, never an engine directly. Which engine runs
// is decided in exactly ONE place: getEngine() below. Until the Firebase
// project config arrives, that is always the MockEngine. When the config
// lands, the same calls run against the real Firebase AI Logic SDK
// (firebase-engine.js) with no other code changes — see SWAP-TO-REAL.md.

import { MockEngine, probeDeviceModel } from './mock.js';
import { getConfig } from './config.js';

export const MODES = {
  INSTANT: 'PREFER_ON_DEVICE', // field processing: device first, cloud fallback
  DIGEST: 'ONLY_IN_CLOUD', // weekly rollup: cloud only
};

export class HybridAI {
  constructor() {
    // Config is read lazily in getEngine() so config.local.js (a deferred
    // script) has definitely executed before we look for it.
    this.config = null;
    this._engine = null;
    this._enginePromise = null;
  }

  /** The one place that picks the engine. */
  async getEngine() {
    if (this._engine) return this._engine;
    if (!this._enginePromise) {
      this._enginePromise = (async () => {
        if (!this.config) this.config = getConfig();
        if (this.config.mode === 'firebase') {
          const { FirebaseEngine } = await import('./firebase-engine.js');
          this._engine = new FirebaseEngine(this.config.firebase);
        } else {
          this._engine = new MockEngine();
        }
        return this._engine;
      })();
    }
    return this._enginePromise;
  }

  get engineKind() {
    return this.config?.mode === 'firebase' ? 'firebase' : 'mock';
  }

  /** Instant field processing for one job card. */
  async processJob(note, routingState) {
    const engine = await this.getEngine();
    return engine.processJob(note, routingState);
  }

  /** Weekly digest over saved jobs (cloud only). */
  async weeklyDigest(jobs, routingState) {
    const engine = await this.getEngine();
    return engine.weeklyDigest(jobs, routingState);
  }

  /**
   * Device-model status for the routing panel.
   * In mock mode we probe the real Prompt API surface if present and label
   * the result honestly; the mock never pretends a real model ran.
   */
  async deviceStatus(routingState) {
    if (this.engineKind === 'firebase') {
      const engine = await this.getEngine();
      return engine.deviceStatus(routingState);
    }
    const probe = await probeDeviceModel();
    if (!probe.apiDetected) {
      return {
        label: 'Simulated — Prompt API not detected in this browser',
        detail: 'Mock mode: the device model is simulated as available so every feature can be tried end to end. On a Chrome 139+ device with Gemini Nano, the real check runs here.',
        availability: routingState.nanoSimulatedUnavailable ? 'unavailable' : 'available',
        simulated: true,
      };
    }
    return {
      label: `Prompt API detected — availability: ${probe.availability}`,
      detail: 'This browser exposes the built-in AI API. Mock mode still simulates the model itself; the real engine uses it once Firebase is connected.',
      availability: probe.availability,
      simulated: true,
    };
  }
}
