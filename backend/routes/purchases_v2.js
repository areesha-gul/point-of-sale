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
        const { vendor_id, product_id, qty_kg, rate, freight_charges = 0, other_charges = 0, amount_paid = 0, payment_method = 'none', bank_account_id, date, notes, is_direct_delivery = 0 } = req.body;
        if (!vendor_id || !product_id || !qty_kg || !rate || !date) return res.status(400).json({ error: 'Missing required fields' });
        if (qty_kg <= 0 || rate <= 0) return res.status(400).json({ error: 'Quantity and rate must be positive' });
        if (!(await query('SELECT id FROM products WHERE id = $1', [product_id])).rows[0]) return res.status(404).json({ error: 'Product not found' });
        if (!(await query('SELECT id FROM vendors WHERE id = $1', [vendor_id])).rows[0]) return res.status(404).json({ error: 'Vendor not found' });
        const total = Number(qty_kg) * Number(rate);
        const grandTotal = total + Number(freight_charges) + Number(other_charges);
        if (amount_paid < 0 || amount_paid > grandTotal) return res.status(400).json({ error: 'Payment amount cannot exceed grand total' });
        const purchaseId = await generatePurchaseId();
        const result = await query(`
            INSERT INTO purchases (purchase_id, vendor_id, product_id, qty_kg, rate, total, freight_charges, other_charges, grand_total, amount_paid, payment_method, bank_account_id, date, notes, is_direct_delivery, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft') RETURNING id
        `, [purchaseId, vendor_id, product_id, qty_kg, rate, total, freight_charges, other_charges, grandTotal, amount_paid, payment_method, bank_account_id || null, date, notes, is_direct_delivery]);
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
            await AccountingService.updateProductAfterPurchase(purchase.product_id, purchase.qty_kg, purchase.rate, client);
            const unpaid = Number(purchase.grand_total) - Number(purchase.amount_paid);
            if (unpaid > 0) await AccountingService.updateVendorBalance(purchase.vendor_id, unpaid, 'add', client);
            if (Number(purchase.amount_paid) > 0 && purchase.payment_method !== 'none') await AccountingService.updateAccountBalance(purchase.payment_method === 'cash' ? 'cash' : 'bank', purchase.amount_paid, 'subtract', client);
            await AccountingService.recordPurchase(purchase, purchase.id, client);
        });
        res.json({ ...(await query(`${purchaseDetails} WHERE p.id = $1`, [req.params.id])).rows[0], message: 'Purchase approved successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to approve purchase', message: error.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const existing = (await query('SELECT * FROM purchases WHERE id = $1 AND status = $2', [req.params.id, 'draft'])).rows[0];
        if (!existing) return res.status(404).json({ error: 'Purchase not found or cannot be edited' });
        const { vendor_id, product_id, qty_kg, rate, freight_charges, other_charges, amount_paid, payment_method, bank_account_id, date, notes, is_direct_delivery } = req.body;
        const qty = qty_kg ?? existing.qty_kg; const unitRate = rate ?? existing.rate;
        const freight = freight_charges ?? existing.freight_charges; const other = other_charges ?? existing.other_charges;
        const total = Number(qty) * Number(unitRate); const grandTotal = total + Number(freight) + Number(other);
        const result = await query(`UPDATE purchases SET vendor_id = $1, product_id = $2, qty_kg = $3, rate = $4, total = $5, freight_charges = $6, other_charges = $7, grand_total = $8, amount_paid = $9, payment_method = $10, bank_account_id = $11, date = $12, notes = $13, is_direct_delivery = $14, updated_at = CURRENT_TIMESTAMP WHERE id = $15 RETURNING id`, [vendor_id ?? existing.vendor_id, product_id ?? existing.product_id, qty, unitRate, total, freight, other, grandTotal, amount_paid ?? existing.amount_paid, payment_method || existing.payment_method, bank_account_id ?? existing.bank_account_id, date || existing.date, notes ?? existing.notes, is_direct_delivery ?? existing.is_direct_delivery, req.params.id]);
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
            await AccountingService.updateProductAfterSale(purchase.product_id, purchase.qty_kg, client);
            const unpaid = Number(purchase.grand_total) - Number(purchase.amount_paid);
            if (unpaid > 0) await AccountingService.updateVendorBalance(purchase.vendor_id, unpaid, 'subtract', client);
            if (Number(purchase.amount_paid) > 0 && purchase.payment_method !== 'none') await AccountingService.updateAccountBalance(purchase.payment_method === 'cash' ? 'cash' : 'bank', purchase.amount_paid, 'add', client);
        });
        res.json({ message: 'Purchase voided successfully' });
    } catch (error) { res.status(500).json({ error: 'Failed to delete purchase' }); }
});

module.exports = router;
