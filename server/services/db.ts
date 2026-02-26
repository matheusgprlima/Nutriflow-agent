import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'dietcoach.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT,
    originalName TEXT,
    mimeType TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS diet_templates (
    id TEXT PRIMARY KEY,
    data JSON,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_metrics (
    id TEXT PRIMARY KEY,
    localDate TEXT,
    data JSON,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    localDate TEXT,
    data JSON,
    createdAt TEXT
  );
`);

export const dbService = {
  saveUpload: (id: string, filename: string, originalName: string, mimeType: string) => {
    const stmt = db.prepare('INSERT INTO uploads (id, filename, originalName, mimeType, createdAt) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, filename, originalName, mimeType, new Date().toISOString());
  },

  saveDietTemplate: (id: string, data: any) => {
    const stmt = db.prepare('INSERT INTO diet_templates (id, data, createdAt) VALUES (?, ?, ?)');
    stmt.run(id, JSON.stringify(data), new Date().toISOString());
  },

  getLatestDietTemplate: () => {
    const stmt = db.prepare('SELECT * FROM diet_templates ORDER BY createdAt DESC LIMIT 1');
    const row = stmt.get() as any;
    return row ? JSON.parse(row.data) : null;
  },

  saveDailyMetrics: (id: string, localDate: string, data: any) => {
    const stmt = db.prepare('INSERT INTO daily_metrics (id, localDate, data, createdAt) VALUES (?, ?, ?, ?)');
    stmt.run(id, localDate, JSON.stringify(data), new Date().toISOString());
  },

  getDailyMetrics: (localDate: string) => {
    const stmt = db.prepare('SELECT * FROM daily_metrics WHERE localDate = ? ORDER BY createdAt DESC LIMIT 1');
    const row = stmt.get(localDate) as any;
    return row ? JSON.parse(row.data) : null;
  },

  savePlan: (id: string, localDate: string, data: any) => {
    const stmt = db.prepare('INSERT INTO plans (id, localDate, data, createdAt) VALUES (?, ?, ?, ?)');
    stmt.run(id, localDate, JSON.stringify(data), new Date().toISOString());
  },

  getPlan: (localDate: string) => {
    const stmt = db.prepare('SELECT * FROM plans WHERE localDate = ? ORDER BY createdAt DESC LIMIT 1');
    const row = stmt.get(localDate) as any;
    return row ? JSON.parse(row.data) : null;
  }
};
