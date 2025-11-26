-- Migration: Add bolReviewsRaw column to products table
-- Description: Adds a JSONB column to store raw Bol.com review data including
--              average rating, total reviews count, and rating distribution
-- Date: 2024-11-26

-- Add the bolReviewsRaw column as JSONB to store structured review data
-- The column is nullable to support existing records
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "bolReviewsRaw" jsonb;

-- Add a comment to document the column's purpose and expected structure
COMMENT ON COLUMN products."bolReviewsRaw" IS 'Raw Bol.com review data: { averageRating: number, totalReviews: number, distribution: [{ rating: number, count: number }] }';
