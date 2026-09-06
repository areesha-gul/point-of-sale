const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const AccountingService = require('../services/accountingService');
const { generateExpenseId } = require('../utils/idGenerator');

const router = express.Router();

// Get all expenses
router.get('/', async (req, res) => {
    try {
        const result = await query(`
            SELECT e.*, ba.name as bank_account_name
            FROM expenses e
            LEFT JOIN cash_bank_accounts ba ON e.bank_account_id = ba.id
            ORDER BY e.date DESC, e.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Create expense
router.post('/', async (req, res) => {
    try {
        const { category, description, amount, method, bank_account_id = null, date, notes } = req.body;
        
        if (!category || !description || !amount || !method || !date) {
            return res.status(400).json({ error: 'Category, description, amount, method, and date are required' });
        }

        if (!['cash', 'bank'].includes(method) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Enter a valid amount and method' });
        }

        if (method === 'bank' && !bank_account_id) {
            return res.status(400).json({ error: 'Select the bank account used for this expense' });
        }

        if (bank_account_id) {
            const accountCheck = await query("SELECT id FROM cash_bank_accounts WHERE id = $1 AND type = 'bank' AND is_active = 1", [bank_account_id]);
            if (!accountCheck.rows[0]) {
                return res.status(400).json({ error: 'Selected bank account was not found' });
            }
        }

        const result = await withTransaction(async (client) => {
            const expenseId = await generateExpenseId();
            
            const inserted = await client.query(`
                INSERT INTO expenses (expense_id, category, description, amount, method, bank_account_id, date, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
            `, [expenseId, category, description, amount, method, bank_account_id, date, notes]);

            // Update account balance (subtract expense)
            await AccountingService.updateAccountBalance(method, amount, 'subtract', client, bank_account_id);

            return inserted.rows[0];
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Failed to record expense' });
    }
});

// Delete expense
router.delete('/:id', async (req, res) => {
    try {
        const expense = (await query('SELECT * FROM expenses WHERE id = $1', [req.params.id])).rows[0];
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        await withTransaction(async (client) => {
            // Restore account balance
            await AccountingService.updateAccountBalance(expense.method, expense.amount, 'add', client, expense.bank_account_id);
            
            // Delete expense
            await client.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
        });

        res.json({ message: 'Expense deleted and balance restored' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

module.exports = router;
