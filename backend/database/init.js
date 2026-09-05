const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'pos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

function initializeDatabase() {
    try {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        const db = new Database(dbPath);
        db.pragma('foreign_keys = ON');
        db.exec(fs.readFileSync(schemaPath, 'utf8'));

        const insertAccount = db.prepare(`
            INSERT OR IGNORE INTO cash_bank_accounts (account_id, name, type, opening_balance, current_balance)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertAccount.run('ACC-00001', 'Cash in Hand', 'cash', 0, 0);
        insertAccount.run('ACC-00002', 'Main Bank Account', 'bank', 0, 0);

        const passwordHash = bcrypt.hashSync('admin123', 10);
        db.prepare(
            'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
        ).run('admin', passwordHash, 'owner');

        db.close();
        console.log(`Database initialized at: ${dbPath}`);
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

initializeDatabase();
