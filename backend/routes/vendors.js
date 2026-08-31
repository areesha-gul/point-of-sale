const express = require('express');
const { getDatabase } = require('../database/connection');
const { generateVendorId } = require('../utils/idGenerator');

const router = express.Router();

// Get all vendors
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const vendors = db.prepare('SELECT * FROM vendors ORDER BY name').all();
        res.json(vendors);
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

// Get vendor by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
        
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        
        res.json(vendor);
    } catch (error) {
        console.error('Error fetching vendor:', error);
        res.status(500).json({ error: 'Failed to fetch vendor' });
    }
});

// Create vendor
router.post('/', (req, res) => {
    try {
        const { name, phone, address, opening_balance = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Vendor name is required' });
        }

        const db = getDatabase();
        const vendorId = generateVendorId();
        
        const result = db.prepare(
            'INSERT INTO vendors (vendor_id, name, phone, address, opening_balance, current_balance) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(vendorId, name, phone, address, opening_balance, opening_balance);

        const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(vendor);
    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ error: 'Failed to create vendor' });
    }
});

// Update vendor
router.put('/:id', (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const db = getDatabase();

        const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        db.prepare(
            'UPDATE vendors SET name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(name || vendor.name, phone || vendor.phone, address || vendor.address, req.params.id);

        const updated = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ error: 'Failed to update vendor' });
    }
});

// Get vendor ledger (transaction history)
router.get('/:id/ledger', (req, res) => {
    try {
        const db = getDatabase();
        const vendorId = req.params.id;

        const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        const transactions = [];

        // Add opening balance if non-zero
        if (vendor.opening_balance > 0) {
            transactions.push({
                date: vendor.created_at,
                type: 'opening',
                description: 'Opening Balance',
                debit: 0,
                credit: vendor.opening_balance,
                balance: vendor.opening_balance
            });
        }

        // Get purchases
        const purchases = db.prepare(`
            SELECT p.id, p.date, p.total, p.amount_paid, pr.name as product_name
            FROM purchases p
            JOIN products pr ON p.product_id = pr.id
            WHERE p.vendor_id = ? AND p.voided = 0
            ORDER BY p.date
        `).all(vendorId);

        purchases.forEach(purchase => {
            const payable = purchase.total - purchase.amount_paid;
            if (payable > 0) {
                transactions.push({
                    date: purchase.date,
                    type: 'purchase',
                    description: `Purchase - ${purchase.product_name}`,
                    ref_id: purchase.id,
                    debit: 0,
                    credit: payable
                });
            }
        });

        // Get payments
        const payments = db.prepare(`
            SELECT id, date, amount, notes
            FROM payments
            WHERE party_type = 'vendor' AND party_id = ? AND direction = 'out' AND voided = 0
            ORDER BY date
        `).all(vendorId);

        payments.forEach(payment => {
            transactions.push({
                date: payment.date,
                type: 'payment',
                description: payment.notes || 'Payment Made',
                ref_id: payment.id,
                debit: payment.amount,
                credit: 0
            });
        });

        // Get settlements
        const settlements = db.prepare(`
            SELECT s.id, s.date, s.amount, s.notes, c.name as customer_name
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.vendor_id = ? AND s.voided = 0
            ORDER BY s.date
        `).all(vendorId);

        settlements.forEach(settlement => {
            transactions.push({
                date: settlement.date,
                type: 'settlement',
                description: `Direct Settlement from ${settlement.customer_name}`,
                ref_id: settlement.id,
                debit: settlement.amount,
                credit: 0
            });
        });

        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        transactions.forEach(txn => {
            balance += txn.credit - txn.debit;
            txn.balance = balance;
        });

        res.json({
            vendor,
            transactions,
            currentBalance: vendor.current_balance
        });
    } catch (error) {
        console.error('Error fetching vendor ledger:', error);
        res.status(500).json({ error: 'Failed to fetch vendor ledger' });
    }
});

module.exports = router;
