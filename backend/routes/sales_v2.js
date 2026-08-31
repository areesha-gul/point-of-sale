const express = require('express');
const { getDatabase } = require('../database/connection');
const AccountingService = require('../services/accountingService');
const { generateSaleId } = require('../utils/idGenerator');

const router = express.Router();

// Get all sales
router.get('/', (req, res) => {
    try {
        const { status } = req.query;
        const db = getDatabase();
        
        let query = `
            SELECT s.*, c.name as customer_name, c.customer_id, c.current_balance as customer_balance,
                   p.name as product_name, p.product_id
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND s.status = ?';
            params.push(status);
        }

        query += ' ORDER BY s.date DESC, s.id DESC';

        const sales = db.prepare(query).all(...params);
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Get sale by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const sale = db.prepare(`
            SELECT s.*, c.name as customer_name, c.customer_id, c.phone as customer_phone, 
                   c.address as customer_address, c.current_balance as customer_balance,
                   p.name as product_name, p.product_id
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.id = ?
        `).get(req.params.id);
        
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        res.json(sale);
    } catch (error) {
        console.error('Error fetching sale:', error);
        res.status(500).json({ error: 'Failed to fetch sale' });
    }
});

// Create sale (Draft)
router.post('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const { customer_id, product_id, qty_kg, rate, amount_paid = 0, payment_method = 'none', date, notes } = req.body;

        // Validation
        if (!customer_id || !product_id || !qty_kg || !rate || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (qty_kg <= 0 || rate <= 0) {
            return res.status(400).json({ error: 'Quantity and rate must be positive' });
        }

        const total = qty_kg * rate;

        if (amount_paid < 0 || amount_paid > total) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        // Check product stock
        const product = db.prepare('SELECT current_stock, product_id, name FROM products WHERE id = ?').get(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.current_stock < qty_kg) {
            return res.status(400).json({ 
                error: 'Insufficient stock', 
                available: product.current_stock,
                required: qty_kg 
            });
        }

        // Check customer exists
        const customer = db.prepare('SELECT id, customer_id, name, current_balance FROM customers WHERE id = ?').get(customer_id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Generate sale ID
        const saleId = generateSaleId();

        // Insert sale as DRAFT
        const result = db.prepare(`
            INSERT INTO sales (sale_id, customer_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `).run(saleId, customer_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date, notes);

        // Fetch created sale with details
        const sale = db.prepare(`
            SELECT s.*, c.name as customer_name, c.customer_id, c.current_balance as customer_balance,
                   p.name as product_name, p.product_id
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            ...sale,
            message: 'Sale created as draft. Click Approve to finalize.'
        });
    } catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({ error: 'Failed to create sale', message: error.message });
    }
});

