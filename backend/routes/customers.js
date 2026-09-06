const express = require('express');
const { query } = require('../database/postgres');
const { generateCustomerId } = require('../utils/idGenerator');

const router = express.Router();

// Get all customers
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT * FROM customers ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
        const customer = result.rows[0];
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create customer
router.post('/', async (req, res) => {
    try {
        const { name, phone, address, opening_balance = 0 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Customer name is required' });
        }

        const customerId = await generateCustomerId();
        
        const result = await query(
            'INSERT INTO customers (customer_id, name, phone, address, opening_balance, current_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [customerId, name, phone, address, opening_balance, opening_balance]
        );
        const customer = result.rows[0];
        res.status(201).json(customer);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const customerResult = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
        const customer = customerResult.rows[0];
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const updatedResult = await query(
            'UPDATE customers SET name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name || customer.name, phone || customer.phone, address || customer.address, req.params.id]
        );
        const updated = updatedResult.rows[0];
        res.json(updated);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!(await query('SELECT id FROM customers WHERE id = $1', [req.params.id])).rows[0]) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        const sales = (await query('SELECT COUNT(*) AS count FROM sales WHERE customer_id = $1', [req.params.id])).rows[0].count;
        const payments = (await query("SELECT COUNT(*) AS count FROM payments WHERE party_type = 'customer' AND party_id = $1", [req.params.id])).rows[0].count;
        const settlements = (await query('SELECT COUNT(*) AS count FROM settlements WHERE customer_id = $1', [req.params.id])).rows[0].count;
        if (Number(sales) || Number(payments) || Number(settlements)) return res.status(409).json({ error: 'This customer has transaction history and cannot be deleted.' });
        await query('DELETE FROM customers WHERE id = $1', [req.params.id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete customer' }); }
});

// Get customer ledger (transaction history)
router.get('/:id/ledger', async (req, res) => {
    try {
        const customerId = req.params.id;

        const customerResult = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
        const customer = customerResult.rows[0];
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const transactions = [];

        // Add opening balance if non-zero
        if (customer.opening_balance > 0) {
            transactions.push({
                date: customer.created_at,
                type: 'opening',
                description: 'Opening Balance',
                debit: customer.opening_balance,
                credit: 0,
                balance: customer.opening_balance
            });
        }

        // Get sales
        const salesResult = await query(`
            SELECT s.id, s.date, s.total, s.freight_charges, s.amount_paid, 
                   p.name as product_name, s.qty_kg, s.rate
            FROM sales s
            JOIN products p ON s.product_id = p.id
            WHERE s.customer_id = $1 AND s.voided = 0
            ORDER BY s.date
        `, [customerId]);
        const sales = salesResult.rows;

        sales.forEach(sale => {
            const total = Number(sale.total);
            const freightCharges = Number(sale.freight_charges) || 0;
            const amountPaid = Number(sale.amount_paid) || 0;
            const productAmount = total - freightCharges;
            const receivable = total - amountPaid;
            
            if (receivable > 0) {
                // Create detailed description
                let description = `Sale - ${sale.product_name}`;
                
                if (freightCharges > 0) {
                    description += `\nProduct: ₨${productAmount.toFixed(2)}`;
                    description += `\nFreight deducted: ₨${freightCharges.toFixed(2)}`;
                    description += `\nNet receivable: ₨${total.toFixed(2)}`;
                }
                
                transactions.push({
                    date: sale.date,
                    type: 'sale',
                    description: description,
                    ref_id: sale.id,
                    debit: receivable,
                    credit: 0,
                    details: {
                        product_amount: productAmount,
                        freight_charges: freightCharges,
                        total: total,
                        amount_paid: amountPaid
                    }
                });
            }
        });

        // Get payments
        const paymentsResult = await query(`
            SELECT id, date, amount, notes
            FROM payments
            WHERE party_type = 'customer' AND party_id = $1 AND direction = 'in' AND voided = 0
            ORDER BY date
        `, [customerId]);
        const payments = paymentsResult.rows;

        payments.forEach(payment => {
            transactions.push({
                date: payment.date,
                type: 'payment',
                description: payment.notes || 'Payment Received',
                ref_id: payment.id,
                debit: 0,
                credit: payment.amount
            });
        });

        // Get settlements
        const settlementsResult = await query(`
            SELECT s.id, s.date, s.amount, s.notes, v.name as vendor_name
            FROM settlements s
            JOIN vendors v ON s.vendor_id = v.id
            WHERE s.customer_id = $1 AND s.voided = 0
            ORDER BY s.date
        `, [customerId]);
        const settlements = settlementsResult.rows;

        settlements.forEach(settlement => {
            transactions.push({
                date: settlement.date,
                type: 'settlement',
                description: `Direct Settlement to ${settlement.vendor_name}`,
                ref_id: settlement.id,
                debit: 0,
                credit: settlement.amount
            });
        });

        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        transactions.forEach(txn => {
            balance += txn.debit - txn.credit;
            txn.balance = balance;
        });

        res.json({
            customer,
            transactions,
            currentBalance: customer.current_balance
        });
    } catch (error) {
        console.error('Error fetching customer ledger:', error);
        res.status(500).json({ error: 'Failed to fetch customer ledger' });
    }
});

module.exports = router;
