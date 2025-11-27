-- ============================================================================
-- Affiliate Infrastructure Migration
-- Run this in your Supabase SQL Editor to create the affiliate tables
-- ============================================================================

-- 1. Affiliate Networks Table
-- Stores information about supported affiliate networks (physical and digital)
CREATE TABLE IF NOT EXISTS affiliate_networks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('physical', 'digital')),
    website TEXT,
    commission_range TEXT,
    cookie_duration_days INTEGER,
    product_types TEXT[] DEFAULT '{}',
    api_available BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on network type for faster filtering
CREATE INDEX IF NOT EXISTS idx_affiliate_networks_type ON affiliate_networks(type);

-- 2. Affiliate Links Table
-- Stores affiliate links for products with tracking information
CREATE TABLE IF NOT EXISTS affiliate_links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    network_id TEXT NOT NULL REFERENCES affiliate_networks(id) ON DELETE CASCADE,
    shop_name TEXT,
    url TEXT NOT NULL,
    price NUMERIC,
    in_stock BOOLEAN DEFAULT true,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product_id ON affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_network_id ON affiliate_links(network_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_is_primary ON affiliate_links(is_primary);

-- 3. Affiliate Clicks Table
-- Tracks clicks on affiliate links for analytics and conversion tracking
CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    link_id TEXT NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_hash TEXT,
    user_id TEXT,
    converted BOOLEAN DEFAULT false,
    commission_amount NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_link_id ON affiliate_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_converted ON affiliate_clicks(converted);

-- 4. Digital Products Table
-- For digital products from PayPro and Plug&Pay
CREATE TABLE IF NOT EXISTS digital_products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    network_id TEXT NOT NULL REFERENCES affiliate_networks(id) ON DELETE CASCADE,
    campaign_id TEXT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC,
    commission_percentage NUMERIC,
    vendor_name TEXT,
    category TEXT,
    image_url TEXT,
    affiliate_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_digital_products_network_id ON digital_products(network_id);
CREATE INDEX IF NOT EXISTS idx_digital_products_slug ON digital_products(slug);
CREATE INDEX IF NOT EXISTS idx_digital_products_category ON digital_products(category);
CREATE INDEX IF NOT EXISTS idx_digital_products_campaign_id ON digital_products(campaign_id);

-- Enable Row Level Security (RLS)
ALTER TABLE affiliate_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access on affiliate_networks" ON affiliate_networks;
DROP POLICY IF EXISTS "Allow public read access on affiliate_links" ON affiliate_links;
DROP POLICY IF EXISTS "Allow public read access on digital_products" ON digital_products;
DROP POLICY IF EXISTS "Allow public insert on affiliate_clicks" ON affiliate_clicks;
DROP POLICY IF EXISTS "Allow authenticated insert on affiliate_networks" ON affiliate_networks;
DROP POLICY IF EXISTS "Allow authenticated update on affiliate_networks" ON affiliate_networks;
DROP POLICY IF EXISTS "Allow authenticated delete on affiliate_networks" ON affiliate_networks;
DROP POLICY IF EXISTS "Allow authenticated insert on affiliate_links" ON affiliate_links;
DROP POLICY IF EXISTS "Allow authenticated update on affiliate_links" ON affiliate_links;
DROP POLICY IF EXISTS "Allow authenticated delete on affiliate_links" ON affiliate_links;
DROP POLICY IF EXISTS "Allow authenticated insert on digital_products" ON digital_products;
DROP POLICY IF EXISTS "Allow authenticated update on digital_products" ON digital_products;
DROP POLICY IF EXISTS "Allow authenticated delete on digital_products" ON digital_products;

-- Create policies for public read access
CREATE POLICY "Allow public read access on affiliate_networks" 
    ON affiliate_networks FOR SELECT 
    USING (true);

CREATE POLICY "Allow public read access on affiliate_links" 
    ON affiliate_links FOR SELECT 
    USING (true);

CREATE POLICY "Allow public read access on digital_products" 
    ON digital_products FOR SELECT 
    USING (true);

-- Allow public insert on affiliate_clicks (for tracking)
CREATE POLICY "Allow public insert on affiliate_clicks" 
    ON affiliate_clicks FOR INSERT 
    WITH CHECK (true);

-- Create policies for authenticated insert/update/delete
CREATE POLICY "Allow authenticated insert on affiliate_networks" 
    ON affiliate_networks FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on affiliate_networks" 
    ON affiliate_networks FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated delete on affiliate_networks" 
    ON affiliate_networks FOR DELETE 
    USING (true);

CREATE POLICY "Allow authenticated insert on affiliate_links" 
    ON affiliate_links FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on affiliate_links" 
    ON affiliate_links FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated delete on affiliate_links" 
    ON affiliate_links FOR DELETE 
    USING (true);

CREATE POLICY "Allow authenticated insert on digital_products" 
    ON digital_products FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on digital_products" 
    ON digital_products FOR UPDATE 
    USING (true);

CREATE POLICY "Allow authenticated delete on digital_products" 
    ON digital_products FOR DELETE 
    USING (true);

-- ============================================================================
-- SEED DATA: Insert affiliate networks
-- ============================================================================

-- Insert affiliate networks with sensible defaults
INSERT INTO affiliate_networks (id, name, type, website, commission_range, cookie_duration_days, product_types, api_available, notes)
VALUES
    ('bol', 'Bol.com Partner', 'physical', 'https://partnerprogramma.bol.com', '5-10%', 30, ARRAY['electronics', 'books', 'toys', 'home', 'fashion'], true, 'Largest Dutch marketplace. Requires partner account and approval.'),
    ('tradetracker', 'TradeTracker', 'physical', 'https://www.tradetracker.com', '2-15%', 30, ARRAY['electronics', 'fashion', 'travel', 'finance', 'telecom'], true, 'European affiliate network with many Dutch merchants.'),
    ('daisycon', 'Daisycon', 'physical', 'https://www.daisycon.com', '2-12%', 30, ARRAY['electronics', 'fashion', 'travel', 'finance', 'utilities'], true, 'Dutch affiliate network with strong local presence.'),
    ('awin', 'Awin', 'physical', 'https://www.awin.com', '3-15%', 30, ARRAY['electronics', 'fashion', 'travel', 'retail', 'finance'], true, 'Global affiliate network with major brands.'),
    ('paypro', 'PayPro', 'digital', 'https://paypro.nl/affiliates', '10-75%', 365, ARRAY['courses', 'ebooks', 'software', 'memberships', 'digital'], true, 'Dutch digital product platform. High commissions for digital products.'),
    ('plugpay', 'Plug&Pay', 'digital', 'https://www.plugpay.nl/affiliate', '10-50%', 365, ARRAY['courses', 'coaching', 'memberships', 'digital'], false, 'Dutch digital product and course platform.')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    website = EXCLUDED.website,
    commission_range = EXCLUDED.commission_range,
    cookie_duration_days = EXCLUDED.cookie_duration_days,
    product_types = EXCLUDED.product_types,
    api_available = EXCLUDED.api_available,
    notes = EXCLUDED.notes,
    updated_at = NOW();
