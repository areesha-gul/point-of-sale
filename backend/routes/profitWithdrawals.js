const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const AccountingService = require('../services/accountingService');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.json((await query('SELECT * FROM profit_withdrawals ORDER BY date DESC, id DESC')).rows);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch profit withdrawals' }); }
});

router.post('/', async (req, res) => {
    try {
        const { recipient, amount, method, bank_account_id = null, date, notes } = req.body;
        const numericAmount = Number(amount);
        const accountId = method === 'bank' && bank_account_id ? Number(bank_account_id) : null;

        if (!['Iftekhar Ahmad', 'Shaukat Rang Illahi', 'Bank'].includes(recipient) || !method || !date || !Number.isFinite(numericAmount)) return res.status(400).json({ error: 'Recipient, amount, method, and date are required' });
        if (!['cash', 'bank'].includes(method) || numericAmount <= 0) return res.status(400).json({ error: 'Enter a valid amount and method' });
        if (method === 'bank' && (!Number.isInteger(accountId) || accountId <= 0)) return res.status(400).json({ error: 'Select the bank account used for this withdrawal' });
        if (accountId && !(await query("SELECT id FROM cash_bank_accounts WHERE id = $1 AND type = 'bank' AND is_active = 1", [accountId])).rows[0]) return res.status(400).json({ error: 'Selected bank account was not found' });
        const result = await withTransaction(async (client) => {
            if (accountId) {
                const account = (await client.query('SELECT current_balance FROM cash_bank_accounts WHERE id = $1 FOR UPDATE', [accountId])).rows[0];
                if (!account || Number(account.current_balance) < numericAmount) {
                    const error = new Error('Insufficient balance in the selected bank account');
                    error.status = 400;
                    throw error;
                }
            }

            const inserted = await client.query('INSERT INTO profit_withdrawals (recipient, amount, method, bank_account_id, date, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [recipient, numericAmount, method, accountId, date, notes]);
            await AccountingService.updateAccountBalance(method, numericAmount, 'subtract', client, accountId);
            return inserted.rows[0];
        });
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating profit withdrawal:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to record profit withdrawal', message: error.status ? undefined : error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const withdrawal = (await query('SELECT * FROM profit_withdrawals WHERE id = $1', [req.params.id])).rows[0];
        if (!withdrawal) return res.status(404).json({ error: 'Profit withdrawal not found' });
        await withTransaction(async (client) => {
            await AccountingService.updateAccountBalance(withdrawal.method, withdrawal.amount, 'add', client, withdrawal.bank_account_id);
            await client.query('DELETE FROM profit_withdrawals WHERE id = $1', [req.params.id]);
        });
        res.json({ message: 'Profit withdrawal deleted and balance restored' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete profit withdrawal' }); }
});

module.exports = router;