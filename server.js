'use strict';

/*
 * AI Tool Use for Academic Research — online questionnaire server.
 * Zero external dependencies: Node's built-in http + node:sqlite.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const ASSETS_DIR = path.join(ROOT, 'public', 'assets');
const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '0.0.0.0';

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
try { fs.chmodSync(DATA_DIR, 0o700); } catch {}

/* ------------------------------- database -------------------------------- */

const db = new DatabaseSync(path.join(DATA_DIR, 'responses.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    q1_international TEXT,
    q2_grade TEXT,
    q3_tool TEXT,
    q4_peu INTEGER,
    q5_pu INTEGER,
    q6_att INTEGER,
    q7_tr INTEGER,
    q8_tr INTEGER,
    q9_mr INTEGER,
    q10_mr INTEGER,
    q11_bi INTEGER,
    q12_bi INTEGER,
    q13_vb INTEGER,
    q14_vb INTEGER,
    q14_no_source INTEGER NOT NULL DEFAULT 0,
    q15_days INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at);
`);

/* --------------------------------- token --------------------------------- */

const TOKEN_FILE = path.join(DATA_DIR, 'admin-token.txt');
let ADMIN_TOKEN;
try {
  ADMIN_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  if (!ADMIN_TOKEN) throw new Error('empty');
} catch {
  ADMIN_TOKEN = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(TOKEN_FILE, ADMIN_TOKEN + '\n', { mode: 0o600 });
}

const views = require('./views');

/* -------------------------------- helpers -------------------------------- */

const ITEMS_B = [
  { no: 4, code: 'PEU', construct: 'Perceived ease of use', text: 'I find this tool easy to use for academic research.' },
  { no: 5, code: 'PU', construct: 'Perceived usefulness', text: 'Using this tool improves my effectiveness in academic research.' },
  { no: 6, code: 'ATT', construct: 'Attitude', text: 'I regard using this tool for academic research as a good choice.' },
  { no: 7, code: 'TR', construct: 'Trust', text: 'This tool has the competence to provide the academic information I need.' },
  { no: 8, code: 'TR', construct: 'Trust', text: 'I regard this tool as a credible source of academic guidance.' },
  { no: 9, code: 'MR', construct: 'Misinformation risk (concern)', text: 'I am concerned that this tool may give me incorrect or outdated academic information.' },
  { no: 10, code: 'MR', construct: 'Misinformation risk (concern)', text: 'I am concerned that this tool may give academic answers that sound convincing but are factually wrong.' },
  { no: 11, code: 'BI', construct: 'Behavioural intention', text: 'I intend to use this tool for academic research during the next 30 days.' },
  { no: 12, code: 'BI', construct: 'Behavioural intention', text: 'I plan to use this tool for academic research during the next 30 days.' },
];

const ITEMS_C = [
  { no: 13, code: 'VB', construct: 'Verification behaviour', text: 'Compare this tool’s factual answers with textbooks or course materials?' },
  { no: 14, code: 'VB', construct: 'Verification behaviour', text: 'When this tool named a source, check whether that source existed?' },
];

const COL = {
  4: 'q4_peu', 5: 'q5_pu', 6: 'q6_att', 7: 'q7_tr', 8: 'q8_tr', 9: 'q9_mr', 10: 'q10_mr',
  11: 'q11_bi', 12: 'q12_bi', 13: 'q13_vb', 14: 'q14_vb',
};

function stat(item, rows, colOf) {
  const vals = [];
  for (const r of rows) {
    const v = r[colOf];
    if (Number.isInteger(v) && v >= 1 && v <= 5) vals.push(v);
  }
  const n = vals.length;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  vals.forEach((v) => dist[v]++);
  const sum = vals.reduce((a, b) => a + b, 0);
  const mean = n ? sum / n : null;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return {
    ...item,
    n,
    mean,
    sd,
    dist,
    agreePct: n ? ((dist[4] + dist[5]) / n) * 100 : null,
  };
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function normTool(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function computeStats() {
  const rows = db.prepare('SELECT * FROM responses ORDER BY id').all();
  const total = rows.length;

  const now = new Date();
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const today = dayKey(now);
  const since7 = new Date(now.getTime() - 6 * 864e5);
  const since30 = new Date(now.getTime() - 29 * 864e5);
  const last7 = rows.filter((r) => new Date(r.created_at) >= new Date(dayKey(since7) + 'T00:00:00Z')).length;
  const last30 = rows.filter((r) => new Date(r.created_at) >= new Date(dayKey(since30) + 'T00:00:00Z')).length;

  const countBy = (fn) => {
    const m = new Map();
    for (const r of rows) {
      const k = fn(r);
      if (k == null || k === '') continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  };

  const toolsMap = new Map();
  for (const r of rows) {
    const display = normTool(r.q3_tool);
    if (!display) continue;
    const key = display.toLowerCase();
    const cur = toolsMap.get(key);
    if (cur) cur.count++;
    else toolsMap.set(key, { count: 1, spellings: new Map([[display, 1]]) });
  }
  const tools = [...toolsMap.values()]
    .map((v) => {
      const best = [...v.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { tool: best, count: v.count };
    })
    .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool));

  const itemB = ITEMS_B.map((it) => stat(it, rows, COL[it.no]));
  const itemC = ITEMS_C.map((it) => {
    const noSource = it.no === 14 ? rows.filter((r) => r.q14_no_source === 1).length : 0;
    return {
      ...stat(it, rows, COL[it.no]),
      // "No source was named" (Q14) is a separate state, not a not-observed case.
      notObserved: rows.filter((r) => r[COL[it.no]] == null && !(it.no === 14 && r.q14_no_source === 1)).length,
      noSource: it.no === 14 ? noSource : undefined,
    };
  });

  const days = rows.map((r) => r.q15_days).filter((v) => Number.isInteger(v));
  const daysSum = days.reduce((a, b) => a + b, 0);
  const buckets = [
    ['0', (v) => v === 0],
    ['1–5', (v) => v >= 1 && v <= 5],
    ['6–10', (v) => v >= 6 && v <= 10],
    ['11–15', (v) => v >= 11 && v <= 15],
    ['16–20', (v) => v >= 16 && v <= 20],
    ['21–25', (v) => v >= 21 && v <= 25],
    ['26–30', (v) => v >= 26 && v <= 30],
  ].map(([label, fn]) => ({ label, count: days.filter(fn).length }));

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5);
    const k = dayKey(d);
    daily.push({ date: k, count: rows.filter((r) => String(r.created_at).slice(0, 10) === k).length });
  }

  return {
    generatedAt: now.toISOString(),
    total,
    last7,
    last30,
    today: rows.filter((r) => String(r.created_at).slice(0, 10) === today).length,
    q1: countBy((r) => (r.q1_international === 'yes' ? 'Yes' : r.q1_international === 'no' ? 'No' : null)),
    q2: countBy((r) => r.q2_grade),
    tools,
    itemB,
    itemC,
    days: {
      n: days.length,
      mean: days.length ? daysSum / days.length : null,
      median: median(days),
      min: days.length ? Math.min(...days) : null,
      max: days.length ? Math.max(...days) : null,
      zero: days.filter((v) => v === 0).length,
      buckets,
    },
    daily,
    rows: rows
      .slice(-50)
      .reverse()
      .map((r) => ({
        id: r.id,
        at: r.created_at,
        tool: r.q3_tool,
        grade: r.q2_grade,
        q1: r.q1_international,
        b: [r.q4_peu, r.q5_pu, r.q6_att, r.q7_tr, r.q8_tr, r.q9_mr, r.q10_mr, r.q11_bi, r.q12_bi],
        q13: r.q13_vb,
        q14: r.q14_no_source ? 'No source' : r.q14_vb,
        q15: r.q15_days,
      })),
  };
}

/* --------------------------------- CSV ----------------------------------- */

function csvCell(v) {
  let s = v == null ? '' : String(v);
  // spreadsheet formula-injection guard for free-text fields
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV() {
  const rows = db.prepare('SELECT * FROM responses ORDER BY id').all();
  const head = [
    'response_id', 'submitted_at_utc', 'q1_international_curriculum', 'q2_grade', 'q3_tool',
    'q4_peu', 'q5_pu', 'q6_att', 'q7_tr', 'q8_tr', 'q9_mr', 'q10_mr', 'q11_bi', 'q12_bi',
    'q13_vb', 'q14_vb', 'q14_no_source_named', 'q15_days_used',
  ];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.created_at, r.q1_international, r.q2_grade, r.q3_tool,
        r.q4_peu, r.q5_pu, r.q6_att, r.q7_tr, r.q8_tr, r.q9_mr, r.q10_mr, r.q11_bi, r.q12_bi,
        r.q13_vb, r.q14_no_source ? '' : r.q14_vb, r.q14_no_source, r.q15_days,
      ].map(csvCell).join(',')
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/* ------------------------------- validation ------------------------------ */

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 128 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clean(s, max = 120) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
}

function validate(raw) {
  const errors = {};
  const out = {};

  out.q1 = raw.q1 === 'yes' ? 'yes' : raw.q1 === 'no' ? 'no' : null;
  if (!out.q1) errors.q1 = 'Please choose Yes or No.';

  out.q2 = clean(raw.q2, 80);
  if (!out.q2) errors.q2 = 'Please choose your grade level (or “Not currently a student”).';

  out.q3 = clean(raw.q3, 80);
  if (!out.q3) errors.q3 = 'Please name the AI tool you use most often.';

  for (const it of ITEMS_B) {
    const v = Number(raw['q' + it.no]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) out['q' + it.no] = v;
    else errors['q' + it.no] = 'Please choose one number from 1 to 5.';
  }

  const q13 = String(raw.q13 == null ? '' : raw.q13);
  out.q13 = /^[1-5]$/.test(q13) ? Number(q13) : null;

  const q14 = String(raw.q14 == null ? '' : raw.q14);
  if (/^[1-5]$/.test(q14)) {
    out.q14 = Number(q14);
    out.q14_no_source = 0;
  } else if (q14 === 'nosource') {
    out.q14 = null;
    out.q14_no_source = 1;
  } else {
    out.q14 = null;
    out.q14_no_source = 0;
  }

  const rawDays = String(raw.q15 == null ? '' : raw.q15).trim();
  const d = /^\d{1,2}$/.test(rawDays) ? Number(rawDays) : NaN;
  if (Number.isInteger(d) && d >= 0 && d <= 30) {
    out.q15 = d;
  } else {
    out.q15 = null;
    errors.q15 = 'Please enter a whole number of days from 0 to 30.';
  }

  if (out.q15 === 0) {
    out.q13 = null;
    out.q14 = null;
    out.q14_no_source = 0;
  }

  return { data: out, errors };
}

const insertStmt = db.prepare(`
  INSERT INTO responses
    (created_at, q1_international, q2_grade, q3_tool,
     q4_peu, q5_pu, q6_att, q7_tr, q8_tr, q9_mr, q10_mr, q11_bi, q12_bi,
     q13_vb, q14_vb, q14_no_source, q15_days)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

function save(d) {
  const info = insertStmt.run(
    new Date().toISOString(), d.q1, d.q2, d.q3,
    d.q4, d.q5, d.q6, d.q7, d.q8, d.q9, d.q10, d.q11, d.q12,
    d.q13, d.q14, d.q14_no_source, d.q15
  );
  return Number(info.lastInsertRowid);
}

/* -------------------------------- cookies -------------------------------- */

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function isAdmin(req, url) {
  const cookies = parseCookies(req);
  if (safeEqual(cookies.q_admin, ADMIN_TOKEN)) return true;
  const t = url.searchParams.get('token');
  return !!(t && safeEqual(t, ADMIN_TOKEN));
}

/* ----------------------------- rate limiting ----------------------------- */

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 100;
  let rec = hits.get(ip);
  if (!rec || now - rec.start > windowMs) {
    rec = { start: now, count: 0 };
    hits.set(ip, rec);
  }
  rec.count++;
  if (hits.size > 5000) hits.clear();
  return rec.count > max;
}

