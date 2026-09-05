import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './services/api';

// Components
import Login from './components/auth/Login';
import DashboardEnhanced from './components/dashboard/DashboardEnhanced';
import Layout from './components/common/Layout';
import ProductList from './components/products/ProductList';
import CustomerList from './components/customers/CustomerList';
import CustomerLedger from './components/customers/CustomerLedger';
import VendorList from './components/vendors/VendorList';
import VendorLedger from './components/vendors/VendorLedger';
import SaleFormComplete from './components/sales/SaleFormComplete';
import SaleList from './components/sales/SaleList';
import PurchaseFormComplete from './components/purchases/PurchaseFormComplete';
import PurchaseList from './components/purchases/PurchaseList';
import PaymentForm from './components/payments/PaymentForm';
import DirectSettlement from './components/payments/DirectSettlement';
import SalesReport from './components/reports/SalesReport';
import PurchaseReport from './components/reports/PurchaseReport';
import OutstandingReport from './components/reports/OutstandingReport';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 10000)
      );
      
      const response = await Promise.race([
        auth.getSession(),
        timeoutPromise
      ]);
      
      setUser(response.data);
    } catch (error) {
      console.error('Session check failed:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/"
          element={
            user ? (
              <Layout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={<DashboardEnhanced />} />
          <Route path="products" element={<ProductList />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="customers/:id/ledger" element={<CustomerLedger />} />
          <Route path="vendors" element={<VendorList />} />
          <Route path="vendors/:id/ledger" element={<VendorLedger />} />
          <Route path="sales/new" element={<SaleFormComplete />} />
          <Route path="sales/list" element={<SaleList />} />
          <Route path="purchases/new" element={<PurchaseFormComplete />} />
          <Route path="purchases/list" element={<PurchaseList />} />
          <Route path="payments/new" element={<PaymentForm />} />
          <Route path="settlements/new" element={<DirectSettlement />} />
          <Route path="reports/sales" element={<SalesReport />} />
          <Route path="reports/purchases" element={<PurchaseReport />} />
          <Route path="reports/outstanding" element={<OutstandingReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
