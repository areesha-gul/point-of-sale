import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { purchases, vendors, products, bankAccounts as bankAccountsApi } from '../../services/api';
import { formatIndianCurrency, getTodayDate, formatDateForInput } from '../../services/formatter';

export default function PurchaseEdit() {
    const { id } = useParams();
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
        actual_weight_kg: '',
        rate: '',
        freight_charges: '0',
        other_charges: '0',
        round_off: '0',
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
    }, [id]);

    useEffect(() => {
        calculateTotals();
    }, [formData.qty_kg, formData.rate, formData.freight_charges, formData.other_charges, formData.round_off, formData.amount_paid]);

    const loadData = async () => {
        try {
            const [purchaseRes, vendorsRes, productsRes, bankAccountsRes] = await Promise.all([
                purchases.getById(id),
                vendors.getAll(),
                products.getAll(),
                bankAccountsApi.getAll()
            ]);

            const purchase = purchaseRes.data;
            
            console.log('Purchase data:', purchase);
            console.log('Vendor ID:', purchase.vendor_id, 'Type:', typeof purchase.vendor_id);
            console.log('Product ID:', purchase.product_id, 'Type:', typeof purchase.product_id);
            
            // Set lists first
            setVendorList(vendorsRes.data);
            setProductList(productsRes.data);
            setBankAccounts(bankAccountsRes.data);

            console.log('Vendors:', vendorsRes.data);
            console.log('Products:', productsRes.data);

            // Set selected vendor and product
            const vendor = vendorsRes.data.find(v => v.id === purchase.vendor_id);
            const product = productsRes.data.find(p => p.id === purchase.product_id);
            
            console.log('Found vendor:', vendor);
            console.log('Found product:', product);
            
            setSelectedVendor(vendor);
            setSelectedProduct(product);

            // Then populate form with existing data (after lists are set)
            const formValues = {
                vendor_id: String(purchase.vendor_id),
                product_id: String(purchase.product_id),
                qty_kg: String(purchase.qty_kg),
                actual_weight_kg: purchase.actual_weight_kg ? String(purchase.actual_weight_kg) : '',
                rate: String(purchase.rate),
                freight_charges: String(purchase.freight_charges || 0),
                other_charges: String(purchase.other_charges || 0),
                round_off: String(purchase.round_off || 0),
                amount_paid: String(purchase.amount_paid || 0),
                payment_method: purchase.payment_method || 'none',
                bank_account_id: purchase.bank_account_id ? String(purchase.bank_account_id) : '',
                date: formatDateForInput(purchase.date),
                notes: purchase.notes || '',
                is_direct_delivery: purchase.is_direct_delivery || 0
            };
            
            console.log('Form values to set:', formValues);
            setFormData(formValues);

        } catch (err) {
            setError('Failed to load purchase data');
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = () => {
        const qty = parseFloat(formData.qty_kg) || 0;
        const rate = parseFloat(formData.rate) || 0;
        const freight = parseFloat(formData.freight_charges) || 0;
        const other = parseFloat(formData.other_charges) || 0;
        const roundOff = parseFloat(formData.round_off) || 0;
        const paid = parseFloat(formData.amount_paid) || 0;

        const total = qty * rate;
        const grand_total = Math.max(0, total - freight + other - roundOff);
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
                actual_weight_kg: formData.actual_weight_kg ? parseFloat(formData.actual_weight_kg) : null,
                rate: parseFloat(formData.rate),
                freight_charges: parseFloat(formData.freight_charges),
                other_charges: parseFloat(formData.other_charges),
                round_off: parseFloat(formData.round_off) || 0,
                amount_paid: parseFloat(formData.amount_paid),
                payment_method: formData.payment_method,
                bank_account_id: formData.bank_account_id ? parseInt(formData.bank_account_id) : null,
                date: formData.date,
                notes: formData.notes,
                is_direct_delivery: formData.is_direct_delivery
            };

            await purchases.update(id, data);
            
            setSuccess('Purchase updated successfully!');
            setTimeout(() => navigate('/purchases/list'), 1500);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update purchase');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="mb-6">
                <h1 className="page-title">Edit Purchase</h1>
                <p className="page-help">Update purchase details (Only draft purchases can be edited)</p>
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

            <form onSubmit={handleSubmit} className="card form-card space-y-4">
                <div className="form-grid grid-cols-1 md:grid-cols-2">
                    {/* Vendor Selection */}
                    <div>
                        <label className="label">Select Vendor *</label>
                        <select
                            className="input select-input"
                            value={String(formData.vendor_id || '')}
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
                            className="input select-input"
                            value={String(formData.product_id || '')}
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

                <div className="form-grid grid-cols-1 md:grid-cols-3">
                    {/* Billed Weight */}
                    <div>
                        <label className="label">Billed Weight (KG) *</label>
                        <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            className="input"
                            value={formData.qty_kg}
                            onChange={(e) => setFormData({ ...formData, qty_kg: e.target.value })}
                            required
                        />
                        <p className="text-xs text-gray-600 mt-1">Weight on invoice/bill</p>
                    </div>

                    {/* Actual Received Weight */}
                    <div>
                        <label className="label">Actual Received Weight (KG)</label>
                        <input
                            type="number"
                            step="0.001"
                            min="0"
                            className="input"
                            value={formData.actual_weight_kg}
                            onChange={(e) => setFormData({ ...formData, actual_weight_kg: e.target.value })}
                            placeholder="Optional"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                            {formData.actual_weight_kg && formData.qty_kg ? (
                                <span className={parseFloat(formData.actual_weight_kg) > parseFloat(formData.qty_kg) ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                    Difference: {(parseFloat(formData.actual_weight_kg || 0) - parseFloat(formData.qty_kg || 0)).toFixed(3)} KG
                                </span>
                            ) : 'Weight on scale (if different)'}
                        </p>
                    </div>

                    {/* Rate per KG */}
                    <div>
                        <label className="label">Rate per KG (₨) *</label>
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
                </div>

                {/* Total */}
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 mb-1">Product Total (Billed Weight × Rate)</p>
                    <p className="text-2xl font-bold text-blue-700">
                        {formatIndianCurrency(calculatedTotals.total)}
                    </p>
                    {formData.actual_weight_kg && formData.actual_weight_kg !== formData.qty_kg && (
                        <p className="text-sm text-gray-600 mt-2">
                            <span className="font-semibold">Note:</span> Vendor will be paid based on billed weight. Stock will be added based on actual received weight.
                        </p>
                    )}
                </div>

                <details className="rounded-lg border border-gray-200 p-4">
                    <summary className="cursor-pointer text-lg font-bold text-blue-700">Optional charges</summary>
                    <div className="form-grid mt-4 grid-cols-1 md:grid-cols-3">
                        <div>
                            <label className="label">Freight Charges (₨)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                value={formData.freight_charges}
                                onChange={(e) => setFormData({ ...formData, freight_charges: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Other Charges (₨)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                value={formData.other_charges}
                                onChange={(e) => setFormData({ ...formData, other_charges: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Round Off (Subtract) (₨)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                value={formData.round_off}
                                onChange={(e) => setFormData({ ...formData, round_off: e.target.value })}
                                placeholder="e.g., 1.25"
                            />
                        </div>
                    </div>
                </details>

                {/* Grand Total */}
                <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
                    <p className="text-lg font-medium">Grand Total (Product - Freight + Other)</p>
                    <p className="text-3xl font-bold text-blue-700">
                        {formatIndianCurrency(calculatedTotals.grand_total)}
                    </p>
                </div>

                <details className="rounded-lg border border-gray-200 p-4">
                    <summary className="cursor-pointer text-lg font-bold text-blue-700">Payment details</summary>
                    <div className="form-grid mt-4 grid-cols-1 md:grid-cols-3">
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

                        {formData.payment_method === 'bank' && (
                            <div>
                                <label className="label">Bank Account *</label>
                                <select
                                    className="input"
                                    value={formData.bank_account_id}
                                    onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Bank...</option>
                                    {bankAccounts.filter(a => a.type === 'bank').map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="label">Amount Paid (₨)</label>
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
                </details>

                <div className="form-grid grid-cols-1 md:grid-cols-2">
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
                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            className="input"
                            rows="1"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Optional notes"
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn-success"
                    >
                        {submitting ? 'Updating...' : 'Update Purchase'}
                    </button>
                    <Link to="/purchases/list" className="btn-secondary">
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
