import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payments } from '../../services/api';
import { formatIndianCurrency, formatDate } from '../../services/formatter';

export default function PaymentForm() {
    const navigate = useNavigate();
    const [paymentList, setPaymentList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { loadPayments(); }, []);

    const loadPayments = async () => {
        try { setPaymentList((await payments.getAll()).data); }
        catch (err) { setError('Could not load payment records'); }
        finally { setLoading(false); }
    };

    const handleDelete = async (payment) => {
        if (!window.confirm(`Delete this payment of ${formatIndianCurrency(payment.amount)}? Balances will be restored.`)) return;
        try { await payments.remove(payment.id); await loadPayments(); }
        catch (err) { setError(err.response?.data?.error || 'Could not delete payment'); }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Record Payment</h1>
            <div className="card mb-6">
                <p className="text-lg">Regular payment form implementation in progress...</p>
                <button onClick={() => navigate('/')} className="btn-secondary mt-4">
                    Back to Dashboard
                </button>
            </div>
            {error && <p className="form-error mb-6">{error}</p>}
            <div className="card overflow-x-auto">
                <h2 className="form-section-title">Payment records</h2>
                {!loading && paymentList.length === 0 && <p className="text-gray-600">No payment records yet.</p>}
                {paymentList.length > 0 && <table className="w-full"><thead><tr className="border-b-2"><th className="text-left py-3 px-4">Date</th><th className="text-left py-3 px-4">Party</th><th className="text-right py-3 px-4">Amount</th><th className="text-center py-3 px-4">Action</th></tr></thead><tbody>{paymentList.map(payment => <tr className="border-b" key={payment.id}><td className="py-3 px-4">{formatDate(payment.date)}</td><td className="py-3 px-4">{payment.party_name || payment.party_type}</td><td className="py-3 px-4 text-right font-bold">{formatIndianCurrency(payment.amount)}</td><td className="py-3 px-4 text-center"><button className="btn-danger text-sm" onClick={() => handleDelete(payment)}>Delete</button></td></tr>)}</tbody></table>}
            </div>
        </div>
    );
}
