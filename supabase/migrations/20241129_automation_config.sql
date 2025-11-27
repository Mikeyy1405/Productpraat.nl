-- ============================================================================
-- Automation Configuration Table Migration
-- Creates the automation_config table for storing automation settings
-- ============================================================================

-- Create automation_config table
CREATE TABLE IF NOT EXISTS automation_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one row can exist (single configuration)
    CONSTRAINT single_row CHECK (id = 'default')
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_automation_config_updated_at ON automation_config(updated_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read config
CREATE POLICY "Allow public read access on automation_config"
ON automation_config FOR SELECT
USING (true);

-- Policy: Allow all authenticated users to update config
CREATE POLICY "Allow public update access on automation_config"
ON automation_config FOR UPDATE
USING (true);

-- Policy: Allow all authenticated users to insert config
CREATE POLICY "Allow public insert access on automation_config"
ON automation_config FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- Insert default configuration as seed data
-- ============================================================================

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
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE automation_config IS 'Stores automation configuration settings for the ProductPraat platform';
COMMENT ON COLUMN automation_config.id IS 'Unique identifier, always "default" for single-row constraint';
COMMENT ON COLUMN automation_config.config IS 'JSONB containing all automation settings';
COMMENT ON COLUMN automation_config.updated_at IS 'Timestamp of last configuration update';
