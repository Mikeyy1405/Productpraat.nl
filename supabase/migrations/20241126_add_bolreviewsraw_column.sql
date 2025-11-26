-- Migration: Add bolReviewsRaw column to products table
-- Description: Adds a JSONB column to store raw Bol.com review data including
--              average rating, total reviews count, and rating distribution
-- Date: 2024-11-26

-- Add the bolReviewsRaw column as JSONB to store structured review data
-- The column is nullable to support existing records
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "bolReviewsRaw" jsonb;

-- Add a comment to document the column's purpose and expected structure
-- The field is nullable when:
-- 1. Product existed before this column was added
-- 2. Bol.com API does not return review data for the product
-- 3. Product was imported without fetching reviews
COMMENT ON COLUMN products."bolReviewsRaw" IS E'Bol.com review data from ratings API endpoint.\n\nStructure:\n{\n  "averageRating": 4.5,           -- Float 0-5, average customer rating\n  "totalReviews": 123,            -- Integer, total number of reviews\n  "distribution": [               -- Array of rating counts\n    { "rating": 5, "count": 80 },\n    { "rating": 4, "count": 25 },\n    { "rating": 3, "count": 10 },\n    { "rating": 2, "count": 5 },\n    { "rating": 1, "count": 3 }\n  ]\n}\n\nNull when: product has no reviews, API unavailable, or legacy product.';
