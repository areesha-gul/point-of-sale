import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { sales, customers, products, bankAccounts as bankAccountsApi } from '../../services/api';
import { formatIndianCurrency, getTodayDate, formatDateForInput } from '../../services/formatter';

export default function SaleEdit() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [customerList, setCustomerList] = useState([]);
    const [productList, setProductList] = useState([]);
    const [bankAccountList, setBankAccountList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        customer_id: '',
        product_id: '',
        qty_kg: '',
        rate: '',
        freight_charges: '',
        round_off: '',
        amount_paid: '',
        payment_method: 'none',
        bank_account_id: '',
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
    }, [id]);

    useEffect(() => {
        calculateTotals();
    }, [formData.qty_kg, formData.rate, formData.freight_charges, formData.round_off, formData.amount_paid]);

    const loadData = async () => {
        try {
            const [saleRes, customersRes, productsRes, accountsRes] = await Promise.all([
                sales.getById(id),
                customers.getAll(),
                products.getAll(),
                bankAccountsApi.getAll()
            ]);

            const sale = saleRes.data;

            setCustomerList(customersRes.data);
            setProductList(productsRes.data);
            setBankAccountList(accountsRes.data.filter(account => account.type === 'bank'));

            const customer = customersRes.data.find(c => c.id === sale.customer_id);
            const product = productsRes.data.find(p => p.id === sale.product_id);

            setSelectedCustomer(customer);
            setSelectedProduct(product);

            setFormData({
                customer_id: String(sale.customer_id),
                product_id: String(sale.product_id),
                qty_kg: String(sale.qty_kg),
                rate: String(sale.rate),
                freight_charges: sale.freight_charges ? String(sale.freight_charges) : '',
                round_off: sale.round_off ? String(sale.round_off) : '',
                amount_paid: sale.amount_paid ? String(sale.amount_paid) : '',
                payment_method: sale.payment_method || 'none',
                bank_account_id: sale.bank_account_id ? String(sale.bank_account_id) : '',
                date: formatDateForInput(sale.date),
                notes: sale.notes || ''
            });
        } catch (err) {
            setError('Failed to load sale data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = () => {
        const qty = parseFloat(formData.qty_kg) || 0;
        const rate = parseFloat(formData.rate) || 0;
        const freight = parseFloat(formData.freight_charges) || 0;
        const roundOff = parseFloat(formData.round_off) || 0;
        const paid = parseFloat(formData.amount_paid) || 0;

        const total = Math.max(0, qty * rate - freight - roundOff);
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
                round_off: parseFloat(formData.round_off) || 0,
                amount_paid: parseFloat(formData.amount_paid),
                payment_method: formData.payment_method,
                bank_account_id: formData.bank_account_id ? parseInt(formData.bank_account_id) : null,
                date: formData.date,
                notes: formData.notes
            };

            await sales.update(id, data);
            setSuccess('Sale updated successfully!');
            setTimeout(() => navigate('/sales/list'), 1500);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update sale');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="mb-6">
                <h1 className="page-title">Edit Sale</h1>
                <p className="page-help">Update sale details (Only draft sales can be edited)</p>
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
                <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <label className="label">Sale Date *</label>
                    <input
                        type="date"
                        className="input"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                    />
                </div>

                <div className="form-grid grid-cols-1 md:grid-cols-2">
                    <div>
                        <label className="label">Select Customer *</label>
                        <select
                            className="input"
                            value={String(formData.customer_id || '')}
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

                    <div>
                        <label className="label">Select Product *</label>
                        <select
                            className="input"
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

                <div className="form-grid grid-cols-1 md:grid-cols-4">
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

                    <div>
                        <label className="label">Round Off (Subtract) (₨)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={formData.round_off}
                            onChange={(e) => setFormData({ ...formData, round_off: e.target.value })}
                        />
                    </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 mb-1">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-700">
                        {formatIndianCurrency(calculatedTotals.total)}
                    </p>
                </div>

                <div className="form-grid grid-cols-1 md:grid-cols-3">
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
                            <label className="label">Receiving Bank Account *</label>
                            <select
                                className="input select-input"
                                value={String(formData.bank_account_id || '')}
                                onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                                required
                            >
                                <option value="">Choose Bank Account...</option>
                                {bankAccountList.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name} - {account.bank_name || 'Bank'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="label">Amount Received Now (₨)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            value={formData.amount_paid}
                            onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                        />
                    </div>
                </div>

                <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
                    <p className="text-lg font-medium">Remaining Receivable from Customer</p>
                    <p className="text-3xl font-bold text-yellow-700">
                        {formatIndianCurrency(calculatedTotals.remaining_receivable)}
                    </p>
                </div>

                <div className="form-grid grid-cols-1 md:grid-cols-2">
                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            className="input"
                            rows="2"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Optional notes"
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        type="submit"
                        className="btn-success flex-1 text-xl"
                        disabled={submitting}
                    >
                        {submitting ? 'Updating...' : 'Update Sale'}
                    </button>
                    <Link to="/sales/list" className="btn-secondary">
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
