-- Migration: Add URL-based import fields to products table
-- Description: Adds columns for the new fields from URL-based product imports
--              including AI-generated content, review content, scores, specifications, etc.
-- Date: 2024-11-27

-- Add title column for full product title
ALTER TABLE products
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add seoDescription for SEO-optimized description (155-160 chars)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

-- Add priceLabel for price display (e.g., "€299,-" or "Vanaf €249,-")
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "priceLabel" TEXT;

-- Add rating column (same as score, but used by URL imports - 0-10)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS rating NUMERIC;

-- Add imageUrl for primary product image URL
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Add galleryImages as JSONB array of additional image URLs
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "galleryImages" JSONB DEFAULT '[]'::jsonb;

-- Add affiliateLink (alias for affiliateUrl for URL imports)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "affiliateLink" TEXT;

-- Add tags as JSONB array of product tags
ALTER TABLE products
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add features as JSONB array of key product features
ALTER TABLE products
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- Add reviewContent as JSONB for comprehensive review sections
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "reviewContent" JSONB;

-- Add specifications as JSONB array of {label, value} objects
ALTER TABLE products
ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '[]'::jsonb;

-- Add scores as JSONB for detailed score breakdown (quality, priceValue, usability, design)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS scores JSONB;

-- Add targetAudience as JSONB array of target audience descriptions
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "targetAudience" JSONB DEFAULT '[]'::jsonb;

-- Add alternatives as JSONB array of alternative product names
ALTER TABLE products
ADD COLUMN IF NOT EXISTS alternatives JSONB DEFAULT '[]'::jsonb;

-- Add reviewAuthor as JSONB for expert author information
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "reviewAuthor" JSONB;

-- Add isAiGenerated flag to indicate AI-generated products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS "isAiGenerated" BOOLEAN DEFAULT false;

-- Add comments to document the columns
COMMENT ON COLUMN products.title IS 'Full product title from URL imports. E.g., "Samsung Galaxy S24 Ultra 256GB"';

COMMENT ON COLUMN products."seoDescription" IS 'SEO-optimized description (155-160 characters) containing brand, model, and key USP.';

COMMENT ON COLUMN products."priceLabel" IS 'Price display label (e.g., "€299,-" or "Vanaf €249,-"). Human-readable price format.';

COMMENT ON COLUMN products.rating IS 'Product rating from 0-10. Same as score field, but used for URL imports.';

COMMENT ON COLUMN products."imageUrl" IS 'Primary product image URL. May be the same as image field.';

COMMENT ON COLUMN products."galleryImages" IS 'Array of additional product image URLs for gallery display.';

COMMENT ON COLUMN products."affiliateLink" IS 'Affiliate/tracking link to shop. May be same as affiliateUrl field.';

COMMENT ON COLUMN products.tags IS 'Array of product tags/keywords for filtering and SEO.';

COMMENT ON COLUMN products.features IS 'Array of key product features as strings.';

COMMENT ON COLUMN products."reviewContent" IS E'Comprehensive review content sections:\n{\n  "whatIsIt": "Product introduction...",\n  "forWho": "Target audience...",\n  "keyFeatures": "Key features explanation...",\n  "whatToConsider": "Buying considerations...",\n  "verdict": "Final verdict and recommendation..."\n}';

COMMENT ON COLUMN products.specifications IS E'Array of structured specifications:\n[\n  { "label": "Screen Size", "value": "6.8 inches" },\n  { "label": "Battery", "value": "5000 mAh" }\n]';

COMMENT ON COLUMN products.scores IS E'Detailed score breakdown:\n{\n  "quality": 8.5,\n  "priceValue": 7.5,\n  "usability": 9.0,\n  "design": 8.0\n}';

COMMENT ON COLUMN products."targetAudience" IS 'Array of target audience descriptions, e.g., ["Power users", "Photography enthusiasts"]';

COMMENT ON COLUMN products.alternatives IS 'Array of alternative product names to consider, e.g., ["iPhone 15 Pro", "Google Pixel 8"]';

COMMENT ON COLUMN products."reviewAuthor" IS E'Expert author information:\n{\n  "name": "Jan de Vries",\n  "role": "Productexpert",\n  "summary": "Expert bio...",\n  "avatarUrl": "https://..."\n}';

COMMENT ON COLUMN products."isAiGenerated" IS 'True if product was generated via URL import with AI analysis. Defaults to false for manually added products.';

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_products_is_ai_generated ON products("isAiGenerated");
