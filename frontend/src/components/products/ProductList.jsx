import { useState, useEffect } from 'react';
import { products } from '../../services/api';
import { formatIndianCurrency, formatQuantity } from '../../services/formatter';

export default function ProductList() {
    const [productList, setProductList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', unit: 'KG', current_stock: '0', avg_cost: '0' });
    const [error, setError] = useState('');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await products.getAll();
            setProductList(response.data);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await products.create({
                ...formData,
                current_stock: Number(formData.current_stock) || 0,
                avg_cost: Number(formData.avg_cost) || 0
            });
            setFormData({ name: '', unit: 'KG', current_stock: '0', avg_cost: '0' });
            setShowForm(false);
            setLoading(true);
            await loadProducts();
        } catch (err) {
            setError(err.response?.data?.error || 'Could not add product');
        }
    };

    const handleDelete = async (product) => {
        if (!window.confirm(`Delete ${product.name}? Products with history cannot be deleted.`)) return;
        try { await products.remove(product.id); await loadProducts(); }
        catch (err) { setError(err.response?.data?.error || 'Could not delete product'); }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div className="page-shell">
            <div className="page-heading">
                <div><h1 className="page-title">Products</h1><p className="page-help">Grain and stock items you buy or sell</p></div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Add Product</button>
            </div>
            {showForm && <form onSubmit={handleSubmit} className="card form-card mb-6">
                <h2 className="form-section-title">New product</h2>
                <div className="form-grid grid-cols-1 md:grid-cols-4">
                    <input className="input" placeholder="Product name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                    <select className="input select-input" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}><option value="KG">KG</option><option value="Bag">Bag</option><option value="Ton">Ton</option></select>
                    <input className="input" type="number" min="0" step="0.01" placeholder="Starting stock" value={formData.current_stock} onChange={e => setFormData({ ...formData, current_stock: e.target.value })} />
                    <input className="input" type="number" min="0" step="0.01" placeholder="Average cost (₨)" value={formData.avg_cost} onChange={e => setFormData({ ...formData, avg_cost: e.target.value })} />
                </div>
                {error && <p className="form-error">{error}</p>}
                <div className="form-actions"><button className="btn-success" type="submit">Save Product</button><button className="btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>}
            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-right py-3 px-4">Current Stock</th>
                            <th className="text-right py-3 px-4">Avg Cost</th>
                            <th className="text-right py-3 px-4">Stock Value</th>
                            <th className="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productList.map(product => (
                            <tr key={product.id} className="border-b">
                                <td className="py-3 px-4 font-medium">{product.name}</td>
                                <td className="py-3 px-4 text-right">{formatQuantity(product.current_stock)}</td>
                                <td className="py-3 px-4 text-right">{formatIndianCurrency(product.avg_cost)}</td>
                                <td className="py-3 px-4 text-right font-bold">
                                    {formatIndianCurrency(product.current_stock * product.avg_cost)}
                                </td>
                                <td className="py-3 px-4 text-center"><button className="btn-danger text-sm" onClick={() => handleDelete(product)}>Delete</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
