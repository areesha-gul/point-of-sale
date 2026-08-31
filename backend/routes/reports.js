const express = require('express');
const { getDatabase } = require('../database/connection');

const router = express.Router();

// Sales report
router.get('/sales', (req, res) => {
    try {
        const { startDate, endDate, customerId, productId } = req.query;
        const db = getDatabase();

        let query = `
            SELECT s.*, c.name as customer_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.voided = 0
        `;
        const params = [];

        if (startDate) {
            query += ' AND s.date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND s.date <= ?';
            params.push(endDate);
        }
        if (customerId) {
            query += ' AND s.customer_id = ?';
            params.push(customerId);
        }
        if (productId) {
            query += ' AND s.product_id = ?';
            params.push(productId);
        }

        query += ' ORDER BY s.date DESC';

        const sales = db.prepare(query).all(...params);

        // Calculate summary
        const summary = {
            totalSales: sales.reduce((sum, s) => sum + s.total, 0),
            totalQuantity: sales.reduce((sum, s) => sum + s.qty_kg, 0),
            totalReceived: sales.reduce((sum, s) => sum + s.amount_paid, 0),
            totalPending: sales.reduce((sum, s) => sum + (s.total - s.amount_paid), 0),
            transactionCount: sales.length
        };

        res.json({ sales, summary });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ error: 'Failed to generate sales report' });
    }
});

// Purchase report
router.get('/purchases', (req, res) => {
    try {
        const { startDate, endDate, vendorId, productId } = req.query;
        const db = getDatabase();

        let query = `
            SELECT p.*, v.name as vendor_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.voided = 0
        `;
        const params = [];

        if (startDate) {
            query += ' AND p.date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND p.date <= ?';
            params.push(endDate);
        }
        if (vendorId) {
            query += ' AND p.vendor_id = ?';
            params.push(vendorId);
        }
        if (productId) {
            query += ' AND p.product_id = ?';
            params.push(productId);
        }

        query += ' ORDER BY p.date DESC';

        const purchases = db.prepare(query).all(...params);

        // Calculate summary
        const summary = {
            totalPurchases: purchases.reduce((sum, p) => sum + p.total, 0),
            totalQuantity: purchases.reduce((sum, p) => sum + p.qty_kg, 0),
            totalPaid: purchases.reduce((sum, p) => sum + p.amount_paid, 0),
            totalPending: purchases.reduce((sum, p) => sum + (p.total - p.amount_paid), 0),
            transactionCount: purchases.length
        };

        res.json({ purchases, summary });
    } catch (error) {
        console.error('Error generating purchase report:', error);
        res.status(500).json({ error: 'Failed to generate purchase report' });
    }
});

// Outstanding balances report
router.get('/outstanding', (req, res) => {
    try {
        const db = getDatabase();

        // Outstanding receivables (customers who owe money)
        const receivables = db.prepare(`
            SELECT id, name, phone, current_balance
            FROM customers
            WHERE current_balance > 0
            ORDER BY current_balance DESC
        `).all();

        // Outstanding payables (vendors we owe money to)
        const payables = db.prepare(`
            SELECT id, name, phone, current_balance
            FROM vendors
            WHERE current_balance > 0
            ORDER BY current_balance DESC
        `).all();

        const summary = {
            totalReceivables: receivables.reduce((sum, c) => sum + c.current_balance, 0),
            totalPayables: payables.reduce((sum, v) => sum + v.current_balance, 0),
            receivableCount: receivables.length,
            payableCount: payables.length
        };

        res.json({ receivables, payables, summary });
    } catch (error) {
        console.error('Error generating outstanding report:', error);
        res.status(500).json({ error: 'Failed to generate outstanding report' });
    }
});

// Profit report (by product)
router.get('/profit', (req, res) => {
    try {
        const { startDate, endDate, productId } = req.query;
        const db = getDatabase();

        let query = `
            SELECT 
                p.id,
                p.name as product_name,
                COALESCE(SUM(s.qty_kg), 0) as total_sold_kg,
                COALESCE(SUM(s.total), 0) as total_revenue,
                p.avg_cost,
                COALESCE(SUM(s.qty_kg * p.avg_cost), 0) as total_cost,
                COALESCE(SUM(s.total) - SUM(s.qty_kg * p.avg_cost), 0) as gross_profit
            FROM products p
            LEFT JOIN sales s ON p.id = s.product_id AND s.voided = 0
        `;
        const params = [];

        if (startDate || endDate || productId) {
            query += ' WHERE 1=1';
            
            if (startDate) {
                query += ' AND s.date >= ?';
                params.push(startDate);
            }
            if (endDate) {
                query += ' AND s.date <= ?';
                params.push(endDate);
            }
            if (productId) {
                query += ' AND p.id = ?';
                params.push(productId);
            }
        }

        query += ' GROUP BY p.id, p.name, p.avg_cost ORDER BY gross_profit DESC';

        const profitByProduct = db.prepare(query).all(...params);

        const summary = {
            totalRevenue: profitByProduct.reduce((sum, p) => sum + p.total_revenue, 0),
            totalCost: profitByProduct.reduce((sum, p) => sum + p.total_cost, 0),
            totalProfit: profitByProduct.reduce((sum, p) => sum + p.gross_profit, 0)
        };

        res.json({ profitByProduct, summary });
    } catch (error) {
        console.error('Error generating profit report:', error);
        res.status(500).json({ error: 'Failed to generate profit report' });
    }
});

module.exports = router;
