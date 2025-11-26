-- Migration: Add SEO fields to articles table
-- Description: Adds columns for slug, metaDescription, tags, categories, and lastUpdated
-- Date: 2024-11-26

-- Add the slug column as TEXT with unique constraint for SEO-friendly URLs
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add the metaDescription column for SEO meta description
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- Add the tags column as TEXT[] array for SEO tags
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add the categories column as TEXT[] array for multiple categories
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Add the lastUpdated column for tracking last modification
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS "lastUpdated" TIMESTAMP WITH TIME ZONE;

-- Add comments to document the columns
COMMENT ON COLUMN articles.slug IS 'SEO-friendly URL slug, e.g., "koopgids-beste-wasmachines-2026". Auto-generated from type and title.';

COMMENT ON COLUMN articles."metaDescription" IS 'SEO meta description for search engine results. Max 160 characters recommended.';

COMMENT ON COLUMN articles.tags IS 'Array of SEO tags for the article, e.g., ["wasmachines", "koopgids", "2026"].';

COMMENT ON COLUMN articles.categories IS 'Array of category IDs for multiple category support. Primary category remains in category column for backwards compatibility.';

COMMENT ON COLUMN articles."lastUpdated" IS 'Timestamp of last modification. Updated when article is edited or rewritten.';

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
