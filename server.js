import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIG ---
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const VITE_ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY || '';

// Initialize Supabase client
let supabase = null;
if (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) {
    supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
}

console.log('[CONFIG] Server starting with configuration:');
console.log(`[CONFIG] Supabase URL: ${VITE_SUPABASE_URL ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Supabase Key: ${VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] AIML API Key: ${VITE_ANTHROPIC_API_KEY ? 'Configured' : 'Not set'}`);

// Helper function to escape strings for safe JavaScript injection
const escapeForJs = (str) => {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/<\/script>/gi, '<\\/script>');
};

app.use(express.json());
app.use(express.static('dist', { index: false }));

// --- ROUTES ---

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: packageJson.version,
        services: {
            supabase: !!(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY),
            aiml: !!VITE_ANTHROPIC_API_KEY
        },
        notes: ['Simplified version - use URL-based product import'],
        timestamp: new Date().toISOString()
    });
});

// Config endpoint for frontend
app.get('/api/config', (req, res) => {
    res.json({
        VITE_SUPABASE_URL: VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: VITE_SUPABASE_ANON_KEY,
        VITE_ANTHROPIC_API_KEY: VITE_ANTHROPIC_API_KEY
    });
});

// Test connection endpoint
app.get('/api/admin/test-connection', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] GET /api/admin/test-connection`);
    
    res.json({
        success: !!(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY),
        message: VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY 
            ? 'Supabase is geconfigureerd' 
            : 'Supabase niet geconfigureerd',
        timestamp
    });
});

// Get available categories
app.get('/api/admin/categories', (req, res) => {
    const CATEGORIES = {
        'televisies': { name: 'Televisies' },
        'audio': { name: 'Audio & HiFi' },
        'laptops': { name: 'Laptops' },
        'smartphones': { name: 'Smartphones' },
        'wasmachines': { name: 'Wasmachines' },
        'stofzuigers': { name: 'Stofzuigers' },
        'smarthome': { name: 'Smart Home' },
        'matrassen': { name: 'Matrassen' },
        'airfryers': { name: 'Airfryers' },
        'koffie': { name: 'Koffie' },
        'keuken': { name: 'Keukenmachines' },
        'verzorging': { name: 'Verzorging' }
    };
    
    res.json({
        categories: Object.entries(CATEGORIES).map(([id, cat]) => ({ id, name: cat.name }))
    });
});

// --- AFFILIATE TRACKING ---
app.post('/api/affiliate/track', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AFFILIATE] POST /api/affiliate/track`);
    
    try {
        const { productId, url } = req.body;
        
        if (!productId || !url) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Validate URL
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({ success: false, error: 'Invalid URL protocol' });
            }
        } catch {
            return res.status(400).json({ success: false, error: 'Invalid URL format' });
        }
        
        console.log(`[AFFILIATE] Click tracked: product=${productId}`);
        
        res.json({
            success: true,
            clickId: `click-${Date.now()}`,
            message: 'Click tracked'
        });
    } catch (error) {
        console.error('[AFFILIATE] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to track click' });
    }
});

// Get affiliate networks
app.get('/api/affiliate/networks', (req, res) => {
    res.json({
        networks: [
            { id: 'bol', name: 'Bol.com Partner', type: 'physical' },
            { id: 'tradetracker', name: 'TradeTracker', type: 'physical' },
            { id: 'daisycon', name: 'Daisycon', type: 'physical' },
            { id: 'awin', name: 'Awin', type: 'physical' },
            { id: 'paypro', name: 'PayPro', type: 'digital' },
            { id: 'plugpay', name: 'Plug&Pay', type: 'digital' }
        ]
    });
});

// --- DEPRECATED ENDPOINTS ---
const deprecatedHandler = (req, res) => {
    res.status(410).json({
        error: 'Endpoint verwijderd',
        message: 'Gebruik de URL-based product import in het Admin Dashboard',
        solution: 'Ga naar /dashboard en gebruik "Voeg Product Toe via URL"'
    });
};

app.post('/api/bol/search-list', deprecatedHandler);
app.post('/api/bol/search-products', deprecatedHandler);
app.post('/api/bol/import', deprecatedHandler);
app.post('/api/bol/import-by-ean', deprecatedHandler);
app.post('/api/admin/bulk/search-and-add', deprecatedHandler);
app.get('/api/admin/bulk/search-stream', deprecatedHandler);
app.post('/api/admin/import/url', deprecatedHandler);
app.post('/api/admin/import/by-category', deprecatedHandler);
app.post('/api/admin/product/generate', deprecatedHandler);
app.post('/api/admin/article/generate', deprecatedHandler);
app.post('/api/admin/sync-prices', deprecatedHandler);

// --- SERVE FRONTEND ---
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Server Error');
        }

        // Inject env vars (escaped to prevent XSS)
        const envScript = `
            <script>
                window.__ENV__ = {
                    VITE_SUPABASE_URL: "${escapeForJs(VITE_SUPABASE_URL)}",
                    VITE_SUPABASE_ANON_KEY: "${escapeForJs(VITE_SUPABASE_ANON_KEY)}",
                    VITE_ANTHROPIC_API_KEY: "${escapeForJs(VITE_ANTHROPIC_API_KEY)}"
                };
            </script>
        `;

        const finalHtml = htmlData.replace('</head>', `${envScript}</head>`);
        res.send(finalHtml);
    });
});

app.listen(port, () => {
    console.log(`ProductPraat Server running on port ${port} (v${packageJson.version} - Simplified)`);
});
