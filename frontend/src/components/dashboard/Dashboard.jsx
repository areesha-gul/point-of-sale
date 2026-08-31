import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboard } from '../../services/api';
import { formatIndianCurrency, formatQuantity, formatDate } from '../../services/formatter';

export default function Dashboard() {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const response = await dashboard.getSummary();
            setData(response.data);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center text-2xl">Loading...</div>;
    }

    if (!data) {
        return <div className="text-center text-2xl text-red-600">Failed to load dashboard</div>;
    }

    const { summary, recentTransactions, topCustomers, topVendors, lowStockProducts } = data;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">{t('dashboard')}</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card bg-green-50 border-2 border-green-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('totalReceivables')}</h3>
                    <p className="text-3xl font-bold text-green-700">
                        {formatIndianCurrency(summary.totalReceivables)}
                    </p>
                </div>

                <div className="card bg-red-50 border-2 border-red-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('totalPayables')}</h3>
                    <p className="text-3xl font-bold text-red-700">
                        {formatIndianCurrency(summary.totalPayables)}
                    </p>
                </div>

                <div className="card bg-blue-50 border-2 border-blue-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('cashBalance')}</h3>
                    <p className="text-3xl font-bold text-blue-700">
                        {formatIndianCurrency(summary.cashBalance)}
                    </p>
                </div>

                <div className="card bg-purple-50 border-2 border-purple-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('bankBalance')}</h3>
                    <p className="text-3xl font-bold text-purple-700">
                        {formatIndianCurrency(summary.bankBalance)}
                    </p>
                </div>
            </div>

            {/* Stock & Counts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card">
                    <h3 className="text-lg font-medium mb-2">Total Stock Value</h3>
                    <p className="text-2xl font-bold text-gray-800">
                        {formatIndianCurrency(summary.totalStockValue)}
                    </p>
                    <p className="text-gray-600">{formatQuantity(summary.totalStockKg)}</p>
                </div>

                <div className="card">
                    <h3 className="text-lg font-medium mb-2">{t('customers')}</h3>
                    <p className="text-2xl font-bold text-gray-800">{summary.customerCount}</p>
                </div>

                <div className="card">
                    <h3 className="text-lg font-medium mb-2">{t('vendors')}</h3>
                    <p className="text-2xl font-bold text-gray-800">{summary.vendorCount}</p>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
                    <div className="space-y-3">
                        {recentTransactions.map((txn, index) => (
                            <div key={index} className="border-b pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                                            txn.type === 'sale' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                            {txn.type}
                                        </span>
                                        <p className="font-medium mt-1">{txn.party_name}</p>
                                        <p className="text-sm text-gray-600">{txn.product_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{formatIndianCurrency(txn.amount)}</p>
                                        <p className="text-sm text-gray-600">{formatDate(txn.date)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Customers */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Top Outstanding {t('customers')}</h2>
                    <div className="space-y-3">
                        {topCustomers.map((customer) => (
                            <div key={customer.id} className="flex justify-between items-center border-b pb-2">
                                <span className="font-medium">{customer.name}</span>
                                <span className="text-green-700 font-bold">
                                    {formatIndianCurrency(customer.current_balance)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Vendors */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Top Outstanding {t('vendors')}</h2>
                    <div className="space-y-3">
                        {topVendors.map((vendor) => (
                            <div key={vendor.id} className="flex justify-between items-center border-b pb-2">
                                <span className="font-medium">{vendor.name}</span>
                                <span className="text-red-700 font-bold">
                                    {formatIndianCurrency(vendor.current_balance)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Low Stock Products */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Low Stock Alert</h2>
                    <div className="space-y-3">
                        {lowStockProducts.length > 0 ? (
                            lowStockProducts.map((product) => (
                                <div key={product.id} className="flex justify-between items-center border-b pb-2">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-orange-700 font-bold">
                                        {formatQuantity(product.current_stock, product.unit)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">All products have sufficient stock</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
