import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeftRight,
    Archive,
    BarChart3,
    CreditCard,
    FileClock,
    FileChartColumn,
    Home,
    Languages,
    LogOut,
    Package,
    ShoppingCart,
    Truck,
    UserRound,
    Users,
    WalletCards
} from 'lucide-react';

const primaryLinks = [
    { to: '/', label: 'Home', icon: Home, exact: true },
    { to: '/sales/new', label: 'New Sale', icon: ShoppingCart },
    { to: '/purchases/new', label: 'New Purchase', icon: Truck },
    { to: '/payments/new', label: 'Record Payment', icon: CreditCard },
    { to: '/settlements/new', label: 'Direct Payment', icon: ArrowLeftRight }
];

const additionalLinks = [
    { to: '/sales/list', label: 'Sales History', icon: FileClock },
    { to: '/purchases/list', label: 'Purchase History', icon: FileClock },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/vendors', label: 'Vendors', icon: UserRound },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/bank-accounts', label: 'Bank Accounts', icon: WalletCards },
    { to: '/backups', label: 'Download Backup', icon: Archive },
    { to: '/reports/outstanding', label: 'Reports', icon: BarChart3 }
];

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

    const renderLink = ({ to, label, icon: Icon, exact, compact = false }) => {
        const active = exact ? location.pathname === to : isActive(to);
        return (
            <Link
                key={to}
                to={to}
                className={`sidebar-link ${active ? 'sidebar-link-active' : ''} ${compact ? 'sidebar-link-compact' : ''}`}
            >
                <Icon size={compact ? 21 : 24} strokeWidth={2.2} aria-hidden="true" />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 md:flex">
            <aside className="sidebar-shell">
                <div className="sidebar-brand">
                    <Link to="/" className="flex items-center gap-3">
                        <span className="brand-mark"><BarChart3 size={26} /></span>
                        <span>{t('appName')}</span>
                    </Link>
                </div>

                <div className="sidebar-user">
                    <span className="user-avatar"><UserRound size={21} /></span>
                    <div>
                        <p className="text-sm text-blue-100">Signed in as</p>
                        <p className="font-bold">{user.username}</p>
                    </div>
                </div>

                <nav className="sidebar-nav" aria-label="Main navigation">
                    <p className="sidebar-heading">Daily work</p>
                    {primaryLinks.map((link) => renderLink(link))}
                    <p className="sidebar-heading mt-6">Records</p>
                    {additionalLinks.map((link) => renderLink({ ...link, compact: true }))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={toggleLanguage} className="sidebar-action">
                        <Languages size={21} />
                        <span>{i18n.language === 'en' ? 'اردو' : 'English'}</span>
                    </button>
                    <button onClick={onLogout} className="sidebar-action sidebar-logout">
                        <LogOut size={21} />
                        <span>{t('logout')}</span>
                    </button>
                </div>
            </aside>

            <div className="min-w-0 flex-1">
                <header className="mobile-header">
                    <Link to="/" className="font-bold text-xl">{t('appName')}</Link>
                    <div className="flex gap-2">
                        <button onClick={toggleLanguage} className="mobile-icon-button" aria-label="Change language">
                            <Languages size={22} />
                        </button>
                        <button onClick={onLogout} className="mobile-icon-button" aria-label={t('logout')}>
                            <LogOut size={22} />
                        </button>
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 md:px-8 md:py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
