import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { settlements, customers, vendors } from '../../services/api';
import { formatIndianCurrency, getTodayDate } from '../../services/formatter';

/**
 * CRITICAL FEATURE: Direct Settlement Component
 * 
 * This allows recording when a customer pays a vendor directly on the company's behalf.
 * This is the core business requirement that differentiates this POS system.
 * 
 * Key behavior:
 * - Customer receivable is reduced (customer owes less)
 * - Vendor payable is reduced (company owes vendor less)
 * - NO cash or bank accounts are touched
 */
export default function DirectSettlement() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    
    const [customerList, setCustomerList] = useState([]);
    const [vendorList, setVendorList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [settlementList, setSettlementList] = useState([]);

    const [formData, setFormData] = useState({
        customer_id: '',
        vendor_id: '',
        amount: '',
        date: getTodayDate(),
        notes: ''
    });

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedVendor, setSelectedVendor] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [customersRes, vendorsRes, settlementsRes] = await Promise.all([
                customers.getAll(),
                vendors.getAll(),
                settlements.getAll()
            ]);
            
            // Filter to only show customers with outstanding receivables
            const customersWithBalance = customersRes.data.filter(c => c.current_balance > 0);
            // Filter to only show vendors with outstanding payables
            const vendorsWithBalance = vendorsRes.data.filter(v => v.current_balance > 0);
            
            setCustomerList(customersWithBalance);
            setVendorList(vendorsWithBalance);
            setSettlementList(settlementsRes.data);
        } catch (err) {
            setError('Failed to load customers and vendors');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSettlement = async (settlement) => {
        if (!window.confirm('Delete this direct settlement? Balances will be restored.')) return;
        try { await settlements.remove(settlement.id); await loadData(); }
        catch (err) { setError(err.response?.data?.error || 'Could not delete settlement'); }
    };

    const handleCustomerChange = (e) => {
        const customerId = e.target.value;
        setFormData({ ...formData, customer_id: customerId });
        
        const customer = customerList.find(c => c.id === parseInt(customerId));
        setSelectedCustomer(customer);
        setError('');
    };

    const handleVendorChange = (e) => {
        const vendorId = e.target.value;
        setFormData({ ...formData, vendor_id: vendorId });
        
        const vendor = vendorList.find(v => v.id === parseInt(vendorId));
        setSelectedVendor(vendor);
        setError('');
    };

    const handleAmountChange = (e) => {
        const amount = e.target.value;
        setFormData({ ...formData, amount });
        setError('');

        // Validate amount against both balances
        if (amount && selectedCustomer && selectedVendor) {
            const numAmount = parseFloat(amount);
            if (numAmount > selectedCustomer.current_balance) {
                setError(`Amount exceeds customer receivable (${formatIndianCurrency(selectedCustomer.current_balance)})`);
            } else if (numAmount > selectedVendor.current_balance) {
                setError(`Amount exceeds vendor payable (${formatIndianCurrency(selectedVendor.current_balance)})`);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const data = {
                customer_id: parseInt(formData.customer_id),
                vendor_id: parseInt(formData.vendor_id),
                amount: parseFloat(formData.amount),
                date: formData.date,
                notes: formData.notes
            };

            const response = await settlements.create(data);
            
            setSuccess(response.data.message || 'Direct settlement recorded successfully!');
            
            // Reset form
            setFormData({
                customer_id: '',
                vendor_id: '',
                amount: '',
                date: getTodayDate(),
                notes: ''
            });
            setSelectedCustomer(null);
            setSelectedVendor(null);

            // Reload data to get updated balances
            await loadData();

            // Redirect to dashboard after 2 seconds
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to record settlement');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="text-center text-2xl">Loading...</div>;
    }

    const maxAmount = selectedCustomer && selectedVendor 
        ? Math.min(selectedCustomer.current_balance, selectedVendor.current_balance)
        : 0;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">{t('directSettlement')}</h1>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-lg text-blue-800">
                        <strong>Important:</strong> {t('settlementDescription')}
                    </p>
                    <p className="text-blue-700 mt-2">
                        Use this when a customer pays a vendor directly on your behalf. 
                        This reduces both what the customer owes you and what you owe the vendor, 
                        without any cash or bank transaction.
                    </p>
                </div>
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
                {/* Customer Selection */}
                <div>
                    <label className="label">
                        {t('customer')} (Who is paying) *
                    </label>
                    <select
                        className="input"
                        value={formData.customer_id}
                        onChange={handleCustomerChange}
                        required
                    >
                        <option value="">Select Customer</option>
                        {customerList.map(customer => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name} - Owes: {formatIndianCurrency(customer.current_balance)}
                            </option>
                        ))}
                    </select>
                    {selectedCustomer && (
                        <p className="mt-2 text-lg text-green-700">
                            Current Receivable: <strong>{formatIndianCurrency(selectedCustomer.current_balance)}</strong>
                        </p>
                    )}
                </div>

                {/* Vendor Selection */}
                <div>
                    <label className="label">
                        {t('vendor')} (Who is receiving) *
                    </label>
                    <select
                        className="input"
                        value={formData.vendor_id}
                        onChange={handleVendorChange}
                        required
                    >
                        <option value="">Select Vendor</option>
                        {vendorList.map(vendor => (
                            <option key={vendor.id} value={vendor.id}>
                                {vendor.name} - Owed: {formatIndianCurrency(vendor.current_balance)}
                            </option>
                        ))}
                    </select>
                    {selectedVendor && (
                        <p className="mt-2 text-lg text-red-700">
                            Current Payable: <strong>{formatIndianCurrency(selectedVendor.current_balance)}</strong>
                        </p>
                    )}
                </div>

                {/* Amount */}
                <div>
                    <label className="label">{t('amount')} (₨) *</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={maxAmount}
                        className="input"
                        value={formData.amount}
                        onChange={handleAmountChange}
                        required
                    />
                    {selectedCustomer && selectedVendor && (
                        <p className="mt-2 text-lg text-blue-700">
                            Maximum settleable amount: <strong>{formatIndianCurrency(maxAmount)}</strong>
                        </p>
                    )}
                </div>

                {/* Date */}
                <div>
                    <label className="label">{t('date')} *</label>
                    <input
                        type="date"
                        className="input"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                    />
                </div>

                {/* Notes */}
                <div>
                    <label className="label">{t('notes')}</label>
                    <textarea
                        className="input"
                        rows="3"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="E.g., Customer A paid Vendor B directly as per agreement"
                    />
                </div>

                {/* Summary Box */}
                {selectedCustomer && selectedVendor && formData.amount && (
                    <div className="bg-yellow-50 border-2 border-yellow-300 p-6 rounded-lg">
                        <h3 className="text-xl font-bold mb-4">Settlement Preview</h3>
                        <div className="space-y-2 text-lg">
                            <p>
                                <strong>{selectedCustomer.name}</strong> will pay{' '}
                                <strong>{selectedVendor.name}</strong> directly
                            </p>
                            <p className="text-2xl font-bold text-blue-700">
                                {formatIndianCurrency(parseFloat(formData.amount))}
                            </p>
                            <hr className="my-3" />
                            <p className="text-green-700">
                                {selectedCustomer.name}'s balance: {formatIndianCurrency(selectedCustomer.current_balance)} → {' '}
                                <strong>{formatIndianCurrency(selectedCustomer.current_balance - parseFloat(formData.amount))}</strong>
                            </p>
                            <p className="text-red-700">
                                {selectedVendor.name}'s balance: {formatIndianCurrency(selectedVendor.current_balance)} → {' '}
                                <strong>{formatIndianCurrency(selectedVendor.current_balance - parseFloat(formData.amount))}</strong>
                            </p>
                            <p className="text-gray-700 mt-3 italic">
                                ⚠️ No cash or bank accounts will be affected
                            </p>
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        className="btn-success flex-1 text-xl"
                        disabled={submitting || !!error}
                    >
                        {submitting ? 'Recording...' : 'Record Direct Settlement'}
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate('/')}
                    >
                        {t('cancel')}
                    </button>
                </div>
            </form>

            {/* Help Section */}
            <div className="mt-8 card bg-gray-50">
                <h3 className="text-xl font-bold mb-3">How Direct Settlement Works</h3>
                <div className="space-y-2 text-gray-700">
                    <p><strong>Example:</strong></p>
                    <p>1. Customer A owes you ₨1,00,00,000 (receivable)</p>
                    <p>2. You owe Vendor B ₨70,00,000 (payable)</p>
                    <p>3. Customer A pays Vendor B ₨70,00,000 directly</p>
                    <p><strong>Result:</strong></p>
                    <p>• Customer A now owes you ₨30,00,000</p>
                    <p>• You now owe Vendor B ₨0</p>
                    <p>• Your cash/bank balances remain unchanged</p>
                </div>
            </div>
            <div className="card mt-6 overflow-x-auto">
                <h2 className="form-section-title">Direct settlement records</h2>
                {settlementList.length === 0 ? <p className="text-gray-600">No settlement records yet.</p> : <table className="w-full"><thead><tr className="border-b-2"><th className="text-left py-3 px-4">Date</th><th className="text-left py-3 px-4">Customer</th><th className="text-left py-3 px-4">Vendor</th><th className="text-right py-3 px-4">Amount</th><th className="text-center py-3 px-4">Action</th></tr></thead><tbody>{settlementList.map(settlement => <tr className="border-b" key={settlement.id}><td className="py-3 px-4">{settlement.date}</td><td className="py-3 px-4">{settlement.customer_name}</td><td className="py-3 px-4">{settlement.vendor_name}</td><td className="py-3 px-4 text-right font-bold">{formatIndianCurrency(settlement.amount)}</td><td className="py-3 px-4 text-center"><button className="btn-danger text-sm" onClick={() => handleDeleteSettlement(settlement)}>Delete</button></td></tr>)}</tbody></table>}
            </div>
        </div>
    );
}
