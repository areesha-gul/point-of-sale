import { useEffect, useState } from 'react';
import { bankAccounts } from '../../services/api';
import { formatIndianCurrency } from '../../services/formatter';

const initialForm = {
    name: '',
    bank_name: '',
    account_number: '',
    opening_balance: '0',
    opening_balance_date: ''
};

export default function BankAccountList() {
    const [accountList, setAccountList] = useState([]);
    const [formData, setFormData] = useState(initialForm);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const response = await bankAccounts.getAll();
            setAccountList(response.data.filter(account => account.type === 'bank'));
        } catch (err) {
            setError('Could not load bank accounts');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            await bankAccounts.create({
                ...formData,
                type: 'bank',
                opening_balance: Number(formData.opening_balance) || 0
            });
            setFormData(initialForm);
            setShowForm(false);
            await loadAccounts();
        } catch (err) {
            setError(err.response?.data?.error || 'Could not save bank account');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (account) => {
        if (!window.confirm(`Hide ${account.name}? Its transaction history will be kept.`)) return;
        try { await bankAccounts.remove(account.id); await loadAccounts(); }
        catch (err) { setError(err.response?.data?.error || 'Could not remove bank account'); }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="page-heading">
                <div>
                    <h1 className="page-title">Bank Accounts</h1>
                    <p className="page-help">Add each account and enter its balance at the start.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    + Add Bank Account
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="card form-card mb-6">
                    <h2 className="form-section-title">New bank account</h2>
                    <div className="form-grid grid-cols-1 md:grid-cols-2">
                        <div>
                            <label className="label">Account name *</label>
                            <input className="input" placeholder="e.g. Main Meezan Account" value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} required autoFocus />
                        </div>
                        <div>
                            <label className="label">Bank name *</label>
                            <input className="input" placeholder="e.g. Meezan Bank" value={formData.bank_name} onChange={event => setFormData({ ...formData, bank_name: event.target.value })} required />
                        </div>
                        <div>
                            <label className="label">Account number</label>
                            <input className="input" placeholder="Optional" value={formData.account_number} onChange={event => setFormData({ ...formData, account_number: event.target.value })} />
                        </div>
                        <div>
                            <label className="label">Starting balance (₨) *</label>
                            <input className="input" type="number" min="0" step="0.01" value={formData.opening_balance} onChange={event => setFormData({ ...formData, opening_balance: event.target.value })} required />
                        </div>
                        <div>
                            <label className="label">Balance date</label>
                            <input className="input" type="date" value={formData.opening_balance_date} onChange={event => setFormData({ ...formData, opening_balance_date: event.target.value })} />
                        </div>
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    <div className="form-actions">
                        <button className="btn-success" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Bank Account'}</button>
                        <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </form>
            )}

            {error && !showForm && <p className="form-error mb-6">{error}</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {accountList.map(account => (
                    <div className="card border-l-4 border-blue-600" key={account.id}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold">{account.name}</h2>
                                <p className="text-gray-600">{account.bank_name || 'Bank account'}</p>
                                {account.account_number && <p className="mt-1 text-sm text-gray-500">Account: {account.account_number}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Current balance</p>
                                <p className="text-2xl font-bold text-blue-700">{formatIndianCurrency(account.current_balance)}</p>
                                <button className="btn-danger mt-2 text-sm" onClick={() => handleDelete(account)}>Remove</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {accountList.length === 0 && <div className="card text-center text-gray-600">No bank accounts added yet.</div>}
        </div>
    );
}