import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatIndianCurrency, formatDate } from '../../services/formatter';
import { sales as salesApi } from '../../services/api';

export default function SaleList() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [processing, setProcessing] = useState(null);

    useEffect(() => {
        loadSales();
    }, [filter]);

    const loadSales = async () => {
        try {
            const response = await salesApi.getAll(filter === 'all' ? undefined : filter);
            setSales(response.data);
        } catch (error) {
            console.error('Error loading sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve this sale? This will deduct stock and update customer balance.')) return;
        
        setProcessing(id);
        try {
            await salesApi.approve(id);
            alert('Sale approved successfully!');
            loadSales();
        } catch (error) {
            alert('Error approving sale');
        } finally {
            setProcessing(null);
        }
    };

    const handleDelete = async (id, status) => {
        const confirmMsg = status === 'draft'
            ? 'Delete this draft sale?'
            : 'Void this sale? This will restore stock and reverse accounting entries.';
        
        if (!confirm(confirmMsg)) return;
        
        setProcessing(id);
        try {
            await salesApi.remove(id);
            alert(status === 'draft' ? 'Sale deleted!' : 'Sale voided!');
            loadSales();
        } catch (error) {
            alert('Error deleting sale');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Sales</h1>
                <Link to="/sales/new" className="btn-primary">
                    + New Sale
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
                    Drafts ({sales.filter(s => s.status === 'draft').length})
                </button>
                <button
                    className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter('approved')}
                >
                    Approved
                </button>
            </div>

            {sales.length === 0 ? (
                <div className="card text-center text-gray-600">
                    <p className="text-xl">No sales found</p>
                    <Link to="/sales/new" className="btn-primary mt-4">
                        Create First Sale
                    </Link>
                </div>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2">
                                <th className="text-left py-3 px-4">Sale ID</th>
                                <th className="text-left py-3 px-4">Date</th>
                                <th className="text-left py-3 px-4">Customer</th>
                                <th className="text-left py-3 px-4">Product</th>
                                <th className="text-right py-3 px-4">Quantity</th>
                                <th className="text-right py-3 px-4">Total</th>
                                <th className="text-center py-3 px-4">Status</th>
                                <th className="text-center py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => (
                                <tr key={sale.id} className="border-b hover:bg-gray-50">
                                    <td className="py-3 px-4 font-bold text-blue-600">
                                        {sale.sale_id}
                                    </td>
                                    <td className="py-3 px-4">{formatDate(sale.date)}</td>
                                    <td className="py-3 px-4">
                                        <div className="font-medium">{sale.customer_name}</div>
                                        <div className="text-sm text-gray-600">{sale.customer_id}</div>
                                    </td>
                                    <td className="py-3 px-4">{sale.product_name}</td>
                                    <td className="py-3 px-4 text-right">{sale.qty_kg} KG</td>
                                    <td className="py-3 px-4 text-right font-bold">
                                        {formatIndianCurrency(sale.total)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            sale.status === 'draft' 
                                                ? 'bg-yellow-100 text-yellow-800' 
                                                : sale.status === 'approved'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {sale.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex gap-2 justify-center">
                                            {sale.status === 'draft' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(sale.id)}
                                                        disabled={processing === sale.id}
                                                        className="btn-success text-sm"
                                                    >
                                                        ✓ Approve
                                                    </button>
                                                    <Link
                                                        to={`/sales/edit/${sale.id}`}
                                                        className="btn-primary text-sm"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(sale.id, sale.status)}
                                                        disabled={processing === sale.id}
                                                        className="btn-danger text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                            {sale.status === 'approved' && (
                                                <button
                                                    onClick={() => handleDelete(sale.id, sale.status)}
                                                    disabled={processing === sale.id}
                                                    className="btn-danger text-sm"
                                                >
                                                    Void
                                                </button>
                                            )}
                                            {sale.status === 'voided' && (
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
