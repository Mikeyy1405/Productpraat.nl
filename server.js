import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIG ---
// Supabase Public Vars to inject
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase client for server-side operations
let supabase = null;
if (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) {
    supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
}

// Automation Configuration
const AUTOMATION_ENABLED = process.env.AUTOMATION_ENABLED !== 'false'; // Default: enabled
const CRON_LINK_CHECK_TIME = process.env.CRON_LINK_CHECK_TIME || '0 2 * * *'; // Daily at 02:00
const CRON_COMMISSION_SYNC_TIME = process.env.CRON_COMMISSION_SYNC_TIME || '0 3 * * *'; // Daily at 03:00
const CRON_CONTENT_GEN_TIME = process.env.CRON_CONTENT_GEN_TIME || '0 9 * * 1,3,5'; // Mon/Wed/Fri at 09:00
const CRON_PUBLICATION_CHECK_TIME = process.env.CRON_PUBLICATION_CHECK_TIME || '0 * * * *'; // Every hour
const CRON_PRODUCT_GEN_TIME = process.env.CRON_PRODUCT_GEN_TIME || '0 10 * * *'; // Daily at 10:00

// Default automation config (synced with types/automationTypes.ts)
const DEFAULT_AUTOMATION_CONFIG = {
    masterEnabled: false,
    productGeneration: {
        enabled: false,
        productsPerDay: 3,
        categories: ['televisies', 'audio', 'laptops', 'smartphones'],
        preferredTime: '09:00'
    },
    contentGeneration: {
        enabled: false,
        frequency: 'weekly',
        contentTypes: ['guides', 'comparisons', 'toplists'],
        postsPerWeek: 3,
        preferredDays: [1, 3, 5]
    },
    linkMonitoring: {
        enabled: true,
        checkFrequency: 'daily',
        autoFix: true,
        notifications: true
    },
    commissionTracking: {
        enabled: true,
        syncFrequency: 'daily',
        networks: ['bol', 'tradetracker', 'daisycon']
    },
    notifications: {
        email: '',
        alertTypes: ['broken_links', 'error_occurred', 'high_earnings'],
        emailEnabled: false
    },
    performance: {
        enableCaching: true,
        enableLazyLoading: true,
        enableImageOptimization: true,
        minConversionRate: 1.0,
        autoRemoveLowPerformers: false
    }
};

// Cached automation config (loaded from database)
let cachedAutomationConfig = { ...DEFAULT_AUTOMATION_CONFIG };

/**
 * Load automation configuration from Supabase database
 */
const loadAutomationConfigFromDB = async () => {
    if (!supabase) {
        console.log('[CONFIG] Supabase not configured, using default automation config');
        return cachedAutomationConfig;
    }

    try {
        const { data, error } = await supabase
            .from('automation_config')
            .select('config')
            .eq('id', 'default')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No config found, use defaults
                console.log('[CONFIG] No automation config in database, using defaults');
            } else {
                console.error('[CONFIG] Error loading automation config:', error);
            }
            return cachedAutomationConfig;
        }

        if (data && data.config) {
            cachedAutomationConfig = { ...DEFAULT_AUTOMATION_CONFIG, ...data.config };
            console.log('[CONFIG] Loaded automation config from database');
        }
    } catch (error) {
        console.error('[CONFIG] Exception loading automation config:', error);
    }

    return cachedAutomationConfig;
};

// Log configuration status
console.log('[CONFIG] Server starting with configuration:');
console.log(`[CONFIG] Supabase URL: ${VITE_SUPABASE_URL ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Supabase Key: ${VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Automation: ${AUTOMATION_ENABLED ? 'Enabled' : 'Disabled'}`);
console.log('[CONFIG] Note: Bol.com API integration has been removed. Use URL-based product import instead.');

// ============================================================================
// AUTOMATION CRON JOBS
// ============================================================================

// Store scheduled tasks for status tracking
const scheduledTasks = {
    linkHealthCheck: null,
    commissionSync: null,
    contentGeneration: null,
    publicationCheck: null,
    productGeneration: null
};