/* -------------------------------- routing -------------------------------- */

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    ...headers,
  });
  res.end(buf);
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, { Location: location, 'Content-Length': 0, ...headers });
  res.end();
}

function clientIp(req) {
  // Behind the Cloudflare tunnel every request arrives from 127.0.0.1; Cloudflare puts the
  // respondent's address in cf-connecting-ip. It is used only for an in-memory rate limit and
  // is never stored with a response.
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method || 'GET';

  try {
    /* ---- static assets ---- */
    if (p.startsWith('/assets/') && method === 'GET') {
      const name = path.basename(p);
      const file = path.join(ASSETS_DIR, name);
      if (!fs.existsSync(file)) return send(res, 404, views.pageError(404, 'Not found.'), { 'Content-Type': 'text/html; charset=utf-8' });
      const ext = path.extname(file);
      const body = fs.readFileSync(file);
      return send(res, 200, body, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=60',
      });
    }

    /* ---- questionnaire ---- */
    if (p === '/' && method === 'GET') {
      const cookies = parseCookies(req);
      const html = views.pageQuestionnaire({}, {}, {
        alreadySubmitted: cookies.q_submitted === '1' && url.searchParams.get('again') !== '1',
      });
      return send(res, 200, html, { 'Cache-Control': 'no-store' });
    }

    /* ---- json submit (programmatic) ---- */
    if (p === '/api/submit' && method === 'POST') {
      if (rateLimited(clientIp(req))) {
        return send(res, 429, JSON.stringify({ ok: false, error: 'too many submissions' }), {
          'Content-Type': 'application/json; charset=utf-8',
        });
      }
      let body;
      try {
        body = JSON.parse((await parseBody(req)) || '{}');
      } catch {
        return send(res, 400, JSON.stringify({ ok: false, error: 'body must be JSON' }), {
          'Content-Type': 'application/json; charset=utf-8',
        });
      }
      const { data, errors } = validate(body);
      if (Object.keys(errors).length) {
        return send(res, 422, JSON.stringify({ ok: false, errors }), { 'Content-Type': 'application/json; charset=utf-8' });
      }
      const id = save(data);
      return send(res, 201, JSON.stringify({ ok: true, id }), { 'Content-Type': 'application/json; charset=utf-8' });
    }

    /* ---- form submit ---- */
    if (p === '/submit' && method === 'POST') {
      if (rateLimited(clientIp(req))) {
        return send(res, 429, views.pageError(429, 'Too many submissions from this connection. Please wait a minute.'), { 'Cache-Control': 'no-store' });
      }
      const body = await parseBody(req);
      const raw = Object.fromEntries(new URLSearchParams(body));
      const { data, errors } = validate(raw);
      if (Object.keys(errors).length) {
        const html = views.pageQuestionnaire(raw, errors, {});
        return send(res, 422, html, { 'Cache-Control': 'no-store' });
      }
      save(data);
      return redirect(res, '/thanks', {
        'Set-Cookie': 'q_submitted=1; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly',
      });
    }

    if (p === '/thanks' && method === 'GET') {
      return send(res, 200, views.pageThanks(), { 'Cache-Control': 'no-store' });
    }

    /* ---- admin auth ---- */
    if (p === '/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      const token = String(Object.fromEntries(new URLSearchParams(body)).token || '').trim();
      if (safeEqual(token, ADMIN_TOKEN)) {
        return redirect(res, '/results', {
          'Set-Cookie': `q_admin=${encodeURIComponent(ADMIN_TOKEN)}; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly`,
        });
      }
      return send(res, 401, views.pageAuth({ error: 'That token is not correct.' }), { 'Cache-Control': 'no-store' });
    }

    if (p === '/results' && method === 'GET') {
      const t = url.searchParams.get('token');
      if (t && safeEqual(t, ADMIN_TOKEN)) {
        return redirect(res, '/results', {
          'Set-Cookie': `q_admin=${encodeURIComponent(ADMIN_TOKEN)}; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly`,
        });
      }
      if (!isAdmin(req, url)) {
        return send(res, 401, views.pageAuth({}), { 'Cache-Control': 'no-store' });
      }
      return send(res, 200, views.pageResultsShell(), { 'Cache-Control': 'no-store' });
    }

    if (p === '/api/results' && method === 'GET') {
      if (!isAdmin(req, url)) {
        return send(res, 401, JSON.stringify({ ok: false, error: 'unauthorised' }), { 'Content-Type': 'application/json; charset=utf-8' });
      }
      return send(res, 200, JSON.stringify(computeStats()), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    }

    if (p === '/api/export.csv' && method === 'GET') {
      if (!isAdmin(req, url)) {
        return send(res, 401, 'unauthorised', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      const stamp = new Date().toISOString().slice(0, 10);
      return send(res, 200, toCSV(), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-tool-academic-research-responses-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      });
    }

    if (p === '/health') {
      const n = db.prepare('SELECT COUNT(*) AS c FROM responses').get().c;
      return send(res, 200, JSON.stringify({ ok: true, responses: n, uptime: process.uptime() }), {
        'Content-Type': 'application/json; charset=utf-8',
      });
    }

    return send(res, 404, views.pageError(404, 'Page not found.'), { 'Cache-Control': 'no-store' });
  } catch (e) {
    console.error('[error]', method, p, e && e.message);
    return send(res, 500, views.pageError(500, 'Something went wrong. Please try again.'), { 'Cache-Control': 'no-store' });
  }
});

