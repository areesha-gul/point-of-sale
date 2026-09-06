const express = require('express');
const { query } = require('../database/postgres');
const { generateVendorId } = require('../utils/idGenerator');

const router = express.Router();

// Get all vendors
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT * FROM vendors ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

// Get vendor by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
        const vendor = result.rows[0];
        
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
router.post('/', async (req, res) => {
    try {
        const { name, phone, address, opening_balance = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Vendor name is required' });
        }

        const vendorId = await generateVendorId();
        
        const result = await query(
            'INSERT INTO vendors (vendor_id, name, phone, address, opening_balance, current_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [vendorId, name, phone, address, opening_balance, opening_balance]
        );
        const vendor = result.rows[0];
        res.status(201).json(vendor);
    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ error: 'Failed to create vendor' });
    }
});

// Update vendor
router.put('/:id', async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const vendorResult = await query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
        const vendor = vendorResult.rows[0];
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        const updatedResult = await query(
            'UPDATE vendors SET name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name || vendor.name, phone || vendor.phone, address || vendor.address, req.params.id]
        );
        const updated = updatedResult.rows[0];
        res.json(updated);
    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ error: 'Failed to update vendor' });
    }
});

// Get vendor ledger (transaction history)
router.get('/:id/ledger', async (req, res) => {
    try {
        const vendorId = req.params.id;

        const vendorResult = await query('SELECT * FROM vendors WHERE id = $1', [vendorId]);
        const vendor = vendorResult.rows[0];
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
        const purchasesResult = await query(`
            SELECT p.id, p.date, p.total, p.amount_paid, pr.name as product_name
            FROM purchases p
            JOIN products pr ON p.product_id = pr.id
            WHERE p.vendor_id = $1 AND p.voided = 0
            ORDER BY p.date
        `, [vendorId]);
        const purchases = purchasesResult.rows;

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
        const paymentsResult = await query(`
            SELECT id, date, amount, notes
            FROM payments
            WHERE party_type = 'vendor' AND party_id = $1 AND direction = 'out' AND voided = 0
            ORDER BY date
        `, [vendorId]);
        const payments = paymentsResult.rows;

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
        const settlementsResult = await query(`
            SELECT s.id, s.date, s.amount, s.notes, c.name as customer_name
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.vendor_id = $1 AND s.voided = 0
            ORDER BY s.date
        `, [vendorId]);
        const settlements = settlementsResult.rows;

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
