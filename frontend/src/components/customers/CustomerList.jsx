import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customers } from '../../services/api';
import { formatIndianCurrency } from '../../services/formatter';

export default function CustomerList() {
    const [customerList, setCustomerList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await customers.getAll();
            setCustomerList(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await customers.create(formData);
            setFormData({ name: '', phone: '', address: '' });
            setShowForm(false);
            await loadCustomers();
        } catch (err) {
            setError(err.response?.data?.error || 'Could not add customer');
        }
    };

    const handleDelete = async (customer) => {
        if (!window.confirm(`Delete ${customer.name}? Customers with history cannot be deleted.`)) return;
        try { await customers.remove(customer.id); await loadCustomers(); }
        catch (err) { setError(err.response?.data?.error || 'Could not delete customer'); }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="page-heading">
                <div><h1 className="page-title">Customers</h1><p className="page-help">People who buy from you</p></div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Customer</button>
            </div>
            {showForm && <form onSubmit={handleSubmit} className="card form-card mb-6">
                <h2 className="form-section-title">New customer</h2>
                <div className="form-grid form-grid-3">
                    <input className="input" placeholder="Customer name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                    <input className="input" placeholder="Phone number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    <input className="input" placeholder="Address (optional)" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                {error && <p className="form-error">{error}</p>}
                <div className="form-actions"><button className="btn-success" type="submit">Save Customer</button><button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>}
            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Phone</th>
                            <th className="text-right py-3 px-4">Balance (Receivable)</th>
                            <th className="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customerList.map(customer => (
                            <tr key={customer.id} className="border-b">
                                <td className="py-3 px-4 font-medium">{customer.name}</td>
                                <td className="py-3 px-4">{customer.phone || '-'}</td>
                                <td className="py-3 px-4 text-right font-bold text-green-700">
                                    {formatIndianCurrency(customer.current_balance)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <Link
                                        to={`/customers/${customer.id}/ledger`}
                                        className="btn-primary text-sm"
                                    >
                                        View Ledger
                                    </Link>
                                    <button className="btn-danger text-sm" onClick={() => handleDelete(customer)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
