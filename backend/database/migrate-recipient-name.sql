-- Migration: Update recipient name from 'Istekhar' to 'Iftekhar Ahmad'
-- Run this once to update existing profit withdrawal records

-- First, drop the existing constraint
ALTER TABLE profit_withdrawals DROP CONSTRAINT IF EXISTS profit_withdrawals_recipient_check;

-- Update existing records
UPDATE profit_withdrawals SET recipient = 'Iftekhar Ahmad' WHERE recipient = 'Istekhar';

-- Add the new constraint with updated values
ALTER TABLE profit_withdrawals ADD CONSTRAINT profit_withdrawals_recipient_check 
CHECK (recipient IN ('Iftekhar Ahmad', 'Shaukat', 'Bank'));
