'use strict';

/* Replace the local D1 placeholder with the deployed database UUID. */

const fs = require('node:fs');
const path = require('node:path');

const id = String(process.argv[2] || '').trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  console.error('usage: node bin/set-d1-id.js <database-uuid>');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'wrangler.jsonc');
const source = fs.readFileSync(file, 'utf8');
const updated = source.replace(
  /("database_id"\s*:\s*")[^"]+(")/,
  `$1${id}$2`
);

if (updated === source && !source.includes(`"database_id": "${id}"`)) {
  console.error('could not find database_id in wrangler.jsonc');
  process.exit(1);
}

fs.writeFileSync(file, updated);
console.log('D1 database id set to', id);
