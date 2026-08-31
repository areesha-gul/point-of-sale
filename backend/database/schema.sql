-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL UNIQUE,
    unit TEXT DEFAULT 'KG',
    current_stock REAL DEFAULT 0,
    avg_cost REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    opening_balance REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    opening_balance REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty_kg REAL NOT NULL,
    rate REAL NOT NULL,
    total REAL NOT NULL,
    amount_paid REAL DEFAULT 0,
    payment_method TEXT CHECK(payment_method IN ('cash', 'bank', 'none')),
    date DATE NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'voided')),
    approved_at DATETIME,
    approved_by INTEGER,
    voided INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id TEXT UNIQUE NOT NULL,
    vendor_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty_kg REAL NOT NULL,
    rate REAL NOT NULL,
    total REAL NOT NULL,
    freight_charges REAL DEFAULT 0,
    other_charges REAL DEFAULT 0,
    grand_total REAL NOT NULL,
    amount_paid REAL DEFAULT 0,
    payment_method TEXT CHECK(payment_method IN ('cash', 'bank', 'none')),
    bank_account_id INTEGER,
    date DATE NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'voided')),
    approved_at DATETIME,
    approved_by INTEGER,
    is_direct_delivery INTEGER DEFAULT 0,
    voided INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (bank_account_id) REFERENCES cash_bank_accounts(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    party_type TEXT NOT NULL CHECK(party_type IN ('customer', 'vendor')),
    party_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('cash', 'bank', 'cheque')),
    bank_account_id INTEGER,
    cheque_number TEXT,
    cheque_date DATE,
    direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
    date DATE NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'voided')),
    approved_at DATETIME,
    approved_by INTEGER,
    voided INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bank_account_id) REFERENCES cash_bank_accounts(id)
);

-- Settlements table (Direct Settlement)
CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    vendor_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    voided INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

-- Cash and Bank Accounts table
CREATE TABLE IF NOT EXISTS cash_bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cash', 'bank')),
    account_number TEXT,
    bank_name TEXT,
    opening_balance REAL DEFAULT 0,
    opening_balance_date DATE,
    current_balance REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Entries (audit trail)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_type TEXT NOT NULL CHECK(ref_type IN ('sale', 'purchase', 'payment', 'settlement', 'bank_transaction')),
    ref_id INTEGER NOT NULL,
    party_type TEXT CHECK(party_type IN ('customer', 'vendor', 'account')),
    party_id INTEGER,
    account_type TEXT CHECK(account_type IN ('receivable', 'payable', 'cash', 'bank', 'stock', 'revenue', 'cogs', 'freight', 'commission')),
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bank Transactions table (deposits, withdrawals, transfers)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('deposit', 'withdrawal', 'transfer')),
    from_account_id INTEGER,
    to_account_id INTEGER,
    amount REAL NOT NULL,
    date DATE NOT NULL,
    reference TEXT,
    notes TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'voided')),
    approved_at DATETIME,
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_account_id) REFERENCES cash_bank_accounts(id),
    FOREIGN KEY (to_account_id) REFERENCES cash_bank_accounts(id)
);

-- Direct Delivery Transactions (for freight handling)
CREATE TABLE IF NOT EXISTS direct_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id TEXT UNIQUE NOT NULL,
    purchase_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    product_cost REAL NOT NULL,
    freight_charges REAL NOT NULL,
    total_received REAL NOT NULL,
    commission_amount REAL DEFAULT 0,
    amount_to_vendor REAL NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'voided')),
    approved_at DATETIME,
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff' CHECK(role IN ('owner', 'staff')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor ON purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_settlements_customer ON settlements(customer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_vendor ON settlements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(date);
