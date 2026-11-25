// extract.js — Pure, deterministic note parsing for JobCard AI.
// No network, no AI calls: turns a technician's rough field notes into the
// structured fields the UI renders. Every number shown comes from the note
// itself; nothing is invented. Works in the browser and in Node (tests).

const TRADE_PARTS = {
  HVAC: [
    'air filter', 'furnace filter', 'thermostat', 'capacitor', 'contactor',
    'blower motor', 'condensate pump', 'condensate drain', 'evaporator coil',
    'condenser coil', 'refrigerant', 'r-410a', 'r410a', 'fan belt', 'igniter',
    'flame sensor', 'duct', 'vent', 'compressor', 'relay',
    'fuse', 'drain pan', 'float switch', 'heat exchanger', 'gas valve',
  ],
  Plumbing: [
    'faucet', 'shower head', 'toilet flapper', 'fill valve', 'flush valve',
    'p-trap', 'pipe', 'elbow', 'coupling', 'shut-off valve',
    'supply line', 'anode rod', 'pressure regulator',
    'gasket', 'o-ring', 'caulk', 'sealant', 'garbage disposal', 'sump pump',
    'check valve', 'angle stop', 'wax ring', 'aerator', 'hose bib',
  ],
  Electrical: [
    'breaker', 'gfci outlet', 'outlet', 'light switch', 'dimmer switch',
    'light fixture', 'bulb', 'led bulb', 'wire', 'wire nut',
    'junction box', 'surge protector', 'smoke detector',
    'carbon monoxide detector', 'thermostat wire', 'doorbell transformer',
    'receptacle', 'conduit', 'ground rod', 'disconnect', 'fuse',
  ],
  Cleaning: [
    'vacuum bag', 'hepa filter', 'microfiber cloth', 'all-purpose cleaner',
    'glass cleaner', 'disinfectant', 'mop head', 'grout cleaner',
    'stain remover', 'air freshener', 'trash bag', 'paper towel',
    'scrub pad', 'degreaser', 'floor polish',
  ],
  Other: [
    'filter', 'valve', 'gasket', 'seal', 'bolt', 'screw', 'bracket',
    'hinge', 'lock', 'handle', 'battery', 'sensor', 'motor', 'belt',
    'hose', 'clamp', 'connector', 'adhesive', 'lubricant',
  ],
};

const COMPLETION_VERBS = [
  'replaced', 'installed', 'fixed', 'repaired', 'cleaned', 'checked',
  'tested', 'tightened', 'flushed', 'sealed', 'adjusted', 'unclogged',
  'cleared', 'serviced', 'inspected', 'reconnected', 'recalibrated',
  'lubricated', 'patched', 're-sealed', 'resealed', 'replaced', 'swapped',
  'upgraded', 'rewired', 'repaired', 'restored', 'balanced', 'charged',
  'recharged', 'defrosted', 'descaled', 'caulked', 'painted', 'mounted',
];

const FOLLOW_UP_MARKERS = [
  'need to', 'needs to', 'should', 'recommend', 'recommended', 'order',
  'schedule', 'return', 'follow up', 'follow-up', 'next visit', 'next time',
  'watch for', 'keep an eye', 'consider', 'plan to', 'book', 'quote',
  'estimate', 'call back', 'check back', 'monitor',
];

// Match money amounts: $1,234.56, $85, 250 dollars, USD 120.00
const MONEY_RE = /\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s?(?:dollars|usd|bucks)?/gi;

function splitSentences(text) {
  const raw = text
    .split(/[\n\r]+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // A line that ends mid-thought (", plus" / ", and") continues on the next
  // line — join it back, so no sentence ends with a dangling conjunction
  // and the summary never ends with a bare "plus".
  const out = [];
  for (const frag of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /[,;]?\s*(plus|and|also)\s*$/i.test(prev)) {
      out[out.length - 1] = `${prev} ${frag}`;
    } else {
      out.push(frag);
    }
  }
  return out;
}

