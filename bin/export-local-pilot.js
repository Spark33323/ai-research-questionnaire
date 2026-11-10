'use strict';

/*
 * Export the existing local pilot rows as a temporary D1 SQL import.
 * deploy.sh writes this to a private temp file and never adds it to the repository.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const output = process.argv[2];
if (!output) {
  console.error('usage: node bin/export-local-pilot.js <temporary-sql-file>');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const databaseFile = path.join(root, 'data', 'responses.db');
if (!fs.existsSync(databaseFile)) {
  console.log('No local pilot database found; skipping import.');
  process.exit(0);
}

const database = new DatabaseSync(databaseFile, { readOnly: true });
const rows = database.prepare('SELECT * FROM responses ORDER BY id').all();
database.close();

const sqlValue = (value) => {
  if (value == null) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return "'" + String(value).replace(/'/g, "''") + "'";
};

const columns = [
  'id',
  'created_at',
  'q1_international',
  'q2_grade',
  'q3_tool',
  'q4_peu',
  'q5_pu',
  'q6_att',
  'q7_tr',
  'q8_tr',
  'q9_mr',
  'q10_mr',
  'q11_bi',
  'q12_bi',
  'q13_vb',
  'q14_vb',
  'q14_no_source',
  'q15_days',
];

const lines = rows.map((row) => (
  `INSERT OR IGNORE INTO responses (${columns.join(',')}) VALUES (` +
  columns.map((column) => sqlValue(row[column])).join(',') +
  ');'
));

fs.writeFileSync(output, lines.join('\n') + (lines.length ? '\n' : ''), { mode: 0o600 });
console.log(`Prepared ${rows.length} local pilot response(s) for private D1 import.`);
