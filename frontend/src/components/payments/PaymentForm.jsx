import { useEffect, useState } from 'react';
import { payments, vendors, customers, bankAccounts, profitWithdrawals } from '../../services/api';
import { formatIndianCurrency, formatDate, getTodayDate } from '../../services/formatter';

const initialForm = { party_type: 'vendor', party_id: '', amount: '', method: 'bank', bank_account_id: '', direction: 'out', date: getTodayDate(), notes: '' };
const initialProfitForm = { recipient: 'Istekhar', amount: '', method: 'bank', bank_account_id: '', date: getTodayDate(), notes: '' };

export default function PaymentForm() {
    const [formData, setFormData] = useState(initialForm);
    const [profitFormData, setProfitFormData] = useState(initialProfitForm);
    const [vendorList, setVendorList] = useState([]);
    const [customerList, setCustomerList] = useState([]);
    const [accountList, setAccountList] = useState([]);
    const [paymentList, setPaymentList] = useState([]);
    const [profitWithdrawalList, setProfitWithdrawalList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('regular'); // 'regular' or 'profit'

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [vendorsRes, customersRes, accountsRes, paymentsRes, profitRes] = await Promise.all([
                vendors.getAll(), 
                customers.getAll(), 
                bankAccounts.getAll(), 
                payments.getAll(),
                profitWithdrawals.getAll()
            ]);
            setVendorList(vendorsRes.data.filter(item => Number(item.current_balance) > 0));
            setCustomerList(customersRes.data.filter(item => Number(item.current_balance) > 0));
            setAccountList(accountsRes.data.filter(item => item.type === 'bank'));
            setPaymentList(paymentsRes.data);
            setProfitWithdrawalList(profitRes.data);
        } catch (err) { setError('Could not load payment data'); }
        finally { setLoading(false); }
    };

    const partyList = formData.party_type === 'vendor' ? vendorList : customerList;
    const handleTypeChange = (party_type) => setFormData({ ...formData, party_type, party_id: '', direction: party_type === 'vendor' ? 'out' : 'in' });

    const handleSubmit = async (event) => {
        event.preventDefault(); setSaving(true); setError(''); setSuccess('');
        try {
            await payments.create({ ...formData, party_id: Number(formData.party_id), amount: Number(formData.amount), bank_account_id: formData.method === 'bank' ? Number(formData.bank_account_id) : null });
            setSuccess('Payment recorded and balances updated.'); setFormData(initialForm); await loadData();
        } catch (err) { setError(err.response?.data?.error || 'Could not record payment'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (payment) => {
        if (!window.confirm('Delete this payment and restore the balance?')) return;
        try { await payments.remove(payment.id); await loadData(); }
        catch (err) { setError(err.response?.data?.error || 'Could not delete payment'); }
    };

    const handleSubmitProfit = async (event) => {
        event.preventDefault(); setSaving(true); setError(''); setSuccess('');
        try {
            await profitWithdrawals.create({ 
                ...profitFormData, 
                amount: Number(profitFormData.amount), 
                bank_account_id: profitFormData.method === 'bank' ? Number(profitFormData.bank_account_id) : null 
            });
            setSuccess('Profit withdrawal recorded successfully!'); 
            setProfitFormData(initialProfitForm); 
            await loadData();
        } catch (err) { setError(err.response?.data?.error || 'Could not record profit withdrawal'); }
        finally { setSaving(false); }
    };

    const handleDeleteProfit = async (withdrawal) => {
        if (!window.confirm('Delete this profit withdrawal and restore the cash/bank balance?')) return;
        try { await profitWithdrawals.remove(withdrawal.id); await loadData(); }
        catch (err) { setError(err.response?.data?.error || 'Could not delete withdrawal'); }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;
    
    return <div className="page-shell">
        <div className="mb-6">
            <h1 className="page-title">Record Payment</h1>
            <p className="page-help">Record payments to/from vendors/customers, or record profit withdrawals for partners.</p>
        </div>

        {/* Tab Navigation */}
        <div className="card mb-6">
            <div className="flex border-b border-gray-200">
                <button 
                    className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'regular' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                    onClick={() => { setActiveTab('regular'); setError(''); setSuccess(''); }}
                >
                    Regular Payments
                </button>
                <button 
                    className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'profit' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-gray-600 hover:text-emerald-600'}`}
                    onClick={() => { setActiveTab('profit'); setError(''); setSuccess(''); }}
                >
                    Profit Withdrawals
                </button>
            </div>
        </div>

        {/* Regular Payments Tab */}
        {activeTab === 'regular' && (
            <>
                <form onSubmit={handleSubmit} className="card form-card mb-6 space-y-4">
                    <div className="form-grid grid-cols-1 md:grid-cols-2">
                        <div><label className="label">Payment type *</label><select className="input select-input" value={formData.party_type} onChange={e => handleTypeChange(e.target.value)}><option value="vendor">Pay vendor</option><option value="customer">Receive from customer</option></select></div>
                        <div><label className="label">{formData.party_type === 'vendor' ? 'Vendor' : 'Customer'} *</label><select className="input select-input" value={formData.party_id} onChange={e => setFormData({ ...formData, party_id: e.target.value })} required><option value="">Choose...</option>{partyList.map(item => <option key={item.id} value={item.id}>{item.name} - Due {formatIndianCurrency(item.current_balance)}</option>)}</select></div>
                        <div><label className="label">Amount (₨) *</label><input className="input" type="number" min="0.01" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required /></div>
                        <div><label className="label">Method *</label><select className="input select-input" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value, bank_account_id: '' })}><option value="bank">Bank</option><option value="cash">Cash</option></select></div>
                        {formData.method === 'bank' && <div><label className="label">Bank account *</label><select className="input select-input" value={formData.bank_account_id} onChange={e => setFormData({ ...formData, bank_account_id: e.target.value })} required><option value="">Choose account...</option>{accountList.map(account => <option key={account.id} value={account.id}>{account.name} - {formatIndianCurrency(account.current_balance)}</option>)}</select></div>}
                        <div><label className="label">Date *</label><input className="input" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required /></div>
                    </div>
                    <textarea className="input" rows="2" placeholder="Note (optional)" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                    {error && <p className="form-error">{error}</p>}{success && <p className="form-success">{success}</p>}
                    <button className="btn-success w-full text-xl" disabled={saving}>{saving ? 'Saving...' : 'Save Payment'}</button>
                </form>
                <div className="card overflow-x-auto">
                    <h2 className="form-section-title">Payment records</h2>
                    {paymentList.length === 0 ? <p className="text-gray-600">No payment records yet.</p> : 
                    <table className="w-full">
                        <thead><tr className="border-b-2"><th className="text-left py-3 px-4">Date</th><th className="text-left py-3 px-4">Party</th><th className="text-right py-3 px-4">Amount</th><th className="text-center py-3 px-4">Action</th></tr></thead>
                        <tbody>{paymentList.map(payment => <tr className="border-b" key={payment.id}><td className="py-3 px-4">{formatDate(payment.date)}</td><td className="py-3 px-4">{payment.party_name || payment.party_type}</td><td className="py-3 px-4 text-right font-bold">{formatIndianCurrency(payment.amount)}</td><td className="py-3 px-4 text-center"><button className="btn-danger text-sm" onClick={() => handleDelete(payment)}>Delete</button></td></tr>)}</tbody>
                    </table>}
                </div>
            </>
        )}

        {/* Profit Withdrawals Tab */}
        {activeTab === 'profit' && (
            <>
                <form onSubmit={handleSubmitProfit} className="card form-card mb-6 space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mb-4">
                        <p className="text-sm text-emerald-800">
                            <strong>Profit Share:</strong> Istekhar (2/5), Shaukat (2/5), Bank loan (1/5). Partners can withdraw any amount - it doesn't have to match their share exactly.
                        </p>
                    </div>
                    <div className="form-grid grid-cols-1 md:grid-cols-2">
                        <div>
                            <label className="label">Recipient *</label>
                            <select className="input select-input" value={profitFormData.recipient} onChange={e => setProfitFormData({ ...profitFormData, recipient: e.target.value })} required>
                                <option value="Istekhar">Istekhar (2/5 share)</option>
                                <option value="Shaukat">Shaukat (2/5 share)</option>
                                <option value="Bank">Bank Loan Payment (1/5 share)</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Amount (₨) *</label>
                            <input className="input" type="number" min="0.01" step="0.01" value={profitFormData.amount} onChange={e => setProfitFormData({ ...profitFormData, amount: e.target.value })} required />
                        </div>
                        <div>
                            <label className="label">Method *</label>
                            <select className="input select-input" value={profitFormData.method} onChange={e => setProfitFormData({ ...profitFormData, method: e.target.value, bank_account_id: '' })}>
                                <option value="bank">Bank</option>
                                <option value="cash">Cash</option>
                            </select>
                        </div>
                        {profitFormData.method === 'bank' && (
                            <div>
                                <label className="label">Bank account *</label>
                                <select className="input select-input" value={profitFormData.bank_account_id} onChange={e => setProfitFormData({ ...profitFormData, bank_account_id: e.target.value })} required>
                                    <option value="">Choose account...</option>
                                    {accountList.map(account => <option key={account.id} value={account.id}>{account.name} - {formatIndianCurrency(account.current_balance)}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="label">Date *</label>
                            <input className="input" type="date" value={profitFormData.date} onChange={e => setProfitFormData({ ...profitFormData, date: e.target.value })} required />
                        </div>
                    </div>
                    <textarea className="input" rows="2" placeholder="Note (optional)" value={profitFormData.notes} onChange={e => setProfitFormData({ ...profitFormData, notes: e.target.value })} />
                    {error && <p className="form-error">{error}</p>}{success && <p className="form-success">{success}</p>}
                    <button className="btn-success w-full text-xl" disabled={saving}>{saving ? 'Saving...' : 'Record Profit Withdrawal'}</button>
                </form>
                <div className="card overflow-x-auto">
                    <h2 className="form-section-title">Profit Withdrawal History</h2>
                    {profitWithdrawalList.length === 0 ? <p className="text-gray-600">No profit withdrawals yet.</p> : 
                    <table className="w-full">
                        <thead><tr className="border-b-2"><th className="text-left py-3 px-4">Date</th><th className="text-left py-3 px-4">Recipient</th><th className="text-left py-3 px-4">Method</th><th className="text-right py-3 px-4">Amount</th><th className="text-center py-3 px-4">Action</th></tr></thead>
                        <tbody>{profitWithdrawalList.map(withdrawal => <tr className="border-b" key={withdrawal.id}><td className="py-3 px-4">{formatDate(withdrawal.date)}</td><td className="py-3 px-4 font-semibold">{withdrawal.recipient}</td><td className="py-3 px-4 capitalize">{withdrawal.method}</td><td className="py-3 px-4 text-right font-bold">{formatIndianCurrency(withdrawal.amount)}</td><td className="py-3 px-4 text-center"><button className="btn-danger text-sm" onClick={() => handleDeleteProfit(withdrawal)}>Delete</button></td></tr>)}</tbody>
                    </table>}
                </div>
            </>
        )}
    </div>;
}
