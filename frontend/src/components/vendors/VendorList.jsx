import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { vendors } from '../../services/api';
import { formatIndianCurrency } from '../../services/formatter';

export default function VendorList() {
    const [vendorList, setVendorList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        loadVendors();
    }, []);

    const loadVendors = async () => {
        try {
            const response = await vendors.getAll();
            setVendorList(response.data);
        } catch (error) {
            console.error('Error loading vendors:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await vendors.create(formData);
            setFormData({ name: '', phone: '', address: '' });
            setShowForm(false);
            await loadVendors();
        } catch (err) {
            setError(err.response?.data?.error || 'Could not add vendor');
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="page-heading">
                <div><h1 className="page-title">Vendors</h1><p className="page-help">People you buy from</p></div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Vendor</button>
            </div>
            {showForm && <form onSubmit={handleSubmit} className="card form-card mb-6">
                <h2 className="form-section-title">New vendor</h2>
                <div className="form-grid form-grid-3">
                    <input className="input" placeholder="Vendor name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                    <input className="input" placeholder="Phone number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    <input className="input" placeholder="Address (optional)" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                {error && <p className="form-error">{error}</p>}
                <div className="form-actions"><button className="btn-success" type="submit">Save Vendor</button><button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>}
            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Phone</th>
                            <th className="text-right py-3 px-4">Balance (Payable)</th>
                            <th className="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vendorList.map(vendor => (
                            <tr key={vendor.id} className="border-b">
                                <td className="py-3 px-4 font-medium">{vendor.name}</td>
                                <td className="py-3 px-4">{vendor.phone || '-'}</td>
                                <td className="py-3 px-4 text-right font-bold text-red-700">
                                    {formatIndianCurrency(vendor.current_balance)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <Link
                                        to={`/vendors/${vendor.id}/ledger`}
                                        className="btn-primary text-sm"
                                    >
                                        View Ledger
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
