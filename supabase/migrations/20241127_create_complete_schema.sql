-- Complete schema voor ProductPraat database
-- Run dit in je Supabase SQL Editor

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    price NUMERIC NOT NULL,
    score NUMERIC NOT NULL,
    category TEXT NOT NULL,
    image TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    specs JSONB DEFAULT '{}'::jsonb,
    pros JSONB DEFAULT '[]'::jsonb,
    cons JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    "metaDescription" TEXT,
    keywords JSONB DEFAULT '[]'::jsonb,
    "longDescription" TEXT,
    "expertOpinion" TEXT,
    "userReviewsSummary" TEXT,
    "affiliateUrl" TEXT,
    ean TEXT,
    "scoreBreakdown" JSONB DEFAULT '{}'::jsonb,
    suitability JSONB DEFAULT '{}'::jsonb,
    faq JSONB DEFAULT '[]'::jsonb,
    predicate TEXT,
    "bolReviewsRaw" JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);

-- 2. Articles Table
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    "htmlContent" TEXT NOT NULL,
    "imageUrl" TEXT,
    author TEXT DEFAULT 'ProductPraat Redactie',
    "readTime" INTEGER DEFAULT 5,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    keywords JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(type);

-- 3. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "userName" TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT NOT NULL,
    comment TEXT NOT NULL,
    "verifiedPurchase" BOOLEAN DEFAULT false,
    helpful INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews("productId");

-- Enable Row Level Security (RLS) - Public read access
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access on products" ON products;
DROP POLICY IF EXISTS "Allow public read access on articles" ON articles;
DROP POLICY IF EXISTS "Allow public read access on reviews" ON reviews;
DROP POLICY IF EXISTS "Allow authenticated insert on products" ON products;
DROP POLICY IF EXISTS "Allow authenticated update on products" ON products;
DROP POLICY IF EXISTS "Allow authenticated delete on products" ON products;
DROP POLICY IF EXISTS "Allow authenticated insert on articles" ON articles;
DROP POLICY IF EXISTS "Allow authenticated update on articles" ON articles;
DROP POLICY IF EXISTS "Allow authenticated delete on articles" ON articles;
DROP POLICY IF EXISTS "Allow public insert on reviews" ON reviews;

-- Create policies for public read access
CREATE POLICY "Allow public read access on products" 
    ON products FOR SELECT 
    USING (true);

CREATE POLICY "Allow public read access on articles" 
    ON articles FOR SELECT 
    USING (true);

CREATE POLICY "Allow public read access on reviews" 
    ON reviews FOR SELECT 
    USING (true);

-- Create policies for authenticated insert/update/delete
CREATE POLICY "Allow authenticated insert on products" 
    ON products FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on products" 
    ON products FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated delete on products" 
    ON products FOR DELETE 
    USING (true);

CREATE POLICY "Allow authenticated insert on articles" 
    ON articles FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on articles" 
    ON articles FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated delete on articles" 
    ON articles FOR DELETE 
    USING (true);

CREATE POLICY "Allow public insert on reviews" 
    ON reviews FOR INSERT 
    WITH CHECK (true);
