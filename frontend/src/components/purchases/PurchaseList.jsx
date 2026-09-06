import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatIndianCurrency, formatDate } from '../../services/formatter';
import { purchases as purchasesApi } from '../../services/api';

export default function PurchaseList() {
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, draft, approved
    const [processing, setProcessing] = useState(null);

    useEffect(() => {
        loadPurchases();
    }, [filter]);

    const loadPurchases = async () => {
        try {
            const response = await purchasesApi.getAll(filter === 'all' ? undefined : filter);
            setPurchases(response.data);
        } catch (error) {
            console.error('Error loading purchases:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve this purchase? This will update stock and vendor balance.')) return;
        
        setProcessing(id);
        try {
            await purchasesApi.approve(id);
            alert('Purchase approved successfully!');
            loadPurchases();
        } catch (error) {
            alert('Error approving purchase');
        } finally {
            setProcessing(null);
        }
    };

    const handleDelete = async (id, status) => {
        const confirmMsg = status === 'draft'
            ? 'Delete this draft purchase?'
            : 'Void this purchase? This will reverse all accounting entries.';
        
        if (!confirm(confirmMsg)) return;
        
        setProcessing(id);
        try {
            await purchasesApi.remove(id);
            alert(status === 'draft' ? 'Purchase deleted!' : 'Purchase voided!');
            loadPurchases();
        } catch (error) {
            alert('Error deleting purchase');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Purchases</h1>
                <Link to="/purchases/new" className="btn-primary">
                    + New Purchase
                </Link>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={`btn ${filter === 'draft' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter('draft')}
                >
                    Drafts ({purchases.filter(p => p.status === 'draft').length})
                </button>
                <button
                    className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter('approved')}
                >
                    Approved
                </button>
            </div>

            {purchases.length === 0 ? (
                <div className="card text-center text-gray-600">
                    <p className="text-xl">No purchases found</p>
                    <Link to="/purchases/new" className="btn-primary mt-4">
                        Create First Purchase
                    </Link>
                </div>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2">
                                <th className="text-left py-3 px-4">Purchase ID</th>
                                <th className="text-left py-3 px-4">Date</th>
                                <th className="text-left py-3 px-4">Vendor</th>
                                <th className="text-left py-3 px-4">Product</th>
                                <th className="text-right py-3 px-4">Quantity</th>
                                <th className="text-right py-3 px-4">Grand Total</th>
                                <th className="text-center py-3 px-4">Status</th>
                                <th className="text-center py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map(purchase => (
                                <tr key={purchase.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4 font-bold text-blue-600">
                                        {purchase.purchase_id}
                                    </td>
                                    <td className="py-3 px-4">{formatDate(purchase.date)}</td>
                                    <td className="py-3 px-4">
                                        <div className="font-medium">{purchase.vendor_name}</div>
                                        <div className="text-sm text-gray-600">{purchase.vendor_id}</div>
                                    </td>
                                    <td className="py-3 px-4">{purchase.product_name}</td>
                                    <td className="py-3 px-4 text-right">{purchase.qty_kg} KG</td>
                                    <td className="py-3 px-4 text-right font-bold">
                                        {formatIndianCurrency(purchase.grand_total || purchase.total)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            purchase.status === 'draft' 
                                                ? 'bg-yellow-100 text-yellow-800' 
                                                : purchase.status === 'approved'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {purchase.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex gap-2 justify-center">
                                            {purchase.status === 'draft' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(purchase.id)}
                                                        disabled={processing === purchase.id}
                                                        className="btn-success text-sm"
                                                    >
                                                        ✓ Approve
                                                    </button>
                                                    <Link
                                                        to={`/purchases/edit/${purchase.id}`}
                                                        className="btn-primary text-sm"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(purchase.id, purchase.status)}
                                                        disabled={processing === purchase.id}
                                                        className="btn-danger text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                            {purchase.status === 'approved' && (
                                                <button
                                                    onClick={() => handleDelete(purchase.id, purchase.status)}
                                                    disabled={processing === purchase.id}
                                                    className="btn-danger text-sm"
                                                >
                                                    Void
                                                </button>
                                            )}
                                            {purchase.status === 'voided' && (
                                                <span className="text-gray-500 text-sm">No actions</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
