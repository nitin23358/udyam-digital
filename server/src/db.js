// SQLite via sql.js (WebAssembly build — no native compiler needed on Windows).
// The DB lives in memory and is flushed to disk after every write, so data survives restarts.
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { DATA_DIR } from './data.js';

const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, '..', 'udyam.sqlite');
let db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  stage TEXT NOT NULL DEFAULT 'advisor',      -- advisor | quote | kyc | checkout | ordered
  profile_json TEXT NOT NULL DEFAULT '{}',
  transcript_json TEXT NOT NULL DEFAULT '[]',
  selection_json TEXT,                         -- bundle the owner is editing
  kyc_json TEXT,                               -- verification summary only (no images)
  contact_name TEXT,
  phone_masked TEXT,
  order_id TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  business_name TEXT,
  quote_json TEXT NOT NULL,
  install_slot TEXT,
  status TEXT NOT NULL,                        -- placed | kyc_verified | install_scheduled | activated
  timeline_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  purposes_json TEXT NOT NULL,
  language TEXT NOT NULL,
  given_at TEXT NOT NULL,
  withdrawn_at TEXT
);
CREATE TABLE IF NOT EXISTS followups (
  lead_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  note TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  application_id TEXT,
  event TEXT NOT NULL,
  detail TEXT
);
`;

export async function initDb() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.run(SCHEMA);
  persist();
  return db;
}

let pending = null;
function persist() {
  // Coalesce bursts of writes into one disk flush.
  if (pending) return;
  pending = setImmediate(() => {
    pending = null;
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  });
}

export function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export const get = (sql, params = []) => all(sql, params)[0] || null;

export function audit(applicationId, event, detail) {
  run('INSERT INTO audit_log (ts, application_id, event, detail) VALUES (?,?,?,?)', [
    new Date().toISOString(), applicationId || null, event, detail ? JSON.stringify(detail) : null,
  ]);
}
