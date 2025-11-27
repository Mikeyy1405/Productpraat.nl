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

// --- DEPRECATED ENDPOINTS ---
// These endpoints are no longer available since Bol.com API has been removed
// They return helpful error messages guiding users to use URL-based import instead

const deprecatedMessage = {
    error: 'Bol.com API is verwijderd',
    message: 'Deze functionaliteit is niet meer beschikbaar.',
    solution: 'Gebruik de URL-based product import via het Admin Dashboard > Producten > Via URL',
    documentation: 'Zie README.md voor instructies'
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