// Strip a dangling tail left when a note literally ends mid-thought:
// "Replaced the bulb, plus" -> "Replaced the bulb". A bare trailing
// "also" is kept — "Checked the spare also." is a complete sentence.
function cleanDanglingTail(s) {
  return s
    .replace(/[,;]?\s*\b(plus|and)\b\s*\.?\s*$/i, '')
    .replace(/,\s*also\s*\.?\s*$/i, '')
    .replace(/[,;]\s*$/, '')
    .trim();
}

function wordsOf(name) {
  return name.toLowerCase().split(/[\s-]+/);
}

// True when a's words are a contiguous run inside b's words:
// ["bulb"] inside ["led", "bulb"], ["filter"] inside ["air", "filter"].
function isWordSubsequence(a, b) {
  if (a.length >= b.length) return false;
  for (let i = 0; i + a.length <= b.length; i++) {
    if (a.every((w, j) => w === b[i + j])) return true;
  }
  return false;
}

function parseQuantity(line) {
  // "2x air filter", "x3", "2 filters", "qty 2"
  const m =
    line.match(/(\d+)\s*x\b/i) ||
    line.match(/\bx\s?(\d+)\b/i) ||
    line.match(/\bqty[:\s]*(\d+)/i) ||
    line.match(/^(\d+)\s+\w/) ||
    line.match(/(\d+)\s*(?:new|replacement|spare)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 99) return n;
  }
  return 1;
}

function extractParts(text, trade) {
  const vocab = [
    ...(TRADE_PARTS[trade] || []),
    ...TRADE_PARTS.Other,
  ];
  const lower = ` ${text.toLowerCase()} `;
  const found = [];
  const seen = new Set();
  for (const part of vocab) {
    if (lower.includes(` ${part} `) || lower.includes(` ${part}s `) ||
        lower.includes(` ${part},`) || lower.includes(` ${part}.`) ||
        lower.includes(` ${part}\n`)) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // quantity: look for a number near the part mention
      const idx = lower.indexOf(part);
      const windowText = text.slice(Math.max(0, idx - 12), idx + part.length + 4);
      found.push({ name: titleCase(part), qty: parseQuantity(windowText) });
    }
  }
  // Subsumption: "LED bulb" contains "bulb", "GFCI outlet" contains
  // "outlet" — keep only the most specific name, never both. Same for
  // "air filter" vs "filter", "wire nut" vs "wire", "fill valve" vs "valve".
  return found.filter((p) => {
    const w = wordsOf(p.name);
    return !found.some((q) => q !== p && isWordSubsequence(w, wordsOf(q.name)));
  });
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractAmounts(text) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const amounts = [];
  for (const line of lines) {
    // Split the line into clauses (",", ";") so two amounts on one line
    // ("capacitor $68.50, labor $120") get separate, meaningful descriptions.
    const clauses = [];
    let start = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ',' || line[i] === ';') {
        clauses.push({ text: line.slice(start, i).trim(), start });
        start = i + 1;
      }
    }
    clauses.push({ text: line.slice(start).trim(), start });
    // Group money matches by clause; within one clause, each amount gets
    // only the text segment that belongs to it — from the previous amount
    // in the same clause (or the clause start) to this amount. Two prices
    // on one line ("bulbs $18.00 and a dimmer switch $32.50") must not
    // share one long description.
    const matches = [...line.matchAll(MONEY_RE)];
    const clauseEnd = new Map(); // clause index -> end offset of last amount
    for (const m of matches) {
      const raw = m[1].replace(/,/g, '');
      const value = parseFloat(raw);
      if (!Number.isFinite(value) || value <= 0) continue;
      // The money marker must belong to THIS number, not just to the line:
      // a bare count on the same line as a real price ("2 bulbs ... $18.00")
      // is a quantity, not $2.00. Require the $ sign on this match, a
      // decimal amount, or a money word right after it.
      const idx = m.index ?? 0;
      const after = line.slice(idx + m[0].length, idx + m[0].length + 10);
      const hasMoneyMarker =
        m[0].includes('$') ||
        /\.\d{2}\b/.test(m[0]) ||
        /^\s?(dollars|usd|bucks)\b/i.test(after);
      if (!hasMoneyMarker) continue;
      const ci = clauses.findIndex((c) => idx >= c.start && idx < c.start + c.text.length + 1);
      const clause = clauses[ci >= 0 ? ci : 0];
      const segStart = clauseEnd.get(ci) ?? clause.start;
      const segEnd = idx + m[0].length;
      clauseEnd.set(ci, segEnd);
      let segment = line.slice(segStart, segEnd).trim();
      // Drop a leading conjunction left over from the previous amount.
      segment = segment.replace(/^(and|plus)\b/i, '').replace(/^[,;]\s*/, '').trim();
      if (amounts.some((a) => a.amount === value && a.clause === segment)) continue;
      amounts.push({ clause: segment, amount: value });
    }
  }
  return amounts;
}