// Track automation job status
const automationStatus = {
    linkHealthCheck: { lastRun: null, status: 'idle', nextRun: null },
    commissionSync: { lastRun: null, status: 'idle', nextRun: null },
    contentGeneration: { lastRun: null, status: 'idle', nextRun: null },
    productGeneration: { lastRun: null, status: 'idle', nextRun: null },
    publicationCheck: { lastRun: null, status: 'idle', nextRun: null }
};

/**
 * Initialize cron jobs for automation
 */
const initializeAutomation = async () => {
    if (!AUTOMATION_ENABLED) {
        console.log('[AUTOMATION] Automation is disabled via AUTOMATION_ENABLED=false');
        return;
    }

    // Load initial config from database
    await loadAutomationConfigFromDB();

    console.log('[AUTOMATION] Initializing automated tasks...');
    console.log(`[AUTOMATION] Master enabled: ${cachedAutomationConfig.masterEnabled}`);

    // Daily at 02:00: Link Health Check
    scheduledTasks.linkHealthCheck = cron.schedule(CRON_LINK_CHECK_TIME, async () => {
        // Reload config to get latest settings
        await loadAutomationConfigFromDB();
        
        // Check if automation is enabled
        if (!cachedAutomationConfig.masterEnabled || !cachedAutomationConfig.linkMonitoring.enabled) {
            console.log('[CRON] Link Health Check skipped - disabled in config');
            return;
        }

        console.log('[CRON] Starting Link Health Check...');
        automationStatus.linkHealthCheck.status = 'running';
        const startTime = Date.now();
        
        try {
            // Note: In production, these would be compiled TypeScript modules
            console.log('[CRON] Link Health Check - executing...');
            console.log(`[CRON] Config: checkFrequency=${cachedAutomationConfig.linkMonitoring.checkFrequency}, autoFix=${cachedAutomationConfig.linkMonitoring.autoFix}`);
            // TODO: Implement actual service calls when TypeScript is compiled
            // await affiliateLinkMonitor.checkAllAffiliateLinks();
            // if (cachedAutomationConfig.linkMonitoring.autoFix) {
            //     await affiliateLinkMonitor.updateBrokenLinks();
            // }
            // await affiliateLinkMonitor.generateLinkHealthReport();
            
            const duration = Date.now() - startTime;
            automationStatus.linkHealthCheck.lastRun = new Date().toISOString();
            automationStatus.linkHealthCheck.status = 'completed';
            console.log(`[CRON] Link Health Check completed in ${duration}ms`);
        } catch (error) {
            automationStatus.linkHealthCheck.status = 'failed';
            console.error('[CRON] Link Health Check failed:', error);
        }
    }, {
        timezone: 'Europe/Amsterdam'
    });

    // Daily at 03:00: Commission Sync
    scheduledTasks.commissionSync = cron.schedule(CRON_COMMISSION_SYNC_TIME, async () => {
        // Reload config to get latest settings
        await loadAutomationConfigFromDB();
        
        // Check if automation is enabled
        if (!cachedAutomationConfig.masterEnabled || !cachedAutomationConfig.commissionTracking.enabled) {
            console.log('[CRON] Commission Sync skipped - disabled in config');
            return;
        }

        console.log('[CRON] Starting Commission Sync...');
        automationStatus.commissionSync.status = 'running';
        const startTime = Date.now();
        
        try {
            const networks = cachedAutomationConfig.commissionTracking.networks || [];
            console.log(`[CRON] Commission Sync - executing for networks: ${networks.join(', ')}`);
            // TODO: Implement actual service calls when TypeScript is compiled
            // for (const network of networks) {
            //     switch(network) {
            //         case 'bol': await commissionTracker.fetchBolComCommissions(); break;
            //         case 'tradetracker': await commissionTracker.fetchTradeTrackerStats(); break;
            //         case 'daisycon': await commissionTracker.fetchDaisyconStats(); break;
            //         case 'awin': await commissionTracker.fetchAwinStats(); break;
            //     }
            // }
            // await commissionTracker.calculateROI();
            
            const duration = Date.now() - startTime;
            automationStatus.commissionSync.lastRun = new Date().toISOString();
            automationStatus.commissionSync.status = 'completed';
            console.log(`[CRON] Commission Sync completed in ${duration}ms`);
        } catch (error) {
            automationStatus.commissionSync.status = 'failed';
            console.error('[CRON] Commission Sync failed:', error);
        }
    }, {
        timezone: 'Europe/Amsterdam'
    });

    // Monday, Wednesday, Friday at 09:00: Content Generation
    scheduledTasks.contentGeneration = cron.schedule(CRON_CONTENT_GEN_TIME, async () => {
        // Reload config to get latest settings
        await loadAutomationConfigFromDB();
        
        // Check if automation is enabled
        if (!cachedAutomationConfig.masterEnabled || !cachedAutomationConfig.contentGeneration.enabled) {
            console.log('[CRON] Content Generation skipped - disabled in config');
            return;
        }

        // Check if today is a preferred day
        const today = new Date().getDay();
        const preferredDays = cachedAutomationConfig.contentGeneration.preferredDays || [];
        if (!preferredDays.includes(today)) {
            console.log('[CRON] Content Generation skipped - not a preferred day');
            return;
        }

        console.log('[CRON] Starting Content Generation...');
        automationStatus.contentGeneration.status = 'running';
        const startTime = Date.now();
        
        try {
            const contentTypes = cachedAutomationConfig.contentGeneration.contentTypes || [];
            const postsPerWeek = cachedAutomationConfig.contentGeneration.postsPerWeek || 3;
            console.log(`[CRON] Content Generation - types: ${contentTypes.join(', ')}, postsPerWeek: ${postsPerWeek}`);
            // TODO: Implement actual service calls when TypeScript is compiled
            // await autonomousContentGenerator.runAutomatedContentGeneration(cachedAutomationConfig);
            
            const duration = Date.now() - startTime;
            automationStatus.contentGeneration.lastRun = new Date().toISOString();
            automationStatus.contentGeneration.status = 'completed';
            console.log(`[CRON] Content Generation completed in ${duration}ms`);
        } catch (error) {
            automationStatus.contentGeneration.status = 'failed';
            console.error('[CRON] Content Generation failed:', error);
        }
    }, {
        timezone: 'Europe/Amsterdam'
    });

    // Every hour: Scheduled Content Publication Check
    scheduledTasks.publicationCheck = cron.schedule(CRON_PUBLICATION_CHECK_TIME, async () => {
        // Reload config to get latest settings
        await loadAutomationConfigFromDB();
        
        if (!cachedAutomationConfig.masterEnabled) {
            console.log('[CRON] Publication Check skipped - master disabled');
            return;
        }

        console.log('[CRON] Starting Publication Check...');
        automationStatus.publicationCheck.status = 'running';
        const startTime = Date.now();
        
        try {
            console.log('[CRON] Publication Check - executing...');
            // TODO: Implement actual service calls when TypeScript is compiled
            // await contentScheduler.autoPublishScheduledContent();
            
            const duration = Date.now() - startTime;
            automationStatus.publicationCheck.lastRun = new Date().toISOString();
            automationStatus.publicationCheck.status = 'completed';
            console.log(`[CRON] Publication Check completed in ${duration}ms`);
        } catch (error) {
            automationStatus.publicationCheck.status = 'failed';
            console.error('[CRON] Publication Check failed:', error);
        }
    }, {
        timezone: 'Europe/Amsterdam'
    });

    // Daily at preferred time: Product Generation
    scheduledTasks.productGeneration = cron.schedule(CRON_PRODUCT_GEN_TIME, async () => {
        // Reload config to get latest settings
        await loadAutomationConfigFromDB();
        
        // Check if automation is enabled
        if (!cachedAutomationConfig.masterEnabled || !cachedAutomationConfig.productGeneration.enabled) {
            console.log('[CRON] Product Generation skipped - disabled in config');
            return;
        }

        // Check if it's the preferred time (within 30 minutes)
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();
        const preferredTime = cachedAutomationConfig.productGeneration.preferredTime || '09:00';
        const [preferredHour, preferredMinutes] = preferredTime.split(':').map(Number);
        const preferredTimeInMinutes = preferredHour * 60 + preferredMinutes;
        const currentTimeInMinutes = currentHour * 60 + currentMinutes;
        
        if (Math.abs(currentTimeInMinutes - preferredTimeInMinutes) > 30) {
            console.log('[CRON] Product Generation skipped - not preferred time');
            return;
        }

        console.log('[CRON] Starting Product Generation...');
        automationStatus.productGeneration.status = 'running';
        const startTime = Date.now();
        
        try {
            const productsPerDay = cachedAutomationConfig.productGeneration.productsPerDay || 3;
            const categories = cachedAutomationConfig.productGeneration.categories || [];
            console.log(`[CRON] Product Generation - productsPerDay: ${productsPerDay}, categories: ${categories.join(', ')}`);
            // TODO: Implement actual service calls when TypeScript is compiled
            // await autonomousProductGenerator.runAutomatedProductGeneration(cachedAutomationConfig);
            
            const duration = Date.now() - startTime;
            automationStatus.productGeneration.lastRun = new Date().toISOString();
            automationStatus.productGeneration.status = 'completed';
            console.log(`[CRON] Product Generation completed in ${duration}ms`);
        } catch (error) {
            automationStatus.productGeneration.status = 'failed';
            console.error('[CRON] Product Generation failed:', error);
        }
    }, {
        timezone: 'Europe/Amsterdam'
    });

    console.log('[AUTOMATION] Cron jobs scheduled:');
    console.log(`  - Link Health Check: ${CRON_LINK_CHECK_TIME}`);
    console.log(`  - Commission Sync: ${CRON_COMMISSION_SYNC_TIME}`);
    console.log(`  - Content Generation: ${CRON_CONTENT_GEN_TIME}`);
    console.log(`  - Publication Check: ${CRON_PUBLICATION_CHECK_TIME}`);
    console.log(`  - Product Generation: ${CRON_PRODUCT_GEN_TIME}`);
};

