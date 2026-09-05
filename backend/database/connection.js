const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'pos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

let db = null;

async function initDatabase() {
    if (!db) {
        // Ensure the directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Create or open the database
        db = new Database(dbPath, { 
            verbose: process.env.NODE_ENV === 'development' ? console.log : null 
        });
        
        // Enable foreign keys and optimize for better performance
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        db.exec(fs.readFileSync(schemaPath, 'utf8'));
        db.prepare(`
            INSERT OR IGNORE INTO cash_bank_accounts
                (account_id, name, type, opening_balance, current_balance)
            VALUES (?, ?, ?, ?, ?)
        `).run('ACC-00001', 'Cash in Hand', 'cash', 0, 0);
        db.prepare(`
            INSERT OR IGNORE INTO cash_bank_accounts
                (account_id, name, type, opening_balance, current_balance)
            VALUES (?, ?, ?, ?, ?)
        `).run('ACC-00002', 'Main Bank Account', 'bank', 0, 0);
        db.prepare(
            'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
        ).run('admin', bcrypt.hashSync('admin123', 10), 'owner');
        
        console.log(`Database initialized at: ${dbPath}`);
    }
    return db;
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('Database connection closed');
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase
};