function lanIp() {
  const os = require('node:os');
  const nets = os.networkInterfaces();
  const found = [];
  for (const [, addrs] of Object.entries(nets)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) found.push(a.address);
    }
  }
  return found.find((ip) => ip.startsWith('192.168.')) || found[0] || '127.0.0.1';
}

function tightenDbPermissions() {
  for (const f of ['responses.db', 'responses.db-wal', 'responses.db-shm', 'admin-token.txt']) {
    try { fs.chmodSync(path.join(DATA_DIR, f), 0o600); } catch {}
  }
}

server.listen(PORT, HOST, () => {
  tightenDbPermissions();
  const ip = lanIp();
  console.log('');
  console.log('  AI Tool Use for Academic Research — questionnaire server');
  console.log('  -------------------------------------------------------');
  console.log(`  Public questionnaire  http://localhost:${PORT}/`);
  console.log(`  Same Wi-Fi           http://${ip}:${PORT}/`);
  console.log(`  Results (token)      http://localhost:${PORT}/results?token=${ADMIN_TOKEN}`);
  console.log(`  CSV export           http://localhost:${PORT}/api/export.csv?token=${ADMIN_TOKEN}`);
  console.log(`  Responses stored     ${path.join(DATA_DIR, 'responses.db')}`);
  console.log('');
});

process.on('SIGINT', () => { try { db.close(); } catch {} process.exit(0); });
process.on('SIGTERM', () => { try { db.close(); } catch {} process.exit(0); });
