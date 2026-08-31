const express = require('express');
const { getDatabase } = require('../database/connection');
const AccountingService = require('../services/accountingService');

const router = express.Router();

// Get all sales
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const sales = db.prepare(`
            SELECT s.*, c.name as customer_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.voided = 0
            ORDER BY s.date DESC, s.id DESC
        `).all();
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
            SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                   p.name as product_name
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

// Create sale
router.post('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const { customer_id, product_id, qty_kg, rate, total, amount_paid = 0, payment_method = 'none', date, notes } = req.body;

        // Validation
        if (!customer_id || !product_id || !qty_kg || !rate || !total || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (qty_kg <= 0 || rate <= 0 || total <= 0) {
            return res.status(400).json({ error: 'Quantity, rate, and total must be positive' });
        }

        if (amount_paid < 0 || amount_paid > total) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        // Check product stock
        const product = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(product_id);
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

        // Start transaction
        const transaction = db.transaction(() => {
            // Insert sale
            const result = db.prepare(`
                INSERT INTO sales (customer_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(customer_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date, notes);

            const saleId = result.lastInsertRowid;

            // Update product stock
            AccountingService.updateProductAfterSale(product_id, qty_kg);

            // Update customer balance (receivable)
            const unpaidAmount = total - amount_paid;
            if (unpaidAmount > 0) {
                AccountingService.updateCustomerBalance(customer_id, unpaidAmount, 'add');
            }

            // Update cash/bank balance if payment made
            if (amount_paid > 0 && payment_method !== 'none') {
                const accountType = payment_method === 'cash' ? 'cash' : 'bank';
                AccountingService.updateAccountBalance(accountType, amount_paid, 'add');
            }

            // Record ledger entries
            AccountingService.recordSale(req.body, saleId);

            return saleId;
        });

        const saleId = transaction();

        // Fetch created sale with details
        const sale = db.prepare(`
            SELECT s.*, c.name as customer_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.id = ?
        `).get(saleId);

        res.status(201).json(sale);
    } catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({ error: 'Failed to create sale', message: error.message });
    }
});

module.exports = router;
