import { useState, useEffect } from 'react';
import { products } from '../../services/api';
import { formatIndianCurrency, formatQuantity } from '../../services/formatter';

export default function ProductList() {
    const [productList, setProductList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '' });
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
                name: formData.name,
                unit: 'KG',
                current_stock: 0,
                avg_cost: 0
            });
            setFormData({ name: '' });
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
                <div className="form-grid grid-cols-1 md:grid-cols-2">
                    <input className="input" placeholder="Product name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                    <p className="flex items-center text-gray-600">Stock and price are added when you record a purchase.</p>
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
