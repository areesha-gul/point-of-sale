const express = require('express');
const { getDatabase } = require('../database/connection');

const router = express.Router();

// Get dashboard summary
router.get('/', (req, res) => {
    try {
        const db = getDatabase();

        // Total receivables (sum of all customer balances)
        const receivablesResult = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM customers').get();
        const totalReceivables = receivablesResult.total;

        // Total payables (sum of all vendor balances)
        const payablesResult = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM vendors').get();
        const totalPayables = payablesResult.total;

        // Cash balance
        const cashResult = db.prepare('SELECT current_balance FROM cash_bank_accounts WHERE type = ?').get('cash');
        const cashBalance = cashResult ? cashResult.current_balance : 0;

        // Bank balance
        const bankResult = db.prepare('SELECT current_balance FROM cash_bank_accounts WHERE type = ?').get('bank');
        const bankBalance = bankResult ? bankResult.current_balance : 0;

        // Stock summary
        const stockSummary = db.prepare(`
            SELECT 
                COUNT(*) as product_count,
                COALESCE(SUM(current_stock), 0) as total_stock_kg,
                COALESCE(SUM(current_stock * avg_cost), 0) as total_stock_value
            FROM products
        `).get();

        // Customer and vendor counts
        const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
        const vendorCount = db.prepare('SELECT COUNT(*) as count FROM vendors').get().count;

        // Recent transactions (last 10)
        const recentSales = db.prepare(`
            SELECT 'sale' as type, s.id, s.date, s.total as amount, c.name as party_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.status = 'approved'
            ORDER BY s.date DESC, s.id DESC
            LIMIT 5
        `).all();

        const recentPurchases = db.prepare(`
            SELECT 'purchase' as type, p.id, p.date, p.grand_total as amount, v.name as party_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.status = 'approved'
            ORDER BY p.date DESC, p.id DESC
            LIMIT 5
        `).all();

        // Combine and sort recent transactions
        const recentTransactions = [...recentSales, ...recentPurchases]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        // Top customers by balance (highest receivables)
        const topCustomers = db.prepare(`
            SELECT id, name, current_balance
            FROM customers
            WHERE current_balance > 0
            ORDER BY current_balance DESC
            LIMIT 5
        `).all();

        // Top vendors by balance (highest payables)
        const topVendors = db.prepare(`
            SELECT id, name, current_balance
            FROM vendors
            WHERE current_balance > 0
            ORDER BY current_balance DESC
            LIMIT 5
        `).all();

        // Low stock products (stock < 100 KG)
        const lowStockProducts = db.prepare(`
            SELECT id, name, current_stock, unit
            FROM products
            WHERE current_stock < 100
            ORDER BY current_stock ASC
            LIMIT 5
        `).all();

        res.json({
            summary: {
                totalReceivables,
                totalPayables,
                cashBalance,
                bankBalance,
                netPosition: totalReceivables - totalPayables + cashBalance + bankBalance,
                totalStockValue: stockSummary.total_stock_value,
                totalStockKg: stockSummary.total_stock_kg,
                productCount: stockSummary.product_count,
                customerCount,
                vendorCount
            },
            recentTransactions,
            topCustomers,
            topVendors,
            lowStockProducts
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get KPIs (Today's sale, MTD sale, Total profit, Pending approvals)
router.get('/kpis', (req, res) => {
    try {
        const db = getDatabase();
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        // Today's sale
        const todaySale = db.prepare(`
            SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
            FROM sales
            WHERE date = ? AND status = 'approved'
        `).get(today);

        // Month to date sale
        const mtdSale = db.prepare(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM sales
            WHERE date >= ? AND status = 'approved'
        `).get(firstDayOfMonth);

        // Total profit (MTD) - Revenue - COGS
        const mtdProfit = db.prepare(`
            SELECT 
                COALESCE(SUM(s.total), 0) as revenue,
                COALESCE(SUM(s.qty_kg * p.avg_cost), 0) as cogs
            FROM sales s
            JOIN products p ON s.product_id = p.id
            WHERE s.date >= ? AND s.status = 'approved'
        `).get(firstDayOfMonth);

        const totalProfit = mtdProfit.revenue - mtdProfit.cogs;

        // Pending approvals
        const pendingPurchases = db.prepare(`SELECT COUNT(*) as count FROM purchases WHERE status = 'draft'`).get().count;
        const pendingSales = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE status = 'draft'`).get().count;
        const pendingPayments = db.prepare(`SELECT COUNT(*) as count FROM payments WHERE status = 'draft'`).get().count;

        res.json({
            todaySale: todaySale.total,
            todaySaleCount: todaySale.count,
            mtdSale: mtdSale.total,
            totalProfit,
            pendingPurchases,
            pendingSales,
            pendingPayments,
            totalPending: pendingPurchases + pendingSales + pendingPayments
        });
    } catch (error) {
        console.error('Error fetching KPIs:', error);
        res.status(500).json({ error: 'Failed to fetch KPIs' });
    }
});

module.exports = router;
