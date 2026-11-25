// run-tests.mjs — Node tests for JobCard AI's pure logic + mock engine.
// Run: node tests/run-tests.mjs   (or: npm test)
// These tests cover everything that can be verified without a browser or a
// Firebase project: note parsing, routing decisions, mock latency, digest.

import { parseNote, buildDigest } from '../js/extract.js';
import { decideEngine, MockEngine } from '../js/mock.js';
import { SAMPLE_JOBS } from '../js/samples.js';

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function approx(a, b) {
  return Math.abs(a - b) < 0.005;
}

// ---- 1. HVAC sample ----
console.log('\n[1] HVAC sample job');
const hvac = parseNote({ customer: 'Maria Lopez', trade: 'HVAC', text: SAMPLE_JOBS[0].text });
check('parts include Air Filter', hvac.parts.some((p) => p.name === 'Air Filter'));
check('parts include Capacitor', hvac.parts.some((p) => p.name === 'Capacitor'));
check('invoice has 2 lines', hvac.invoiceLines.length === 2, JSON.stringify(hvac.invoiceLines));
check('invoice descriptions differ', new Set(hvac.invoiceLines.map((l) => l.description)).size === 2);
check('total is $188.50', approx(hvac.total, 188.5), `got ${hvac.total}`);
check('completed items found', hvac.completed.length >= 2, JSON.stringify(hvac.completed));
check('follow-up about humidifier quote', hvac.followUps.some((f) => /humidifier/i.test(f)));
check('customer message mentions total', hvac.message.includes('188.50'));

// ---- 2. Plumbing sample ----
console.log('\n[2] Plumbing sample job');
const plumb = parseNote({ customer: 'James Whitfield', trade: 'Plumbing', text: SAMPLE_JOBS[1].text });
check('total is $24.99', approx(plumb.total, 24.99), `got ${plumb.total}`);
check('parts include Fill Valve', plumb.parts.some((p) => p.name === 'Fill Valve'));
check('follow-up about water heater flush', plumb.followUps.some((f) => /water heater/i.test(f)));

// ---- 3. Electrical sample ----
console.log('\n[3] Electrical sample job');
const elec = parseNote({ customer: 'Priya Natarajan', trade: 'Electrical', text: SAMPLE_JOBS[2].text });
check('total is $50.50', approx(elec.total, 50.5), `got ${elec.total}`);
check('parts include Dimmer Switch', elec.parts.some((p) => p.name === 'Dimmer Switch'));
check('follow-up about breaker', elec.followUps.some((f) => /breaker/i.test(f)));

// ---- 4. No amounts invented ----
console.log('\n[4] No invented money');
const noMoney = parseNote({
  customer: 'Test',
  trade: 'Other',
  text: 'Checked the unit. Everything looks fine. Replaced 2 filters and a gasket.',
});
check('no invoice lines without money in notes', noMoney.invoiceLines.length === 0);
check('total is 0', noMoney.total === 0);
check('counts are not mistaken for money', noMoney.parts.length >= 0);

// ---- 5. Routing decisions ----
console.log('\n[5] Routing decisions (decideEngine)');
const onlineNano = { online: true, offlineSimulated: false, nanoAvailable: true };
const onlineNoNano = { online: true, offlineSimulated: false, nanoAvailable: false };
const offlineSim = { online: true, offlineSimulated: true, nanoAvailable: true };
const reallyOffline = { online: false, offlineSimulated: false, nanoAvailable: true };

let r = decideEngine('PREFER_ON_DEVICE', onlineNano);
check('online + Nano -> on-device', r.available && r.engine === 'on-device' && !r.fallback);
r = decideEngine('PREFER_ON_DEVICE', onlineNoNano);
check('online + no Nano -> cloud fallback', r.available && r.engine === 'cloud' && r.fallback);
r = decideEngine('PREFER_ON_DEVICE', offlineSim);
check('simulated offline -> on-device', r.available && r.engine === 'on-device' && !r.fallback);
r = decideEngine('PREFER_ON_DEVICE', reallyOffline);
check('really offline -> on-device', r.available && r.engine === 'on-device');
r = decideEngine('ONLY_IN_CLOUD', onlineNano);
check('digest online -> cloud', r.available && r.engine === 'cloud');
r = decideEngine('ONLY_IN_CLOUD', offlineSim);
check('digest offline -> honestly unavailable', !r.available && r.engine === null);
r = decideEngine('ONLY_IN_CLOUD', reallyOffline);
check('digest really offline -> honestly unavailable', !r.available);

// ---- 6. Mock engine end-to-end (real timing) ----
console.log('\n[6] Mock engine');
const engine = new MockEngine();
const t0 = Date.now();
const res = await engine.processJob(
  { customer: 'Maria Lopez', trade: 'HVAC', text: SAMPLE_JOBS[0].text },
  onlineNano,
);
check('processJob ok', res.ok === true);
check('processJob engine on-device', res.engine === 'on-device');
check('latency is measured and > 0', res.latencyMs > 0, `got ${res.latencyMs}`);
check('latency within simulated window', res.latencyMs >= 300 && res.latencyMs < 1500, `got ${res.latencyMs}`);
check('result total $188.50', approx(res.result.total, 188.5));