function buildInvoiceLines(text) {
  const amounts = extractAmounts(text);
  return amounts.map(({ clause, amount }) => {
    const desc = clause
      .replace(/\$\s?[\d,]+(?:\.\d{2})?/g, '')
      .replace(/\s?(?:dollars|usd|bucks)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[-•*]\s*/, '')
      .replace(/^(and|plus)\b/i, '')
      .replace(/\s+\.\s*$/, '') // orphaned sentence-final period ("Labor .")
      .replace(/\s+[,;]\s*$/, '')
      .trim();
    // Only multiply when the note says the price is per unit ("each").
    // Otherwise the amount is the line total as written — never invent.
    const perUnit = /\beach\b|\bper (unit|item|piece)\b/i.test(clause);
    const qty = perUnit ? parseQuantity(clause) : 1;
    return {
      description: desc ? sentenceCase(desc) : 'Service charge',
      qty,
      amount: Math.round(amount * 100) / 100,
    };
  });
}

function sentenceCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractCompleted(text) {
  const lines = splitSentences(text);
  const done = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasVerb = COMPLETION_VERBS.some((v) => lower.includes(v));
    const explicit = /\b(done|completed|finished|fixed it|all good)\b/i.test(line);
    if (hasVerb || explicit) {
      done.push(sentenceCase(cleanDanglingTail(line.replace(/^[-•*]\s*/, '').trim())));
    }
  }
  return done.slice(0, 8);
}

function extractFollowUps(text) {
  const lines = splitSentences(text);
  const ups = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (FOLLOW_UP_MARKERS.some((m) => lower.includes(m))) {
      ups.push(sentenceCase(cleanDanglingTail(line.replace(/^[-•*]\s*/, '').trim())));
    }
  }
  return ups.slice(0, 6);
}

function buildSummary({ customer, trade, completed, parts, total }) {
  const bits = [];
  // First completed sentence, cleaned so it never ends mid-thought.
  const firstDone = completed
    .map((c) => cleanDanglingTail(c.replace(/\.$/, '')))
    .find(Boolean);
  if (firstDone) {
    bits.push(firstDone);
    if (completed.length > 1) bits.push(`plus ${completed.length - 1} more task${completed.length - 1 > 1 ? 's' : ''}`);
  }
  if (parts.length) {
    bits.push(`Parts used: ${parts.map((p) => `${p.qty}× ${p.name}`).join(', ')}`);
  }
  if (total > 0) bits.push(`Billed $${total.toFixed(2)}`);
  const who = customer ? `Visit for ${customer}` : 'Field visit';
  const core = bits.length ? bits.join('. ') : 'Field notes recorded, no completed tasks detected';
  return `${who} (${trade}): ${core}.`;
}

function buildCustomerMessage({ customer, completed, parts, total, followUps }) {
  const name = customer ? customer.split(' ')[0] : 'there';
  const lines = [`Hi ${name}, thanks for having us out today.`];
  if (completed.length) {
    lines.push(`Here's what we did: ${completed.join('; ')}.`);
  }
  if (parts.length) {
    lines.push(`Parts installed: ${parts.map((p) => `${p.qty}× ${p.name}`).join(', ')}.`);
  }
  if (total > 0) lines.push(`Total for today's visit: $${total.toFixed(2)}.`);
  if (followUps.length) {
    lines.push(`One thing to keep in mind: ${followUps[0].replace(/\.$/, '').toLowerCase()}.`);
  }
  lines.push('Reply to this message if anything comes up — happy to help.');
  return lines.join(' ');
}

