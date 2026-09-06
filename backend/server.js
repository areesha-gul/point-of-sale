const express = require('express');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const { initPostgres, closePostgres } = require('./database/postgres');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://point-of-sale-frontend-three.vercel.app'
];

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list or matches any Vercel deployment
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(null, true); // TEMPORARILY ALLOW ALL FOR DEBUGGING
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'grain-trading-pos-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 60 * 1000 // 30 minutes
    }
}));

// Auth middleware
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', authMiddleware, require('./routes/products'));
app.use('/api/customers', authMiddleware, require('./routes/customers'));
app.use('/api/vendors', authMiddleware, require('./routes/vendors'));
app.use('/api/sales', authMiddleware, require('./routes/sales_v2'));
app.use('/api/purchases', authMiddleware, require('./routes/purchases_v2'));
app.use('/api/payments', authMiddleware, require('./routes/payments'));
app.use('/api/profit-withdrawals', authMiddleware, require('./routes/profitWithdrawals'));
app.use('/api/expenses', authMiddleware, require('./routes/expenses'));
app.use('/api/settlements', authMiddleware, require('./routes/settlements'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/api/reports', authMiddleware, require('./routes/reports'));
app.use('/api/accounts', authMiddleware, require('./routes/accounts'));
app.use('/api/bank-accounts', authMiddleware, require('./routes/bankAccounts'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Point of Sale API Server',
        status: 'running',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            products: '/api/products',
            customers: '/api/customers',
            vendors: '/api/vendors',
            sales: '/api/sales',
            purchases: '/api/purchases'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// Start server after initializing database
async function startServer() {
    try {
        console.log('Initializing database...');
        await initPostgres();
        console.log('Database initialized successfully');
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    closePostgres().finally(() => process.exit(0));
});
