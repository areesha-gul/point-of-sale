const { query } = require('../database/postgres');

/**
 * Accounting Service - Handles double-entry bookkeeping logic
 */
class AccountingService {
    /**
     * Record a sale transaction with ledger entries
     */
    static async recordSale(saleData, saleId, client = null) {
        const db = client || { query };
        const { customer_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date } = saleData;

        // Get product's average cost for COGS calculation
        const productResult = await db.query('SELECT avg_cost, current_stock FROM products WHERE id = $1', [product_id]);
        const product = productResult.rows[0];
        const costOfGoodsSold = qty_kg * product.avg_cost;

        const insertLedger = (values) => db.query(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', values
        );

        // Dr. Customer Receivable (unpaid amount)
        const unpaidAmount = total - amount_paid;
        if (unpaidAmount > 0) {
            await insertLedger(['sale', saleId, 'customer', customer_id, 'receivable', unpaidAmount, 0, date]);
        }

        // Dr. Cash/Bank (if paid)
        if (amount_paid > 0 && payment_method !== 'none') {
            const accountType = payment_method === 'cash' ? 'cash' : 'bank';
            await insertLedger(['sale', saleId, 'account', null, accountType, amount_paid, 0, date]);
        }

        // Cr. Sales Revenue
        await insertLedger(['sale', saleId, null, null, 'revenue', 0, total, date]);

        // Dr. COGS
        await insertLedger(['sale', saleId, null, null, 'cogs', costOfGoodsSold, 0, date]);

        // Cr. Stock
        await insertLedger(['sale', saleId, null, null, 'stock', 0, costOfGoodsSold, date]);
    }

    /**
     * Record a purchase transaction with ledger entries
     */
    static async recordPurchase(purchaseData, purchaseId, client = null) {
        const db = client || { query };
        const { vendor_id, total, amount_paid, payment_method, date } = purchaseData;

        const insertLedger = (values) => db.query(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', values
        );

        // Dr. Stock (at purchase cost)
        await insertLedger(['purchase', purchaseId, null, null, 'stock', total, 0, date]);

        // Cr. Vendor Payable (unpaid amount)
        const unpaidAmount = total - amount_paid;
        if (unpaidAmount > 0) {
            await insertLedger(['purchase', purchaseId, 'vendor', vendor_id, 'payable', 0, unpaidAmount, date]);
        }

        // Cr. Cash/Bank (if paid)
        if (amount_paid > 0 && payment_method !== 'none') {
            const accountType = payment_method === 'cash' ? 'cash' : 'bank';
            await insertLedger(['purchase', purchaseId, 'account', null, accountType, 0, amount_paid, date]);
        }
    }

    /**
     * Record a payment (customer payment received or vendor payment made)
     */
    static async recordPayment(paymentData, paymentId, client = null) {
        const db = client || { query };
        const { party_type, party_id, amount, method, direction, date } = paymentData;

        const insertLedger = (values) => db.query(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', values
        );

        const accountType = method === 'cash' ? 'cash' : 'bank';

        if (direction === 'in') {
            // Customer payment received
            // Dr. Cash/Bank
            await insertLedger(['payment', paymentId, 'account', null, accountType, amount, 0, date]);
            // Cr. Customer Receivable
            await insertLedger(['payment', paymentId, 'customer', party_id, 'receivable', 0, amount, date]);
        } else {
            // Vendor payment made
            // Dr. Vendor Payable
            await insertLedger(['payment', paymentId, 'vendor', party_id, 'payable', amount, 0, date]);
            // Cr. Cash/Bank
            await insertLedger(['payment', paymentId, 'account', null, accountType, 0, amount, date]);
        }
    }

    /**
     * Record a direct settlement (critical feature)
     * Customer pays vendor directly without cash/bank involvement
     */
    static async recordSettlement(settlementData, settlementId, client = null) {
        const db = client || { query };
        const { customer_id, vendor_id, amount, date } = settlementData;

        const insertLedger = (values) => db.query(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', values
        );

        // Dr. Vendor Payable (reduce what we owe vendor)
        await insertLedger(['settlement', settlementId, 'vendor', vendor_id, 'payable', amount, 0, date]);

        // Cr. Customer Receivable (reduce what customer owes us)
        await insertLedger(['settlement', settlementId, 'customer', customer_id, 'receivable', 0, amount, date]);

        // Note: No cash or bank accounts are touched - this is the key feature
    }

    /**
     * Update product stock and average cost after purchase
     */
    static async updateProductAfterPurchase(productId, qty, purchaseCost, client = null) {
        const db = client || { query };
        const productResult = await db.query('SELECT current_stock, avg_cost FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];

        const oldStock = Number(product.current_stock);
        const oldAvgCost = Number(product.avg_cost);
        const newStock = oldStock + Number(qty);

        // Calculate weighted average cost
        const totalOldValue = oldStock * oldAvgCost;
        const totalNewValue = Number(qty) * Number(purchaseCost);
        const newAvgCost = newStock > 0 ? (totalOldValue + totalNewValue) / newStock : 0;

        await db.query('UPDATE products SET current_stock = $1, avg_cost = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [newStock, newAvgCost, productId]);
    }

    /**
     * Update product stock after sale
     */
    static async updateProductAfterSale(productId, qty, client = null) {
        const db = client || { query };
        await db.query('UPDATE products SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [qty, productId]);
    }

    /**
     * Update customer balance
     */
    static async updateCustomerBalance(customerId, amount, operation = 'add', client = null) {
        const db = client || { query };
        const sql = operation === 'add'
            ? 'UPDATE customers SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
            : 'UPDATE customers SET current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        await db.query(sql, [amount, customerId]);
    }

    /**
     * Update vendor balance
     */
    static async updateVendorBalance(vendorId, amount, operation = 'add', client = null) {
        const db = client || { query };
        const sql = operation === 'add'
            ? 'UPDATE vendors SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
            : 'UPDATE vendors SET current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
        await db.query(sql, [amount, vendorId]);
    }

    /**
     * Update cash or bank account balance
     */
    static async updateAccountBalance(accountType, amount, operation = 'add', client = null) {
        const db = client || { query };
        const sql = operation === 'add'
            ? 'UPDATE cash_bank_accounts SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE type = $2'
            : 'UPDATE cash_bank_accounts SET current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE type = $2';
        await db.query(sql, [amount, accountType]);
    }
}

module.exports = AccountingService;
