const express = require('express');
const { getDatabase } = require('../database/connection');
const { generateCustomerId } = require('../utils/idGenerator');

const router = express.Router();

// Get all customers
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();
        res.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create customer
router.post('/', (req, res) => {
    try {
        const { name, phone, address, opening_balance = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Customer name is required' });
        }

        const db = getDatabase();
        const customerId = generateCustomerId();
        
        const result = db.prepare(
            'INSERT INTO customers (customer_id, name, phone, address, opening_balance, current_balance) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(customerId, name, phone, address, opening_balance, opening_balance);

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(customer);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
router.put('/:id', (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const db = getDatabase();

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        db.prepare(
            'UPDATE customers SET name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(name || customer.name, phone || customer.phone, address || customer.address, req.params.id);

        const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Get customer ledger (transaction history)
router.get('/:id/ledger', (req, res) => {
    try {
        const db = getDatabase();
        const customerId = req.params.id;

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const transactions = [];

        // Add opening balance if non-zero
        if (customer.opening_balance > 0) {
            transactions.push({
                date: customer.created_at,
                type: 'opening',
                description: 'Opening Balance',
                debit: customer.opening_balance,
                credit: 0,
                balance: customer.opening_balance
            });
        }

        // Get sales
        const sales = db.prepare(`
            SELECT s.id, s.date, s.total, s.amount_paid, p.name as product_name
            FROM sales s
            JOIN products p ON s.product_id = p.id
            WHERE s.customer_id = ? AND s.voided = 0
            ORDER BY s.date
        `).all(customerId);

        sales.forEach(sale => {
            const receivable = sale.total - sale.amount_paid;
            if (receivable > 0) {
                transactions.push({
                    date: sale.date,
                    type: 'sale',
                    description: `Sale - ${sale.product_name}`,
                    ref_id: sale.id,
                    debit: receivable,
                    credit: 0
                });
            }
        });

        // Get payments
        const payments = db.prepare(`
            SELECT id, date, amount, notes
            FROM payments
            WHERE party_type = 'customer' AND party_id = ? AND direction = 'in' AND voided = 0
            ORDER BY date
        `).all(customerId);

        payments.forEach(payment => {
            transactions.push({
                date: payment.date,
                type: 'payment',
                description: payment.notes || 'Payment Received',
                ref_id: payment.id,
                debit: 0,
                credit: payment.amount
            });
        });

        // Get settlements
        const settlements = db.prepare(`
            SELECT s.id, s.date, s.amount, s.notes, v.name as vendor_name
            FROM settlements s
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.customer_id = ? AND s.voided = 0
            ORDER BY s.date
        `).all(customerId);

        settlements.forEach(settlement => {
            transactions.push({
                date: settlement.date,
                type: 'settlement',
                description: `Direct Settlement to ${settlement.vendor_name}`,
                ref_id: settlement.id,
                debit: 0,
                credit: settlement.amount
            });
        });

        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        transactions.forEach(txn => {
            balance += txn.debit - txn.credit;
            txn.balance = balance;
        });

        res.json({
            customer,
            transactions,
            currentBalance: customer.current_balance
        });
    } catch (error) {
        console.error('Error fetching customer ledger:', error);
        res.status(500).json({ error: 'Failed to fetch customer ledger' });
    }
});

module.exports = router;
