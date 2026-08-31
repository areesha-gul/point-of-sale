const express = require('express');
const { getDatabase } = require('../database/connection');
const { generateProductId } = require('../utils/idGenerator');

const router = express.Router();

// Get all products
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const products = db.prepare('SELECT * FROM products ORDER BY name').all();
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get product by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Create product
router.post('/', (req, res) => {
    try {
        const { name, unit = 'KG', current_stock = 0, avg_cost = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Product name is required' });
        }

        const db = getDatabase();
        const productId = generateProductId();
        
        const result = db.prepare(
            'INSERT INTO products (product_id, name, unit, current_stock, avg_cost) VALUES (?, ?, ?, ?, ?)'
        ).run(productId, name, unit, current_stock, avg_cost);

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(product);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Product with this name already exists' });
        }
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:id', (req, res) => {
    try {
        const { name, unit } = req.body;
        const db = getDatabase();

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        db.prepare(
            'UPDATE products SET name = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(name || product.name, unit || product.unit, req.params.id);

        const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        res.json(updated);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Get product stock movements
router.get('/:id/movements', (req, res) => {
    try {
        const db = getDatabase();
        
        // Get purchases (stock in)
        const purchases = db.prepare(`
            SELECT 'purchase' as type, p.id, p.qty_kg, p.rate, p.date, v.name as party_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            WHERE p.product_id = ? AND p.voided = 0
        `).all(req.params.id);

        // Get sales (stock out)
        const sales = db.prepare(`
            SELECT 'sale' as type, s.id, s.qty_kg, s.rate, s.date, c.name as party_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.product_id = ? AND s.voided = 0
        `).all(req.params.id);

        // Combine and sort by date
        const movements = [...purchases, ...sales].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        res.json(movements);
    } catch (error) {
        console.error('Error fetching stock movements:', error);
        res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
});

module.exports = router;
