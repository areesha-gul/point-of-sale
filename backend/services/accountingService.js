const { getDatabase } = require('../database/connection');

/**
 * Accounting Service - Handles double-entry bookkeeping logic
 */
class AccountingService {
    /**
     * Record a sale transaction with ledger entries
     */
    static recordSale(saleData, saleId) {
        const db = getDatabase();
        const { customer_id, product_id, qty_kg, rate, total, amount_paid, payment_method, date } = saleData;

        // Get product's average cost for COGS calculation
        const product = db.prepare('SELECT avg_cost, current_stock FROM products WHERE id = ?').get(product_id);
        const costOfGoodsSold = qty_kg * product.avg_cost;

        const insertLedger = db.prepare(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        // Dr. Customer Receivable (unpaid amount)
        const unpaidAmount = total - amount_paid;
        if (unpaidAmount > 0) {
            insertLedger.run('sale', saleId, 'customer', customer_id, 'receivable', unpaidAmount, 0, date);
        }

        // Dr. Cash/Bank (if paid)
        if (amount_paid > 0 && payment_method !== 'none') {
            const accountType = payment_method === 'cash' ? 'cash' : 'bank';
            insertLedger.run('sale', saleId, 'account', null, accountType, amount_paid, 0, date);
        }

        // Cr. Sales Revenue
        insertLedger.run('sale', saleId, null, null, 'revenue', 0, total, date);

        // Dr. COGS
        insertLedger.run('sale', saleId, null, null, 'cogs', costOfGoodsSold, 0, date);

        // Cr. Stock
        insertLedger.run('sale', saleId, null, null, 'stock', 0, costOfGoodsSold, date);
    }

    /**
     * Record a purchase transaction with ledger entries
     */
    static recordPurchase(purchaseData, purchaseId) {
        const db = getDatabase();
        const { vendor_id, total, amount_paid, payment_method, date } = purchaseData;

        const insertLedger = db.prepare(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        // Dr. Stock (at purchase cost)
        insertLedger.run('purchase', purchaseId, null, null, 'stock', total, 0, date);

        // Cr. Vendor Payable (unpaid amount)
        const unpaidAmount = total - amount_paid;
        if (unpaidAmount > 0) {
            insertLedger.run('purchase', purchaseId, 'vendor', vendor_id, 'payable', 0, unpaidAmount, date);
        }

        // Cr. Cash/Bank (if paid)
        if (amount_paid > 0 && payment_method !== 'none') {
            const accountType = payment_method === 'cash' ? 'cash' : 'bank';
            insertLedger.run('purchase', purchaseId, 'account', null, accountType, 0, amount_paid, date);
        }
    }

    /**
     * Record a payment (customer payment received or vendor payment made)
     */
    static recordPayment(paymentData, paymentId) {
        const db = getDatabase();
        const { party_type, party_id, amount, method, direction, date } = paymentData;

        const insertLedger = db.prepare(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        const accountType = method === 'cash' ? 'cash' : 'bank';

        if (direction === 'in') {
            // Customer payment received
            // Dr. Cash/Bank
            insertLedger.run('payment', paymentId, 'account', null, accountType, amount, 0, date);
            // Cr. Customer Receivable
            insertLedger.run('payment', paymentId, 'customer', party_id, 'receivable', 0, amount, date);
        } else {
            // Vendor payment made
            // Dr. Vendor Payable
            insertLedger.run('payment', paymentId, 'vendor', party_id, 'payable', amount, 0, date);
            // Cr. Cash/Bank
            insertLedger.run('payment', paymentId, 'account', null, accountType, 0, amount, date);
        }
    }

    /**
     * Record a direct settlement (critical feature)
     * Customer pays vendor directly without cash/bank involvement
     */
    static recordSettlement(settlementData, settlementId) {
        const db = getDatabase();
        const { customer_id, vendor_id, amount, date } = settlementData;

        const insertLedger = db.prepare(
            'INSERT INTO ledger_entries (ref_type, ref_id, party_type, party_id, account_type, debit, credit, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        // Dr. Vendor Payable (reduce what we owe vendor)
        insertLedger.run('settlement', settlementId, 'vendor', vendor_id, 'payable', amount, 0, date);

        // Cr. Customer Receivable (reduce what customer owes us)
        insertLedger.run('settlement', settlementId, 'customer', customer_id, 'receivable', 0, amount, date);

        // Note: No cash or bank accounts are touched - this is the key feature
    }

    /**
     * Update product stock and average cost after purchase
     */
    static updateProductAfterPurchase(productId, qty, purchaseCost) {
        const db = getDatabase();
        const product = db.prepare('SELECT current_stock, avg_cost FROM products WHERE id = ?').get(productId);

        const oldStock = product.current_stock;
        const oldAvgCost = product.avg_cost;
        const newStock = oldStock + qty;

        // Calculate weighted average cost
        const totalOldValue = oldStock * oldAvgCost;
        const totalNewValue = qty * purchaseCost;
        const newAvgCost = newStock > 0 ? (totalOldValue + totalNewValue) / newStock : 0;

        db.prepare('UPDATE products SET current_stock = ?, avg_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newStock, newAvgCost, productId);
    }

    /**
     * Update product stock after sale
     */
    static updateProductAfterSale(productId, qty) {
        const db = getDatabase();
        db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(qty, productId);
    }

    /**
     * Update customer balance
     */
    static updateCustomerBalance(customerId, amount, operation = 'add') {
        const db = getDatabase();
        const sql = operation === 'add'
            ? 'UPDATE customers SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            : 'UPDATE customers SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        db.prepare(sql).run(amount, customerId);
    }

    /**
     * Update vendor balance
     */
    static updateVendorBalance(vendorId, amount, operation = 'add') {
        const db = getDatabase();
        const sql = operation === 'add'
            ? 'UPDATE vendors SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            : 'UPDATE vendors SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        db.prepare(sql).run(amount, vendorId);
    }

    /**
     * Update cash or bank account balance
     */
    static updateAccountBalance(accountType, amount, operation = 'add') {
        const db = getDatabase();
        const sql = operation === 'add'
            ? 'UPDATE cash_bank_accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE type = ?'
            : 'UPDATE cash_bank_accounts SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE type = ?';
        db.prepare(sql).run(amount, accountType);
    }
}

module.exports = AccountingService;