app.use(express.json());
// We serve static files manually to intercept index.html
app.use(express.static('dist', { index: false }));

// --- ROUTES ---

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '3.0.0',
        services: {
            supabase: !!(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)
        },
        notes: [
            'Bol.com API integration has been removed',
            'Use URL-based product import (client-side scraping + Claude AI)',
            'Set VITE_ANTHROPIC_API_KEY for AI features'
        ],
        timestamp: new Date().toISOString()
    });
});

// Config endpoint for frontend
app.get('/api/config', (req, res) => {
    res.json({
        VITE_SUPABASE_URL: VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: VITE_SUPABASE_ANON_KEY
    });
});

// Test connection endpoint - simplified without Bol.com
app.get('/api/admin/test-connection', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] GET /api/admin/test-connection`);
    
    const results = {
        timestamp,
        supabase: { 
            status: (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) ? 'configured' : 'not_configured',
            message: (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) 
                ? 'Supabase is geconfigureerd'
                : 'Supabase niet geconfigureerd. Stel VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in.'
        },
        ai: { 
            status: 'client_side',
            message: 'AI functies werken via de browser (client-side). Controleer VITE_ANTHROPIC_API_KEY in de browser console.'
        },
        urlImport: {
            status: 'available',
            message: 'URL-based product import is beschikbaar. Gebruik het ProductGenerator component.'
        }
    };
    
    res.json({
        success: results.supabase.status === 'configured',
        message: results.supabase.status === 'configured' 
            ? 'Alle services zijn geconfigureerd' 
            : 'Sommige services hebben problemen',
        notes: [
            'Bol.com API is verwijderd',
            'Producten worden toegevoegd via URL scraping + AI',
            'Alle AI calls gebeuren client-side via VITE_ANTHROPIC_API_KEY'
        ],
        ...results
    });
});

// Get available categories (static, no API needed)
app.get('/api/admin/categories', (req, res) => {
    const CATEGORIES = {
        'televisies': { name: 'Televisies', searchTerm: 'smart tv 4k' },
        'audio': { name: 'Audio & HiFi', searchTerm: 'bluetooth speaker' },
        'laptops': { name: 'Laptops', searchTerm: 'laptop' },
        'smartphones': { name: 'Smartphones', searchTerm: 'smartphone' },
        'wasmachines': { name: 'Wasmachines', searchTerm: 'wasmachine' },
        'stofzuigers': { name: 'Stofzuigers', searchTerm: 'stofzuiger' },
        'smarthome': { name: 'Smart Home', searchTerm: 'smart home' },
        'matrassen': { name: 'Matrassen', searchTerm: 'matras' },
        'airfryers': { name: 'Airfryers', searchTerm: 'airfryer' },
        'koffie': { name: 'Koffie', searchTerm: 'koffiemachine' },
        'keuken': { name: 'Keukenmachines', searchTerm: 'keukenmachine' },
        'verzorging': { name: 'Verzorging', searchTerm: 'scheerapparaat' }
    };
    
    res.json({
        categories: Object.keys(CATEGORIES).map(key => ({
            id: key,
            name: CATEGORIES[key].name,
            searchTerm: CATEGORIES[key].searchTerm
        }))
    });
});

// --- AFFILIATE TRACKING ENDPOINTS ---
// New affiliate infrastructure for tracking clicks and managing networks

/**
 * Default affiliate networks (used when database is not available)
 */
const DEFAULT_AFFILIATE_NETWORKS = [
    {
        id: 'bol',
        name: 'Bol.com Partner',
        type: 'physical',
        website: 'https://partnerprogramma.bol.com',
        commission_range: '5-10%',
        cookie_duration_days: 30,
        product_types: ['electronics', 'books', 'toys', 'home', 'fashion'],
        api_available: true,
        notes: 'Largest Dutch marketplace. Requires partner account and approval.',
    },
    {
        id: 'tradetracker',
        name: 'TradeTracker',
        type: 'physical',
        website: 'https://www.tradetracker.com',
        commission_range: '2-15%',
        cookie_duration_days: 30,
        product_types: ['electronics', 'fashion', 'travel', 'finance', 'telecom'],
        api_available: true,
        notes: 'European affiliate network with many Dutch merchants.',
    },
    {
        id: 'daisycon',
        name: 'Daisycon',
        type: 'physical',
        website: 'https://www.daisycon.com',
        commission_range: '2-12%',
        cookie_duration_days: 30,
        product_types: ['electronics', 'fashion', 'travel', 'finance', 'utilities'],
        api_available: true,
        notes: 'Dutch affiliate network with strong local presence.',
    },
    {
        id: 'awin',
        name: 'Awin',
        type: 'physical',
        website: 'https://www.awin.com',
        commission_range: '3-15%',
        cookie_duration_days: 30,
        product_types: ['electronics', 'fashion', 'travel', 'retail', 'finance'],
        api_available: true,
        notes: 'Global affiliate network with major brands.',
    },
    {
        id: 'paypro',
        name: 'PayPro',
        type: 'digital',
        website: 'https://paypro.nl/affiliates',
        commission_range: '10-75%',
        cookie_duration_days: 365,
        product_types: ['courses', 'ebooks', 'software', 'memberships', 'digital'],
        api_available: true,
        notes: 'Dutch digital product platform. High commissions for digital products.',
    },
    {
        id: 'plugpay',
        name: 'Plug&Pay',
        type: 'digital',
        website: 'https://www.plugpay.nl/affiliate',
        commission_range: '10-50%',
        cookie_duration_days: 365,
        product_types: ['courses', 'coaching', 'memberships', 'digital'],
        api_available: false,
        notes: 'Dutch digital product and course platform.',
    },
];

/**
 * POST /api/affiliate/track
 * Track a click on an affiliate link
 * 
 * Request body:
 * - productId: string (required) - The product ID
 * - url: string (required) - The affiliate link URL that was clicked
 * - ipHash: string (optional) - Pre-hashed IP address
 * - userId: string (optional) - User ID if authenticated
 * 
 * Response:
 * - success: boolean
 * - linkId: string (if successful)
 * - clickId: string (if successful)
 * 
 * Note: This is a simplified server-side implementation for tracking.
 * When Supabase is properly configured, full database tracking is done 
 * client-side via affiliateService.trackClick(). This endpoint provides
 * a fallback for server-side tracking or environments without Supabase.
 */
app.post('/api/affiliate/track', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AFFILIATE] POST /api/affiliate/track`);
    
    try {
        const { productId, url, ipHash, userId } = req.body;
        
        // Validate required fields
        if (!productId || !url) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: productId and url are required'
            });
        }
        
        // Validate URL format
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid URL protocol - must be http or https'
                });
            }
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }
        
        // Log the click for analytics
        console.log(`[AFFILIATE] Click tracked: product=${productId}, url=${url.substring(0, 50)}...`);
        
        // Generate unique IDs for the click and link
        const clickId = `click-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const linkId = `link-${productId}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Note: Full database persistence is handled by the client-side 
        // affiliateService.trackClick() when Supabase is configured.
        // This endpoint logs clicks for server-side analytics.
        
        res.json({
            success: true,
            linkId,
            clickId,
            message: 'Click tracked successfully'
        });
    } catch (error) {
        console.error('[AFFILIATE] Error tracking click:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track click'
        });
    }
});

