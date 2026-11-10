'use strict';
/*
 * backup.js — write a timestamped CSV snapshot of all responses and prune old ones.
 * Run hourly by local.ai-research-questionnaire-backup (launchd); safe to run by hand.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DB = path.join(ROOT, 'data', 'responses.db');
const OUT_DIR = path.join(ROOT, 'data', 'backups');
const KEEP = 200;

fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(DB)) { console.error('no database yet:', DB); process.exit(0); }

const db = new DatabaseSync(DB);
let rows = [];
try {
  rows = db.prepare('SELECT * FROM responses ORDER BY id').all();
} catch (e) {
  console.error('cannot read responses:', e.message);
  process.exit(1);
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const head = [
  'response_id', 'submitted_at_utc', 'q1_international_curriculum', 'q2_grade', 'q3_tool',
  'q4_peu', 'q5_pu', 'q6_att', 'q7_tr', 'q8_tr', 'q9_mr', 'q10_mr', 'q11_bi', 'q12_bi',
  'q13_vb', 'q14_vb', 'q14_no_source_named', 'q15_days_used',
];

const out = ['\uFEFF' + head.join(',')];
for (const r of rows) {
  out.push([
    r.id, r.created_at, r.q1_international, r.q2_grade, r.q3_tool,
    r.q4_peu, r.q5_pu, r.q6_att, r.q7_tr, r.q8_tr, r.q9_mr, r.q10_mr, r.q11_bi, r.q12_bi,
    r.q13_vb, r.q14_no_source ? '' : r.q14_vb, r.q14_no_source, r.q15_days,
  ].map(cell).join(','));
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = path.join(OUT_DIR, `responses-${stamp}.csv`);
fs.writeFileSync(file, out.join('\r\n') + '\r\n');

const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.csv')).sort();
for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
  fs.unlinkSync(path.join(OUT_DIR, f));
}

console.log(new Date().toISOString(), 'backup wrote', rows.length, 'rows ->', file);
