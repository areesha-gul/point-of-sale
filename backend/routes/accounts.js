const express = require('express');
const { getDatabase } = require('../database/connection');

const router = express.Router();

// Get all cash and bank accounts
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const accounts = db.prepare('SELECT * FROM cash_bank_accounts ORDER BY type, name').all();
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Get account transactions
router.get('/:id/transactions', (req, res) => {
    try {
        const db = getDatabase();
        const accountId = req.params.id;

        const account = db.prepare('SELECT * FROM cash_bank_accounts WHERE id = ?').get(accountId);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const transactions = [];

        // Get sales with cash/bank payment
        const sales = db.prepare(`
            SELECT s.id, s.date, s.amount_paid as amount, 'sale' as type, 
                   c.name as party_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.payment_method = ? AND s.amount_paid > 0 AND s.voided = 0
            ORDER BY s.date
        `).all(account.type);

        sales.forEach(sale => {
            transactions.push({
                ...sale,
                direction: 'in',
                description: `Sale to ${sale.party_name} - ${sale.product_name}`
            });
        });

        // Get purchases with cash/bank payment
        const purchases = db.prepare(`
            SELECT p.id, p.date, p.amount_paid as amount, 'purchase' as type,
                   v.name as party_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.payment_method = ? AND p.amount_paid > 0 AND p.voided = 0
            ORDER BY p.date
        `).all(account.type);

        purchases.forEach(purchase => {
            transactions.push({
                ...purchase,
                direction: 'out',
                description: `Purchase from ${purchase.party_name} - ${purchase.product_name}`
            });
        });

        // Get regular payments
        const payments = db.prepare(`
            SELECT p.id, p.date, p.amount, p.direction, p.party_type, p.notes,
                   CASE 
                       WHEN p.party_type = 'customer' THEN c.name
                       WHEN p.party_type = 'vendor' THEN v.name
                   END as party_name
            FROM payments p
            LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
            LEFT JOIN vendors v ON p.party_type = 'vendor' AND p.party_id = v.id
            WHERE p.method = ? AND p.voided = 0
            ORDER BY p.date
        `).all(account.type);

        payments.forEach(payment => {
            transactions.push({
                ...payment,
                type: 'payment',
                description: payment.notes || `Payment ${payment.direction === 'in' ? 'from' : 'to'} ${payment.party_name}`
            });
        });

        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        transactions.forEach(txn => {
            if (txn.direction === 'in') {
                balance += txn.amount;
            } else {
                balance -= txn.amount;
            }
            txn.balance = balance;
        });

        res.json({
            account,
            transactions,
            currentBalance: account.current_balance
        });
    } catch (error) {
        console.error('Error fetching account transactions:', error);
        res.status(500).json({ error: 'Failed to fetch account transactions' });
    }
});

module.exports = router;
