const express = require('express');
const { getDatabase } = require('../database/connection');
const { generateAccountId, generateBankTransactionId } = require('../utils/idGenerator');

const router = express.Router();

// Get all bank accounts
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const accounts = db.prepare('SELECT * FROM cash_bank_accounts WHERE is_active = 1 ORDER BY type, name').all();
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        res.status(500).json({ error: 'Failed to fetch bank accounts' });
    }
});

// Get account by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const account = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(req.params.id);
        
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        res.json(account);
    } catch (error) {
        console.error('Error fetching account:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
});

// Create bank account
router.post('/', (req, res) => {
    try {
        const { name, type, account_number, bank_name, opening_balance = 0, opening_balance_date } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }

        if (!['cash', 'bank'].includes(type)) {
            return res.status(400).json({ error: 'Type must be cash or bank' });
        }

        const db = getDatabase();
        const accountId = generateAccountId();
        
        const result = db.prepare(`
            INSERT INTO cash_bank_accounts (
                account_id, name, type, account_number, bank_name, 
                opening_balance, opening_balance_date, current_balance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            accountId, name, type, account_number, bank_name,
            opening_balance, opening_balance_date, opening_balance
        );

        const account = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(account);
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Update bank account
router.put('/:id', (req, res) => {
    try {
        const { name, account_number, bank_name } = req.body;
        const db = getDatabase();

        const account = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(req.params.id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        db.prepare(`
            UPDATE cash_bank_accounts 
            SET name = ?, account_number = ?, bank_name = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(
            name || account.name,
            account_number || account.account_number,
            bank_name || account.bank_name,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

// Deactivate account (soft delete)
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        
        db.prepare(`
            UPDATE cash_bank_accounts 
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(req.params.id);

        res.json({ message: 'Account deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating account:', error);
        res.status(500).json({ error: 'Failed to deactivate account' });
    }
});

// Bank Deposit
router.post('/deposit', (req, res) => {
    const db = getDatabase();
    
    try {
        const { account_id, amount, date, reference, notes } = req.body;

        if (!account_id || !amount || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const account = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(account_id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const transactionId = generateBankTransactionId();

        const transaction = db.transaction(() => {
            // Create bank transaction record
            const result = db.prepare(`
                INSERT INTO bank_transactions (
                    transaction_id, transaction_type, to_account_id, amount, date, reference, notes, status
                ) VALUES (?, 'deposit', ?, ?, ?, ?, ?, 'draft')
            `).run(transactionId, account_id, amount, date, reference, notes);

            return result.lastInsertRowid;
        });

        const txnId = transaction();

        const txn = db.prepare(`
            SELECT bt.*, ba.name as account_name, ba.account_id as account_code
            FROM bank_transactions bt
            LEFT JOIN cash_bank_accounts ba ON bt.to_account_id = ba.id
            WHERE bt.id = ?
        `).get(txnId);

        res.status(201).json({
            ...txn,
            message: 'Deposit created as draft. Click Approve to finalize.'
        });
    } catch (error) {
        console.error('Error creating deposit:', error);
        res.status(500).json({ error: 'Failed to create deposit', message: error.message });
    }
});

// Bank Withdrawal
router.post('/withdrawal', (req, res) => {
    const db = getDatabase();
    
    try {
        const { account_id, amount, date, reference, notes } = req.body;

        if (!account_id || !amount || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const account = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(account_id);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const transactionId = generateBankTransactionId();

        const transaction = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO bank_transactions (
                    transaction_id, transaction_type, from_account_id, amount, date, reference, notes, status
                ) VALUES (?, 'withdrawal', ?, ?, ?, ?, ?, 'draft')
            `).run(transactionId, account_id, amount, date, reference, notes);

            return result.lastInsertRowid;
        });

        const txnId = transaction();

        const txn = db.prepare(`
            SELECT bt.*, ba.name as account_name, ba.account_id as account_code
            FROM bank_transactions bt
            LEFT JOIN cash_bank_accounts ba ON bt.from_account_id = ba.id
            WHERE bt.id = ?
        `).get(txnId);

        res.status(201).json({
            ...txn,
            message: 'Withdrawal created as draft. Click Approve to finalize.'
        });
    } catch (error) {
        console.error('Error creating withdrawal:', error);
        res.status(500).json({ error: 'Failed to create withdrawal', message: error.message });
    }
});

