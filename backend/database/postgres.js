const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for PostgreSQL');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_SIZE || 10)
});

async function query(text, params) {
    return pool.query(text, params);
}

async function initPostgres() {
    const schema = fs.readFileSync(
        path.join(__dirname, 'schema.postgres.sql'),
        'utf8'
    );

    await pool.query(schema);
    await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS freight_charges NUMERIC(15, 2) DEFAULT 0');
    await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES cash_bank_accounts(id)');
    await pool.query(`
        INSERT INTO cash_bank_accounts
            (account_id, name, type, opening_balance, current_balance)
        VALUES
            ('ACC-00001', 'Cash in Hand', 'cash', 0, 0),
            ('ACC-00002', 'Main Bank Account', 'bank', 0, 0)
        ON CONFLICT (account_id) DO NOTHING
    `);

    await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        ['admin', bcrypt.hashSync('admin123', 10), 'owner']
    );
}

async function withTransaction(work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function closePostgres() {
    await pool.end();
}

module.exports = { pool, query, initPostgres, withTransaction, closePostgres };