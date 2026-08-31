const express = require('express');
const { getDatabase } = require('../database/connection');
const AccountingService = require('../services/accountingService');
const { generatePurchaseId } = require('../utils/idGenerator');

const router = express.Router();

// Get all purchases
router.get('/', (req, res) => {
    try {
        const { status } = req.query;
        const db = getDatabase();
        
        let query = `
            SELECT p.*, v.name as vendor_name, v.vendor_id, v.current_balance as vendor_balance,
                   pr.name as product_name, pr.product_id,
                   ba.name as bank_account_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            LEFT JOIN cash_bank_accounts ba ON p.bank_account_id = ba.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }

        query += ' ORDER BY p.date DESC, p.id DESC';

        const purchases = db.prepare(query).all(...params);
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
            SELECT p.*, v.name as vendor_name, v.vendor_id, v.phone as vendor_phone, 
                   v.address as vendor_address, v.current_balance as vendor_balance,
                   pr.name as product_name, pr.product_id,
                   ba.name as bank_account_name, ba.account_id
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            LEFT JOIN cash_bank_accounts ba ON p.bank_account_id = ba.id
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

// Create purchase (Draft)
router.post('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const { 
            vendor_id, 
            product_id, 
            qty_kg, 
            rate, 
            freight_charges = 0,
            other_charges = 0,
            amount_paid = 0, 
            payment_method = 'none',
            bank_account_id,
            date, 
            notes,
            is_direct_delivery = 0
        } = req.body;

        // Validation
        if (!vendor_id || !product_id || !qty_kg || !rate || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (qty_kg <= 0 || rate <= 0) {
            return res.status(400).json({ error: 'Quantity and rate must be positive' });
        }

        if (amount_paid < 0) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        // Check if product and vendor exist
        const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const vendor = db.prepare('SELECT id, current_balance FROM vendors WHERE id = ?').get(vendor_id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Calculate totals
        const total = qty_kg * rate;
        const grand_total = total + freight_charges + other_charges;

        if (amount_paid > grand_total) {
            return res.status(400).json({ error: 'Payment amount cannot exceed grand total' });
        }

        // Generate purchase ID
        const purchaseId = generatePurchaseId();

        // Insert purchase as DRAFT
        const result = db.prepare(`
            INSERT INTO purchases (
                purchase_id, vendor_id, product_id, qty_kg, rate, total, 
                freight_charges, other_charges, grand_total,
                amount_paid, payment_method, bank_account_id, date, notes,
                is_direct_delivery, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `).run(
            purchaseId, vendor_id, product_id, qty_kg, rate, total,
            freight_charges, other_charges, grand_total,
            amount_paid, payment_method, bank_account_id, date, notes,
            is_direct_delivery
        );

        // Fetch created purchase with details
        const purchase = db.prepare(`
            SELECT p.*, v.name as vendor_name, v.vendor_id, v.current_balance as vendor_balance,
                   pr.name as product_name, pr.product_id
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            ...purchase,
            message: 'Purchase created as draft. Click Approve to finalize.'
        });
    } catch (error) {
        console.error('Error creating purchase:', error);
        res.status(500).json({ error: 'Failed to create purchase', message: error.message });
    }
});

