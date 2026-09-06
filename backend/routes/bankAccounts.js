const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const { generateAccountId, generateBankTransactionId } = require('../utils/idGenerator');

const router = express.Router();

router.get('/', async (req, res) => {
    try { res.json((await query('SELECT * FROM cash_bank_accounts WHERE is_active = 1 ORDER BY type, name')).rows); }
    catch (error) { res.status(500).json({ error: 'Failed to fetch bank accounts' }); }
});

router.get('/:id', async (req, res) => {
    try {
        const account = (await query('SELECT * FROM cash_bank_accounts WHERE id = $1', [req.params.id])).rows[0];
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json(account);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch account' }); }
});

router.post('/', async (req, res) => {
    try {
        const { name, type, account_number, bank_name, opening_balance = 0, opening_balance_date } = req.body;
        if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });
        if (!['cash', 'bank'].includes(type)) return res.status(400).json({ error: 'Type must be cash or bank' });
        const accountId = await generateAccountId();
        const result = await query(`INSERT INTO cash_bank_accounts (account_id, name, type, account_number, bank_name, opening_balance, opening_balance_date, current_balance) VALUES ($1, $2, $3, $4, $5, $6, $7, $6) RETURNING *`, [accountId, name, type, account_number, bank_name, opening_balance, opening_balance_date]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to create account' }); }
});

router.put('/:id', async (req, res) => {
    try {
        const current = (await query('SELECT * FROM cash_bank_accounts WHERE id = $1', [req.params.id])).rows[0];
        if (!current) return res.status(404).json({ error: 'Account not found' });
        const { name, account_number, bank_name } = req.body;
        const result = await query('UPDATE cash_bank_accounts SET name = $1, account_number = $2, bank_name = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *', [name || current.name, account_number || current.account_number, bank_name || current.bank_name, req.params.id]);
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to update account' }); }
});

router.delete('/:id', async (req, res) => {
    try { await query('UPDATE cash_bank_accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]); res.json({ message: 'Account deactivated successfully' }); }
    catch (error) { res.status(500).json({ error: 'Failed to deactivate account' }); }
});

async function createBankTransaction(req, res, type) {
    try {
        const { account_id, amount, date, reference, notes } = req.body;
        if (!account_id || !amount || !date || amount <= 0) return res.status(400).json({ error: 'Valid account, amount, and date are required' });
        const id = await generateBankTransactionId();
        const column = type === 'deposit' ? 'to_account_id' : 'from_account_id';
        const result = await query(`INSERT INTO bank_transactions (transaction_id, transaction_type, ${column}, amount, date, reference, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *`, [id, type, account_id, amount, date, reference, notes]);
        res.status(201).json({ ...result.rows[0], message: `${type} created as draft. Click Approve to finalize.` });
    } catch (error) { res.status(500).json({ error: `Failed to create ${type}` }); }
}
router.post('/deposit', (req, res) => createBankTransaction(req, res, 'deposit'));
router.post('/withdrawal', (req, res) => createBankTransaction(req, res, 'withdrawal'));

router.post('/transfer', async (req, res) => {
    try {
        const { from_account_id, to_account_id, amount, date, reference, notes } = req.body;
        if (!from_account_id || !to_account_id || !amount || !date || from_account_id === to_account_id) return res.status(400).json({ error: 'Valid different accounts, amount, and date are required' });
        const id = await generateBankTransactionId();
        const result = await query(`INSERT INTO bank_transactions (transaction_id, transaction_type, from_account_id, to_account_id, amount, date, reference, notes, status) VALUES ($1, 'transfer', $2, $3, $4, $5, $6, $7, 'draft') RETURNING *`, [id, from_account_id, to_account_id, amount, date, reference, notes]);
        res.status(201).json({ ...result.rows[0], message: 'Transfer created as draft. Click Approve to finalize.' });
    } catch (error) { res.status(500).json({ error: 'Failed to create transfer' }); }
});

router.post('/:id/approve', async (req, res) => {
    try {
        const txn = (await query('SELECT * FROM bank_transactions WHERE id = $1 AND status = $2', [req.params.id, 'draft'])).rows[0];
        if (!txn) return res.status(404).json({ error: 'Transaction not found or already approved' });
        await withTransaction(async (client) => {
            await client.query(`UPDATE bank_transactions SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = $1 WHERE id = $2`, [req.user?.id || null, req.params.id]);
            if (txn.transaction_type === 'deposit') await client.query('UPDATE cash_bank_accounts SET current_balance = current_balance + $1 WHERE id = $2', [txn.amount, txn.to_account_id]);
            if (txn.transaction_type === 'withdrawal') await client.query('UPDATE cash_bank_accounts SET current_balance = current_balance - $1 WHERE id = $2', [txn.amount, txn.from_account_id]);
            if (txn.transaction_type === 'transfer') {
                await client.query('UPDATE cash_bank_accounts SET current_balance = current_balance - $1 WHERE id = $2', [txn.amount, txn.from_account_id]);
                await client.query('UPDATE cash_bank_accounts SET current_balance = current_balance + $1 WHERE id = $2', [txn.amount, txn.to_account_id]);
            }
        });
        res.json({ ...(await query('SELECT * FROM bank_transactions WHERE id = $1', [req.params.id])).rows[0], message: 'Transaction approved successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to approve transaction' }); }
});

module.exports = router;
