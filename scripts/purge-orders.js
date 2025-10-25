#!/usr/bin/env node
/*
  Purge 'done' orders older than N days from server/data/orders.json
  Usage:
    node scripts/purge-orders.js [--days 30] [--dry-run]
*/
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let days = 30;
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--days' && args[i + 1]) {
    days = parseInt(args[++i], 10);
  } else if (a === '--dry-run') {
    dryRun = true;
  }
}

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'server', 'data', 'orders.json');

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const txt = fs.readFileSync(file, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    console.error('Failed to read JSON', e.message);
    process.exit(1);
  }
}

function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const orders = readJsonSafe(DATA_FILE);
const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

let removed = 0;
const kept = orders.filter(o => {
  if (!o || o.status !== 'done' || !o.createdAt) return true;
  const t = Date.parse(o.createdAt);
  if (isNaN(t)) return true;
  const old = t < cutoff;
  if (old) removed++;
  return !old;
});

console.log(`Found ${orders.length} orders. Removing ${removed} done orders older than ${days} days.`);

if (!dryRun) {
  writeJsonAtomic(DATA_FILE, kept);
  console.log('Orders file updated:', DATA_FILE);
} else {
  console.log('Dry-run: no changes written.');
}
