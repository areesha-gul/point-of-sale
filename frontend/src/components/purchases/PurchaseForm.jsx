import { useNavigate } from 'react-router-dom';

export default function PurchaseForm() {
    const navigate = useNavigate();

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Record Purchase</h1>
            <div className="card">
                <p className="text-lg">Purchase form implementation in progress...</p>
                <button onClick={() => navigate('/')} className="btn-secondary mt-4">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
