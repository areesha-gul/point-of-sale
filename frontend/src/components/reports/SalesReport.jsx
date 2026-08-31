import { useNavigate } from 'react-router-dom';

export default function SalesReport() {
    const navigate = useNavigate();

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Sales Report</h1>
            <div className="card">
                <p className="text-lg">Sales report implementation in progress...</p>
                <button onClick={() => navigate('/')} className="btn-secondary mt-4">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
