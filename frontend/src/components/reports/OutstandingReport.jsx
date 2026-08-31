import { useState, useEffect } from 'react';
import { reports } from '../../services/api';
import { formatIndianCurrency } from '../../services/formatter';

export default function OutstandingReport() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReport();
    }, []);

    const loadReport = async () => {
        try {
            const response = await reports.getOutstanding();
            setData(response.data);
        } catch (error) {
            console.error('Error loading report:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;
    if (!data) return <div className="text-center text-2xl text-red-600">Failed to load report</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Outstanding Balances</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="card bg-green-50">
                    <h3 className="text-xl font-bold mb-2">Total Receivables</h3>
                    <p className="text-3xl font-bold text-green-700">
                        {formatIndianCurrency(data.summary.totalReceivables)}
                    </p>
                    <p className="text-gray-600">{data.summary.receivableCount} customers</p>
                </div>
                <div className="card bg-red-50">
                    <h3 className="text-xl font-bold mb-2">Total Payables</h3>
                    <p className="text-3xl font-bold text-red-700">
                        {formatIndianCurrency(data.summary.totalPayables)}
                    </p>
                    <p className="text-gray-600">{data.summary.payableCount} vendors</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Receivables */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Customers (Receivables)</h2>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2">
                                <th className="text-left py-2">Name</th>
                                <th className="text-right py-2">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.receivables.map(customer => (
                                <tr key={customer.id} className="border-b">
                                    <td className="py-2">{customer.name}</td>
                                    <td className="py-2 text-right font-bold text-green-700">
                                        {formatIndianCurrency(customer.current_balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Payables */}
                <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Vendors (Payables)</h2>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2">
                                <th className="text-left py-2">Name</th>
                                <th className="text-right py-2">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.payables.map(vendor => (
                                <tr key={vendor.id} className="border-b">
                                    <td className="py-2">{vendor.name}</td>
                                    <td className="py-2 text-right font-bold text-red-700">
                                        {formatIndianCurrency(vendor.current_balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
