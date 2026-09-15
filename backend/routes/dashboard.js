const express = require('express');
const { query } = require('../database/postgres');

const router = express.Router();

const getMonthRange = (monthValue) => {
    const target = monthValue ? new Date(`${monthValue}-01T00:00:00`) : new Date();
    const start = new Date(target.getFullYear(), target.getMonth(), 1);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 1);

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
};

// Get dashboard summary
router.get('/', async (req, res) => {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const { start, end } = getMonthRange(month);

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

        // Recent transactions (last 10) for selected month
        const recentSales = (await query(`
            SELECT 'sale' as type, s.id, s.date, s.total as amount, c.name as party_name, p.name as product_name
            FROM sales s
            JOIN customers c ON s.customer_id = c.id
            JOIN products p ON s.product_id = p.id
            WHERE s.status = 'approved' AND s.date >= $1 AND s.date < $2
            ORDER BY s.date DESC, s.id DESC
            LIMIT 5
        `, [start, end])).rows;

        const recentPurchases = (await query(`
            SELECT 'purchase' as type, p.id, p.date, p.grand_total as amount, v.name as party_name, pr.name as product_name
            FROM purchases p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN products pr ON p.product_id = pr.id
            WHERE p.status = 'approved' AND p.date >= $1 AND p.date < $2
            ORDER BY p.date DESC, p.id DESC
            LIMIT 5
        `, [start, end])).rows;

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
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const { start, end } = getMonthRange(month);

        const today = new Date().toISOString().split('T')[0];

        // Today's sale
        const todaySale = (await query(`
            SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
            FROM sales
            WHERE date = $1 AND status = 'approved'
        `, [today])).rows[0];

        // Selected month sale
        const mtdSale = (await query(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM sales
            WHERE date >= $1 AND date < $2 AND status = 'approved'
        `, [start, end])).rows[0];

        // Total profit for selected month - Total Sales - Total Purchases (actual cost paid)
        const mtdRevenue = (await query(`
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM sales
            WHERE date >= $1 AND date < $2 AND status = 'approved'
        `, [start, end])).rows[0];

        const mtdCost = (await query(`
            SELECT COALESCE(SUM(grand_total), 0) as cost
            FROM purchases
            WHERE date >= $1 AND date < $2 AND status = 'approved'
        `, [start, end])).rows[0];

        // Total expenses for selected month
        const mtdExpenses = (await query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE date >= $1 AND date < $2
        `, [start, end])).rows[0];

        const overallExpenses = (await query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
        `)).rows[0];

        // Total profit up to selected month: sum from beginning of records to end of selected month
        const cumulativeRevenue = (await query(`
            SELECT COALESCE(SUM(total), 0) as revenue
            FROM sales
            WHERE date < $1 AND status = 'approved'
        `, [end])).rows[0];

        const cumulativeCost = (await query(`
            SELECT COALESCE(SUM(grand_total), 0) as cost
            FROM purchases
            WHERE date < $1 AND status = 'approved'
        `, [end])).rows[0];

        const cumulativeExpenses = (await query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE date < $1
        `, [end])).rows[0];

        // Net Profit = Revenue - Purchases - Expenses
        const totalProfit = Number(mtdRevenue.revenue) - Number(mtdCost.cost) - Number(mtdExpenses.total);
        const totalProfitUpToMonth = Number(cumulativeRevenue.revenue) - Number(cumulativeCost.cost) - Number(cumulativeExpenses.total);
        const profitSplit = {
            iftekhar_ahmad: totalProfitUpToMonth * 2 / 5,
            shaukat_rang_illahi: totalProfitUpToMonth * 2 / 5,
            bank: totalProfitUpToMonth / 5
        };

        // Get cumulative withdrawals by recipient up to selected month
        const withdrawals = (await query(`
            SELECT 
                recipient,
                COALESCE(SUM(amount), 0) as total_withdrawn
            FROM profit_withdrawals
            WHERE date < $1
            GROUP BY recipient
        `, [end])).rows;

        const withdrawalsByRecipient = {
            iftekhar_ahmad: 0,
            shaukat_rang_illahi: 0,
            bank: 0
        };

        withdrawals.forEach(w => {
            const key = w.recipient.toLowerCase().replace(/ /g, '_');
            withdrawalsByRecipient[key] = Number(w.total_withdrawn);
        });

        // Calculate remaining cumulative amounts up to selected month
        const profitRemaining = {
            iftekhar_ahmad: profitSplit.iftekhar_ahmad - withdrawalsByRecipient.iftekhar_ahmad,
            shaukat_rang_illahi: profitSplit.shaukat_rang_illahi - withdrawalsByRecipient.shaukat_rang_illahi,
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
            totalProfitUpToMonth,
            totalExpenses: Number(mtdExpenses.total),
            totalExpensesOverall: Number(overallExpenses.total),
            profitSplit,
            profitWithdrawals: withdrawalsByRecipient,
            profitRemaining,
            pendingPurchases: Number(pendingPurchases),
            pendingSales: Number(pendingSales),
            pendingPayments: Number(pendingPayments)
        });
    } catch (error) {
        console.error('Error fetching KPIs:', error);
        res.status(500).json({ error: 'Failed to fetch KPIs' });
    }
});

module.exports = router;
