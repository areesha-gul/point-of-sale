const express = require('express');
const { getDatabase } = require('../database/connection');
const AccountingService = require('../services/accountingService');

const router = express.Router();

// Get all purchases
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const purchases = db.prepare(`
            SELECT p.*, v.name as vendor_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.voided = 0
            ORDER BY p.date DESC, p.id DESC
        `).all();
        res.json(purchases);
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ error: 'Failed to fetch purchases' });
    }
});

// Get purchase by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const purchase = db.prepare(`
            SELECT p.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address,
                   pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.id = ?
        `).get(req.params.id);
        
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        
        res.json(purchase);
    } catch (error) {
        console.error('Error fetching purchase:', error);
        res.status(500).json({ error: 'Failed to fetch purchase' });
    }
});

// Create purchase
router.post('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const { vendor_id, product_id, qty_kg, rate, total, amount_paid = 0, payment_method = 'none', date, notes } = req.body;

        // Validation
        if (!vendor_id || !product_id || !qty_kg || !rate || !total || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (qty_kg <= 0 || rate <= 0 || total <= 0) {
            return res.status(400).json({ error: 'Quantity, rate, and total must be positive' });
        }

        if (amount_paid < 0 || amount_paid > total) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        // Check if product exists
        const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if vendor exists
        const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(vendor_id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Start transaction
        const transaction = db.transaction(() => {
            // Insert purchase
            const result = db.prepare(`
                INSERT INTO purchases (vendor_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(vendor_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date, notes);

            const purchaseId = result.lastInsertRowid;

            // Update product stock and average cost
            AccountingService.updateProductAfterPurchase(product_id, qty_kg, rate);

            // Update vendor balance (payable)
            const unpaidAmount = total - amount_paid;
            if (unpaidAmount > 0) {
                AccountingService.updateVendorBalance(vendor_id, unpaidAmount, 'add');
            }

            // Update cash/bank balance if payment made
            if (amount_paid > 0 && payment_method !== 'none') {
                const accountType = payment_method === 'cash' ? 'cash' : 'bank';
                AccountingService.updateAccountBalance(accountType, amount_paid, 'subtract');
            }

            // Record ledger entries
            AccountingService.recordPurchase(req.body, purchaseId);

            return purchaseId;
        });

        const purchaseId = transaction();

        // Fetch created purchase with details
        const purchase = db.prepare(`
            SELECT p.*, v.name as vendor_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.id = ?
        `).get(purchaseId);

        res.status(201).json(purchase);
    } catch (error) {
        console.error('Error creating purchase:', error);
        res.status(500).json({ error: 'Failed to create purchase', message: error.message });
    }
});

module.exports = router;
