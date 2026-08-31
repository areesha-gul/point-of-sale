# Grain Trading POS System

A Point of Sale and accounting system for grain trading businesses with **Direct Settlement** feature.

## 🌟 Key Features

### ✅ Direct Settlement (Critical Feature)
The most important business requirement - record when a customer pays a vendor directly on your behalf:
- Reduces customer receivable (what they owe you)
- Reduces vendor payable (what you owe them)
- **No cash or bank transaction** - money flows directly between customer and vendor
- Maintains proper double-entry accounting records

### ✅ Core Functionality
- **Sales Management**: Record grain sales with automatic stock deduction
- **Purchase Management**: Record purchases with automatic stock updates and average cost calculation
- **Inventory Tracking**: KG-based stock with weighted average costing
- **Customer & Vendor Ledgers**: Complete transaction history with running balances
- **Payment Processing**: Record cash/bank payments for customers and vendors
- **Dashboard**: Real-time summary of receivables, payables, cash, bank, and stock
- **Reports**: Sales, purchases, outstanding balances, and profit calculations

### ✅ User Experience
- **Simple Interface**: One clean screen per task
- **Touch-Friendly**: Large buttons (44x44px minimum) for tablets
- **Indian Number Format**: Amounts displayed in lakh/crore style (₹1,00,00,000)
- **Bilingual**: English and Urdu language toggle
- **Responsive**: Works on desktop (1366x768+) and tablets (1024x768+)

### ✅ Accounting
- Double-entry bookkeeping underneath (invisible to users)
- Complete audit trail for all transactions
- Atomic transactions with rollback on errors
- Ledger entries for every financial transaction

## 🏗️ Technology Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite with better-sqlite3
- **Authentication**: Session-based with bcrypt password hashing

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Initialize Database

```bash
cd backend
npm run init-db
```

This creates the database with:
- All required tables
- Default cash and bank accounts
- Admin user (username: `admin`, password: `admin123`)

### 3. Start Development Servers

```bash
# From root directory
npm run dev
```

This starts:
- Backend API on `http://localhost:5000`
- Frontend on `http://localhost:5173`

### 4. Login

Open `http://localhost:5173` in your browser and login with:
- **Username**: `admin`
- **Password**: `admin123`

## 📖 Usage Guide

### Recording a Sale
1. Click "Sales" → "New Sale"
2. Select customer, product, enter quantity and rate
3. Total calculates automatically
4. Enter payment received (if any) and select cash/bank
5. Submit - stock reduces, customer receivable increases

### Recording a Purchase
1. Click "Purchases" → "New Purchase"
2. Select vendor, product, enter quantity and rate
3. Enter payment made (if any)
4. Submit - stock increases, vendor payable increases, average cost recalculates

### Direct Settlement (Important!)
1. Click "Payments" → "Direct Settlement"
2. Select the customer (who is paying)
3. Select the vendor (who is receiving)
4. Enter the amount
5. Add reference notes
6. Submit

**Example**:
- Customer A owes you ₹1,00,00,000
- You owe Vendor B ₹70,00,000
- Customer A pays Vendor B ₹70,00,000 directly
- Result: Customer A owes ₹30,00,000, Vendor B owed ₹0

### Regular Payment
- **From Customer**: Click "Payments" → "Payment Received" → Select customer, enter amount, select cash/bank
- **To Vendor**: Click "Payments" → "Payment Made" → Select vendor, enter amount, select cash/bank

### Viewing Ledgers
- Click on any customer or vendor name to see complete transaction history
- Shows all sales/purchases, payments, settlements with running balance

### Reports
- **Sales Report**: Filter by date, customer, or product
- **Purchase Report**: Filter by date, vendor, or product  
- **Outstanding**: See all customers who owe money and vendors you owe
- **Profit**: Gross profit by product (revenue - cost)

## 📂 Project Structure

```
grain-trading-pos/
├── backend/
│   ├── database/
│   │   ├── schema.sql          # Database schema
│   │   ├── init.js             # Database initialization
│   │   └── connection.js       # Database connection
│   ├── routes/
│   │   ├── auth.js             # Authentication
│   │   ├── products.js         # Product CRUD
│   │   ├── customers.js        # Customer CRUD + ledger
│   │   ├── vendors.js          # Vendor CRUD + ledger
│   │   ├── sales.js            # Sales recording
│   │   ├── purchases.js        # Purchase recording
│   │   ├── payments.js         # Regular payments
│   │   ├── settlements.js      # Direct settlement (critical)
│   │   ├── dashboard.js        # Dashboard summary
│   │   ├── reports.js          # Report generation
│   │   └── accounts.js         # Cash/bank accounts
│   ├── services/
│   │   └── accountingService.js # Double-entry bookkeeping
│   ├── server.js               # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── services/
│   │   │   ├── api.js          # API client
│   │   │   └── formatter.js    # Number formatting
│   │   ├── i18n/               # English/Urdu translations
│   │   ├── App.jsx             # Main app
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 🔐 Security

- Session-based authentication with secure cookies
- Bcrypt password hashing
- SQL injection prevention via parameterized queries
- CSRF protection recommended for production
- Server-side validation for all inputs

## 🔄 Database Schema

**Key Tables**:
- `products` - Grain inventory
- `customers` - Customer master
- `vendors` - Vendor master
- `sales` - Sales transactions
- `purchases` - Purchase transactions
- `payments` - Regular cash/bank payments
- `settlements` - **Direct settlements** (customer → vendor)
- `ledger_entries` - Complete audit trail
- `cash_bank_accounts` - Cash and bank balances

## 📊 Accounting Logic

### Sale Transaction
```
Dr. Customer Receivable (unpaid)
Dr. Cash/Bank (paid)
Cr. Sales Revenue
Dr. COGS
Cr. Stock
```

### Purchase Transaction
```
Dr. Stock
Cr. Vendor Payable (unpaid)
Cr. Cash/Bank (paid)
```

### Direct Settlement (Special!)
```
Dr. Vendor Payable
Cr. Customer Receivable
(No cash/bank touched)
```

## 🌐 Language Support

Toggle between English and Urdu using the language selector in the header.

## 📱 Responsive Design

- **Desktop (1366x768+)**: Full multi-column layout
- **Tablet (1024x768)**: Optimized for touch with large buttons
- **Touch Targets**: Minimum 44x44 pixels

## 🔢 Number Formatting

All currency amounts displayed in Indian numbering format:
- ₹1,00,00,000 (1 crore)
- ₹70,00,000 (70 lakh)
- ₹50,000 (50 thousand)

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Vite dev server with hot reload
```

### Production Build
```bash
cd frontend
npm run build  # Creates optimized production build
```

## ⚠️ Important Notes

1. **Change Default Password**: After first login, create a new admin user with a strong password
2. **Backup Database**: The SQLite database file is at `backend/database/pos.db` - back it up regularly
3. **Direct Settlement Validation**: The system prevents settlements that exceed customer receivable or vendor payable
4. **Stock Validation**: Cannot sell more than available stock
5. **Opening Balances**: Set opening balances when creating customers/vendors for existing relationships

## 🤝 Support

For issues or questions, refer to the technical design document at `.kiro/specs/grain-trading-pos/design.md`

## 📝 License

MIT

---

**Built with ❤️ for family-owned grain trading businesses**
