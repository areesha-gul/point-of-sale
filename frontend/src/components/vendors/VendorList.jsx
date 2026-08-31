import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { vendors } from '../../services/api';
import { formatIndianCurrency } from '../../services/formatter';

export default function VendorList() {
    const [vendorList, setVendorList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVendors();
    }, []);

    const loadVendors = async () => {
        try {
            const response = await vendors.getAll();
            setVendorList(response.data);
        } catch (error) {
            console.error('Error loading vendors:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center text-2xl">Loading...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Vendors</h1>
            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2">
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Phone</th>
                            <th className="text-right py-3 px-4">Balance (Payable)</th>
                            <th className="text-center py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vendorList.map(vendor => (
                            <tr key={vendor.id} className="border-b">
                                <td className="py-3 px-4 font-medium">{vendor.name}</td>
                                <td className="py-3 px-4">{vendor.phone || '-'}</td>
                                <td className="py-3 px-4 text-right font-bold text-red-700">
                                    {formatIndianCurrency(vendor.current_balance)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <Link
                                        to={`/vendors/${vendor.id}/ledger`}
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
