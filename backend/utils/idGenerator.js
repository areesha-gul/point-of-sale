const { query } = require('../database/postgres');

/**
 * Generate formatted IDs for entities
 * Format: PREFIX-NNNNN (e.g., V-00001, C-00001, P-00001)
 */

async function generateFormattedId(prefix, tableName, columnName) {
    // Get the last ID number
    const result = await query(`
        SELECT ${columnName} FROM ${tableName} 
        ORDER BY id DESC LIMIT 1
    `);
    const row = result.rows[0];
    
    let nextNumber = 1;
    
    if (row && row[columnName]) {
        // Extract number from format PREFIX-NNNNN
        const match = row[columnName].match(/\d+$/);
        if (match) {
            nextNumber = parseInt(match[0]) + 1;
        }
    }
    
    // Format with leading zeros (5 digits)
    const formattedNumber = nextNumber.toString().padStart(5, '0');
    return `${prefix}-${formattedNumber}`;
}

async function generateVendorId() {
    return generateFormattedId('V', 'vendors', 'vendor_id');
}

async function generateCustomerId() {
    return generateFormattedId('C', 'customers', 'customer_id');
}

async function generateProductId() {
    return generateFormattedId('P', 'products', 'product_id');
}

async function generatePurchaseId() {
    return generateFormattedId('PUR', 'purchases', 'purchase_id');
}

async function generateSaleId() {
    return generateFormattedId('SAL', 'sales', 'sale_id');
}

async function generatePaymentId() {
    return generateFormattedId('PAY', 'payments', 'payment_id');
}

async function generateAccountId() {
    return generateFormattedId('ACC', 'cash_bank_accounts', 'account_id');
}

async function generateBankTransactionId() {
    return generateFormattedId('BT', 'bank_transactions', 'transaction_id');
}

async function generateDeliveryId() {
    return generateFormattedId('DD', 'direct_deliveries', 'delivery_id');
}

async function generateExpenseId() {
    return generateFormattedId('EXP', 'expenses', 'expense_id');
}

module.exports = {
    generateVendorId,
    generateCustomerId,
    generateProductId,
    generatePurchaseId,
    generateSaleId,
    generatePaymentId,
    generateAccountId,
    generateBankTransactionId,
    generateDeliveryId,
    generateExpenseId
};
