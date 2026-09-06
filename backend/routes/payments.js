const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const AccountingService = require('../services/accountingService');
const { generatePaymentId } = require('../utils/idGenerator');

const router = express.Router();

// Get all payments
router.get('/', async (req, res) => {
    try {
        const result = await query(`
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
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query(`
            SELECT p.*, 
                CASE 
                    WHEN p.party_type = 'customer' THEN c.name
                    WHEN p.party_type = 'vendor' THEN v.name
                END as party_name
            FROM payments p
            LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
            LEFT JOIN vendors v ON p.party_type = 'vendor' AND p.party_id = v.id
            WHERE p.id = $1
        `, [req.params.id]);
        const payment = result.rows[0];
        
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
router.post('/', async (req, res) => {
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
        const partyResult = await query(`SELECT current_balance FROM ${partyTable} WHERE id = $1`, [party_id]);
        const party = partyResult.rows[0];
        if (!party) {
            return res.status(404).json({ error: `${party_type} not found` });
        }

        // Check if payment exceeds balance (warning, but allow)
        if (amount > party.current_balance && party.current_balance > 0) {
            // Allow but could add warning in response
        }

        // For outgoing payments, check if sufficient cash/bank balance
        if (direction === 'out') {
            const accountResult = await query('SELECT current_balance FROM cash_bank_accounts WHERE type = $1', [method]);
            const account = accountResult.rows[0];
            if (account && amount > account.current_balance) {
                return res.status(400).json({ 
                    error: 'Insufficient balance', 
                    available: account.current_balance 
                });
            }
        }

        // Start transaction
        const paymentId = await withTransaction(async (client) => {
            const generatedPaymentId = await generatePaymentId();
            // Insert payment
            const result = await client.query(`
                INSERT INTO payments (payment_id, party_type, party_id, amount, method, direction, date, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
            `, [generatedPaymentId, party_type, party_id, amount, method, direction, date, notes]);
            const databasePaymentId = result.rows[0].id;

            // Update party balance
            if (party_type === 'customer' && direction === 'in') {
                await AccountingService.updateCustomerBalance(party_id, amount, 'subtract', client);
            } else if (party_type === 'vendor' && direction === 'out') {
                await AccountingService.updateVendorBalance(party_id, amount, 'subtract', client);
            }

            // Update cash/bank balance
            const accountType = method;
            if (direction === 'in') {
                await AccountingService.updateAccountBalance(accountType, amount, 'add', client);
            } else {
                await AccountingService.updateAccountBalance(accountType, amount, 'subtract', client);
            }

            // Record ledger entries
            await AccountingService.recordPayment(req.body, databasePaymentId, client);

            return databasePaymentId;
        });

        // Fetch created payment with details
        const paymentResult = await query(`
            SELECT p.*, 
                CASE 
                    WHEN p.party_type = 'customer' THEN c.name
                    WHEN p.party_type = 'vendor' THEN v.name
                END as party_name
            FROM payments p
            LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
            LEFT JOIN vendors v ON p.party_type = 'vendor' AND p.party_id = v.id
            WHERE p.id = $1
        `, [paymentId]);
        const payment = paymentResult.rows[0];

        res.status(201).json(payment);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Failed to create payment', message: error.message });
    }
});

module.exports = router;