/**
 * GET /api/affiliate/networks
 * Get list of supported affiliate networks
 * 
 * Response:
 * - networks: AffiliateNetwork[]
 */
app.get('/api/affiliate/networks', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AFFILIATE] GET /api/affiliate/networks`);
    
    // Return the default networks (in production, these come from the database)
    res.json({
        networks: DEFAULT_AFFILIATE_NETWORKS,
        note: 'Configure affiliate IDs in environment variables to enable tracking'
    });
});

// --- DEPRECATED ENDPOINTS ---
// These endpoints are no longer available since Bol.com API has been removed
// They return helpful error messages guiding users to use URL-based import instead
// Note: Use the new /api/affiliate/* routes for affiliate functionality

const deprecatedMessage = {
    error: 'Bol.com API is verwijderd',
    message: 'Deze functionaliteit is niet meer beschikbaar.',
    solution: 'Gebruik de URL-based product import via het Admin Dashboard > Producten > Via URL',
    documentation: 'Zie README.md voor instructies',
    affiliateNote: 'Voor affiliate tracking, gebruik de nieuwe /api/affiliate/* endpoints'
};

// Deprecated: Bol.com search endpoints
app.post('/api/bol/search-list', (req, res) => {
    res.status(410).json(deprecatedMessage);
});

app.post('/api/bol/search-products', (req, res) => {
    res.status(410).json(deprecatedMessage);
});

app.post('/api/bol/import', (req, res) => {
    res.status(410).json(deprecatedMessage);
});

app.post('/api/bol/import-by-ean', (req, res) => {
    res.status(410).json(deprecatedMessage);
});

// Deprecated: Admin bulk endpoints that depended on Bol.com API
app.post('/api/admin/bulk/search-and-add', (req, res) => {
    res.status(410).json({
        ...deprecatedMessage,
        solution: 'Gebruik de Bulk Import functie via het ProductGenerator component met meerdere URLs'
    });
});

app.get('/api/admin/bulk/search-stream', (req, res) => {
    res.status(410).json({
        ...deprecatedMessage,
        solution: 'Gebruik de Bulk Import functie via het ProductGenerator component'
    });
});

app.post('/api/admin/import/url', (req, res) => {
    res.status(410).json({
        ...deprecatedMessage,
        message: 'Server-side URL import is verwijderd. URL import werkt nu volledig client-side.',
        solution: 'Gebruik de ProductGenerator component in het Admin Dashboard'
    });
});

app.post('/api/admin/import/by-category', (req, res) => {
    res.status(410).json(deprecatedMessage);
});

app.post('/api/admin/product/generate', (req, res) => {
    res.status(410).json({
        ...deprecatedMessage,
        message: 'AI generatie werkt nu volledig client-side.',
        solution: 'Controleer of VITE_ANTHROPIC_API_KEY correct is ingesteld'
    });
});

app.post('/api/admin/article/generate', (req, res) => {
    res.status(410).json({
        ...deprecatedMessage,
        message: 'Artikel generatie moet worden geüpdatet naar client-side.',
        solution: 'Deze functie wordt binnenkort toegevoegd aan de client-side'
    });
});

app.post('/api/admin/sync-prices', (req, res) => {
    res.status(410).json({
        ...deprecatedMessage,
        message: 'Prijs synchronisatie via Bol.com API is niet meer beschikbaar.',
        solution: 'Prijzen moeten handmatig worden bijgewerkt of via URL import opnieuw worden opgehaald'
    });
});

// --- AUTOMATION API ENDPOINTS ---

/**
 * GET /api/automation/status
 * Get the status of all automation jobs
 */
app.get('/api/automation/status', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] GET /api/automation/status`);
    
    // Reload config to get latest settings
    await loadAutomationConfigFromDB();
    
    res.json({
        enabled: AUTOMATION_ENABLED && cachedAutomationConfig.masterEnabled,
        jobs: automationStatus,
        config: {
            linkHealthCheck: CRON_LINK_CHECK_TIME,
            commissionSync: CRON_COMMISSION_SYNC_TIME,
            contentGeneration: CRON_CONTENT_GEN_TIME,
            publicationCheck: CRON_PUBLICATION_CHECK_TIME,
            productGeneration: CRON_PRODUCT_GEN_TIME
        },
        automationConfig: cachedAutomationConfig,
        timestamp
    });
});

