import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { inventoryAdjustments, products as productsApi } from '../../services/api';
import { getTodayDate, formatDate } from '../../services/formatter';

export default function InventoryAdjustment() {
    const [products, setProducts] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [formData, setFormData] = useState({
        product_id: '',
        adjustment_type: 'increase',
        quantity_kg: '',
        reason: 'Scale Gain',
        description: '',
        date: getTodayDate()
    });

    const reasons = [
        'Scale Gain',
        'Scale Loss',
        'Moisture Loss',
        'Damaged Grain',
        'Stock Count Correction',
        'Other'
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [productsRes, adjustmentsRes] = await Promise.all([
                productsApi.getAll(),
                inventoryAdjustments.getAll()
            ]);
            setProducts(productsRes.data);
            setAdjustments(adjustmentsRes.data);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleProductChange = (e) => {
        const productId = e.target.value;
        setFormData({ ...formData, product_id: productId });
        
        const product = products.find(p => p.id === parseInt(productId));
        setSelectedProduct(product);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            const data = {
                product_id: parseInt(formData.product_id),
                adjustment_type: formData.adjustment_type,
                quantity_kg: parseFloat(formData.quantity_kg),
                reason: formData.reason,
                description: formData.description,
                date: formData.date
            };

            const response = await inventoryAdjustments.create(data);
            setSuccess(response.data.message || 'Adjustment created successfully!');
            
            // Reset form
            setFormData({
                product_id: '',
                adjustment_type: 'increase',
                quantity_kg: '',
                reason: 'Scale Gain',
                description: '',
                date: getTodayDate()
            });
            setSelectedProduct(null);
            
            // Reload data
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create adjustment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this adjustment? Stock will be reversed.')) return;

        try {
            await inventoryAdjustments.remove(id);
            setSuccess('Adjustment deleted successfully!');
            loadData();
        } catch (err) {
            setError('Failed to delete adjustment');
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="mb-6">
                <h1 className="page-title">Inventory Adjustments</h1>
                <p className="page-help">Manually adjust product stock for scale differences, moisture loss, damage, or corrections.</p>
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    <strong>Important:</strong> Inventory adjustments only affect stock quantities. They do NOT affect customer/vendor balances or financial accounts.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                    <strong>Use cases:</strong> Scale gain/loss during purchases, moisture loss during storage, damaged grain, physical stock count corrections.
                </p>
            </div>

            {/* Adjustment Form */}
            <form onSubmit={handleSubmit} className="card mb-8">
                <h2 className="form-section-title">Create New Adjustment</h2>
                
                <div className="form-grid grid-cols-1 md:grid-cols-2">
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
                            {products.map(product => (
                                <option key={product.id} value={product.id}>
                                    {product.name} (Current Stock: {product.current_stock} KG)
                                </option>
                            ))}
                        </select>
                        {selectedProduct && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                                <p className="font-semibold text-blue-700">Current Stock</p>
                                <p className="text-2xl font-bold text-blue-800">{selectedProduct.current_stock} KG</p>
                            </div>
                        )}
                    </div>

                    {/* Adjustment Type */}
                    <div>
                        <label className="label">Adjustment Type *</label>
                        <select
                            className="input"
                            value={formData.adjustment_type}
                            onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value })}
                            required
                        >
                            <option value="increase">Increase Stock (+)</option>
                            <option value="decrease">Decrease Stock (−)</option>
                        </select>
                    </div>
                </div>

                <div className="form-grid grid-cols-1 md:grid-cols-3">
                    {/* Quantity */}
                    <div>
                        <label className="label">Quantity (KG) *</label>
                        <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            className="input"
                            value={formData.quantity_kg}
                            onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                            required
                        />
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="label">Reason *</label>
                        <select
                            className="input"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            required
                        >
                            {reasons.map(reason => (
                                <option key={reason} value={reason}>{reason}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="label">Date *</label>
                        <input
                            type="date"
                            className="input"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="label">Description (Optional)</label>
                    <textarea
                        className="input"
                        rows="2"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Additional notes about this adjustment..."
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary"
                >
                    {submitting ? 'Creating...' : 'Create Adjustment'}
                </button>
            </form>

            {/* Adjustments History */}
            <div className="card">
                <h2 className="form-section-title">Adjustment History</h2>
                
                {adjustments.length === 0 ? (
                    <p className="text-gray-600">No adjustments recorded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2">
                                    <th className="text-left py-3 px-4">Adjustment ID</th>
                                    <th className="text-left py-3 px-4">Date</th>
                                    <th className="text-left py-3 px-4">Product</th>
                                    <th className="text-center py-3 px-4">Type</th>
                                    <th className="text-right py-3 px-4">Quantity</th>
                                    <th className="text-left py-3 px-4">Reason</th>
                                    <th className="text-left py-3 px-4">Description</th>
                                    <th className="text-center py-3 px-4">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustments.map(adj => (
                                    <tr key={adj.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4 font-bold text-blue-600">
                                            {adj.adjustment_id}
                                        </td>
                                        <td className="py-3 px-4">{formatDate(adj.date)}</td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium">{adj.product_name}</div>
                                            <div className="text-xs text-gray-600">Stock: {adj.current_stock} KG</div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                adj.adjustment_type === 'increase' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {adj.adjustment_type === 'increase' ? '+' : '−'} {adj.adjustment_type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold">
                                            {adj.adjustment_type === 'increase' ? '+' : '−'}{adj.quantity_kg} KG
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                                {adj.reason}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {adj.description || '—'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <button
                                                onClick={() => handleDelete(adj.id)}
                                                className="btn-danger text-sm"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
