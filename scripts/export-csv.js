#!/usr/bin/env node
/*
  Export orders to CSV.
  Usage:
    node scripts/export-csv.js > orders.csv
  Or to file:
    node scripts/export-csv.js --out exports/orders-<timestamp>.csv
*/
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let outFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) {
    outFile = args[++i];
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

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

const orders = readJsonSafe(DATA_FILE);

const header = [
  'id',
  'status',
  'createdAt',
  'customerName',
  'phone',
  'total',
  'itemsCount',
  'itemsSummary'
];

const rows = [header.join(',')];

for (const o of orders) {
  const items = Array.isArray(o.items) ? o.items : [];
  const itemsSummary = items.map(it => `${it.quantity || 1}x ${it.name || it.id || ''}`).join(' | ');
  const row = [
    o.id,
    o.status,
    o.createdAt,
    o.customer?.name || '',
    o.customer?.phone || '',
    typeof o.total === 'number' ? o.total.toFixed(2) : '',
    items.length,
    itemsSummary
  ].map(csvEscape).join(',');
  rows.push(row);
}

const csv = rows.join('\n') + '\n';

if (outFile) {
  const outPath = path.isAbsolute(outFile) ? outFile : path.join(ROOT, outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, csv);
  console.log('CSV written to', outPath);
} else {
  process.stdout.write(csv);
}
