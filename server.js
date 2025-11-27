import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIG ---
// Supabase Public Vars to inject
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Log configuration status
console.log('[CONFIG] Server starting with configuration:');
console.log(`[CONFIG] Supabase URL: ${VITE_SUPABASE_URL ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Supabase Key: ${VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not set'}`);
console.log('[CONFIG] Note: Bol.com API integration has been removed. Use URL-based product import instead.');

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
  console.log(`ProductPraat Server running on port ${port} (v3.0.0 - URL-based Import)`);
  console.log(`[INFO] Bol.com API integration removed - use URL-based product import`);
});
