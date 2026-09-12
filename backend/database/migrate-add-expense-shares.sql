-- Migration: Add partner share columns to expenses table
-- This adds tracking of how expenses are divided among partners

-- Add new columns for partner shares
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS iftekhar_share NUMERIC(15, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS shaukat_share NUMERIC(15, 2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_share NUMERIC(15, 2);

-- Update existing expenses to calculate shares (2:2:1 ratio)
UPDATE expenses 
SET 
    iftekhar_share = amount * 2 / 5,
    shaukat_share = amount * 2 / 5,
    bank_share = amount * 1 / 5
WHERE iftekhar_share IS NULL;

-- Make columns NOT NULL after populating data
ALTER TABLE expenses ALTER COLUMN iftekhar_share SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN shaukat_share SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN bank_share SET NOT NULL;

-- Verify the migration
SELECT 'Expense shares migration completed successfully!' AS status;
SELECT 
    COUNT(*) as total_expenses,
    SUM(amount) as total_amount,
    SUM(iftekhar_share) as iftekhar_total,
    SUM(shaukat_share) as shaukat_total,
    SUM(bank_share) as bank_total
FROM expenses;