// Approve purchase
router.post('/:id/approve', (req, res) => {
    const db = getDatabase();
    
    try {
        const purchaseId = req.params.id;
        const userId = req.session.userId;

        // Get purchase details
        const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND status = ?')
            .get(purchaseId, 'draft');

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found or already approved' });
        }

        // Start transaction
        const transaction = db.transaction(() => {
            // Update purchase status
            db.prepare(`
                UPDATE purchases 
                SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(userId, purchaseId);

            // Update product stock and average cost
            AccountingService.updateProductAfterPurchase(
                purchase.product_id, 
                purchase.qty_kg, 
                purchase.rate
            );

            // Update vendor balance (payable)
            const unpaidAmount = purchase.grand_total - purchase.amount_paid;
            if (unpaidAmount > 0) {
                AccountingService.updateVendorBalance(purchase.vendor_id, unpaidAmount, 'add');
            }

            // Update cash/bank balance if payment made
            if (purchase.amount_paid > 0 && purchase.payment_method !== 'none') {
                if (purchase.payment_method === 'bank' && purchase.bank_account_id) {
                    // Update specific bank account
                    db.prepare(`
                        UPDATE cash_bank_accounts 
                        SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `).run(purchase.amount_paid, purchase.bank_account_id);
                } else {
                    // Update cash
                    const accountType = purchase.payment_method === 'cash' ? 'cash' : 'bank';
                    AccountingService.updateAccountBalance(accountType, purchase.amount_paid, 'subtract');
                }
            }

            // Record ledger entries
            AccountingService.recordPurchase(purchase, purchaseId);
        });

        transaction();

        // Fetch updated purchase
        const updated = db.prepare(`
            SELECT p.*, v.name as vendor_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.id = ?
        `).get(purchaseId);

        res.json({
            ...updated,
            message: 'Purchase approved successfully'
        });
    } catch (error) {
        console.error('Error approving purchase:', error);
        res.status(500).json({ error: 'Failed to approve purchase', message: error.message });
    }
});

// Update purchase (only if draft)
router.put('/:id', (req, res) => {
    const db = getDatabase();
    
    try {
        const purchaseId = req.params.id;
        
        // Check if purchase exists and is draft
        const existing = db.prepare('SELECT * FROM purchases WHERE id = ? AND status = ?')
            .get(purchaseId, 'draft');

        if (!existing) {
            return res.status(404).json({ error: 'Purchase not found or cannot be edited' });
        }

        const { 
            vendor_id, product_id, qty_kg, rate, 
            freight_charges, other_charges,
            amount_paid, payment_method, bank_account_id, date, notes 
        } = req.body;

        // Calculate totals
        const total = qty_kg * rate;
        const grand_total = total + (freight_charges || 0) + (other_charges || 0);

        db.prepare(`
            UPDATE purchases 
            SET vendor_id = ?, product_id = ?, qty_kg = ?, rate = ?, total = ?,
                freight_charges = ?, other_charges = ?, grand_total = ?,
                amount_paid = ?, payment_method = ?, bank_account_id = ?, date = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            vendor_id || existing.vendor_id,
            product_id || existing.product_id,
            qty_kg || existing.qty_kg,
            rate || existing.rate,
            total,
            freight_charges !== undefined ? freight_charges : existing.freight_charges,
            other_charges !== undefined ? other_charges : existing.other_charges,
            grand_total,
            amount_paid !== undefined ? amount_paid : existing.amount_paid,
            payment_method || existing.payment_method,
            bank_account_id || existing.bank_account_id,
            date || existing.date,
            notes || existing.notes,
            purchaseId
        );

        const updated = db.prepare(`
            SELECT p.*, v.name as vendor_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.id = ?
        `).get(purchaseId);

        res.json(updated);
    } catch (error) {
        console.error('Error updating purchase:', error);
        res.status(500).json({ error: 'Failed to update purchase' });
    }
});

// Delete/Void purchase
router.delete('/:id', (req, res) => {
    const db = getDatabase();
    
    try {
        const purchaseId = req.params.id;
        
        const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
        
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }

        if (purchase.status === 'draft') {
            // If draft, permanently delete
            db.prepare('DELETE FROM purchases WHERE id = ?').run(purchaseId);
            res.json({ message: 'Draft purchase deleted successfully' });
        } else if (purchase.status === 'approved') {
            // If approved, void it and reverse accounting
            const transaction = db.transaction(() => {
                // Mark as voided
                db.prepare(`
                    UPDATE purchases 
                    SET status = 'voided', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(purchaseId);

                // Reverse stock
                AccountingService.updateProductAfterSale(
                    purchase.product_id,
                    purchase.qty_kg
                );

                // Reverse vendor balance
                const unpaidAmount = purchase.grand_total - purchase.amount_paid;
                if (unpaidAmount > 0) {
                    AccountingService.updateVendorBalance(purchase.vendor_id, unpaidAmount, 'subtract');
                }

                // Reverse cash/bank
                if (purchase.amount_paid > 0 && purchase.payment_method !== 'none') {
                    if (purchase.payment_method === 'bank' && purchase.bank_account_id) {
                        db.prepare(`
                            UPDATE cash_bank_accounts 
                            SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        `).run(purchase.amount_paid, purchase.bank_account_id);
                    } else {
                        const accountType = purchase.payment_method === 'cash' ? 'cash' : 'bank';
                        AccountingService.updateAccountBalance(accountType, purchase.amount_paid, 'add');
                    }
                }
            });

            transaction();
            res.json({ message: 'Purchase voided successfully' });
        } else {
            res.status(400).json({ error: 'Purchase already voided' });
        }
    } catch (error) {
        console.error('Error deleting purchase:', error);
        res.status(500).json({ error: 'Failed to delete purchase' });
    }
});

module.exports = router;
