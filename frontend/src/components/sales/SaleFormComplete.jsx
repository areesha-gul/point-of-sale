import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sales, customers, products } from '../../services/api';
import { formatIndianCurrency, getTodayDate } from '../../services/formatter';

export default function SaleFormComplete() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    const [customerList, setCustomerList] = useState([]);
    const [productList, setProductList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        customer_id: '',
        product_id: '',
        qty_kg: '',
        rate: '',
        freight_charges: '0',
        amount_paid: '0',
        payment_method: 'none',
        date: getTodayDate(),
        notes: ''
    });

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [calculatedTotals, setCalculatedTotals] = useState({
        total: 0,
        remaining_receivable: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        calculateTotals();
    }, [formData.qty_kg, formData.rate, formData.freight_charges, formData.amount_paid]);

    const loadData = async () => {
        try {
            const [customersRes, productsRes] = await Promise.all([
                customers.getAll(),
                products.getAll()
            ]);
            
            setCustomerList(customersRes.data);
            setProductList(productsRes.data);
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
        const paid = parseFloat(formData.amount_paid) || 0;

        const total = Math.max(0, qty * rate - freight);
        const remaining_receivable = total - paid;

        setCalculatedTotals({ total, remaining_receivable });
    };

    const handleCustomerChange = (e) => {
        const customerId = e.target.value;
        setFormData({ ...formData, customer_id: customerId });
        
        const customer = customerList.find(c => c.id === parseInt(customerId));
        setSelectedCustomer(customer);
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
                customer_id: parseInt(formData.customer_id),
                product_id: parseInt(formData.product_id),
                qty_kg: parseFloat(formData.qty_kg),
                rate: parseFloat(formData.rate),
                freight_charges: parseFloat(formData.freight_charges) || 0,
                amount_paid: parseFloat(formData.amount_paid),
                payment_method: formData.payment_method,
                date: formData.date,
                notes: formData.notes
            };

            const response = await sales.create(data);
            
            setSuccess(`Sale ${response.data.sale_id} created successfully! Status: DRAFT - Needs approval.`);
            
            // Reset form
            setFormData({
                customer_id: '',
                product_id: '',
                qty_kg: '',
                rate: '',
                freight_charges: '0',
                amount_paid: '0',
                payment_method: 'none',
                date: getTodayDate(),
                notes: ''
            });
            setSelectedCustomer(null);
            setSelectedProduct(null);

            // Redirect after 2 seconds
            setTimeout(() => navigate('/sales/list'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create sale');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="text-center text-2xl">Loading...</div>;
    }

    return (
        <div className="page-shell">
            <div className="mb-6">
            <h1 className="page-title">New Sale</h1>
            <p className="page-help">Choose the customer, product, quantity, and price.</p>
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
                    {/* Customer Selection */}
                    <div>
                        <label className="label">Select Customer *</label>
                        <select
                            className="input"
                            value={formData.customer_id}
                            onChange={handleCustomerChange}
                            required
                        >
                            <option value="">Choose Customer...</option>
                            {customerList.map(customer => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.customer_id} - {customer.name}
                                </option>
                            ))}
                        </select>
                        {selectedCustomer && (
                            <div className="mt-2 rounded-lg bg-green-50 px-3 py-2">
                                <p className="font-bold text-green-700">Previous Due:</p>
                                <p className="text-2xl font-bold text-green-800">
                                    {formatIndianCurrency(selectedCustomer.current_balance)}
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
                        {selectedProduct && selectedProduct.current_stock < parseFloat(formData.qty_kg || 0) && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700">
                                ⚠️ Insufficient stock! Available: {selectedProduct.current_stock} KG
                            </div>
                        )}
                    </div>
                </div>

                <div className="form-grid grid-cols-1 md:grid-cols-4">
                    {/* Quantity */}
                    <div>
                        <label className="label">Quantity (KG) *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={selectedProduct?.current_stock}
                            className="input"
                            value={formData.qty_kg}
                            onChange={(e) => setFormData({ ...formData, qty_kg: e.target.value })}
                            required
                        />
                        {selectedProduct && (
                            <p className="text-sm text-gray-600 mt-1">
                                Available: {selectedProduct.current_stock} KG
                            </p>
                        )}
                    </div>

                    {/* Price per KG */}
                    <div>
                        <label className="label">Price per KG (₨) *</label>
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

                    <div>
                        <label className="label">Freight (₨)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            value={formData.freight_charges}
                            onChange={(e) => setFormData({ ...formData, freight_charges: e.target.value })}
                        />
                    </div>

                    {/* Total (Auto-calculated) */}
                    <div>
                        <label className="label">Total Amount</label>
                        <input
                            type="text"
                            className="input bg-gray-100 font-bold text-blue-700"
                            value={formatIndianCurrency(calculatedTotals.total)}
                            readOnly
                        />
                    </div>
                </div>

                <details className="rounded-lg border border-gray-200 p-4">
                    <summary className="cursor-pointer text-lg font-bold text-blue-700">Payment details</summary>
                <div className="form-grid mt-4 grid-cols-1 md:grid-cols-3">
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

                    {/* Amount Received */}
                    <div>
                        <label className="label">Amount Received Now (₨)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={calculatedTotals.total}
                            className="input"
                            value={formData.amount_paid}
                            onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="label">Sale Date *</label>
                        <input
                            type="date"
                            className="input"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                </div>
                </details>

                {/* Remaining Receivable */}
                <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
                    <p className="text-lg font-medium">Remaining Receivable from Customer</p>
                    <p className="text-3xl font-bold text-yellow-700">
                        {formatIndianCurrency(calculatedTotals.remaining_receivable)}
                    </p>
                </div>

                <details className="rounded-lg border border-gray-200 p-4">
                    <summary className="cursor-pointer text-lg font-bold text-blue-700">Optional note</summary>
                    <textarea className="input mt-4" rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Add a note if needed" />
                </details>

                {/* Buttons */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        className="btn-success flex-1 text-xl"
                        disabled={submitting || (selectedProduct && selectedProduct.current_stock < parseFloat(formData.qty_kg || 0))}
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

            </form>
        </div>
    );
}
