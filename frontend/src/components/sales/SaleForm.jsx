import { useNavigate } from 'react-router-dom';

export default function SaleForm() {
    const navigate = useNavigate();

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Record Sale</h1>
            <div className="card">
                <p className="text-lg">Sales form implementation in progress...</p>
                <button onClick={() => navigate('/')} className="btn-secondary mt-4">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
