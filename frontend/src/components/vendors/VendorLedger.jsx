import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendors } from '../../services/api';
import { formatIndianCurrency, formatDate } from '../../services/formatter';

export default function VendorLedger() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLedger();
    }, [id]);

    const loadLedger = async () => {
        try {
            const response = await vendors.getLedger(id);
            setData(response.data);
        } catch (error) {
            console.error('Error loading ledger:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;
    if (!data) return <div className="text-center text-2xl text-red-600">Ledger not found</div>;

    return (
        <div>
            <div className="mb-6">
                <button onClick={() => navigate('/vendors')} className="btn-secondary mb-4">
                    ← Back to Vendors
                </button>
                <h1 className="text-3xl font-bold">{data.vendor.name} - Ledger</h1>
                <p className="text-lg text-gray-600">{data.vendor.phone}</p>
                <p className="text-2xl font-bold text-red-700 mt-2">
                    Current Balance: {formatIndianCurrency(data.currentBalance)}
                </p>
            </div>

            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Date</th>
                            <th className="text-left py-3 px-4">Description</th>
                            <th className="text-right py-3 px-4">Debit</th>
                            <th className="text-right py-3 px-4">Credit</th>
                            <th className="text-right py-3 px-4">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.transactions.map((txn, index) => (
                            <tr key={index} className="border-b">
                                <td className="py-3 px-4">{formatDate(txn.date)}</td>
                                <td className="py-3 px-4">{txn.description}</td>
                                <td className="py-3 px-4 text-right text-green-600">
                                    {txn.debit > 0 ? formatIndianCurrency(txn.debit) : '-'}
                                </td>
                                <td className="py-3 px-4 text-right text-red-600">
                                    {txn.credit > 0 ? formatIndianCurrency(txn.credit) : '-'}
                                </td>
                                <td className="py-3 px-4 text-right font-bold">
                                    {formatIndianCurrency(txn.balance)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