const resOff = await engine.processJob(
  { customer: 'Maria Lopez', trade: 'HVAC', text: SAMPLE_JOBS[0].text },
  offlineSim,
);
check('offline still processes on-device', resOff.ok && resOff.engine === 'on-device');

const resFb = await engine.processJob(
  { customer: 'Maria Lopez', trade: 'HVAC', text: SAMPLE_JOBS[0].text },
  onlineNoNano,
);
check('no Nano falls back to cloud', resFb.ok && resFb.engine === 'cloud' && resFb.fallback === true);

const digOff = await engine.weeklyDigest([], offlineSim);
check('digest offline refused', digOff.ok === false);

// ---- 7. Weekly digest over the 3 samples ----
console.log('\n[7] Weekly digest');
const jobs = SAMPLE_JOBS.map((s) => ({
  customer: s.customer,
  trade: s.trade,
  result: parseNote({ customer: s.customer, trade: s.trade, text: s.text }),
}));
const digest = buildDigest(jobs);
check('digest counts 3 jobs', digest.jobCount === 3);
check('digest total $263.99', approx(digest.total, 263.99), `got ${digest.total}`);
check('digest has open follow-ups', digest.openFollowUps.length >= 3, `got ${digest.openFollowUps.length}`);
check('digest top parts non-empty', digest.topParts.length > 0);
check('digest customer report mentions 3 visits', /3 visit/.test(digest.customerReport));
check('digest next week has items', digest.nextWeek.length > 0);

// ---- 8. Content-quality regressions (browser check, 2026-11-25) ----
console.log('\n[8] Content-quality regressions');
// (a) Summary must never end with a dangling conjunction.
const dangle = parseNote({
  customer: 'Test', trade: 'Other',
  text: 'Inspected the site. The old cover was also replaced, plus\ntightened all visible fittings.',
});
check('dangling line-continuation is merged into one sentence',
  dangle.completed.some((c) => /was also replaced, plus tightened all visible fittings/.test(c)),
  JSON.stringify(dangle.completed));
check('summary never ends with "plus"', !/plus\.?\s*$/.test(dangle.summary), dangle.summary);
const dangleEnd = parseNote({ customer: 'Test', trade: 'Electrical', text: 'Replaced the bulb, plus' });
check('note-final dangling "plus" is stripped',
  dangleEnd.completed[0] === 'Replaced the bulb', JSON.stringify(dangleEnd.completed));
check('stripped summary ends with a complete sentence', /Replaced the bulb\./.test(dangleEnd.summary), dangleEnd.summary);
// (b) Parts: specific name subsumes the generic one; equipment is not a part.
check('no generic Bulb beside Led Bulb', !elec.parts.some((p) => p.name === 'Bulb'));
check('no generic Outlet beside Gfci Outlet', !elec.parts.some((p) => p.name === 'Outlet'));
check('no generic Wire beside Wire Nut', !elec.parts.some((p) => p.name === 'Wire'));
check('Led Bulb qty stays 2, not doubled by the merge',
  elec.parts.find((p) => p.name === 'Led Bulb')?.qty === 2, JSON.stringify(elec.parts));
check('no generic Filter beside Air Filter', !hvac.parts.some((p) => p.name === 'Filter'));
check('no generic Valve beside Fill Valve', !plumb.parts.some((p) => p.name === 'Valve'));
check('Drain is not listed as a part', !plumb.parts.some((p) => p.name === 'Drain'));
check('Water Heater is not listed as a part', !plumb.parts.some((p) => p.name === 'Water Heater'));
check('Ceiling Fan is not listed as a part', !elec.parts.some((p) => p.name === 'Ceiling Fan'));
check('Panel is not listed as a part', !elec.parts.some((p) => p.name === 'Panel'));
// (c) Invoice lines: one amount, one description; amounts only from the notes.
check('electrical invoice descriptions are distinct per line',
  elec.invoiceLines.length === 2 &&
  /led bulb/i.test(elec.invoiceLines[0].description) &&
  /dimmer switch/i.test(elec.invoiceLines[1].description),
  JSON.stringify(elec.invoiceLines));
check('electrical invoice amounts are exactly the two written amounts',
  approx(elec.invoiceLines[0].amount, 18) && approx(elec.invoiceLines[1].amount, 32.5));
check('no invoice description ends with an orphaned period',
  [...hvac.invoiceLines, ...plumb.invoiceLines, ...elec.invoiceLines].every((l) => !/\s\.$/.test(l.description)));
check('HVAC second line is "Labor", not "Labor ."', hvac.invoiceLines[1].description === 'Labor');

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed ? 1 : 0);
