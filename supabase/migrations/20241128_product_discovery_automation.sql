-- ============================================================================
-- Product Discovery Automation Tables
-- Creates tables for automated product discovery from Bol.com
-- ============================================================================

-- 1. Automation Runs Table
-- Stores history of automation discovery runs
CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    run_type TEXT NOT NULL DEFAULT 'manual' CHECK (run_type IN ('manual', 'scheduled')),
    categories TEXT[], -- Array of Bol.com category IDs
    filters JSONB DEFAULT '{}', -- Filters applied (min rating, min reviews, in stock only)
    products_processed INTEGER DEFAULT 0,
    products_imported INTEGER DEFAULT 0,
    products_skipped INTEGER DEFAULT 0,
    products_failed INTEGER DEFAULT 0,
    error_message TEXT,
    config JSONB DEFAULT '{}', -- Configuration used for this run
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_run_type ON automation_runs(run_type);

-- 2. Discovery Configuration Table
-- Stores the product discovery automation configuration
CREATE TABLE IF NOT EXISTS discovery_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    enabled BOOLEAN DEFAULT false,
    schedule_interval TEXT CHECK (schedule_interval IN ('hourly', 'daily', 'weekly')),
    categories TEXT[] DEFAULT ARRAY[]::TEXT[], -- Bol.com category IDs to monitor
    filters JSONB DEFAULT '{
        "minRating": 4.0,
        "minReviews": 10,
        "inStockOnly": true
    }'::jsonb,
    max_products_per_run INTEGER DEFAULT 10,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_scheduled_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one config row
    CONSTRAINT single_discovery_config CHECK (id = 'default')
);

-- 3. Product Import Log Table
-- Tracks individual product imports during automation runs
CREATE TABLE IF NOT EXISTS product_import_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    run_id TEXT REFERENCES automation_runs(id) ON DELETE CASCADE,
    ean TEXT,
    bol_product_id TEXT,
    product_title TEXT,
    status TEXT NOT NULL CHECK (status IN ('imported', 'skipped', 'failed')),
    skip_reason TEXT, -- e.g., "duplicate", "low_rating", "out_of_stock"
    error_message TEXT,
    product_id TEXT, -- Reference to the created product, if imported
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_product_import_logs_run_id ON product_import_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_product_import_logs_status ON product_import_logs(status);
CREATE INDEX IF NOT EXISTS idx_product_import_logs_ean ON product_import_logs(ean);

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_import_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS Policies
-- ============================================================================

-- Automation Runs policies
CREATE POLICY "Allow public read on automation_runs" ON automation_runs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on automation_runs" ON automation_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on automation_runs" ON automation_runs FOR UPDATE USING (true);

-- Discovery Config policies
CREATE POLICY "Allow public read on discovery_config" ON discovery_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert on discovery_config" ON discovery_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on discovery_config" ON discovery_config FOR UPDATE USING (true);

-- Product Import Logs policies
CREATE POLICY "Allow public read on product_import_logs" ON product_import_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on product_import_logs" ON product_import_logs FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Insert default discovery configuration
-- ============================================================================

INSERT INTO discovery_config (id, enabled, schedule_interval, categories, filters, max_products_per_run)
VALUES (
    'default',
    false,
    'daily',
    ARRAY['11652', '13512', '21328']::TEXT[], -- Electronics, Computer & Gaming, Phones
    '{
        "minRating": 4.0,
        "minReviews": 10,
        "inStockOnly": true
    }'::jsonb,
    10
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Create trigger for updating updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_discovery_config_updated_at ON discovery_config;
CREATE TRIGGER update_discovery_config_updated_at
    BEFORE UPDATE ON discovery_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE automation_runs IS 'Stores history of automated product discovery runs';
COMMENT ON TABLE discovery_config IS 'Configuration for automated product discovery';
COMMENT ON TABLE product_import_logs IS 'Detailed logs of individual product imports during automation runs';
