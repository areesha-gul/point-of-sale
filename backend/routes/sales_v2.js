const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const AccountingService = require('../services/accountingService');
const { generateSaleId } = require('../utils/idGenerator');

const router = express.Router();

const saleDetails = `
    SELECT s.*, c.name AS customer_name, c.customer_id,
           c.phone AS customer_phone, c.address AS customer_address,
           c.current_balance AS customer_balance,
           p.name AS product_name, p.product_id
    FROM sales s
    JOIN customers c ON s.customer_id = c.id
    JOIN products p ON s.product_id = p.id
`;

router.get('/', async (req, res) => {
    try {
        const params = [];
        let sql = `${saleDetails} WHERE 1 = 1`;
        if (req.query.status) {
            params.push(req.query.status);
            sql += ` AND s.status = $${params.length}`;
        }
        sql += ' ORDER BY s.date DESC, s.id DESC';
        res.json((await query(sql, params)).rows);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const sale = (await query(`${saleDetails} WHERE s.id = $1`, [req.params.id])).rows[0];
        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        res.json(sale);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sale' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { customer_id, product_id, qty_kg, rate, freight_charges = 0, amount_paid = 0, payment_method = 'none', bank_account_id = null, date, notes } = req.body;
        if (!customer_id || !product_id || !qty_kg || !rate || !date) return res.status(400).json({ error: 'Missing required fields' });
        if (qty_kg <= 0 || rate <= 0) return res.status(400).json({ error: 'Quantity and rate must be positive' });
        const total = Number(qty_kg) * Number(rate) - Number(freight_charges);
        if (total < 0) return res.status(400).json({ error: 'Freight cannot be greater than the product total' });
        if (amount_paid < 0 || amount_paid > total) return res.status(400).json({ error: 'Invalid payment amount' });
        if (payment_method === 'bank' && !bank_account_id) return res.status(400).json({ error: 'Select the bank account receiving this payment' });
        if (bank_account_id && !(await query("SELECT id FROM cash_bank_accounts WHERE id = $1 AND type = 'bank' AND is_active = 1", [bank_account_id])).rows[0]) return res.status(400).json({ error: 'Selected bank account was not found' });
        const product = (await query('SELECT current_stock FROM products WHERE id = $1', [product_id])).rows[0];
        if (!product) return res.status(404).json({ error: 'Product not found' });
        if (Number(product.current_stock) < Number(qty_kg)) return res.status(400).json({ error: 'Insufficient stock', available: product.current_stock, required: qty_kg });
        if (!(await query('SELECT id FROM customers WHERE id = $1', [customer_id])).rows[0]) return res.status(404).json({ error: 'Customer not found' });
        const saleId = await generateSaleId();
        const result = await query(`
            INSERT INTO sales (sale_id, customer_id, product_id, qty_kg, rate, total, freight_charges, amount_paid, payment_method, bank_account_id, date, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft') RETURNING id
        `, [saleId, customer_id, product_id, qty_kg, rate, total, freight_charges, amount_paid, payment_method, bank_account_id, date, notes]);
        const sale = (await query(`${saleDetails} WHERE s.id = $1`, [result.rows[0].id])).rows[0];
        res.status(201).json({ ...sale, message: 'Sale created as draft. Click Approve to finalize.' });
    } catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({ error: 'Failed to create sale', message: error.message });
    }
});

router.post('/:id/approve', async (req, res) => {
    try {
        const sale = (await query('SELECT * FROM sales WHERE id = $1 AND status = $2', [req.params.id, 'draft'])).rows[0];
        if (!sale) return res.status(404).json({ error: 'Sale not found or already approved' });
        const product = (await query('SELECT current_stock FROM products WHERE id = $1', [sale.product_id])).rows[0];
        if (Number(product.current_stock) < Number(sale.qty_kg)) return res.status(400).json({ error: 'Insufficient stock for approval', available: product.current_stock, required: sale.qty_kg });
        await withTransaction(async (client) => {
            await client.query(`UPDATE sales SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [req.user?.id || null, req.params.id]);
            // Update product stock only (no avg_cost calculation needed)
            await client.query('UPDATE products SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [sale.qty_kg, sale.product_id]);
            const unpaid = Number(sale.total) - Number(sale.amount_paid);
            if (unpaid > 0) await AccountingService.updateCustomerBalance(sale.customer_id, unpaid, 'add', client);
            if (Number(sale.amount_paid) > 0 && sale.payment_method !== 'none') await AccountingService.updateAccountBalance(sale.payment_method === 'cash' ? 'cash' : 'bank', sale.amount_paid, 'add', client, sale.bank_account_id);
            await AccountingService.recordSale(sale, sale.id, client);
        });
        const updated = (await query(`${saleDetails} WHERE s.id = $1`, [req.params.id])).rows[0];
        res.json({ ...updated, message: 'Sale approved successfully' });
    } catch (error) {
        console.error('Error approving sale:', error);
        res.status(500).json({ error: 'Failed to approve sale', message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const existing = (await query('SELECT * FROM sales WHERE id = $1 AND status = $2', [req.params.id, 'draft'])).rows[0];
        if (!existing) return res.status(404).json({ error: 'Sale not found or cannot be edited' });
        const { customer_id, product_id, qty_kg, rate, freight_charges, amount_paid, payment_method, bank_account_id, date, notes } = req.body;
        const values = [customer_id || existing.customer_id, product_id || existing.product_id, qty_kg || existing.qty_kg, rate || existing.rate];
        const freight = freight_charges ?? existing.freight_charges ?? 0;
        const total = Number(values[2]) * Number(values[3]) - Number(freight);
        if (total < 0) return res.status(400).json({ error: 'Freight cannot be greater than the product total' });
        const updated = await query(`UPDATE sales SET customer_id = $1, product_id = $2, qty_kg = $3, rate = $4, total = $5, freight_charges = $6, amount_paid = $7, payment_method = $8, bank_account_id = $9, date = $10, notes = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12 RETURNING id`, [...values, total, freight, amount_paid ?? existing.amount_paid, payment_method || existing.payment_method, bank_account_id ?? existing.bank_account_id, date || existing.date, notes ?? existing.notes, req.params.id]);
        res.json((await query(`${saleDetails} WHERE s.id = $1`, [updated.rows[0].id])).rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const sale = (await query('SELECT * FROM sales WHERE id = $1', [req.params.id])).rows[0];
        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        if (sale.status === 'draft') {
            await query('DELETE FROM sales WHERE id = $1', [req.params.id]);
            return res.json({ message: 'Draft sale deleted successfully' });
        }
        if (sale.status !== 'approved') return res.status(400).json({ error: 'Sale already voided' });
        await withTransaction(async (client) => {
            await client.query(`UPDATE sales SET status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id]);
            // Restore product stock (no avg_cost update needed)
            await client.query('UPDATE products SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [sale.qty_kg, sale.product_id]);
            const unpaid = Number(sale.total) - Number(sale.amount_paid);
            if (unpaid > 0) await AccountingService.updateCustomerBalance(sale.customer_id, unpaid, 'subtract', client);
            if (Number(sale.amount_paid) > 0 && sale.payment_method !== 'none') await AccountingService.updateAccountBalance(sale.payment_method === 'cash' ? 'cash' : 'bank', sale.amount_paid, 'subtract', client, sale.bank_account_id);
        });
        res.json({ message: 'Sale voided successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

module.exports = router;
