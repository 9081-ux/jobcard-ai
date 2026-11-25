// config.local.example.js — COPY to config.local.js and fill in your values.
// config.local.js is git-ignored and must NEVER be committed.
// See SWAP-TO-REAL.md for the full steps.
//
// How to get these values: Firebase console → your project → Project
// settings → "Your apps" → Web app → SDK setup and configuration.

window.JOBCARD_CONFIG = {
  apiKey: 'PASTE_YOUR_API_KEY_HERE',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',

  // Optional — App Check (required by AI Logic):
  // appCheckSiteKey: 'RECAPTCHA_ENTERPRISE_SITE_KEY', // deployed demo
  // appCheckDebug: true, // local dev only — browser generates the token
};
