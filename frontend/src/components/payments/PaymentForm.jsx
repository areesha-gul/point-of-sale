import { useEffect, useState } from 'react';
import { payments, vendors, customers, bankAccounts } from '../../services/api';
import { formatIndianCurrency, formatDate, getTodayDate } from '../../services/formatter';

const initialForm = { party_type: 'vendor', party_id: '', amount: '', method: 'bank', bank_account_id: '', direction: 'out', date: getTodayDate(), notes: '' };

export default function PaymentForm() {
    const [formData, setFormData] = useState(initialForm);
    const [vendorList, setVendorList] = useState([]);
    const [customerList, setCustomerList] = useState([]);
    const [accountList, setAccountList] = useState([]);
    const [paymentList, setPaymentList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [vendorsRes, customersRes, accountsRes, paymentsRes] = await Promise.all([vendors.getAll(), customers.getAll(), bankAccounts.getAll(), payments.getAll()]);
            setVendorList(vendorsRes.data.filter(item => Number(item.current_balance) > 0));
            setCustomerList(customersRes.data.filter(item => Number(item.current_balance) > 0));
            setAccountList(accountsRes.data.filter(item => item.type === 'bank'));
            setPaymentList(paymentsRes.data);
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

    if (loading) return <div className="text-center text-2xl">Loading...</div>;
    return <div className="page-shell">
        <div className="mb-6"><h1 className="page-title">Record Payment</h1><p className="page-help">Pay a vendor later, or record money received from a customer.</p></div>
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
        <div className="card overflow-x-auto"><h2 className="form-section-title">Payment records</h2>{paymentList.length === 0 ? <p className="text-gray-600">No payment records yet.</p> : <table className="w-full"><thead><tr className="border-b-2"><th className="text-left py-3 px-4">Date</th><th className="text-left py-3 px-4">Party</th><th className="text-right py-3 px-4">Amount</th><th className="text-center py-3 px-4">Action</th></tr></thead><tbody>{paymentList.map(payment => <tr className="border-b" key={payment.id}><td className="py-3 px-4">{formatDate(payment.date)}</td><td className="py-3 px-4">{payment.party_name || payment.party_type}</td><td className="py-3 px-4 text-right font-bold">{formatIndianCurrency(payment.amount)}</td><td className="py-3 px-4 text-center"><button className="btn-danger text-sm" onClick={() => handleDelete(payment)}>Delete</button></td></tr>)}</tbody></table>}</div>
    </div>;
}
