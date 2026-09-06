const express = require('express');
const { query } = require('../database/postgres');
const { generateProductId } = require('../utils/idGenerator');

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT * FROM products ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get product by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        const product = result.rows[0];
        
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
router.post('/', async (req, res) => {
    try {
        const { name, unit = 'KG', current_stock = 0, avg_cost = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Product name is required' });
        }

        const productId = await generateProductId();
        
        const result = await query(
            'INSERT INTO products (product_id, name, unit, current_stock, avg_cost) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [productId, name, unit, current_stock, avg_cost]
        );
        const product = result.rows[0];
        res.status(201).json(product);
    } catch (error) {
        if (error.code === '23505' || error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Product with this name already exists' });
        }
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:id', async (req, res) => {
    try {
        const { name, unit } = req.body;
        const productResult = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        const product = productResult.rows[0];
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updatedResult = await query(
            'UPDATE products SET name = $1, unit = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [name || product.name, unit || product.unit, req.params.id]
        );
        const updated = updatedResult.rows[0];
        res.json(updated);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!(await query('SELECT id FROM products WHERE id = $1', [req.params.id])).rows[0]) return res.status(404).json({ error: 'Product not found' });
        const sales = (await query('SELECT COUNT(*) AS count FROM sales WHERE product_id = $1', [req.params.id])).rows[0].count;
        const purchases = (await query('SELECT COUNT(*) AS count FROM purchases WHERE product_id = $1', [req.params.id])).rows[0].count;
        if (Number(sales) || Number(purchases)) return res.status(409).json({ error: 'This product has transaction history and cannot be deleted.' });
        await query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete product' }); }
});

// Get product stock movements
router.get('/:id/movements', async (req, res) => {
    try {
        // Get purchases (stock in)
        const purchasesResult = await query(`
            SELECT 'purchase' as type, p.id, p.qty_kg, p.rate, p.date, v.name as party_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            WHERE p.product_id = $1 AND p.voided = 0
        `, [req.params.id]);
        const purchases = purchasesResult.rows;

        // Get sales (stock out)
        const salesResult = await query(`
            SELECT 'sale' as type, s.id, s.qty_kg, s.rate, s.date, c.name as party_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            WHERE s.product_id = $1 AND s.voided = 0
        `, [req.params.id]);
        const sales = salesResult.rows;

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
