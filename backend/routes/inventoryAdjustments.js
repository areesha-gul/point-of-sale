const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const { generateAdjustmentId } = require('../utils/idGenerator');

const router = express.Router();

// Get all inventory adjustments
router.get('/', async (req, res) => {
    try {
        const { product_id } = req.query;
        let sql = `
            SELECT ia.*, p.name AS product_name, p.product_id, p.current_stock
            FROM inventory_adjustments ia
            JOIN products p ON ia.product_id = p.id
            WHERE 1 = 1
        `;
        const params = [];
        
        if (product_id) {
            params.push(product_id);
            sql += ` AND ia.product_id = $${params.length}`;
        }
        
        sql += ' ORDER BY ia.date DESC, ia.id DESC';
        
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching inventory adjustments:', error);
        res.status(500).json({ error: 'Failed to fetch inventory adjustments' });
    }
});

// Get single adjustment
router.get('/:id', async (req, res) => {
    try {
        const result = await query(`
            SELECT ia.*, p.name AS product_name, p.product_id
            FROM inventory_adjustments ia
            JOIN products p ON ia.product_id = p.id
            WHERE ia.id = $1
        `, [req.params.id]);
        
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'Inventory adjustment not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching inventory adjustment:', error);
        res.status(500).json({ error: 'Failed to fetch inventory adjustment' });
    }
});

// Create inventory adjustment
router.post('/', async (req, res) => {
    try {
        const { product_id, adjustment_type, quantity_kg, reason, description, date } = req.body;
        
        // Validation
        if (!product_id || !adjustment_type || !quantity_kg || !reason || !date) {
            return res.status(400).json({ error: 'Product, adjustment type, quantity, reason, and date are required' });
        }
        
        if (!['increase', 'decrease'].includes(adjustment_type)) {
            return res.status(400).json({ error: 'Adjustment type must be either increase or decrease' });
        }
        
        if (Number(quantity_kg) <= 0) {
            return res.status(400).json({ error: 'Quantity must be positive' });
        }
        
        const validReasons = ['Scale Gain', 'Scale Loss', 'Moisture Loss', 'Damaged Grain', 'Stock Count Correction', 'Other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ error: 'Invalid reason' });
        }
        
        // Check if product exists
        const productCheck = await query('SELECT id, current_stock, name FROM products WHERE id = $1', [product_id]);
        if (!productCheck.rows[0]) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = productCheck.rows[0];
        
        // Check if decreasing more than available stock
        if (adjustment_type === 'decrease' && Number(product.current_stock) < Number(quantity_kg)) {
            return res.status(400).json({ 
                error: `Cannot decrease by ${quantity_kg} KG. Only ${product.current_stock} KG available in stock.` 
            });
        }
        
        const result = await withTransaction(async (client) => {
            const adjustmentId = await generateAdjustmentId();
            
            // Create adjustment record
            const inserted = await client.query(`
                INSERT INTO inventory_adjustments 
                (adjustment_id, product_id, adjustment_type, quantity_kg, reason, description, date, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [adjustmentId, product_id, adjustment_type, quantity_kg, reason, description, date, req.user?.id || null]);
            
            // Update product stock
            const stockChange = adjustment_type === 'increase' ? quantity_kg : -quantity_kg;
            await client.query(`
                UPDATE products 
                SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [stockChange, product_id]);
            
            return inserted.rows[0];
        });
        
        // Fetch full details
        const fullRecord = await query(`
            SELECT ia.*, p.name AS product_name, p.product_id, p.current_stock
            FROM inventory_adjustments ia
            JOIN products p ON ia.product_id = p.id
            WHERE ia.id = $1
        `, [result.id]);
        
        res.status(201).json({ 
            ...fullRecord.rows[0], 
            message: `Stock ${adjustment_type === 'increase' ? 'increased' : 'decreased'} successfully` 
        });
    } catch (error) {
        console.error('Error creating inventory adjustment:', error);
        res.status(500).json({ error: 'Failed to create inventory adjustment', message: error.message });
    }
});

// Delete inventory adjustment (reverse it)
router.delete('/:id', async (req, res) => {
    try {
        const adjustment = (await query('SELECT * FROM inventory_adjustments WHERE id = $1', [req.params.id])).rows[0];
        
        if (!adjustment) {
            return res.status(404).json({ error: 'Inventory adjustment not found' });
        }
        
        await withTransaction(async (client) => {
            // Reverse the stock change
            const stockChange = adjustment.adjustment_type === 'increase' ? -adjustment.quantity_kg : adjustment.quantity_kg;
            await client.query(`
                UPDATE products 
                SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [stockChange, adjustment.product_id]);
            
            // Delete the adjustment
            await client.query('DELETE FROM inventory_adjustments WHERE id = $1', [req.params.id]);
        });
        
        res.json({ message: 'Inventory adjustment deleted successfully' });
    } catch (error) {
        console.error('Error deleting inventory adjustment:', error);
        res.status(500).json({ error: 'Failed to delete inventory adjustment' });
    }
});

module.exports = router;
