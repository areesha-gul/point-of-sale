const express = require('express');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('../backend/database/connection');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
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
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 60 * 1000 // 30 minutes
    }
}));

// Initialize database
let dbInitialized = false;
async function ensureDatabase() {
    if (!dbInitialized) {
        await initDatabase();
        dbInitialized = true;
    }
}

// Auth middleware
const authMiddleware = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Routes
app.use('/api/auth', require('../backend/routes/auth'));
app.use('/api/products', authMiddleware, require('../backend/routes/products'));
app.use('/api/customers', authMiddleware, require('../backend/routes/customers'));
app.use('/api/vendors', authMiddleware, require('../backend/routes/vendors'));
app.use('/api/sales', authMiddleware, require('../backend/routes/sales_v2'));
app.use('/api/purchases', authMiddleware, require('../backend/routes/purchases_v2'));
app.use('/api/payments', authMiddleware, require('../backend/routes/payments'));
app.use('/api/settlements', authMiddleware, require('../backend/routes/settlements'));
app.use('/api/dashboard', authMiddleware, require('../backend/routes/dashboard'));
app.use('/api/reports', authMiddleware, require('../backend/routes/reports'));
app.use('/api/accounts', authMiddleware, require('../backend/routes/accounts'));
app.use('/api/bank-accounts', authMiddleware, require('../backend/routes/bankAccounts'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// Serverless handler
module.exports = async (req, res) => {
    await ensureDatabase();
    return app(req, res);
};
