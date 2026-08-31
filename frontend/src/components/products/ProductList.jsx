import { useState, useEffect } from 'react';
import { products } from '../../services/api';
import { formatIndianCurrency, formatQuantity } from '../../services/formatter';

export default function ProductList() {
    const [productList, setProductList] = useState([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Products</h1>
            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-right py-3 px-4">Current Stock</th>
                            <th className="text-right py-3 px-4">Avg Cost</th>
                            <th className="text-right py-3 px-4">Stock Value</th>
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
