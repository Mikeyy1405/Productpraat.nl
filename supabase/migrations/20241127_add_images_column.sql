-- Migration: Add images column to products table
-- Description: Adds a JSONB column to store multiple product images from Bol.com media endpoint
-- This fixes the error: "Could not find the 'images' column of 'products' in the schema cache"
-- Date: 2024-11-27

-- Add the images column as JSONB to store an array of image URLs
-- The column is nullable with a default empty array to support existing records
ALTER TABLE products
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

-- Add a comment to document the column's purpose and expected structure
-- The field stores multiple product images retrieved from the Bol.com media API
COMMENT ON COLUMN products.images IS E'Array of product image URLs from Bol.com media endpoint.\n\nStructure: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]\n\nThe first image in the array is typically the main product image.\nDefaults to empty array [] for products without multiple images.';
