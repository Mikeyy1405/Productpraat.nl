-- Migration: Fix reviews table to match TypeScript UserReview type
-- Description: Adds date column and makes title optional for compatibility
-- Date: 2024-11-27

-- Add date column for human-readable date display
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS date TEXT;

-- Make title optional by dropping the NOT NULL constraint
-- First check if the constraint exists before altering
DO $$
BEGIN
    -- Drop NOT NULL constraint on title if it exists
    ALTER TABLE reviews ALTER COLUMN title DROP NOT NULL;
EXCEPTION
    WHEN others THEN
        -- Ignore if column doesn't exist or constraint already dropped
        NULL;
END $$;

-- Set a default for title to handle new inserts without title
ALTER TABLE reviews
ALTER COLUMN title SET DEFAULT '';

-- Add comment documenting the date field
COMMENT ON COLUMN reviews.date IS 'Human-readable date string (e.g., "27 november 2024"). Used for display purposes.';
