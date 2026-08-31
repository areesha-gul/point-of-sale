import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dashboard } from '../../services/api';
import { formatIndianCurrency, formatQuantity, formatDate } from '../../services/formatter';

export default function DashboardEnhanced() {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [kpis, setKpis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [dashboardRes, kpiRes] = await Promise.all([
                dashboard.getSummary(),
                fetch('/api/dashboard/kpis', { credentials: 'include' }).then(r => r.json()).catch(() => null)
            ]);
            
            setData(dashboardRes.data);
            setKpis(kpiRes);
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
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
                <div className="text-sm text-gray-600">
                    {new Date().toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}
                </div>
            </div>

            {/* KPI Cards Row 1 - Sales & Profit */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card bg-blue-50 border-2 border-blue-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Today's Sale</h3>
                    <p className="text-3xl font-bold text-blue-700">
                        {formatIndianCurrency(kpis?.todaySale || 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                        {kpis?.todaySaleCount || 0} transactions
                    </p>
                </div>

                <div className="card bg-purple-50 border-2 border-purple-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Month to Date Sale</h3>
                    <p className="text-3xl font-bold text-purple-700">
                        {formatIndianCurrency(kpis?.mtdSale || 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                        This month total
                    </p>
                </div>

                <div className="card bg-green-50 border-2 border-green-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Total Profit (MTD)</h3>
                    <p className="text-3xl font-bold text-green-700">
                        {formatIndianCurrency(kpis?.totalProfit || 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                        Gross profit
                    </p>
                </div>

                <div className="card bg-orange-50 border-2 border-orange-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Pending Approvals</h3>
                    <p className="text-3xl font-bold text-orange-700">
                        {(kpis?.pendingPurchases || 0) + (kpis?.pendingSales || 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                        {kpis?.pendingPurchases || 0} purchases, {kpis?.pendingSales || 0} sales
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card bg-gradient-to-r from-blue-50 to-purple-50">
                <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Link to="/sales/new" className="btn-success text-center">
                        + New Sale
                    </Link>
                    <Link to="/purchases/new" className="btn-primary text-center">
                        + New Purchase
                    </Link>
                    <Link to="/payments/new" className="btn-primary text-center">
                        Record Payment
                    </Link>
                    <Link to="/settlements/new" className="btn-success text-center">
                        Direct Settlement
                    </Link>
                    <Link to="/reports/outstanding" className="btn-secondary text-center">
                        View Reports
                    </Link>
                </div>
            </div>

            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card bg-green-50 border-2 border-green-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('totalReceivables')}</h3>
                    <p className="text-3xl font-bold text-green-700">
                        {formatIndianCurrency(summary.totalReceivables)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">From {summary.customerCount} customers</p>
                </div>

                <div className="card bg-red-50 border-2 border-red-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('totalPayables')}</h3>
                    <p className="text-3xl font-bold text-red-700">
                        {formatIndianCurrency(summary.totalPayables)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">To {summary.vendorCount} vendors</p>
                </div>

                <div className="card bg-blue-50 border-2 border-blue-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('cashBalance')}</h3>
                    <p className="text-3xl font-bold text-blue-700">
                        {formatIndianCurrency(summary.cashBalance)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Cash in hand</p>
                </div>

                <div className="card bg-purple-50 border-2 border-purple-200">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('bankBalance')}</h3>
                    <p className="text-3xl font-bold text-purple-700">
                        {formatIndianCurrency(summary.bankBalance)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">All bank accounts</p>
                </div>
            </div>

            {/* Stock & Counts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-indigo-50 border-2 border-indigo-200">
                    <h3 className="text-lg font-medium mb-2">Total Stock Value</h3>
                    <p className="text-2xl font-bold text-indigo-700">
                        {formatIndianCurrency(summary.totalStockValue)}
                    </p>
                    <p className="text-gray-600">{formatQuantity(summary.totalStockKg)}</p>
                    <p className="text-sm text-gray-600">{summary.productCount} products</p>
                </div>

                <div className="card bg-teal-50 border-2 border-teal-200">
                    <h3 className="text-lg font-medium mb-2">Net Position</h3>
                    <p className="text-2xl font-bold text-teal-700">
                        {formatIndianCurrency(summary.netPosition || 
                            (summary.totalReceivables - summary.totalPayables + summary.cashBalance + summary.bankBalance))}
                    </p>
                    <p className="text-sm text-gray-600">Receivables - Payables + Cash + Bank</p>
                </div>

                <div className="card bg-yellow-50 border-2 border-yellow-200">
                    <h3 className="text-lg font-medium mb-2">Business Summary</h3>
                    <div className="space-y-1 text-sm">
                        <p><span className="font-medium">{summary.customerCount}</span> Customers</p>
                        <p><span className="font-medium">{summary.vendorCount}</span> Vendors</p>
                        <p><span className="font-medium">{summary.productCount}</span> Products</p>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Recent Transactions</h2>
                        <Link to="/reports/outstanding" className="text-blue-600 hover:underline text-sm">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {recentTransactions && recentTransactions.length > 0 ? (
                            recentTransactions.map((txn, index) => (
                                <div key={index} className="border-b pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
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
                            ))
                        ) : (
                            <p className="text-gray-600 text-center py-4">No recent transactions</p>
                        )}
                    </div>
                </div>

                {/* Top Customers */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Top Outstanding Customers</h2>
                        <Link to="/customers" className="text-blue-600 hover:underline text-sm">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {topCustomers && topCustomers.length > 0 ? (
                            topCustomers.map((customer) => (
                                <Link 
                                    key={customer.id}
                                    to={`/customers/${customer.id}/ledger`}
                                    className="flex justify-between items-center border-b pb-2 hover:bg-gray-50 -mx-2 px-2 rounded"
                                >
                                    <span className="font-medium">{customer.name}</span>
                                    <span className="text-green-700 font-bold">
                                        {formatIndianCurrency(customer.current_balance)}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-600 text-center py-4">No outstanding receivables</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Vendors */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Top Outstanding Vendors</h2>
                        <Link to="/vendors" className="text-blue-600 hover:underline text-sm">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {topVendors && topVendors.length > 0 ? (
                            topVendors.map((vendor) => (
                                <Link
                                    key={vendor.id}
                                    to={`/vendors/${vendor.id}/ledger`}
                                    className="flex justify-between items-center border-b pb-2 hover:bg-gray-50 -mx-2 px-2 rounded"
                                >
                                    <span className="font-medium">{vendor.name}</span>
                                    <span className="text-red-700 font-bold">
                                        {formatIndianCurrency(vendor.current_balance)}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <p className="text-gray-600 text-center py-4">No outstanding payables</p>
                        )}
                    </div>
                </div>

                {/* Low Stock Products */}
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Low Stock Alert</h2>
                        <Link to="/products" className="text-blue-600 hover:underline text-sm">
                            View All →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {lowStockProducts && lowStockProducts.length > 0 ? (
                            lowStockProducts.map((product) => (
                                <div key={product.id} className="flex justify-between items-center border-b pb-2">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-orange-700 font-bold">
                                        {formatQuantity(product.current_stock, product.unit)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-center py-4">All products have sufficient stock</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
