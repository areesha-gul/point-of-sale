const { getDatabase } = require('../database/connection');

/**
 * Generate formatted IDs for entities
 * Format: PREFIX-NNNNN (e.g., V-00001, C-00001, P-00001)
 */

function generateFormattedId(prefix, tableName, columnName) {
    const db = getDatabase();
    
    // Get the last ID number
    const result = db.prepare(`
        SELECT ${columnName} FROM ${tableName} 
        ORDER BY id DESC LIMIT 1
    `).get();
    
    let nextNumber = 1;
    
    if (result && result[columnName]) {
        // Extract number from format PREFIX-NNNNN
        const match = result[columnName].match(/\d+$/);
        if (match) {
            nextNumber = parseInt(match[0]) + 1;
        }
    }
    
    // Format with leading zeros (5 digits)
    const formattedNumber = nextNumber.toString().padStart(5, '0');
    return `${prefix}-${formattedNumber}`;
}

function generateVendorId() {
    return generateFormattedId('V', 'vendors', 'vendor_id');
}

function generateCustomerId() {
    return generateFormattedId('C', 'customers', 'customer_id');
}

function generateProductId() {
    return generateFormattedId('P', 'products', 'product_id');
}

function generatePurchaseId() {
    return generateFormattedId('PUR', 'purchases', 'purchase_id');
}

function generateSaleId() {
    return generateFormattedId('SAL', 'sales', 'sale_id');
}

function generatePaymentId() {
    return generateFormattedId('PAY', 'payments', 'payment_id');
}

function generateAccountId() {
    return generateFormattedId('ACC', 'cash_bank_accounts', 'account_id');
}

function generateBankTransactionId() {
    return generateFormattedId('BT', 'bank_transactions', 'transaction_id');
}

function generateDeliveryId() {
    return generateFormattedId('DD', 'direct_deliveries', 'delivery_id');
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
    generateDeliveryId
};
