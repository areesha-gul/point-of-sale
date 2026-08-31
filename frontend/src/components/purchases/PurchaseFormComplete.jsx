import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { purchases, vendors, products } from '../../services/api';
import { formatIndianCurrency, getTodayDate } from '../../services/formatter';

export default function PurchaseFormComplete() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    const [vendorList, setVendorList] = useState([]);
    const [productList, setProductList] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        vendor_id: '',
        product_id: '',
        qty_kg: '',
        rate: '',
        freight_charges: '0',
        other_charges: '0',
        amount_paid: '0',
        payment_method: 'none',
        bank_account_id: '',
        date: getTodayDate(),
        notes: '',
        is_direct_delivery: 0
    });

    const [selectedVendor, setSelectedVendor] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [calculatedTotals, setCalculatedTotals] = useState({
        total: 0,
        grand_total: 0,
        remaining_payable: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        calculateTotals();
    }, [formData.qty_kg, formData.rate, formData.freight_charges, formData.other_charges, formData.amount_paid]);

    const loadData = async () => {
        try {
            const [vendorsRes, productsRes, accountsRes] = await Promise.all([
                vendors.getAll(),
                products.getAll(),
                fetch('/api/bank-accounts', { credentials: 'include' }).then(r => r.json())
            ]);
            
            setVendorList(vendorsRes.data);
            setProductList(productsRes.data);
            setBankAccounts(accountsRes);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = () => {
        const qty = parseFloat(formData.qty_kg) || 0;
        const rate = parseFloat(formData.rate) || 0;
        const freight = parseFloat(formData.freight_charges) || 0;
        const other = parseFloat(formData.other_charges) || 0;
        const paid = parseFloat(formData.amount_paid) || 0;

        const total = qty * rate;
        const grand_total = total + freight + other;
        const remaining_payable = grand_total - paid;

        setCalculatedTotals({ total, grand_total, remaining_payable });
    };

    const handleVendorChange = (e) => {
        const vendorId = e.target.value;
        setFormData({ ...formData, vendor_id: vendorId });
        
        const vendor = vendorList.find(v => v.id === parseInt(vendorId));
        setSelectedVendor(vendor);
    };

    const handleProductChange = (e) => {
        const productId = e.target.value;
        setFormData({ ...formData, product_id: productId });
        
        const product = productList.find(p => p.id === parseInt(productId));
        setSelectedProduct(product);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const data = {
                vendor_id: parseInt(formData.vendor_id),
                product_id: parseInt(formData.product_id),
                qty_kg: parseFloat(formData.qty_kg),
                rate: parseFloat(formData.rate),
                freight_charges: parseFloat(formData.freight_charges),
                other_charges: parseFloat(formData.other_charges),
                amount_paid: parseFloat(formData.amount_paid),
                payment_method: formData.payment_method,
                bank_account_id: formData.bank_account_id ? parseInt(formData.bank_account_id) : null,
                date: formData.date,
                notes: formData.notes,
                is_direct_delivery: formData.is_direct_delivery
            };

            const response = await purchases.create(data);
            
            setSuccess(`Purchase ${response.data.purchase_id} created successfully! Status: DRAFT - Needs approval.`);
            
            // Reset form
            setFormData({
                vendor_id: '',
                product_id: '',
                qty_kg: '',
                rate: '',
                freight_charges: '0',
                other_charges: '0',
                amount_paid: '0',
                payment_method: 'none',
                bank_account_id: '',
                date: getTodayDate(),
                notes: '',
                is_direct_delivery: 0
            });
            setSelectedVendor(null);
            setSelectedProduct(null);

            // Redirect after 2 seconds
            setTimeout(() => navigate('/purchases/list'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create purchase');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="text-center text-2xl">Loading...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Record Purchase</h1>
                <p className="text-gray-600">Purchase ID will be auto-generated (PUR-00001 format)</p>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg mb-6">
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vendor Selection */}
                    <div>
                        <label className="label">Select Vendor *</label>
                        <select
                            className="input"
                            value={formData.vendor_id}
                            onChange={handleVendorChange}
                            required
                        >
                            <option value="">Choose Vendor...</option>
                            {vendorList.map(vendor => (
                                <option key={vendor.id} value={vendor.id}>
                                    {vendor.vendor_id} - {vendor.name}
                                </option>
                            ))}
                        </select>
                        {selectedVendor && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                <p className="font-bold text-red-700">Previous Due:</p>
                                <p className="text-2xl font-bold text-red-800">
                                    {formatIndianCurrency(selectedVendor.current_balance)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Product Selection */}
                    <div>
                        <label className="label">Select Product *</label>
                        <select
                            className="input"
                            value={formData.product_id}
                            onChange={handleProductChange}
                            required
                        >
                            <option value="">Choose Product...</option>
                            {productList.map(product => (
                                <option key={product.id} value={product.id}>
                                    {product.product_id} - {product.name} (Stock: {product.current_stock} KG)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Quantity */}
                    <div>
                        <label className="label">Quantity (KG) *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="input"
                            value={formData.qty_kg}
                            onChange={(e) => setFormData({ ...formData, qty_kg: e.target.value })}
                            required
                        />
                    </div>

                    {/* Rate per KG */}
                    <div>
                        <label className="label">Rate per KG (₹) *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="input"
                            value={formData.rate}
                            onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                            required
                        />
                    </div>

                    {/* Total (Auto-calculated) */}
                    <div>
                        <label className="label">Product Total</label>
                        <input
                            type="text"
                            className="input bg-gray-100 font-bold text-blue-700"
                            value={formatIndianCurrency(calculatedTotals.total)}
                            readOnly
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Freight Charges */}
                    <div>
                        <label className="label">Freight Charges (₹)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            value={formData.freight_charges}
                            onChange={(e) => setFormData({ ...formData, freight_charges: e.target.value })}
                        />
                    </div>

                    {/* Other Charges */}
                    <div>
                        <label className="label">Other Charges (₹)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            value={formData.other_charges}
                            onChange={(e) => setFormData({ ...formData, other_charges: e.target.value })}
                        />
                    </div>
                </div>

                {/* Grand Total */}
                <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
                    <p className="text-lg font-medium">Grand Total (Product + Freight + Other)</p>
                    <p className="text-3xl font-bold text-blue-700">
                        {formatIndianCurrency(calculatedTotals.grand_total)}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Payment Method */}
                    <div>
                        <label className="label">Payment Method</label>
                        <select
                            className="input"
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        >
                            <option value="none">No Payment Now</option>
                            <option value="cash">Cash</option>
                            <option value="bank">Bank</option>
                        </select>
                    </div>

                    {/* Bank Account (if payment method is bank) */}
                    {formData.payment_method === 'bank' && (
                        <div>
                            <label className="label">Select Bank Account</label>
                            <select
                                className="input"
                                value={formData.bank_account_id}
                                onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                                required={formData.payment_method === 'bank'}
                            >
                                <option value="">Choose Account...</option>
                                {bankAccounts.filter(acc => acc.type === 'bank').map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.account_id} - {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Amount Paid */}
                    <div>
                        <label className="label">Amount Paid Now (₹)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={calculatedTotals.grand_total}
                            className="input"
                            value={formData.amount_paid}
                            onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                        />
                    </div>
                </div>

                {/* Remaining Payable */}
                <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
                    <p className="text-lg font-medium">Remaining Payable to Vendor</p>
                    <p className="text-3xl font-bold text-yellow-700">
                        {formatIndianCurrency(calculatedTotals.remaining_payable)}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Date */}
                    <div>
                        <label className="label">Purchase Date *</label>
                        <input
                            type="date"
                            className="input"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>

                    {/* Direct Delivery */}
                    <div className="flex items-center">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="mr-3 w-6 h-6"
                                checked={formData.is_direct_delivery === 1}
                                onChange={(e) => setFormData({ 
                                    ...formData, 
                                    is_direct_delivery: e.target.checked ? 1 : 0 
                                })}
                            />
                            <span className="text-lg">Direct Delivery to Customer</span>
                        </label>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="label">Notes</label>
                    <textarea
                        className="input"
                        rows="3"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes about this purchase..."
                    />
                </div>

                {/* Buttons */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        className="btn-success flex-1 text-xl"
                        disabled={submitting}
                    >
                        {submitting ? 'Saving...' : 'Save as Draft'}
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate('/')}
                    >
                        Cancel
                    </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                    <p><strong>Note:</strong> This purchase will be saved as DRAFT.</p>
                    <p>You need to approve it from the purchases list to finalize the transaction.</p>
                    <p>Only after approval will stock be updated and vendor balance increased.</p>
                </div>
            </form>
        </div>
    );
}
