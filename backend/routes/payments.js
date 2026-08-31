const express = require('express');
const { getDatabase } = require('../database/connection');
const AccountingService = require('../services/accountingService');

const router = express.Router();

// Get all payments
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const payments = db.prepare(`
            SELECT p.*, 
                CASE 
                    WHEN p.party_type = 'customer' THEN c.name
                    WHEN p.party_type = 'vendor' THEN v.name
                END as party_name
            FROM payments p
            LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
            LEFT JOIN vendors v ON p.party_type = 'vendor' AND p.party_id = v.id
            WHERE p.voided = 0
            ORDER BY p.date DESC, p.id DESC
        `).all();
        res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Get payment by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const payment = db.prepare(`
            SELECT p.*, 
                CASE 
                    WHEN p.party_type = 'customer' THEN c.name
                    WHEN p.party_type = 'vendor' THEN v.name
                END as party_name
            FROM payments p
            LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
            LEFT JOIN vendors v ON p.party_type = 'vendor' AND p.party_id = v.id
            WHERE p.id = ?
        `).get(req.params.id);
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        res.json(payment);
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ error: 'Failed to fetch payment' });
    }
});

// Create payment
router.post('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const { party_type, party_id, amount, method, direction, date, notes } = req.body;

        // Validation
        if (!party_type || !party_id || !amount || !method || !direction || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['customer', 'vendor'].includes(party_type)) {
            return res.status(400).json({ error: 'Invalid party type' });
        }

        if (!['cash', 'bank'].includes(method)) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }

        if (!['in', 'out'].includes(direction)) {
            return res.status(400).json({ error: 'Invalid direction' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        // Verify party exists and get balance
        const partyTable = party_type === 'customer' ? 'customers' : 'vendors';
        const party = db.prepare(`SELECT current_balance FROM ${partyTable} WHERE id = ?`).get(party_id);
        if (!party) {
            return res.status(404).json({ error: `${party_type} not found` });
        }

        // Check if payment exceeds balance (warning, but allow)
        if (amount > party.current_balance && party.current_balance > 0) {
            // Allow but could add warning in response
        }

        // For outgoing payments, check if sufficient cash/bank balance
        if (direction === 'out') {
            const account = db.prepare('SELECT current_balance FROM cash_bank_accounts WHERE type = ?').get(method);
            if (account && amount > account.current_balance) {
                return res.status(400).json({ 
                    error: 'Insufficient balance', 
                    available: account.current_balance 
                });
            }
        }

        // Start transaction
        const transaction = db.transaction(() => {
            // Insert payment
            const result = db.prepare(`
                INSERT INTO payments (party_type, party_id, amount, method, direction, date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(party_type, party_id, amount, method, direction, date, notes);

            const paymentId = result.lastInsertRowid;

            // Update party balance
            if (party_type === 'customer' && direction === 'in') {
                AccountingService.updateCustomerBalance(party_id, amount, 'subtract');
            } else if (party_type === 'vendor' && direction === 'out') {
                AccountingService.updateVendorBalance(party_id, amount, 'subtract');
            }

            // Update cash/bank balance
            const accountType = method;
            if (direction === 'in') {
                AccountingService.updateAccountBalance(accountType, amount, 'add');
            } else {
                AccountingService.updateAccountBalance(accountType, amount, 'subtract');
            }

            // Record ledger entries
            AccountingService.recordPayment(req.body, paymentId);

            return paymentId;
        });

        const paymentId = transaction();

        // Fetch created payment with details
        const payment = db.prepare(`
            SELECT p.*, 
                CASE 
                    WHEN p.party_type = 'customer' THEN c.name
                    WHEN p.party_type = 'vendor' THEN v.name
                END as party_name
            FROM payments p
            LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
            LEFT JOIN vendors v ON p.party_type = 'vendor' AND p.party_id = v.id
            WHERE p.id = ?
        `).get(paymentId);

        res.status(201).json(payment);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Failed to create payment', message: error.message });
    }
});

module.exports = router;
