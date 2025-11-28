-- ============================================================================
-- Fix Automation Configuration and Sites Table Migration
-- Addresses database schema issues with automation_config and sites tables
-- ============================================================================

-- ============================================================================
-- 1. Ensure automation_config table exists with correct structure
-- ============================================================================

-- Create automation_config table if not exists (backup for missing table)
CREATE TABLE IF NOT EXISTS automation_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL DEFAULT '{
        "enabled": false,
        "schedules": {},
        "productGeneration": {
            "enabled": false,
            "categories": [],
            "filters": {
                "minRating": 4.0,
                "minReviews": 10,
                "inStockOnly": true
            },
            "maxProductsPerRun": 10
        }
    }'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config if not exists
INSERT INTO automation_config (id, config, updated_at)
VALUES (
    'default',
    '{
        "masterEnabled": false,
        "productGeneration": {
            "enabled": false,
            "productsPerDay": 3,
            "categories": ["televisies", "audio", "laptops", "smartphones"],
            "preferredTime": "09:00"
        },
        "contentGeneration": {
            "enabled": false,
            "frequency": "weekly",
            "contentTypes": ["guides", "comparisons", "toplists"],
            "postsPerWeek": 3,
            "preferredDays": [1, 3, 5]
        },
        "linkMonitoring": {
            "enabled": true,
            "checkFrequency": "daily",
            "autoFix": true,
            "notifications": true
        },
        "commissionTracking": {
            "enabled": true,
            "syncFrequency": "daily",
            "networks": ["bol", "tradetracker", "daisycon"]
        },
        "notifications": {
            "email": "",
            "alertTypes": ["broken_links", "error_occurred", "high_earnings"],
            "emailEnabled": false
        },
        "performance": {
            "enableCaching": true,
            "enableLazyLoading": true,
            "enableImageOptimization": true,
            "minConversionRate": 1.0,
            "autoRemoveLowPerformers": false
        }
    }'::jsonb,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Ensure automation_runs table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    run_type TEXT DEFAULT 'manual',
    categories TEXT[],
    filters JSONB,
    config JSONB,
    products_processed INT DEFAULT 0,
    products_imported INT DEFAULT 0,
    products_skipped INT DEFAULT 0,
    products_failed INT DEFAULT 0,
    error_message TEXT
);

-- Index for faster queries on automation_runs
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at 
    ON automation_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status
    ON automation_runs(status);

-- ============================================================================
-- 3. Ensure discovery_config table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS discovery_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    enabled BOOLEAN DEFAULT false,
    schedule_interval TEXT DEFAULT 'daily',
    categories TEXT[] DEFAULT ARRAY['11652', '13512', '21328'],
    filters JSONB DEFAULT '{"minRating": 4.0, "minReviews": 10, "inStockOnly": true}'::jsonb,
    max_products_per_run INT DEFAULT 10,
    last_run_at TIMESTAMPTZ,
    next_scheduled_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default discovery config if not exists
INSERT INTO discovery_config (id, enabled, schedule_interval, categories, filters, max_products_per_run)
VALUES (
    'default',
    false,
    'daily',
    ARRAY['11652', '13512', '21328'],
    '{"minRating": 4.0, "minReviews": 10, "inStockOnly": true}'::jsonb,
    10
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Ensure product_import_logs table exists
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL,
    ean TEXT,
    bol_product_id TEXT,
    product_title TEXT,
    status TEXT NOT NULL,
    skip_reason TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries on import logs
CREATE INDEX IF NOT EXISTS idx_product_import_logs_run_id 
    ON product_import_logs(run_id);

CREATE INDEX IF NOT EXISTS idx_product_import_logs_status 
    ON product_import_logs(status);

-- ============================================================================
-- 5. Enable RLS on tables if not already enabled
-- ============================================================================

-- automation_config RLS
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on automation_config" ON automation_config;
CREATE POLICY "Allow public read access on automation_config"
ON automation_config FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public write access on automation_config" ON automation_config;
CREATE POLICY "Allow public write access on automation_config"
ON automation_config FOR ALL
USING (true)
WITH CHECK (true);

-- automation_runs RLS
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access on automation_runs" ON automation_runs;
CREATE POLICY "Allow public access on automation_runs"
ON automation_runs FOR ALL
USING (true)
WITH CHECK (true);

-- discovery_config RLS
ALTER TABLE discovery_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access on discovery_config" ON discovery_config;
CREATE POLICY "Allow public access on discovery_config"
ON discovery_config FOR ALL
USING (true)
WITH CHECK (true);

-- product_import_logs RLS
ALTER TABLE product_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access on product_import_logs" ON product_import_logs;
CREATE POLICY "Allow public access on product_import_logs"
ON product_import_logs FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE automation_config IS 'Stores automation configuration settings for the ProductPraat platform';
COMMENT ON TABLE automation_runs IS 'Tracks automation run history and results';
COMMENT ON TABLE discovery_config IS 'Configuration for product discovery automation';
COMMENT ON TABLE product_import_logs IS 'Detailed logs for product import operations';
