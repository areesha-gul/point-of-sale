import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Layout({ user, onLogout }) {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ur' : 'en';
        i18n.changeLanguage(newLang);
    };

    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-blue-600 text-white shadow-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <Link to="/" className="text-2xl font-bold">
                            {t('appName')}
                        </Link>
                        <div className="flex items-center gap-4">
                            <span className="text-lg">{user.username}</span>
                            <button
                                onClick={toggleLanguage}
                                className="btn-secondary text-sm"
                            >
                                {i18n.language === 'en' ? 'اردو' : 'English'}
                            </button>
                            <button onClick={onLogout} className="btn-danger">
                                {t('logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white shadow-md">
                <div className="container mx-auto px-4">
                    <div className="flex overflow-x-auto gap-2 py-3">
                        <Link
                            to="/"
                            className={`btn ${isActive('/') && location.pathname === '/' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('dashboard')}
                        </Link>
                        <Link
                            to="/sales/list"
                            className={`btn ${isActive('/sales') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('sales')}
                        </Link>
                        <Link
                            to="/purchases/list"
                            className={`btn ${isActive('/purchases') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('purchases')}
                        </Link>
                        <Link
                            to="/payments/new"
                            className={`btn ${isActive('/payments') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('payments')}
                        </Link>
                        <Link
                            to="/settlements/new"
                            className={`btn ${isActive('/settlements') ? 'btn-success' : 'btn-secondary'}`}
                        >
                            {t('directSettlement')}
                        </Link>
                        <Link
                            to="/customers"
                            className={`btn ${isActive('/customers') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('customers')}
                        </Link>
                        <Link
                            to="/vendors"
                            className={`btn ${isActive('/vendors') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('vendors')}
                        </Link>
                        <Link
                            to="/products"
                            className={`btn ${isActive('/products') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('products')}
                        </Link>
                        <Link
                            to="/reports/outstanding"
                            className={`btn ${isActive('/reports') ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {t('reports')}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <Outlet />
            </main>
        </div>
    );
}
