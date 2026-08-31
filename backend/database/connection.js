const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'pos.db');

let db = null;
let SQL = null;

async function initDatabase() {
    if (!SQL) {
        SQL = await initSqlJs();
    }
    
    if (!db) {
        try {
            // Try to load existing database
            const buffer = fs.readFileSync(dbPath);
            db = new SQL.Database(buffer);
        } catch (err) {
            // Create new database if file doesn't exist
            db = new SQL.Database();
        }
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
    }
    return db;
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    
    // Return a wrapper object that mimics better-sqlite3 API
    return {
        // Prepare statement wrapper
        prepare: (sql) => {
            const stmt = db.prepare(sql);
            
            return {
                // Get single row
                get: (...params) => {
                    stmt.bind(params);
                    const result = stmt.step() ? stmt.getAsObject() : null;
                    stmt.reset();
                    return result;
                },
                
                // Get all rows
                all: (...params) => {
                    stmt.bind(params);
                    const results = [];
                    while (stmt.step()) {
                        results.push(stmt.getAsObject());
                    }
                    stmt.reset();
                    return results;
                },
                
                // Run statement (INSERT, UPDATE, DELETE)
                run: (...params) => {
                    stmt.bind(params);
                    stmt.step();
                    stmt.reset();
                    saveDatabase();
                    return {
                        changes: db.getRowsModified(),
                        lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0
                    };
                },
                
                // Free statement
                free: () => {
                    stmt.free();
                }
            };
        },
        
        // Execute raw SQL
        exec: (sql) => {
            db.exec(sql);
            saveDatabase();
        },
        
        // Run single statement
        run: (sql, params = []) => {
            db.run(sql, params);
            saveDatabase();
        },
        
        // Pragma wrapper
        pragma: (pragma) => {
            try {
                db.run(`PRAGMA ${pragma}`);
            } catch (err) {
                // Ignore pragma errors for sql.js compatibility
                console.log(`Pragma ${pragma} not supported, skipping...`);
            }
        },
        
        // Transaction support
        transaction: (fn) => {
            return (...args) => {
                try {
                    db.run('BEGIN TRANSACTION');
                    const result = fn(...args);
                    db.run('COMMIT');
                    saveDatabase();
                    return result;
                } catch (err) {
                    db.run('ROLLBACK');
                    throw err;
                }
            };
        }
    };
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    saveDatabase,
    closeDatabase
};
