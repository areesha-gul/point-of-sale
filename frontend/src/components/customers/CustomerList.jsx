import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customers } from '../../services/api';
import { formatIndianCurrency } from '../../services/formatter';

export default function CustomerList() {
    const [customerList, setCustomerList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const response = await customers.getAll();
            setCustomerList(response.data);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Customers</h1>
            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Phone</th>
                            <th className="text-right py-3 px-4">Balance (Receivable)</th>
                            <th className="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customerList.map(customer => (
                            <tr key={customer.id} className="border-b">
                                <td className="py-3 px-4 font-medium">{customer.name}</td>
                                <td className="py-3 px-4">{customer.phone || '-'}</td>
                                <td className="py-3 px-4 text-right font-bold text-green-700">
                                    {formatIndianCurrency(customer.current_balance)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <Link
                                        to={`/customers/${customer.id}/ledger`}
                                        className="btn-primary text-sm"
                                    >
                                        View Ledger
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
