import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../../services/api';

export default function Login({ onLogin }) {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await auth.login({ username, password });
            onLogin(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 px-4">
            <div className="card max-w-md w-full">
                <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
                    {t('appName')}
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="label">{t('username')}</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="label">{t('password')}</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary w-full text-xl"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : t('login')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>Default credentials:</p>
                    <p>Username: <strong>admin</strong></p>
                    <p>Password: <strong>admin123</strong></p>
                </div>
            </div>
        </div>
    );
}
