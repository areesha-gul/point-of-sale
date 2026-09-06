import axios from 'axios';

// Use environment variable for API URL
// In production (Vercel), this MUST be set to your Render backend URL
const baseURL = import.meta.env.VITE_API_URL || '/api';

if (!baseURL) {
    console.error('VITE_API_URL is not set! API calls will fail.');
}

console.log('API Base URL:', baseURL);

const api = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor - add JWT token to requests
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth
export const auth = {
    login: (credentials) => api.post('/auth/login', credentials),
    logout: () => api.post('/auth/logout'),
    getSession: () => api.get('/auth/session')
};

// Products
export const products = {
    getAll: () => api.get('/products'),
    getById: (id) => api.get(`/products/${id}`),
    create: (data) => api.post('/products', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    getMovements: (id) => api.get(`/products/${id}/movements`),
    remove: (id) => api.delete(`/products/${id}`)
};

// Customers
export const customers = {
    getAll: () => api.get('/customers'),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    getLedger: (id) => api.get(`/customers/${id}/ledger`),
    remove: (id) => api.delete(`/customers/${id}`)
};

// Vendors
export const vendors = {
    getAll: () => api.get('/vendors'),
    getById: (id) => api.get(`/vendors/${id}`),
    create: (data) => api.post('/vendors', data),
    update: (id, data) => api.put(`/vendors/${id}`, data),
    getLedger: (id) => api.get(`/vendors/${id}/ledger`),
    remove: (id) => api.delete(`/vendors/${id}`)
};

// Sales
export const sales = {
    getAll: (status) => api.get('/sales', status ? { params: { status } } : undefined),
    getById: (id) => api.get(`/sales/${id}`),
    create: (data) => api.post('/sales', data),
    approve: (id) => api.post(`/sales/${id}/approve`),
    remove: (id) => api.delete(`/sales/${id}`)
};

// Purchases
export const purchases = {
    getById: (id) => api.get(`/purchases/${id}`),
    create: (data) => api.post('/purchases', data),
    getAll: (status) => api.get('/purchases', status ? { params: { status } } : undefined),
    approve: (id) => api.post(`/purchases/${id}/approve`),
    remove: (id) => api.delete(`/purchases/${id}`)
};

// Payments
export const payments = {
    getAll: () => api.get('/payments'),
    getById: (id) => api.get(`/payments/${id}`),
    create: (data) => api.post('/payments', data),
    remove: (id) => api.delete(`/payments/${id}`)
};

// Settlements (Direct Settlement - Critical Feature)
export const settlements = {
    getAll: () => api.get('/settlements'),
    getById: (id) => api.get(`/settlements/${id}`),
    create: (data) => api.post('/settlements', data),
    getByCustomer: (customerId) => api.get(`/settlements/customer/${customerId}`),
    getByVendor: (vendorId) => api.get(`/settlements/vendor/${vendorId}`),
    remove: (id) => api.delete(`/settlements/${id}`)
};

// Dashboard
export const dashboard = {
    getSummary: () => api.get('/dashboard'),
    getKpis: () => api.get('/dashboard/kpis')
};

// Reports
export const reports = {
    getSales: (params) => api.get('/reports/sales', { params }),
    getPurchases: (params) => api.get('/reports/purchases', { params }),
    getOutstanding: () => api.get('/reports/outstanding'),
    getProfit: (params) => api.get('/reports/profit', { params }),
    downloadBackup: (params) => api.get('/reports/backup', { params, responseType: 'blob' })
};

// Accounts
export const accounts = {
    getAll: () => api.get('/accounts'),
    getTransactions: (id) => api.get(`/accounts/${id}/transactions`)
};

// Bank accounts
export const bankAccounts = {
    getAll: () => api.get('/bank-accounts'),
    create: (data) => api.post('/bank-accounts', data),
    update: (id, data) => api.put(`/bank-accounts/${id}`, data),
    remove: (id) => api.delete(`/bank-accounts/${id}`)
};