// Approve sale
router.post('/:id/approve', (req, res) => {
    const db = getDatabase();
    
    try {
        const saleId = req.params.id;
        const userId = req.session.userId;

        // Get sale details
        const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND status = ?')
            .get(saleId, 'draft');

        if (!sale) {
            return res.status(404).json({ error: 'Sale not found or already approved' });
        }

        // Check stock again before approval
        const product = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(sale.product_id);
        if (product.current_stock < sale.qty_kg) {
            return res.status(400).json({ 
                error: 'Insufficient stock for approval',
                available: product.current_stock,
                required: sale.qty_kg
            });
        }

        // Start transaction
        const transaction = db.transaction(() => {
            // Update sale status
            db.prepare(`
                UPDATE sales 
                SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(userId, saleId);

            // Update product stock
            AccountingService.updateProductAfterSale(sale.product_id, sale.qty_kg);

            // Update customer balance (receivable)
            const unpaidAmount = sale.total - sale.amount_paid;
            if (unpaidAmount > 0) {
                AccountingService.updateCustomerBalance(sale.customer_id, unpaidAmount, 'add');
            }

            // Update cash/bank balance if payment made
            if (sale.amount_paid > 0 && sale.payment_method !== 'none') {
                const accountType = sale.payment_method === 'cash' ? 'cash' : 'bank';
                AccountingService.updateAccountBalance(accountType, sale.amount_paid, 'add');
            }

            // Record ledger entries
            AccountingService.recordSale(sale, saleId);
        });

        transaction();

        // Fetch updated sale
        const updated = db.prepare(`
            SELECT s.*, c.name as customer_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.id = ?
        `).get(saleId);

        res.json({
            ...updated,
            message: 'Sale approved successfully'
        });
    } catch (error) {
        console.error('Error approving sale:', error);
        res.status(500).json({ error: 'Failed to approve sale', message: error.message });
    }
});

// Update sale (only if draft)
router.put('/:id', (req, res) => {
    const db = getDatabase();
    
    try {
        const saleId = req.params.id;
        
        // Check if sale exists and is draft
        const existing = db.prepare('SELECT * FROM sales WHERE id = ? AND status = ?')
            .get(saleId, 'draft');

        if (!existing) {
            return res.status(404).json({ error: 'Sale not found or cannot be edited' });
        }

        const { customer_id, product_id, qty_kg, rate, amount_paid, payment_method, date, notes } = req.body;

        // Calculate total
        const total = (qty_kg || existing.qty_kg) * (rate || existing.rate);

        // Check stock if product or quantity changed
        if (product_id && product_id !== existing.product_id || qty_kg && qty_kg !== existing.qty_kg) {
            const product = db.prepare('SELECT current_stock FROM products WHERE id = ?')
                .get(product_id || existing.product_id);
            
            if (product && product.current_stock < (qty_kg || existing.qty_kg)) {
                return res.status(400).json({ 
                    error: 'Insufficient stock',
                    available: product.current_stock 
                });
            }
        }

        db.prepare(`
            UPDATE sales 
            SET customer_id = ?, product_id = ?, qty_kg = ?, rate = ?, total = ?,
                amount_paid = ?, payment_method = ?, date = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            customer_id || existing.customer_id,
            product_id || existing.product_id,
            qty_kg || existing.qty_kg,
            rate || existing.rate,
            total,
            amount_paid !== undefined ? amount_paid : existing.amount_paid,
            payment_method || existing.payment_method,
            date || existing.date,
            notes || existing.notes,
            saleId
        );

        const updated = db.prepare(`
            SELECT s.*, c.name as customer_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.id = ?
        `).get(saleId);

        res.json(updated);
    } catch (error) {
        console.error('Error updating sale:', error);
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

// Delete/Void sale
router.delete('/:id', (req, res) => {
    const db = getDatabase();
    
    try {
        const saleId = req.params.id;
        
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        if (sale.status === 'draft') {
            // If draft, permanently delete
            db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
            res.json({ message: 'Draft sale deleted successfully' });
        } else if (sale.status === 'approved') {
            // If approved, void it and reverse accounting
            const transaction = db.transaction(() => {
                // Mark as voided
                db.prepare(`
                    UPDATE sales 
                    SET status = 'voided', updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(saleId);

                // Restore stock
                AccountingService.updateProductAfterPurchase(
                    sale.product_id,
                    sale.qty_kg,
                    0 // Don't affect average cost when restoring
                );

                // Reverse customer balance
                const unpaidAmount = sale.total - sale.amount_paid;
                if (unpaidAmount > 0) {
                    AccountingService.updateCustomerBalance(sale.customer_id, unpaidAmount, 'subtract');
                }

                // Reverse cash/bank
                if (sale.amount_paid > 0 && sale.payment_method !== 'none') {
                    const accountType = sale.payment_method === 'cash' ? 'cash' : 'bank';
                    AccountingService.updateAccountBalance(accountType, sale.amount_paid, 'subtract');
                }
            });

            transaction();
            res.json({ message: 'Sale voided successfully' });
        } else {
            res.status(400).json({ error: 'Sale already voided' });
        }
    } catch (error) {
        console.error('Error deleting sale:', error);
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

module.exports = router;
