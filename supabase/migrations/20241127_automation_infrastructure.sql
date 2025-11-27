-- ============================================================================
-- Automation Infrastructure Migration
-- Run this in your Supabase SQL Editor to create automation-related tables
-- ============================================================================

-- 1. Link Health Checks Table
-- Stores historical health check results for affiliate links
CREATE TABLE IF NOT EXISTS link_health_checks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    link_id TEXT NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
    status_code INTEGER NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time INTEGER, -- Response time in milliseconds
    is_working BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_link_health_checks_link_id ON link_health_checks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_health_checks_checked_at ON link_health_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_link_health_checks_is_working ON link_health_checks(is_working);

-- Add health tracking columns to affiliate_links if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'affiliate_links' AND column_name = 'health_status') THEN
        ALTER TABLE affiliate_links ADD COLUMN health_status TEXT DEFAULT 'unknown';
    END IF;
END $$;

-- 2. Commission Records Table
-- Stores commission data from affiliate networks
CREATE TABLE IF NOT EXISTS commission_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    network_id TEXT NOT NULL REFERENCES affiliate_networks(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    order_id TEXT,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    product_name TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(order_id, network_id)
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_commission_records_network_id ON commission_records(network_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_product_id ON commission_records(product_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_date ON commission_records(date);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);

-- 3. Performance Metrics Table
-- Stores aggregated performance metrics for products, links, and campaigns
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_type TEXT NOT NULL, -- e.g., 'link_performance', 'product_roi', 'network_commission_stats'
    entity_id TEXT NOT NULL, -- ID of the entity being measured
    data JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_entity_id ON performance_metrics(entity_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);

-- 4. Content Schedule Table
-- Stores scheduled content for automated publishing
CREATE TABLE IF NOT EXISTS content_schedule (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content_type TEXT NOT NULL CHECK (content_type IN ('article', 'product_review', 'comparison')),
    category TEXT NOT NULL,
    topic TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'generating', 'generated', 'published', 'failed')),
    created_by_ai BOOLEAN DEFAULT true,
    article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_content_schedule_status ON content_schedule(status);
CREATE INDEX IF NOT EXISTS idx_content_schedule_scheduled_for ON content_schedule(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_schedule_category ON content_schedule(category);

-- 5. Automation Logs Table
-- Stores cron job execution logs
CREATE TABLE IF NOT EXISTS automation_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    details JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_logs_job_name ON automation_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_started_at ON automation_logs(started_at);

-- 6. Automation Metrics Table
-- Stores detailed metrics from automated tasks
CREATE TABLE IF NOT EXISTS automation_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_type TEXT NOT NULL, -- e.g., 'link_check', 'commission_sync', 'content_generation'
    data JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_metrics_metric_type ON automation_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_automation_metrics_recorded_at ON automation_metrics(recorded_at);

-- 7. Daily Reports Table
-- Stores daily automation summary reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    report_date TIMESTAMP WITH TIME ZONE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON daily_reports(report_date);

-- 8. Automation Alerts Table
-- Stores alerts and notifications from automated tasks
CREATE TABLE IF NOT EXISTS automation_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    job_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_alerts_severity ON automation_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_acknowledged ON automation_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_created_at ON automation_alerts(created_at);

-- 9. Retry Tasks Table
-- Stores tasks that need to be retried after failure
CREATE TABLE IF NOT EXISTS retry_tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_name TEXT NOT NULL,
    original_error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'succeeded', 'exhausted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_retry_tasks_status ON retry_tasks(status);
CREATE INDEX IF NOT EXISTS idx_retry_tasks_next_retry_at ON retry_tasks(next_retry_at);

-- ============================================================================
-- Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE link_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retry_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS Policies
-- ============================================================================

-- Drop existing policies if they exist
DO $$ 
BEGIN
    -- Link Health Checks
    DROP POLICY IF EXISTS "Allow public read on link_health_checks" ON link_health_checks;
    DROP POLICY IF EXISTS "Allow authenticated insert on link_health_checks" ON link_health_checks;
    
    -- Commission Records
    DROP POLICY IF EXISTS "Allow public read on commission_records" ON commission_records;
    DROP POLICY IF EXISTS "Allow authenticated insert on commission_records" ON commission_records;
    DROP POLICY IF EXISTS "Allow authenticated update on commission_records" ON commission_records;
    
    -- Performance Metrics
    DROP POLICY IF EXISTS "Allow public read on performance_metrics" ON performance_metrics;
    DROP POLICY IF EXISTS "Allow authenticated insert on performance_metrics" ON performance_metrics;
    
    -- Content Schedule
    DROP POLICY IF EXISTS "Allow public read on content_schedule" ON content_schedule;
    DROP POLICY IF EXISTS "Allow authenticated insert on content_schedule" ON content_schedule;
    DROP POLICY IF EXISTS "Allow authenticated update on content_schedule" ON content_schedule;
    
    -- Automation Logs
    DROP POLICY IF EXISTS "Allow public read on automation_logs" ON automation_logs;
    DROP POLICY IF EXISTS "Allow authenticated insert on automation_logs" ON automation_logs;
    
    -- Automation Metrics
    DROP POLICY IF EXISTS "Allow public read on automation_metrics" ON automation_metrics;
    DROP POLICY IF EXISTS "Allow authenticated insert on automation_metrics" ON automation_metrics;
    
    -- Daily Reports
    DROP POLICY IF EXISTS "Allow public read on daily_reports" ON daily_reports;
    DROP POLICY IF EXISTS "Allow authenticated insert on daily_reports" ON daily_reports;
    
    -- Automation Alerts
    DROP POLICY IF EXISTS "Allow public read on automation_alerts" ON automation_alerts;
    DROP POLICY IF EXISTS "Allow authenticated insert on automation_alerts" ON automation_alerts;
    DROP POLICY IF EXISTS "Allow authenticated update on automation_alerts" ON automation_alerts;
    
    -- Retry Tasks
    DROP POLICY IF EXISTS "Allow public read on retry_tasks" ON retry_tasks;
    DROP POLICY IF EXISTS "Allow authenticated insert on retry_tasks" ON retry_tasks;
    DROP POLICY IF EXISTS "Allow authenticated update on retry_tasks" ON retry_tasks;
END $$;

-- Create public read policies (for dashboard)
CREATE POLICY "Allow public read on link_health_checks" ON link_health_checks FOR SELECT USING (true);
CREATE POLICY "Allow public read on commission_records" ON commission_records FOR SELECT USING (true);
CREATE POLICY "Allow public read on performance_metrics" ON performance_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read on content_schedule" ON content_schedule FOR SELECT USING (true);
CREATE POLICY "Allow public read on automation_logs" ON automation_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read on automation_metrics" ON automation_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read on daily_reports" ON daily_reports FOR SELECT USING (true);
CREATE POLICY "Allow public read on automation_alerts" ON automation_alerts FOR SELECT USING (true);
CREATE POLICY "Allow public read on retry_tasks" ON retry_tasks FOR SELECT USING (true);

-- Create insert/update policies (for server-side operations)
CREATE POLICY "Allow authenticated insert on link_health_checks" ON link_health_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on commission_records" ON commission_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on commission_records" ON commission_records FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated insert on performance_metrics" ON performance_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on content_schedule" ON content_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on content_schedule" ON content_schedule FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated insert on automation_logs" ON automation_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on automation_metrics" ON automation_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on daily_reports" ON daily_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated insert on automation_alerts" ON automation_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on automation_alerts" ON automation_alerts FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated insert on retry_tasks" ON retry_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on retry_tasks" ON retry_tasks FOR UPDATE USING (true);

-- Allow delete for cleanup operations
CREATE POLICY "Allow authenticated delete on automation_logs" ON automation_logs FOR DELETE USING (true);
CREATE POLICY "Allow authenticated delete on automation_metrics" ON automation_metrics FOR DELETE USING (true);
CREATE POLICY "Allow authenticated delete on link_health_checks" ON link_health_checks FOR DELETE USING (true);

-- ============================================================================
-- Create helper function for updating timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_commission_records_updated_at ON commission_records;
CREATE TRIGGER update_commission_records_updated_at
    BEFORE UPDATE ON commission_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_schedule_updated_at ON content_schedule;
CREATE TRIGGER update_content_schedule_updated_at
    BEFORE UPDATE ON content_schedule
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
