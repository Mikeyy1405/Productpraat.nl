-- ============================================================================
-- Bol.com Shop Tables Migration
-- 
-- Creates tables for storing Bol.com products, categories, images, 
-- specifications, and deals for the affiliate shop.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

-- Main products table for Bol.com products
CREATE TABLE IF NOT EXISTS bol_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ean TEXT UNIQUE NOT NULL,
    bol_product_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    
    -- Pricing
    price DECIMAL(10,2),
    strikethrough_price DECIMAL(10,2),
    discount_percentage INTEGER,
    
    -- Availability
    delivery_description TEXT,
    in_stock BOOLEAN DEFAULT true,
    is_deal BOOLEAN DEFAULT false,
    
    -- Ratings
    average_rating DECIMAL(3,2),
    total_ratings INTEGER DEFAULT 0,
    
    -- Media
    main_image_url TEXT,
    
    -- Custom content (for editorial additions)
    custom_description TEXT,
    custom_review_summary TEXT, -- "Wat anderen zeggen"
    
    -- Metadata
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PRODUCT IMAGES TABLE
-- ============================================================================

-- Additional product images
CREATE TABLE IF NOT EXISTS bol_product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES bol_products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    display_order INTEGER DEFAULT 1,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================

-- Bol.com categories (hierarchical)
CREATE TABLE IF NOT EXISTS bol_categories (
    id TEXT PRIMARY KEY, -- Bol.com category ID
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES bol_categories(id) ON DELETE SET NULL,
    product_count INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PRODUCT CATEGORIES JUNCTION TABLE
-- ============================================================================

-- Many-to-many relationship between products and categories
CREATE TABLE IF NOT EXISTS bol_product_categories (
    product_id UUID REFERENCES bol_products(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES bol_categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (product_id, category_id)
);

-- ============================================================================
-- PRODUCT SPECIFICATIONS TABLE
-- ============================================================================

-- Product specifications/attributes
CREATE TABLE IF NOT EXISTS bol_product_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES bol_products(id) ON DELETE CASCADE,
    group_title TEXT, -- e.g., "Algemeen", "Display"
    spec_key TEXT NOT NULL,
    spec_name TEXT NOT NULL,
    spec_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- DEALS TABLE
-- ============================================================================

-- Tracked deals and promotions
CREATE TABLE IF NOT EXISTS bol_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES bol_products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    discount_percentage INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    deal_type TEXT CHECK (deal_type IN ('black_friday', 'flash_deal', 'daily_deal', 'clearance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AFFILIATE CLICKS TABLE
-- ============================================================================

-- Track affiliate link clicks
CREATE TABLE IF NOT EXISTS bol_affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_ean TEXT NOT NULL,
    affiliate_url TEXT NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id TEXT,
    referrer TEXT,
    ip_hash TEXT, -- Hashed IP for fraud prevention
    user_agent TEXT,
    converted BOOLEAN DEFAULT false,
    conversion_value DECIMAL(10,2)
);

-- ============================================================================
-- SYNC JOBS TABLE
-- ============================================================================

-- Track sync job history
CREATE TABLE IF NOT EXISTS bol_sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL CHECK (job_type IN ('popular_products', 'price_update', 'deal_detection', 'rating_update', 'category_sync')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    category_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_bol_products_ean ON bol_products(ean);
CREATE INDEX IF NOT EXISTS idx_bol_products_price ON bol_products(price);
CREATE INDEX IF NOT EXISTS idx_bol_products_rating ON bol_products(average_rating);
CREATE INDEX IF NOT EXISTS idx_bol_products_deal ON bol_products(is_deal) WHERE is_deal = true;
CREATE INDEX IF NOT EXISTS idx_bol_products_in_stock ON bol_products(in_stock) WHERE in_stock = true;
CREATE INDEX IF NOT EXISTS idx_bol_products_last_synced ON bol_products(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_bol_products_created ON bol_products(created_at);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_bol_categories_parent ON bol_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_bol_categories_level ON bol_categories(level);

-- Product images indexes
CREATE INDEX IF NOT EXISTS idx_bol_product_images_product ON bol_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_bol_product_images_order ON bol_product_images(product_id, display_order);

-- Specifications indexes
CREATE INDEX IF NOT EXISTS idx_bol_product_specs_product ON bol_product_specifications(product_id);
CREATE INDEX IF NOT EXISTS idx_bol_product_specs_group ON bol_product_specifications(product_id, group_title);

-- Deals indexes
CREATE INDEX IF NOT EXISTS idx_bol_deals_product ON bol_deals(product_id);
CREATE INDEX IF NOT EXISTS idx_bol_deals_active ON bol_deals(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bol_deals_type ON bol_deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_bol_deals_dates ON bol_deals(start_date, end_date);

-- Affiliate clicks indexes
CREATE INDEX IF NOT EXISTS idx_bol_affiliate_clicks_ean ON bol_affiliate_clicks(product_ean);
CREATE INDEX IF NOT EXISTS idx_bol_affiliate_clicks_date ON bol_affiliate_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_bol_affiliate_clicks_session ON bol_affiliate_clicks(session_id);

-- Sync jobs indexes
CREATE INDEX IF NOT EXISTS idx_bol_sync_jobs_type ON bol_sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_bol_sync_jobs_status ON bol_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bol_sync_jobs_created ON bol_sync_jobs(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bol_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for products
DROP TRIGGER IF EXISTS trigger_bol_products_updated_at ON bol_products;
CREATE TRIGGER trigger_bol_products_updated_at
    BEFORE UPDATE ON bol_products
    FOR EACH ROW
    EXECUTE FUNCTION update_bol_updated_at();

-- Trigger for categories
DROP TRIGGER IF EXISTS trigger_bol_categories_updated_at ON bol_categories;
CREATE TRIGGER trigger_bol_categories_updated_at
    BEFORE UPDATE ON bol_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_bol_updated_at();

-- Trigger for deals
DROP TRIGGER IF EXISTS trigger_bol_deals_updated_at ON bol_deals;
CREATE TRIGGER trigger_bol_deals_updated_at
    BEFORE UPDATE ON bol_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_bol_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE bol_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_product_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bol_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Public read access for products, categories, and deals
CREATE POLICY "Public read access" ON bol_products FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bol_product_images FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bol_categories FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bol_product_categories FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bol_product_specifications FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bol_deals FOR SELECT USING (true);

-- Allow anonymous inserts for affiliate click tracking
CREATE POLICY "Allow click tracking" ON bol_affiliate_clicks FOR INSERT WITH CHECK (true);

-- Authenticated users can manage all data (for admin operations)
CREATE POLICY "Authenticated users full access" ON bol_products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_product_images FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_product_categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_product_specifications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_deals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_affiliate_clicks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bol_sync_jobs FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for products with their primary category
CREATE OR REPLACE VIEW bol_products_with_category AS
SELECT 
    p.*,
    c.name as category_name,
    c.id as category_id
FROM bol_products p
LEFT JOIN bol_product_categories pc ON p.id = pc.product_id AND pc.is_primary = true
LEFT JOIN bol_categories c ON pc.category_id = c.id;

-- View for active deals with product info
CREATE OR REPLACE VIEW bol_active_deals AS
SELECT 
    d.*,
    p.title as product_title,
    p.main_image_url as product_image,
    p.price as current_price,
    p.strikethrough_price as original_price,
    p.url as product_url
FROM bol_deals d
JOIN bol_products p ON d.product_id = p.id
WHERE d.is_active = true
ORDER BY d.discount_percentage DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bol_products IS 'Products synchronized from Bol.com Marketing Catalog API';
COMMENT ON TABLE bol_product_images IS 'Additional product images from Bol.com';
COMMENT ON TABLE bol_categories IS 'Product categories from Bol.com (hierarchical)';
COMMENT ON TABLE bol_product_categories IS 'Many-to-many relationship between products and categories';
COMMENT ON TABLE bol_product_specifications IS 'Product specifications/attributes';
COMMENT ON TABLE bol_deals IS 'Tracked deals and promotions';
COMMENT ON TABLE bol_affiliate_clicks IS 'Affiliate link click tracking for analytics';
COMMENT ON TABLE bol_sync_jobs IS 'History of sync jobs for monitoring';