/**
 * parseNote(note) -> structured result for one job.
 * note: { customer, address, trade, text }
 * Never invents amounts: invoice lines only exist when the note mentions money.
 */
export function parseNote(note) {
  const text = (note.text || '').trim();
  const trade = note.trade || 'Other';
  const parts = extractParts(text, trade);
  const invoiceLines = buildInvoiceLines(text);
  const total = Math.round(invoiceLines.reduce((s, l) => s + l.amount * l.qty, 0) * 100) / 100;
  const completed = extractCompleted(text);
  const followUps = extractFollowUps(text);
  const summary = buildSummary({ customer: note.customer, trade, completed, parts, total });
  const message = buildCustomerMessage({ customer: note.customer, completed, parts, total, followUps });
  return { summary, completed, parts, followUps, invoiceLines, total, message };
}

/**
 * buildDigest(jobs) -> weekly summary over saved jobs with processed results.
 * Totals come only from invoice lines the notes actually contained.
 */
export function buildDigest(jobs) {
  const withResults = jobs.filter((j) => j.result);
  const total = Math.round(
    withResults.reduce((s, j) => s + (j.result.total || 0), 0) * 100,
  ) / 100;
  const byTrade = {};
  for (const j of withResults) {
    byTrade[j.trade] = (byTrade[j.trade] || 0) + 1;
  }
  const openFollowUps = [];
  for (const j of withResults) {
    for (const f of j.result.followUps || []) {
      openFollowUps.push({ job: j.customer, trade: j.trade, text: f });
    }
  }
  const allParts = {};
  for (const j of withResults) {
    for (const p of j.result.parts || []) {
      allParts[p.name] = (allParts[p.name] || 0) + p.qty;
    }
  }
  const topParts = Object.entries(allParts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const opportunities = openFollowUps.slice(0, 5).map((f) => ({
    text: f.text,
    job: f.job,
  }));

  const weekSummary =
    withResults.length === 0
      ? 'No processed jobs this week yet. Process a few job cards and the digest will fill in.'
      : `${withResults.length} job${withResults.length > 1 ? 's' : ''} processed this week` +
        (total > 0 ? `, $${total.toFixed(2)} billed from amounts written in the notes` : ', no amounts written in the notes yet') +
        `. Most common trade: ${Object.entries(byTrade).sort((a, b) => b[1] - a[1])[0][0]}.` +
        (openFollowUps.length
          ? ` ${openFollowUps.length} follow-up item${openFollowUps.length > 1 ? 's' : ''} still open.`
          : ' No open follow-ups.');

  const customerReport =
    withResults.length === 0
      ? ''
      : `This week our team completed ${withResults.length} visit${withResults.length > 1 ? 's' : ''} ` +
        `(${Object.entries(byTrade).map(([t, n]) => `${n} ${t}`).join(', ')}).` +
        (total > 0 ? ` Total billed: $${total.toFixed(2)}.` : '') +
        (openFollowUps.length
          ? ` We also flagged ${openFollowUps.length} item${openFollowUps.length > 1 ? 's' : ''} to watch — we'll be in touch about each one.`
          : ' Everything is wrapped up with no outstanding items.') +
        ' Thank you for trusting us with your home.';

  const nextWeek =
    openFollowUps.length > 0
      ? openFollowUps.slice(0, 3).map((f) => `Follow up on "${f.text}" (${f.job}).`)
      : ['No open follow-ups — use the week to restock the most-used parts and confirm next appointments.'];

  return {
    jobCount: withResults.length,
    total,
    byTrade,
    topParts,
    openFollowUps,
    opportunities,
    weekSummary,
    customerReport,
    nextWeek,
  };
}