/**
 * POST /api/automation/trigger/:jobName
 * Manually trigger an automation job
 */
app.post('/api/automation/trigger/:jobName', async (req, res) => {
    const { jobName } = req.params;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/trigger/${jobName}`);
    
    const validJobs = ['linkHealthCheck', 'commissionSync', 'contentGeneration', 'publicationCheck', 'productGeneration'];
    
    if (!validJobs.includes(jobName)) {
        return res.status(400).json({
            success: false,
            error: `Invalid job name. Valid options: ${validJobs.join(', ')}`
        });
    }
    
    // Mark as running
    automationStatus[jobName].status = 'running';
    
    // In a real implementation, this would trigger the actual job
    // For now, we simulate a quick job execution
    setTimeout(() => {
        automationStatus[jobName].status = 'completed';
        automationStatus[jobName].lastRun = new Date().toISOString();
    }, 1000);
    
    res.json({
        success: true,
        message: `Job ${jobName} triggered`,
        timestamp
    });
});

/**
 * POST /api/automation/enable
 * Enable or disable automation
 */
app.post('/api/automation/enable', (req, res) => {
    const { enabled } = req.body;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/enable - enabled: ${enabled}`);
    
    // Note: This changes runtime state but not the env variable
    // A full restart would reset this based on AUTOMATION_ENABLED
    
    if (enabled === true) {
        // Re-enable cron jobs
        Object.values(scheduledTasks).forEach(task => {
            if (task && typeof task.start === 'function') {
                task.start();
            }
        });
        res.json({ success: true, message: 'Automation enabled', timestamp });
    } else if (enabled === false) {
        // Stop cron jobs
        Object.values(scheduledTasks).forEach(task => {
            if (task && typeof task.stop === 'function') {
                task.stop();
            }
        });
        res.json({ success: true, message: 'Automation disabled', timestamp });
    } else {
        res.status(400).json({ 
            success: false, 
            error: 'Invalid value for enabled. Use true or false.' 
        });
    }
});

/**
 * GET /api/automation/logs
 * Get recent automation logs (placeholder - real implementation uses database)
 */
app.get('/api/automation/logs', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] GET /api/automation/logs`);
    
    // Placeholder - in production this would query the automation_logs table
    res.json({
        logs: [],
        note: 'Logs are stored in the automation_logs table in Supabase',
        timestamp
    });
});

// --- SERVER SIDE INJECTION OF ENV VARS ---
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Server Error');
        }

        // Inject vars into window.__ENV__
        const envScript = `
            <script>
                window.__ENV__ = {
                    VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
                    VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}"
                };
            </script>
        `;

        // Insert script before </head>
        const finalHtml = htmlData.replace('</head>', `${envScript}</head>`);
        
        res.send(finalHtml);
    });
});

app.listen(port, () => {
    console.log(`ProductPraat Server running on port ${port} (v4.1.0 - Automation System)`);
    console.log(`[INFO] Bol.com API integration removed - use URL-based product import`);
    
    // Initialize automation cron jobs
    initializeAutomation();
});
