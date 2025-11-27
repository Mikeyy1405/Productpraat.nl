-- Migration: Create sites table for CMS configuration storage
-- This table stores site configuration for each user, replacing localStorage

CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    
    -- Template configuration (stored as JSONB)
    template_type TEXT NOT NULL DEFAULT 'shop',
    template_settings JSONB DEFAULT '{}'::jsonb,
    
    -- Feature toggles (array of feature states)
    features JSONB DEFAULT '[]'::jsonb,
    
    -- SEO settings
    seo JSONB DEFAULT '{}'::jsonb,
    
    -- Contact information
    contact JSONB DEFAULT '{}'::jsonb,
    
    -- Social media links
    social_media JSONB DEFAULT '{}'::jsonb,
    
    -- Migration status (for backwards compatibility)
    migrated_from_productpraat BOOLEAN DEFAULT false,
    legacy_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one site per user (for now)
    CONSTRAINT unique_user_site UNIQUE(user_id)
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);

-- Enable Row Level Security
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own site" ON sites;
DROP POLICY IF EXISTS "Users can insert their own site" ON sites;
DROP POLICY IF EXISTS "Users can update their own site" ON sites;
DROP POLICY IF EXISTS "Users can delete their own site" ON sites;

-- Create RLS policies
-- Users can only read their own site
CREATE POLICY "Users can read their own site" 
    ON sites FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can only insert their own site
CREATE POLICY "Users can insert their own site" 
    ON sites FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own site
CREATE POLICY "Users can update their own site" 
    ON sites FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can only delete their own site
CREATE POLICY "Users can delete their own site" 
    ON sites FOR DELETE 
    USING (auth.uid() = user_id);
