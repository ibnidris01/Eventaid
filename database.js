const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'eventaid.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    gender TEXT,
    address TEXT,
    dob TEXT,
    profile_pic TEXT,
    subaccount_code TEXT,
    recipient_code TEXT,
    role TEXT CHECK(role IN ('host', 'planner', 'admin')) DEFAULT 'host',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    location TEXT NOT NULL,
    budget INTEGER,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id)
  )`);

  // Proposals table
  db.run(`CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    planner_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    transaction_ref TEXT,
    payment_released INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (planner_id) REFERENCES users(id)
  )`);

  // Portfolio table
  db.run(`CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (planner_id) REFERENCES users(id)
  )`);

  // Password resets table
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Announcements table
  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Add missing columns to existing tables (safe ALTERs)
  // For proposals
  db.all("PRAGMA table_info(proposals)", (err, rows) => {
    if (err) return console.error('Error checking proposals schema:', err);
    const cols = rows.map(row => row.name);
    if (!cols.includes('payment_status')) {
      db.run("ALTER TABLE proposals ADD COLUMN payment_status TEXT DEFAULT 'pending'");
    }
    if (!cols.includes('transaction_ref')) {
      db.run("ALTER TABLE proposals ADD COLUMN transaction_ref TEXT");
    }
    if (!cols.includes('payment_released')) {
      db.run("ALTER TABLE proposals ADD COLUMN payment_released INTEGER DEFAULT 0");
      console.log("Added payment_released column to proposals");
    }
  });

  // For users
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) return console.error('Error checking users schema:', err);
    const cols = rows.map(row => row.name);
    const userColumns = ['phone', 'gender', 'address', 'dob', 'profile_pic', 'subaccount_code', 'recipient_code'];
    userColumns.forEach(col => {
      if (!cols.includes(col)) {
        db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
        console.log(`Added ${col} column to users`);
      }
    });
  });
});

module.exports = db;