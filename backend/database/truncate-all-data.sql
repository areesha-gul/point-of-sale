-- ============================================
-- TRUNCATE ALL DATA - Clean Database Reset
-- ============================================
-- This script removes all data from all tables
-- but keeps the table structure intact.
-- USE WITH CAUTION - THIS CANNOT BE UNDONE!
-- ============================================

-- Disable foreign key checks temporarily (PostgreSQL specific)
SET session_replication_role = 'replica';

-- Truncate all transaction tables
TRUNCATE TABLE ledger_entries CASCADE;
TRUNCATE TABLE profit_withdrawals CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE bank_transactions CASCADE;
TRUNCATE TABLE direct_deliveries CASCADE;
TRUNCATE TABLE settlements CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE purchases CASCADE;

-- Truncate master data tables
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE vendors CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE cash_bank_accounts CASCADE;

-- Keep users table (so login credentials remain)
-- TRUNCATE TABLE users CASCADE; -- Commented out to preserve login

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences to start from 1
ALTER SEQUENCE IF EXISTS ledger_entries_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS profit_withdrawals_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS expenses_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bank_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS direct_deliveries_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS settlements_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS sales_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS purchases_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS customers_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vendors_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS cash_bank_accounts_id_seq RESTART WITH 1;

-- Display success message
SELECT 'Database truncated successfully. All data cleared except user accounts.' AS status;
