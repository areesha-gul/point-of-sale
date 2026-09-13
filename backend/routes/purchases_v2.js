const express = require('express');
const { query, withTransaction } = require('../database/postgres');
const AccountingService = require('../services/accountingService');
const { generatePurchaseId } = require('../utils/idGenerator');

const router = express.Router();
const purchaseDetails = `
    SELECT p.*, v.name AS vendor_name, v.vendor_id, v.current_balance AS vendor_balance,
           pr.name AS product_name, pr.product_id, ba.name AS bank_account_name
    FROM purchases p
    JOIN vendors v ON p.vendor_id = v.id
    JOIN products pr ON p.product_id = pr.id
    LEFT JOIN cash_bank_accounts ba ON p.bank_account_id = ba.id
`;

router.get('/', async (req, res) => {
    try {
        const params = [];
        let sql = `${purchaseDetails} WHERE 1 = 1`;
        if (req.query.status) { params.push(req.query.status); sql += ` AND p.status = $${params.length}`; }
        sql += ' ORDER BY p.date DESC, p.id DESC';
        res.json((await query(sql, params)).rows);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch purchases' }); }
});

router.get('/:id', async (req, res) => {
    try {
        const purchase = (await query(`${purchaseDetails} WHERE p.id = $1`, [req.params.id])).rows[0];
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        res.json(purchase);
    } catch (error) { res.status(500).json({ error: 'Failed to fetch purchase' }); }
});

router.post('/', async (req, res) => {
    try {
        const { vendor_id, product_id, qty_kg, actual_weight_kg, rate, freight_charges = 0, other_charges = 0, round_off = 0, amount_paid = 0, payment_method = 'none', bank_account_id, date, notes, is_direct_delivery = 0 } = req.body;
        if (!vendor_id || !product_id || !qty_kg || !rate || !date) return res.status(400).json({ error: 'Missing required fields' });
        if (qty_kg <= 0 || rate <= 0) return res.status(400).json({ error: 'Quantity and rate must be positive' });
        if (actual_weight_kg && actual_weight_kg <= 0) return res.status(400).json({ error: 'Actual weight must be positive if provided' });
        if (!(await query('SELECT id FROM products WHERE id = $1', [product_id])).rows[0]) return res.status(404).json({ error: 'Product not found' });
        if (!(await query('SELECT id FROM vendors WHERE id = $1', [vendor_id])).rows[0]) return res.status(404).json({ error: 'Vendor not found' });
        
        // Calculate weight difference if actual weight provided
        const actualWeight = actual_weight_kg ? Number(actual_weight_kg) : null;
        const weightDifference = actualWeight ? actualWeight - Number(qty_kg) : null;
        
        const total = Number(qty_kg) * Number(rate);
        const grandTotal = total - Number(freight_charges) + Number(other_charges) - Number(round_off);
        if (grandTotal < 0) return res.status(400).json({ error: 'Total cannot be negative' });
        if (amount_paid < 0 || amount_paid > grandTotal) return res.status(400).json({ error: 'Payment amount cannot exceed grand total' });
        const purchaseId = await generatePurchaseId();
        const result = await query(`
            INSERT INTO purchases (purchase_id, vendor_id, product_id, qty_kg, actual_weight_kg, weight_difference, rate, total, freight_charges, other_charges, round_off, grand_total, amount_paid, payment_method, bank_account_id, date, notes, is_direct_delivery, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'draft') RETURNING id
        `, [purchaseId, vendor_id, product_id, qty_kg, actualWeight, weightDifference, rate, total, freight_charges, other_charges, round_off, grandTotal, amount_paid, payment_method, bank_account_id || null, date, notes, is_direct_delivery]);
        const purchase = (await query(`${purchaseDetails} WHERE p.id = $1`, [result.rows[0].id])).rows[0];
        res.status(201).json({ ...purchase, message: 'Purchase created as draft. Click Approve to finalize.' });
    } catch (error) { res.status(500).json({ error: 'Failed to create purchase', message: error.message }); }
});

router.post('/:id/approve', async (req, res) => {
    try {
        const purchase = (await query('SELECT * FROM purchases WHERE id = $1 AND status = $2', [req.params.id, 'draft'])).rows[0];
        if (!purchase) return res.status(404).json({ error: 'Purchase not found or already approved' });
        await withTransaction(async (client) => {
            await client.query(`UPDATE purchases SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [req.user?.id || null, req.params.id]);
            // Update product stock - use actual_weight_kg if provided, otherwise use qty_kg
            const stockToAdd = purchase.actual_weight_kg ? Number(purchase.actual_weight_kg) : Number(purchase.qty_kg);
            await client.query('UPDATE products SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [stockToAdd, purchase.product_id]);
            const unpaid = Number(purchase.grand_total) - Number(purchase.amount_paid);
            if (unpaid > 0) await AccountingService.updateVendorBalance(purchase.vendor_id, unpaid, 'add', client);
            if (Number(purchase.amount_paid) > 0 && purchase.payment_method !== 'none') await AccountingService.updateAccountBalance(purchase.payment_method === 'cash' ? 'cash' : 'bank', purchase.amount_paid, 'subtract', client, purchase.bank_account_id);
            await AccountingService.recordPurchase(purchase, purchase.id, client);
        });
        res.json({ ...(await query(`${purchaseDetails} WHERE p.id = $1`, [req.params.id])).rows[0], message: 'Purchase approved successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to approve purchase', message: error.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const existing = (await query('SELECT * FROM purchases WHERE id = $1 AND status = $2', [req.params.id, 'draft'])).rows[0];
        if (!existing) return res.status(404).json({ error: 'Purchase not found or cannot be edited' });
        const { vendor_id, product_id, qty_kg, actual_weight_kg, rate, freight_charges, other_charges, round_off, amount_paid, payment_method, bank_account_id, date, notes, is_direct_delivery } = req.body;
        const qty = qty_kg ?? existing.qty_kg; const unitRate = rate ?? existing.rate;
        const freight = freight_charges ?? existing.freight_charges; const other = other_charges ?? existing.other_charges;
        const roundOff = round_off ?? existing.round_off;
        
        // Calculate weight difference if actual weight provided
        const actualWeight = actual_weight_kg !== undefined ? (actual_weight_kg || null) : existing.actual_weight_kg;
        const weightDifference = actualWeight ? Number(actualWeight) - Number(qty) : null;
        
        const total = Number(qty) * Number(unitRate); const grandTotal = total - Number(freight) + Number(other) - Number(roundOff);
        if (grandTotal < 0) return res.status(400).json({ error: 'Total cannot be negative' });
        const result = await query(`UPDATE purchases SET vendor_id = $1, product_id = $2, qty_kg = $3, actual_weight_kg = $4, weight_difference = $5, rate = $6, total = $7, freight_charges = $8, other_charges = $9, round_off = $10, grand_total = $11, amount_paid = $12, payment_method = $13, bank_account_id = $14, date = $15, notes = $16, is_direct_delivery = $17, updated_at = CURRENT_TIMESTAMP WHERE id = $18 RETURNING id`, [vendor_id ?? existing.vendor_id, product_id ?? existing.product_id, qty, actualWeight, weightDifference, unitRate, total, freight, other, roundOff, grandTotal, amount_paid ?? existing.amount_paid, payment_method || existing.payment_method, bank_account_id ?? existing.bank_account_id, date || existing.date, notes ?? existing.notes, is_direct_delivery ?? existing.is_direct_delivery, req.params.id]);
        res.json((await query(`${purchaseDetails} WHERE p.id = $1`, [result.rows[0].id])).rows[0]);
    } catch (error) { res.status(500).json({ error: 'Failed to update purchase' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const purchase = (await query('SELECT * FROM purchases WHERE id = $1', [req.params.id])).rows[0];
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        if (purchase.status === 'draft') { await query('DELETE FROM purchases WHERE id = $1', [req.params.id]); return res.json({ message: 'Draft purchase deleted successfully' }); }
        if (purchase.status !== 'approved') return res.status(400).json({ error: 'Purchase already voided' });
        await withTransaction(async (client) => {
            await client.query(`UPDATE purchases SET status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id]);
            // Reduce product stock - use actual_weight_kg if it was used, otherwise use qty_kg
            const stockToReduce = purchase.actual_weight_kg ? Number(purchase.actual_weight_kg) : Number(purchase.qty_kg);
            await client.query('UPDATE products SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [stockToReduce, purchase.product_id]);
            const unpaid = Number(purchase.grand_total) - Number(purchase.amount_paid);
            if (unpaid > 0) await AccountingService.updateVendorBalance(purchase.vendor_id, unpaid, 'subtract', client);
            if (Number(purchase.amount_paid) > 0 && purchase.payment_method !== 'none') await AccountingService.updateAccountBalance(purchase.payment_method === 'cash' ? 'cash' : 'bank', purchase.amount_paid, 'add', client, purchase.bank_account_id);
        });
        res.json({ message: 'Purchase voided successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete purchase' }); }
});

module.exports = router;
