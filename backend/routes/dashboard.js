const express = require('express');
const { query } = require('../database/postgres');

const router = express.Router();

// Get dashboard summary
router.get('/', async (req, res) => {
    try {
        // Total receivables (sum of all customer balances)
        const receivablesResult = (await query('SELECT COALESCE(SUM(current_balance), 0) as total FROM customers')).rows[0];
        const totalReceivables = Number(receivablesResult.total);

        // Total payables (sum of all vendor balances)
        const payablesResult = (await query('SELECT COALESCE(SUM(current_balance), 0) as total FROM vendors')).rows[0];
        const totalPayables = Number(payablesResult.total);

        // Cash balance
        const cashResult = (await query('SELECT current_balance FROM cash_bank_accounts WHERE type = $1', ['cash'])).rows[0];
        const cashBalance = cashResult ? Number(cashResult.current_balance) : 0;

        // Bank balance
        const bankResult = (await query('SELECT current_balance FROM cash_bank_accounts WHERE type = $1', ['bank'])).rows[0];
        const bankBalance = bankResult ? Number(bankResult.current_balance) : 0;

        // Stock summary
        const stockSummary = (await query(`
            SELECT 
                COUNT(*) as product_count,
                COALESCE(SUM(current_stock), 0) as total_stock_kg,
                COALESCE(SUM(current_stock * avg_cost), 0) as total_stock_value
            FROM products
        `)).rows[0];

        // Customer and vendor counts
        const customerCount = (await query('SELECT COUNT(*) as count FROM customers')).rows[0].count;
        const vendorCount = (await query('SELECT COUNT(*) as count FROM vendors')).rows[0].count;

        // Recent transactions (last 10)
        const recentSales = (await query(`
            SELECT 'sale' as type, s.id, s.date, s.total as amount, c.name as party_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.status = 'approved'
            ORDER BY s.date DESC, s.id DESC
            LIMIT 5
        `)).rows;

        const recentPurchases = (await query(`
            SELECT 'purchase' as type, p.id, p.date, p.grand_total as amount, v.name as party_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.status = 'approved'
            ORDER BY p.date DESC, p.id DESC
            LIMIT 5
        `)).rows;

        // Combine and sort recent transactions
        const recentTransactions = [...recentSales, ...recentPurchases]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        // Top customers by balance (highest receivables)
        const topCustomers = (await query(`
            SELECT id, name, current_balance
            FROM customers
            WHERE current_balance > 0
            ORDER BY current_balance DESC
            LIMIT 5
        `)).rows;

        // Top vendors by balance (highest payables)
        const topVendors = (await query(`
            SELECT id, name, current_balance
            FROM vendors
            WHERE current_balance > 0
            ORDER BY current_balance DESC
            LIMIT 5
        `)).rows;

        // Low stock products (stock < 100 KG)
        const lowStockProducts = (await query(`
            SELECT id, name, current_stock, unit
            FROM products
            WHERE current_stock < 100
            ORDER BY current_stock ASC
            LIMIT 5
        `)).rows;

        res.json({
            summary: {
                totalReceivables,
                totalPayables,
                cashBalance,
                bankBalance,
                netPosition: totalReceivables - totalPayables + cashBalance + bankBalance,
                totalStockValue: Number(stockSummary.total_stock_value),
                totalStockKg: Number(stockSummary.total_stock_kg),
                productCount: Number(stockSummary.product_count),
                customerCount: Number(customerCount),
                vendorCount: Number(vendorCount)
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
router.get('/kpis', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        // Today's sale
        const todaySale = (await query(`
            SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
            FROM sales
            WHERE date = $1 AND status = 'approved'
        `, [today])).rows[0];

        // Month to date sale
        const mtdSale = (await query(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM sales
            WHERE date >= $1 AND status = 'approved'
        `, [firstDayOfMonth])).rows[0];

        // Total profit (MTD) - Total Sales - Total Purchases (actual cost paid)
        const mtdRevenue = (await query(`
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM sales
            WHERE date >= $1 AND status = 'approved'
        `, [firstDayOfMonth])).rows[0];

        const mtdCost = (await query(`
            SELECT COALESCE(SUM(grand_total), 0) as cost
            FROM purchases
            WHERE date >= $1 AND status = 'approved'
        `, [firstDayOfMonth])).rows[0];

        const totalProfit = Number(mtdRevenue.revenue) - Number(mtdCost.cost);
        const profitSplit = {
            iftekhar_ahmad: totalProfit * 2 / 5,
            shaukat: totalProfit * 2 / 5,
            bank: totalProfit / 5
        };

        // Get cumulative withdrawals (MTD) by recipient
        const withdrawals = (await query(`
            SELECT 
                recipient,
                COALESCE(SUM(amount), 0) as total_withdrawn
            FROM profit_withdrawals
            WHERE date >= $1
            GROUP BY recipient
        `, [firstDayOfMonth])).rows;

        const withdrawalsByRecipient = {
            iftekhar_ahmad: 0,
            shaukat: 0,
            bank: 0
        };

        withdrawals.forEach(w => {
            const key = w.recipient.toLowerCase().replace(/ /g, '_');
            withdrawalsByRecipient[key] = Number(w.total_withdrawn);
        });

        // Calculate remaining amounts
        const profitRemaining = {
            iftekhar_ahmad: profitSplit.iftekhar_ahmad - withdrawalsByRecipient.iftekhar_ahmad,
            shaukat: profitSplit.shaukat - withdrawalsByRecipient.shaukat,
            bank: profitSplit.bank - withdrawalsByRecipient.bank
        };

        // Pending approvals
        const pendingPurchases = (await query(`SELECT COUNT(*) as count FROM purchases WHERE status = 'draft'`)).rows[0].count;
        const pendingSales = (await query(`SELECT COUNT(*) as count FROM sales WHERE status = 'draft'`)).rows[0].count;
        const pendingPayments = (await query(`SELECT COUNT(*) as count FROM payments WHERE status = 'draft'`)).rows[0].count;

        res.json({
            todaySale: Number(todaySale.total),
            todaySaleCount: Number(todaySale.count),
            mtdSale: Number(mtdSale.total),
            totalProfit,
            profitSplit,
            profitWithdrawals: withdrawalsByRecipient,
            profitRemaining,
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
