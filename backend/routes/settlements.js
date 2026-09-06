const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const AccountingService = require('../services/accountingService');

const router = express.Router();

// Get all settlements
router.get('/', async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, c.name as customer_name, v.name as vendor_name
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.voided = 0
            ORDER BY s.date DESC, s.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching settlements:', error);
        res.status(500).json({ error: 'Failed to fetch settlements' });
    }
});

// Get settlement by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, 
                c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.id = $1
        `, [req.params.id]);
        const settlement = result.rows[0];
        
        if (!settlement) {
            return res.status(404).json({ error: 'Settlement not found' });
        }
        
        res.json(settlement);
    } catch (error) {
        console.error('Error fetching settlement:', error);
        res.status(500).json({ error: 'Failed to fetch settlement' });
    }
});

/**
 * CRITICAL FEATURE: Create Direct Settlement
 * 
 * This is the core business requirement where a customer pays a vendor directly
 * on behalf of the company. This reduces both customer receivable and vendor payable
 * without any cash or bank transaction.
 * 
 * Example: 
 * - Customer A owes company Rs. 1,00,00,000 (receivable)
 * - Company owes Vendor B Rs. 70,00,000 (payable)
 * - Customer A pays Vendor B Rs. 70,00,000 directly
 * - Result: Customer receivable = Rs. 30,00,000, Vendor payable = Rs. 0
 * - Company cash/bank balances remain unchanged
 */
router.post('/', async (req, res) => {
    try {
        const { customer_id, vendor_id, amount, date, notes } = req.body;

        // Validation
        if (!customer_id || !vendor_id || !amount || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        // Get customer balance (receivable - what they owe us)
        const customerResult = await query('SELECT name, current_balance FROM customers WHERE id = $1', [customer_id]);
        const customer = customerResult.rows[0];
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get vendor balance (payable - what we owe them)
        const vendorResult = await query('SELECT name, current_balance FROM vendors WHERE id = $1', [vendor_id]);
        const vendor = vendorResult.rows[0];
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // CRITICAL VALIDATION: Settlement cannot exceed customer's receivable
        if (amount > customer.current_balance) {
            return res.status(400).json({ 
                error: 'Settlement amount exceeds customer receivable',
                customerBalance: customer.current_balance,
                attemptedAmount: amount,
                message: `${customer.name} only owes Rs. ${customer.current_balance.toFixed(2)}. Cannot settle Rs. ${amount.toFixed(2)}`
            });
        }

        // CRITICAL VALIDATION: Settlement cannot exceed vendor's payable
        if (amount > vendor.current_balance) {
            return res.status(400).json({ 
                error: 'Settlement amount exceeds vendor payable',
                vendorBalance: vendor.current_balance,
                attemptedAmount: amount,
                message: `Company only owes Rs. ${vendor.current_balance.toFixed(2)} to ${vendor.name}. Cannot settle Rs. ${amount.toFixed(2)}`
            });
        }

        // Start transaction
        const settlementId = await withTransaction(async (client) => {
            // Insert settlement record
            const result = await client.query(`
                INSERT INTO settlements (customer_id, vendor_id, amount, date, notes)
                VALUES ($1, $2, $3, $4, $5) RETURNING id
            `, [customer_id, vendor_id, amount, date, notes]);
            const databaseSettlementId = result.rows[0].id;

            // CRITICAL: Update customer balance (reduce receivable - they owe us less)
            await AccountingService.updateCustomerBalance(customer_id, amount, 'subtract', client);

            // CRITICAL: Update vendor balance (reduce payable - we owe them less)
            await AccountingService.updateVendorBalance(vendor_id, amount, 'subtract', client);

            // CRITICAL: Record ledger entries WITHOUT touching cash/bank accounts
            // This is what makes direct settlement different from regular payments
            await AccountingService.recordSettlement(req.body, databaseSettlementId, client);

            return databaseSettlementId;
        });

        // Fetch created settlement with full details
        const settlementResult = await query(`
            SELECT s.*, 
                c.name as customer_name, c.current_balance as customer_balance,
                v.name as vendor_name, v.current_balance as vendor_balance
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.id = $1
        `, [settlementId]);
        const settlement = settlementResult.rows[0];

        res.status(201).json({
            ...settlement,
            message: `Direct settlement recorded: ${customer.name} paid ${vendor.name} Rs. ${amount.toFixed(2)}`,
            details: {
                customerNewBalance: settlement.customer_balance,
                vendorNewBalance: settlement.vendor_balance,
                note: 'No cash or bank accounts were affected by this transaction'
            }
        });
    } catch (error) {
        console.error('Error creating settlement:', error);
        res.status(500).json({ error: 'Failed to create settlement', message: error.message });
    }
});

// Get settlements involving a specific customer
router.get('/customer/:customerId', async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, c.name as customer_name, v.name as vendor_name
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.customer_id = $1 AND s.voided = 0
            ORDER BY s.date DESC
        `, [req.params.customerId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching customer settlements:', error);
        res.status(500).json({ error: 'Failed to fetch customer settlements' });
    }
});

// Get settlements involving a specific vendor
router.get('/vendor/:vendorId', async (req, res) => {
    try {
        const result = await query(`
            SELECT s.*, c.name as customer_name, v.name as vendor_name
            FROM settlements s
            JOIN customers c ON s.customer_id = c.id
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.vendor_id = $1 AND s.voided = 0
            ORDER BY s.date DESC
        `, [req.params.vendorId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching vendor settlements:', error);
        res.status(500).json({ error: 'Failed to fetch vendor settlements' });
    }
});

module.exports = router;
