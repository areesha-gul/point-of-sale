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
        if (!['Istekhar', 'Shaukat', 'Bank'].includes(recipient) || !amount || !method || !date) return res.status(400).json({ error: 'Recipient, amount, method, and date are required' });
        if (!['cash', 'bank'].includes(method) || Number(amount) <= 0) return res.status(400).json({ error: 'Enter a valid amount and method' });
        if (method === 'bank' && !bank_account_id) return res.status(400).json({ error: 'Select the bank account used for this withdrawal' });
        if (bank_account_id && !(await query("SELECT id FROM cash_bank_accounts WHERE id = $1 AND type = 'bank' AND is_active = 1", [bank_account_id])).rows[0]) return res.status(400).json({ error: 'Selected bank account was not found' });
        const result = await withTransaction(async (client) => {
            const inserted = await client.query('INSERT INTO profit_withdrawals (recipient, amount, method, bank_account_id, date, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [recipient, amount, method, bank_account_id, date, notes]);
            await AccountingService.updateAccountBalance(method, amount, 'subtract', client, bank_account_id);
            return inserted.rows[0];
        });
        res.status(201).json(result);
    } catch (error) { res.status(500).json({ error: 'Failed to record profit withdrawal' }); }
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