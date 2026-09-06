const express = require('express');
const { query: dbQuery } = require('../database/postgres');

const router = express.Router();

// Download a portable JSON backup of the business records.
router.get('/backup', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const transactionTables = [
            ['sales', 'date'],
            ['purchases', 'date'],
            ['payments', 'date'],
            ['settlements', 'date'],
            ['bank_transactions', 'date'],
            ['ledger_entries', 'date']
        ];
        const backup = {
            exportedAt: new Date().toISOString(),
            period: { startDate: startDate || null, endDate: endDate || null },
            customers: (await dbQuery('SELECT * FROM customers ORDER BY id')).rows,
            vendors: (await dbQuery('SELECT * FROM vendors ORDER BY id')).rows,
            products: (await dbQuery('SELECT * FROM products ORDER BY id')).rows,
            accounts: (await dbQuery('SELECT * FROM cash_bank_accounts ORDER BY id')).rows,
            transactions: {}
        };

        for (const [table, dateColumn] of transactionTables) {
            const params = [];
            const conditions = [];
            if (startDate) {
                params.push(startDate);
                conditions.push(`${dateColumn} >= $${params.length}`);
            }
            if (endDate) {
                params.push(endDate);
                conditions.push(`${dateColumn} <= $${params.length}`);
            }
            const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
            backup.transactions[table] = (await dbQuery(`SELECT * FROM ${table}${where} ORDER BY id`, params)).rows;
        }

        const filename = `pos-backup-${startDate || 'all'}-to-${endDate || 'all'}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(backup);
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// Sales report
router.get('/sales', async (req, res) => {
    try {
        const { startDate, endDate, customerId, productId } = req.query;

        let query = `
            SELECT s.*, c.name as customer_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.voided = 0
        `;
        const params = [];

        if (startDate) {
            query += ` AND s.date >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND s.date <= $${params.length + 1}`;
            params.push(endDate);
        }
        if (customerId) {
            query += ` AND s.customer_id = $${params.length + 1}`;
            params.push(customerId);
        }
        if (productId) {
            query += ` AND s.product_id = $${params.length + 1}`;
            params.push(productId);
        }

        query += ' ORDER BY s.date DESC';

        const sales = (await dbQuery(query, params)).rows;

        // Calculate summary
        const summary = {
            totalSales: sales.reduce((sum, s) => sum + Number(s.total), 0),
            totalQuantity: sales.reduce((sum, s) => sum + Number(s.qty_kg), 0),
            totalReceived: sales.reduce((sum, s) => sum + Number(s.amount_paid), 0),
            totalPending: sales.reduce((sum, s) => sum + Number(s.total) - Number(s.amount_paid), 0),
            transactionCount: sales.length
        };

        res.json({ sales, summary });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ error: 'Failed to generate sales report' });
    }
});

// Purchase report
router.get('/purchases', async (req, res) => {
    try {
        const { startDate, endDate, vendorId, productId } = req.query;

        let query = `
            SELECT p.*, v.name as vendor_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.voided = 0
        `;
        const params = [];

        if (startDate) {
            query += ` AND p.date >= $${params.length + 1}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND p.date <= $${params.length + 1}`;
            params.push(endDate);
        }
        if (vendorId) {
            query += ` AND p.vendor_id = $${params.length + 1}`;
            params.push(vendorId);
        }
        if (productId) {
            query += ` AND p.product_id = $${params.length + 1}`;
            params.push(productId);
        }

        query += ' ORDER BY p.date DESC';

        const purchases = (await dbQuery(query, params)).rows;

        // Calculate summary
        const summary = {
            totalPurchases: purchases.reduce((sum, p) => sum + Number(p.total), 0),
            totalQuantity: purchases.reduce((sum, p) => sum + Number(p.qty_kg), 0),
            totalPaid: purchases.reduce((sum, p) => sum + Number(p.amount_paid), 0),
            totalPending: purchases.reduce((sum, p) => sum + Number(p.total) - Number(p.amount_paid), 0),
            transactionCount: purchases.length
        };

        res.json({ purchases, summary });
    } catch (error) {
        console.error('Error generating purchase report:', error);
        res.status(500).json({ error: 'Failed to generate purchase report' });
    }
});

// Outstanding balances report
router.get('/outstanding', async (req, res) => {
    try {

        // Outstanding receivables (customers who owe money)
        const receivables = (await dbQuery(`
            SELECT id, name, phone, current_balance
            FROM customers
            WHERE current_balance > 0
            ORDER BY current_balance DESC
        `)).rows;

        // Outstanding payables (vendors we owe money to)
        const payables = (await dbQuery(`
            SELECT id, name, phone, current_balance
            FROM vendors
            WHERE current_balance > 0
            ORDER BY current_balance DESC
        `)).rows;

        const summary = {
            totalReceivables: receivables.reduce((sum, c) => sum + Number(c.current_balance), 0),
            totalPayables: payables.reduce((sum, v) => sum + Number(v.current_balance), 0),
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
router.get('/profit', async (req, res) => {
    try {
        const { startDate, endDate, productId } = req.query;

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
                query += ` AND s.date >= $${params.length + 1}`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND s.date <= $${params.length + 1}`;
                params.push(endDate);
            }
            if (productId) {
                query += ` AND p.id = $${params.length + 1}`;
                params.push(productId);
            }
        }

        query += ' GROUP BY p.id, p.name, p.avg_cost ORDER BY gross_profit DESC';

        const profitByProduct = (await dbQuery(query, params)).rows;

        const summary = {
            totalRevenue: profitByProduct.reduce((sum, p) => sum + Number(p.total_revenue), 0),
            totalCost: profitByProduct.reduce((sum, p) => sum + Number(p.total_cost), 0),
            totalProfit: profitByProduct.reduce((sum, p) => sum + Number(p.gross_profit), 0)
        };

        res.json({ profitByProduct, summary });
    } catch (error) {
        console.error('Error generating profit report:', error);
        res.status(500).json({ error: 'Failed to generate profit report' });
    }
});

module.exports = router;