// Bank Transfer
router.post('/transfer', (req, res) => {
    const db = getDatabase();
    
    try {
        const { from_account_id, to_account_id, amount, date, reference, notes } = req.body;

        if (!from_account_id || !to_account_id || !amount || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (from_account_id === to_account_id) {
            return res.status(400).json({ error: 'Cannot transfer to the same account' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        const fromAccount = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(from_account_id);
        const toAccount = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(to_account_id);

        if (!fromAccount || !toAccount) {
            return res.status(404).json({ error: 'One or both accounts not found' });
        }

        const transactionId = generateBankTransactionId();

        const transaction = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO bank_transactions (
                    transaction_id, transaction_type, from_account_id, to_account_id, amount, date, reference, notes, status
                ) VALUES (?, 'transfer', ?, ?, ?, ?, ?, ?, 'draft')
            `).run(transactionId, from_account_id, to_account_id, amount, date, reference, notes);

            return result.lastInsertRowid;
        });

        const txnId = transaction();

        const txn = db.prepare(`
            SELECT bt.*, 
                   fa.name as from_account_name, fa.account_id as from_account_code,
                   ta.name as to_account_name, ta.account_id as to_account_code
            FROM bank_transactions bt
            LEFT JOIN cash_bank_accounts fa ON bt.from_account_id = fa.id
            LEFT JOIN cash_bank_accounts ta ON bt.to_account_id = ta.id
            WHERE bt.id = ?
        `).get(txnId);

        res.status(201).json({
            ...txn,
            message: 'Transfer created as draft. Click Approve to finalize.'
        });
    } catch (error) {
        console.error('Error creating transfer:', error);
        res.status(500).json({ error: 'Failed to create transfer', message: error.message });
    }
});

// Approve bank transaction
router.post('/transactions/:id/approve', (req, res) => {
    const db = getDatabase();
    
    try {
        const txnId = req.params.id;
        const userId = req.session.userId;

        const txn = db.prepare('SELECT * FROM bank_transactions WHERE id = ? AND status = ?')
            .get(txnId, 'draft');

        if (!txn) {
            return res.status(404).json({ error: 'Transaction not found or already approved' });
        }

        const transaction = db.transaction(() => {
            // Update transaction status
            db.prepare(`
                UPDATE bank_transactions 
                SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(userId, txnId);

            // Update account balances
            if (txn.transaction_type === 'deposit') {
                db.prepare(`
                    UPDATE cash_bank_accounts 
                    SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(txn.amount, txn.to_account_id);
            } else if (txn.transaction_type === 'withdrawal') {
                db.prepare(`
                    UPDATE cash_bank_accounts 
                    SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(txn.amount, txn.from_account_id);
            } else if (txn.transaction_type === 'transfer') {
                db.prepare(`
                    UPDATE cash_bank_accounts 
                    SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(txn.amount, txn.from_account_id);
                
                db.prepare(`
                    UPDATE cash_bank_accounts 
                    SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(txn.amount, txn.to_account_id);
            }
        });

        transaction();

        res.json({ message: 'Bank transaction approved successfully' });
    } catch (error) {
        console.error('Error approving bank transaction:', error);
        res.status(500).json({ error: 'Failed to approve transaction' });
    }
});

// Get all bank transactions
router.get('/transactions', (req, res) => {
    try {
        const { status, type } = req.query;
        const db = getDatabase();
        
        let query = `
            SELECT bt.*,
                   fa.name as from_account_name, fa.account_id as from_account_code,
                   ta.name as to_account_name, ta.account_id as to_account_code
            FROM bank_transactions bt
            LEFT JOIN cash_bank_accounts fa ON bt.from_account_id = fa.id
            LEFT JOIN cash_bank_accounts ta ON bt.to_account_id = ta.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND bt.status = ?';
            params.push(status);
        }

        if (type) {
            query += ' AND bt.transaction_type = ?';
            params.push(type);
        }

        query += ' ORDER BY bt.date DESC, bt.id DESC';

        const transactions = db.prepare(query).all(...params);
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching bank transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

module.exports = router;
