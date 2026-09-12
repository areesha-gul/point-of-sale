-- Migration: Remove partner share columns from expenses table
-- Expenses now reduce total profit, then profit is divided among partners

-- Remove the share columns
ALTER TABLE expenses DROP COLUMN IF EXISTS iftekhar_share;
ALTER TABLE expenses DROP COLUMN IF EXISTS shaukat_share;
ALTER TABLE expenses DROP COLUMN IF EXISTS bank_share;

-- Verify the migration
SELECT 'Expense share columns removed successfully!' AS status;
SELECT 
    COUNT(*) as total_expenses,
    SUM(amount) as total_expense_amount
FROM expenses;
