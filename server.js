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

// Bol.com Partner Program API - OAuth2 Credentials
const BOL_CLIENT_ID = process.env.BOL_CLIENT_ID || '';
const BOL_CLIENT_SECRET = process.env.BOL_CLIENT_SECRET || '';
const BOL_SITE_ID = process.env.BOL_SITE_ID || '';

console.log('[CONFIG] Server starting with configuration:');
console.log(`[CONFIG] Supabase URL: ${VITE_SUPABASE_URL ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Supabase Key: ${VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] AIML API Key: ${VITE_ANTHROPIC_API_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Bol.com Client ID: ${BOL_CLIENT_ID ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Bol.com Client Secret: ${BOL_CLIENT_SECRET ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Bol.com Site ID: ${BOL_SITE_ID ? 'Configured' : 'Not set'}`);

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

// ============================================================================
// BOL.COM SYNC SERVICE
// ============================================================================

/**
 * Constants for Bol.com sync
 */
const BOL_AVAILABILITY_IN_STOCK = 'IN_STOCK';
const BOL_AVAILABILITY_LIMITED = 'LIMITED_STOCK';
const DEAL_THRESHOLD_PERCENTAGE = 15;

// OAuth2 token management constants
const DEFAULT_TOKEN_EXPIRY_SECONDS = 299;
const TOKEN_REFRESH_BUFFER_MS = 30000; // Refresh 30 seconds before expiry

/**
 * Bol.com Sync Service for server-side product synchronization
 * Implements the Partner Program API with OAuth2 authentication
 */
const bolSyncService = {
    apiBaseUrl: 'https://api.bol.com',
    tokenEndpoint: 'https://login.bol.com/token',
    
    // OAuth2 token cache
    accessToken: null,
    tokenExpiresAt: null,
    
    /**
     * Check if the Bol.com API is configured with OAuth2 credentials
     */
    isConfigured() {
        return Boolean(BOL_CLIENT_ID && BOL_CLIENT_SECRET);
    },
    
    /**
     * Request a new OAuth2 access token from Bol.com
     */
    async getAccessToken() {
        if (!this.isConfigured()) {
            throw new Error('Bol.com API not configured. Set BOL_CLIENT_ID and BOL_CLIENT_SECRET environment variables.');
        }
        
        // Check if we have a valid cached token (with buffer before expiry)
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
            return this.accessToken;
        }
        
        console.log('[BolSync] Requesting new OAuth2 access token');
        
        try {
            // Create Basic Auth header from client credentials
            const credentials = Buffer.from(`${BOL_CLIENT_ID}:${BOL_CLIENT_SECRET}`).toString('base64');
            
            const response = await fetch(this.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                body: 'grant_type=client_credentials',
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[BolSync] Token request failed:', response.status, errorText);
                throw new Error(`OAuth2 token request failed: ${response.status} - ${errorText}`);
            }
            
            const tokenData = await response.json();
            
            // Cache the token with expiration time
            this.accessToken = tokenData.access_token;
            // expires_in is in seconds, convert to milliseconds
            const expiresInSeconds = tokenData.expires_in || DEFAULT_TOKEN_EXPIRY_SECONDS;
            const expiresIn = expiresInSeconds * 1000;
            this.tokenExpiresAt = Date.now() + expiresIn;
            
            console.log(`[BolSync] Access token obtained, expires in ${expiresInSeconds} seconds`);
            
            return this.accessToken;
        } catch (error) {
            console.error('[BolSync] Failed to obtain access token:', error);
            // Clear any stale token
            this.accessToken = null;
            this.tokenExpiresAt = null;
            throw error;
        }
    },
    
    /**
     * Clear the cached token (useful for forcing refresh)
     */
    clearToken() {
        this.accessToken = null;
        this.tokenExpiresAt = null;
    },
    
    /**
     * Make an authenticated API request to Bol.com with OAuth2
     */
    async apiRequest(path, options = {}, retryCount = 0) {
        if (!this.isConfigured()) {
            throw new Error('Bol.com API not configured. Set BOL_CLIENT_ID and BOL_CLIENT_SECRET environment variables.');
        }
        
        // Get a valid access token
        const token = await this.getAccessToken();
        
        const url = `${this.apiBaseUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        
        // Handle 401 Unauthorized - token may have expired
        if (response.status === 401 && retryCount < 1) {
            console.log('[BolSync] Received 401, refreshing token and retrying');
            this.clearToken();
            return this.apiRequest(path, options, retryCount + 1);
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Bol.com API error: ${response.status} - ${errorText}`);
        }
        
        return response.json();
    },
    
    /**
     * Search for products on Bol.com
     */
    async searchProducts(searchTerm, limit = 50) {
        try {
            const params = new URLSearchParams({
                q: searchTerm,
                limit: String(Math.min(limit, 100)),
            });
            
            const data = await this.apiRequest(`/marketing/catalog/v1/products/search?${params.toString()}`);
            return data.products || [];
        } catch (error) {
            console.error('[BolSync] Search error:', error);
            throw error;
        }
    },
    
    /**
     * Get product details by EAN
     */
    async getProduct(ean) {
        try {
            const data = await this.apiRequest(`/marketing/catalog/v1/products/${ean}`);
            return data;
        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    },
    
    /**
     * Get popular products in a category
     */
    async getPopularProducts(categoryId, limit = 50) {
        try {
            const params = new URLSearchParams({
                categoryId,
                limit: String(Math.min(limit, 100)),
            });
            
            const data = await this.apiRequest(`/marketing/catalog/v1/products/lists/popular?${params.toString()}`);
            return data.products || [];
        } catch (error) {
            console.error('[BolSync] Popular products error:', error);
            throw error;
        }
    },
    
    /**
     * Map Bol.com product to database format
     */
    mapProductToDb(bolProduct) {
        const offer = bolProduct.bestOffer || {};
        const now = new Date().toISOString();
        
        return {
            ean: bolProduct.ean,
            bol_product_id: bolProduct.bolProductId,
            title: bolProduct.title,
            description: bolProduct.description || bolProduct.shortDescription || '',
            url: bolProduct.url || `https://www.bol.com/nl/p/-/${bolProduct.ean}/`,
            price: offer.price?.value || null,
            strikethrough_price: offer.strikethroughPrice?.value || null,
            discount_percentage: offer.discountPercentage || null,
            delivery_description: offer.delivery?.deliveryDescription || null,
            in_stock: offer.availability === BOL_AVAILABILITY_IN_STOCK || offer.availability === BOL_AVAILABILITY_LIMITED,
            is_deal: (offer.discountPercentage || 0) >= DEAL_THRESHOLD_PERCENTAGE,
            average_rating: bolProduct.rating?.averageRating || null,
            total_ratings: bolProduct.rating?.totalRatings || 0,
            main_image_url: bolProduct.mainImageUrl || (bolProduct.images && bolProduct.images[0]?.url) || null,
            last_synced_at: now,
            updated_at: now,
        };
    },
    
    /**
     * Sync products from search term to database using batch upsert
     */
    async syncFromSearch(searchTerm, limit = 50) {
        if (!supabase) {
            throw new Error('Database not configured');
        }
        
        const job = {
            id: `sync-${Date.now()}`,
            type: 'search_sync',
            status: 'running',
            searchTerm,
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsCreated: 0,
            itemsUpdated: 0,
            itemsFailed: 0,
            errors: [],
        };
        
        console.log(`[BolSync] Starting sync for search: "${searchTerm}"`);
        
        try {
            // Search for products
            const products = await this.searchProducts(searchTerm, limit);
            console.log(`[BolSync] Found ${products.length} products`);
            
            if (products.length === 0) {
                job.status = 'completed';
                job.completedAt = new Date().toISOString();
                return job;
            }
            
            // Map all products to DB format
            const now = new Date().toISOString();
            const dbProducts = products.map(bolProduct => ({
                ...this.mapProductToDb(bolProduct),
                created_at: now,
            }));
            
            // Get existing products EANs in one query
            const eans = dbProducts.map(p => p.ean);
            const { data: existingProducts, error: selectError } = await supabase
                .from('bol_products')
                .select('ean')
                .in('ean', eans);
            
            if (selectError) {
                throw selectError;
            }
            
            const existingEans = new Set((existingProducts || []).map(p => p.ean));
            
            // Split into new and existing products
            const newProducts = dbProducts.filter(p => !existingEans.has(p.ean));
            const updateProducts = dbProducts.filter(p => existingEans.has(p.ean));
            
            // Batch insert new products
            if (newProducts.length > 0) {
                const { error: insertError } = await supabase
                    .from('bol_products')
                    .insert(newProducts);
                
                if (insertError) {
                    console.error('[BolSync] Batch insert error:', insertError);
                    job.itemsFailed += newProducts.length;
                    job.errors.push({ batch: 'insert', error: insertError.message });
                } else {
                    job.itemsCreated = newProducts.length;
                }
            }
            
            // Batch update existing products using upsert
            if (updateProducts.length > 0) {
                // Remove created_at from updates to preserve original
                const updateData = updateProducts.map(({ created_at, ...rest }) => rest);
                
                const { error: upsertError } = await supabase
                    .from('bol_products')
                    .upsert(updateData, { onConflict: 'ean' });
                
                if (upsertError) {
                    console.error('[BolSync] Batch upsert error:', upsertError);
                    job.itemsFailed += updateProducts.length;
                    job.errors.push({ batch: 'update', error: upsertError.message });
                } else {
                    job.itemsUpdated = updateProducts.length;
                }
            }
            
            job.itemsProcessed = products.length;
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            console.log(`[BolSync] Completed. Created: ${job.itemsCreated}, Updated: ${job.itemsUpdated}, Failed: ${job.itemsFailed}`);
            
        } catch (error) {
            console.error('[BolSync] Sync failed:', error);
            job.status = 'failed';
            job.errorMessage = error.message;
        }
        
        return job;
    },
    
    /**
     * Sync popular products for a category using batch upsert
     */
    async syncPopularProducts(categoryId, limit = 50) {
        if (!supabase) {
            throw new Error('Database not configured');
        }
        
        const job = {
            id: `sync-${Date.now()}`,
            type: 'popular_products',
            status: 'running',
            categoryId,
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsCreated: 0,
            itemsUpdated: 0,
            itemsFailed: 0,
            errors: [],
        };
        
        console.log(`[BolSync] Starting popular products sync for category ${categoryId}`);
        
        try {
            // Get popular products
            const products = await this.getPopularProducts(categoryId, limit);
            console.log(`[BolSync] Found ${products.length} popular products`);
            
            if (products.length === 0) {
                job.status = 'completed';
                job.completedAt = new Date().toISOString();
                return job;
            }
            
            // Map all products to DB format
            const now = new Date().toISOString();
            const dbProducts = products.map(bolProduct => ({
                ...this.mapProductToDb(bolProduct),
                created_at: now,
            }));
            
            // Get existing products EANs in one query
            const eans = dbProducts.map(p => p.ean);
            const { data: existingProducts, error: selectError } = await supabase
                .from('bol_products')
                .select('ean')
                .in('ean', eans);
            
            if (selectError) {
                throw selectError;
            }
            
            const existingEans = new Set((existingProducts || []).map(p => p.ean));
            
            // Split into new and existing products
            const newProducts = dbProducts.filter(p => !existingEans.has(p.ean));
            const updateProducts = dbProducts.filter(p => existingEans.has(p.ean));
            
            // Batch insert new products
            if (newProducts.length > 0) {
                const { error: insertError } = await supabase
                    .from('bol_products')
                    .insert(newProducts);
                
                if (insertError) {
                    console.error('[BolSync] Batch insert error:', insertError);
                    job.itemsFailed += newProducts.length;
                    job.errors.push({ batch: 'insert', error: insertError.message });
                } else {
                    job.itemsCreated = newProducts.length;
                }
            }
            
            // Batch update existing products using upsert
            if (updateProducts.length > 0) {
                // Remove created_at from updates to preserve original
                const updateData = updateProducts.map(({ created_at, ...rest }) => rest);
                
                const { error: upsertError } = await supabase
                    .from('bol_products')
                    .upsert(updateData, { onConflict: 'ean' });
                
                if (upsertError) {
                    console.error('[BolSync] Batch upsert error:', upsertError);
                    job.itemsFailed += updateProducts.length;
                    job.errors.push({ batch: 'update', error: upsertError.message });
                } else {
                    job.itemsUpdated = updateProducts.length;
                }
            }
            
            job.itemsProcessed = products.length;
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            console.log(`[BolSync] Completed. Created: ${job.itemsCreated}, Updated: ${job.itemsUpdated}, Failed: ${job.itemsFailed}`);
            
        } catch (error) {
            console.error('[BolSync] Sync failed:', error);
            job.status = 'failed';
            job.errorMessage = error.message;
        }
        
        return job;
    },
    
    /**
     * Get sync status
     */
    getStatus() {
        return {
            configured: this.isConfigured(),
            clientIdSet: Boolean(BOL_CLIENT_ID),
            clientSecretSet: Boolean(BOL_CLIENT_SECRET),
            siteIdSet: Boolean(BOL_SITE_ID),
            hasValidToken: Boolean(this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt),
            supabaseConfigured: Boolean(supabase),
        };
    }
};

// Default category IDs for Bol.com (electronics & home)
const BOL_DEFAULT_CATEGORIES = {
    '11652': 'Elektronica',
    '13512': 'Computer & Gaming',
    '21328': 'Telefonie & Navigatie',
    '15452': 'TV & Audio',
    '15457': 'Huishouden',
    '13640': 'Wonen & Slapen',
    '12652': 'Speelgoed',
    '10644': 'Klussen & Gereedschap',
    '10639': 'Tuin & Klussen',
    '15654': 'Baby & Kind',
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

// --- BOL.COM SHOP API ENDPOINTS ---

// Search products
app.get('/api/products/search', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] GET /api/products/search`);
    
    try {
        const { q, category, minPrice, maxPrice, minRating, inStock, sortBy, page, limit } = req.query;
        
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        let query = supabase
            .from('bol_products')
            .select('*', { count: 'exact' });
        
        // Apply search filter with sanitization
        if (q) {
            // Sanitize search term: remove special SQL characters and limit length
            const sanitizedQuery = String(q)
                .replace(/[%_\\]/g, '') // Remove SQL wildcards
                .substring(0, 100); // Limit length
            
            if (sanitizedQuery.trim()) {
                query = query.ilike('title', `%${sanitizedQuery}%`);
            }
        }
        
        // Apply price range
        if (minPrice) {
            query = query.gte('price', parseFloat(minPrice));
        }
        if (maxPrice) {
            query = query.lte('price', parseFloat(maxPrice));
        }
        
        // Apply rating filter
        if (minRating) {
            query = query.gte('average_rating', parseFloat(minRating));
        }
        
        // Apply stock filter
        if (inStock === 'true') {
            query = query.eq('in_stock', true);
        }
        
        // Apply sorting
        switch (sortBy) {
            case 'price_asc':
                query = query.order('price', { ascending: true });
                break;
            case 'price_desc':
                query = query.order('price', { ascending: false });
                break;
            case 'rating':
                query = query.order('average_rating', { ascending: false });
                break;
            case 'popularity':
            default:
                query = query.order('total_ratings', { ascending: false });
        }
        
        // Apply pagination
        const pageNum = parseInt(page) || 1;
        const pageSize = Math.min(parseInt(limit) || 24, 100);
        const offset = (pageNum - 1) * pageSize;
        
        query = query.range(offset, offset + pageSize - 1);
        
        const { data, count, error } = await query;
        
        if (error) {
            console.error('[SHOP] Search error:', error);
            return res.status(500).json({ error: 'Search failed' });
        }
        
        res.json({
            products: data || [],
            totalCount: count || 0,
            page: pageNum,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize)
        });
    } catch (error) {
        console.error('[SHOP] Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get product by EAN
app.get('/api/products/:ean', async (req, res) => {
    const timestamp = new Date().toISOString();
    const { ean } = req.params;
    console.log(`[${timestamp}] [SHOP] GET /api/products/${ean}`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        // Get product with images and specifications
        const { data: product, error } = await supabase
            .from('bol_products')
            .select('*')
            .eq('ean', ean)
            .single();
        
        if (error || !product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Get images
        const { data: images } = await supabase
            .from('bol_product_images')
            .select('*')
            .eq('product_id', product.id)
            .order('display_order');
        
        // Get specifications
        const { data: specifications } = await supabase
            .from('bol_product_specifications')
            .select('*')
            .eq('product_id', product.id);
        
        // Get categories
        const { data: categories } = await supabase
            .from('bol_product_categories')
            .select('category_id, bol_categories(id, name)')
            .eq('product_id', product.id);
        
        res.json({
            ...product,
            images: images || [],
            specifications: specifications || [],
            categories: categories?.map(c => c.bol_categories) || []
        });
    } catch (error) {
        console.error('[SHOP] Product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get popular products
app.get('/api/products/popular', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] GET /api/products/popular`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const { category, limit } = req.query;
        const pageSize = Math.min(parseInt(limit) || 12, 50);
        
        let query = supabase
            .from('bol_products')
            .select('*')
            .eq('in_stock', true)
            .order('total_ratings', { ascending: false })
            .limit(pageSize);
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[SHOP] Popular products error:', error);
            return res.status(500).json({ error: 'Failed to fetch popular products' });
        }
        
        res.json({ products: data || [] });
    } catch (error) {
        console.error('[SHOP] Popular error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get deals
app.get('/api/products/deals', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] GET /api/products/deals`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const { limit } = req.query;
        const pageSize = Math.min(parseInt(limit) || 12, 50);
        
        const { data, error } = await supabase
            .from('bol_products')
            .select('*')
            .eq('is_deal', true)
            .eq('in_stock', true)
            .order('discount_percentage', { ascending: false })
            .limit(pageSize);
        
        if (error) {
            console.error('[SHOP] Deals error:', error);
            return res.status(500).json({ error: 'Failed to fetch deals' });
        }
        
        res.json({ products: data || [] });
    } catch (error) {
        console.error('[SHOP] Deals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get shop categories
app.get('/api/categories', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] GET /api/categories`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const { parentId } = req.query;
        
        let query = supabase
            .from('bol_categories')
            .select('*')
            .order('name');
        
        if (parentId) {
            query = query.eq('parent_id', parentId);
        } else {
            query = query.is('parent_id', null);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[SHOP] Categories error:', error);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        
        res.json({ categories: data || [] });
    } catch (error) {
        console.error('[SHOP] Categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Trigger product sync (admin only)
app.post('/api/sync/products', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] POST /api/sync/products`);
    
    try {
        // In production, this should be protected with authentication
        const { categoryIds, type, searchTerm, limit } = req.body;
        
        // Check if sync service is configured
        if (!bolSyncService.isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Bol.com API not configured',
                message: 'Set BOL_CLIENT_ID and BOL_CLIENT_SECRET environment variables to enable product sync',
            });
        }
        
        if (!supabase) {
            return res.status(503).json({
                success: false,
                error: 'Database not configured',
            });
        }
        
        let job;
        
        if (type === 'search' && searchTerm) {
            // Sync from search term
            job = await bolSyncService.syncFromSearch(searchTerm, limit || 50);
        } else if (type === 'popular_products' && categoryIds && categoryIds.length > 0) {
            // Sync popular products for each category
            const jobs = [];
            for (const categoryId of categoryIds) {
                const categoryJob = await bolSyncService.syncPopularProducts(categoryId, limit || 50);
                jobs.push(categoryJob);
            }
            // Merge results
            job = {
                id: `sync-batch-${Date.now()}`,
                type: 'popular_products_batch',
                status: jobs.every(j => j.status === 'completed') ? 'completed' : 'partial',
                categoryIds,
                startedAt: jobs[0]?.startedAt,
                completedAt: new Date().toISOString(),
                itemsProcessed: jobs.reduce((sum, j) => sum + j.itemsProcessed, 0),
                itemsCreated: jobs.reduce((sum, j) => sum + j.itemsCreated, 0),
                itemsUpdated: jobs.reduce((sum, j) => sum + j.itemsUpdated, 0),
                itemsFailed: jobs.reduce((sum, j) => sum + j.itemsFailed, 0),
                jobs,
            };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid sync request',
                message: 'Provide type="search" with searchTerm, or type="popular_products" with categoryIds',
            });
        }
        
        res.json({
            success: job.status === 'completed',
            job,
        });
    } catch (error) {
        console.error('[SHOP] Sync error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to sync products',
            message: error.message,
        });
    }
});

// Get sync status and available categories
app.get('/api/sync/status', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] GET /api/sync/status`);
    
    const status = bolSyncService.getStatus();
    
    res.json({
        ...status,
        availableCategories: BOL_DEFAULT_CATEGORIES,
        timestamp,
    });
});

// Get product count in database
app.get('/api/sync/stats', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] GET /api/sync/stats`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        // Get product count
        const { count: productCount, error: productError } = await supabase
            .from('bol_products')
            .select('*', { count: 'exact', head: true });
        
        if (productError) {
            console.error('[SHOP] Stats error:', productError);
            return res.status(500).json({ error: 'Failed to get stats' });
        }
        
        // Get deal count
        const { count: dealCount } = await supabase
            .from('bol_products')
            .select('*', { count: 'exact', head: true })
            .eq('is_deal', true);
        
        // Get in-stock count
        const { count: inStockCount } = await supabase
            .from('bol_products')
            .select('*', { count: 'exact', head: true })
            .eq('in_stock', true);
        
        // Get last sync time
        const { data: lastSynced } = await supabase
            .from('bol_products')
            .select('last_synced_at')
            .order('last_synced_at', { ascending: false })
            .limit(1)
            .single();
        
        res.json({
            totalProducts: productCount || 0,
            dealsCount: dealCount || 0,
            inStockCount: inStockCount || 0,
            lastSyncedAt: lastSynced?.last_synced_at || null,
            timestamp,
        });
    } catch (error) {
        console.error('[SHOP] Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Track Bol.com affiliate click
app.post('/api/bol/track-click', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SHOP] POST /api/bol/track-click`);
    
    try {
        const { productEan, affiliateUrl, referrer } = req.body;
        
        if (!productEan || !affiliateUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate URL
        try {
            const parsedUrl = new URL(affiliateUrl);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                return res.status(400).json({ error: 'Invalid URL protocol' });
            }
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        if (supabase) {
            const { error } = await supabase
                .from('bol_affiliate_clicks')
                .insert({
                    product_ean: productEan,
                    affiliate_url: affiliateUrl,
                    clicked_at: timestamp,
                    session_id: `sess-${Date.now()}`,
                    referrer: referrer || null
                });
            
            if (error) {
                console.error('[SHOP] Click tracking error:', error);
            }
        }
        
        res.json({
            success: true,
            message: 'Click tracked'
        });
    } catch (error) {
        console.error('[SHOP] Click tracking error:', error);
        res.status(500).json({ error: 'Failed to track click' });
    }
});

// ============================================================================
// ADMIN SEED PRODUCTS ENDPOINT
// ============================================================================

/**
 * Seed initial products from Bol.com categories
 * Used to quickly populate the database with products for a new webshop
 */
app.post('/api/admin/seed-products', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/seed-products`);
    
    try {
        // Check if Bol.com API is configured
        if (!bolSyncService.isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Bol.com API niet geconfigureerd',
                message: 'Stel BOL_CLIENT_ID en BOL_CLIENT_SECRET in als environment variabelen',
                configured: false
            });
        }
        
        // Check if database is configured
        if (!supabase) {
            return res.status(503).json({
                success: false,
                error: 'Database niet geconfigureerd',
                message: 'Stel VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in als environment variabelen',
                configured: false
            });
        }
        
        const { categories, productsPerCategory = 8 } = req.body;
        
        // Default categories if none provided (first 6 categories)
        const targetCategories = categories && Array.isArray(categories) && categories.length > 0
            ? categories.slice(0, 10) // Max 10 categories at once
            : Object.keys(BOL_DEFAULT_CATEGORIES).slice(0, 6);
        
        console.log(`[ADMIN] Seeding products from ${targetCategories.length} categories, ${productsPerCategory} per category`);
        
        const results = [];
        let totalImported = 0;
        let totalProcessed = 0;
        let totalFailed = 0;
        
        for (const categoryId of targetCategories) {
            const categoryName = BOL_DEFAULT_CATEGORIES[categoryId] || categoryId;
            console.log(`[ADMIN] Processing category: ${categoryName} (${categoryId})`);
            
            try {
                const job = await bolSyncService.syncPopularProducts(categoryId, productsPerCategory);
                
                results.push({
                    categoryId,
                    categoryName,
                    status: job.status,
                    itemsProcessed: job.itemsProcessed || 0,
                    itemsCreated: job.itemsCreated || 0,
                    itemsUpdated: job.itemsUpdated || 0,
                    itemsFailed: job.itemsFailed || 0,
                    errors: job.errors || []
                });
                
                totalImported += (job.itemsCreated || 0) + (job.itemsUpdated || 0);
                totalProcessed += job.itemsProcessed || 0;
                totalFailed += job.itemsFailed || 0;
                
                console.log(`[ADMIN] Category ${categoryName}: ${job.itemsCreated} created, ${job.itemsUpdated} updated`);
                
            } catch (categoryError) {
                const errorMsg = categoryError.message || String(categoryError);
                console.error(`[ADMIN] Category ${categoryName} error:`, errorMsg);
                
                results.push({
                    categoryId,
                    categoryName,
                    status: 'failed',
                    itemsProcessed: 0,
                    itemsCreated: 0,
                    itemsUpdated: 0,
                    itemsFailed: 0,
                    error: errorMsg
                });
            }
        }
        
        res.json({
            success: totalImported > 0,
            message: `${totalImported} producten geïmporteerd uit ${targetCategories.length} categorieën`,
            summary: {
                categoriesProcessed: targetCategories.length,
                totalProductsProcessed: totalProcessed,
                totalProductsImported: totalImported,
                totalProductsFailed: totalFailed
            },
            results,
            timestamp
        });
        
    } catch (error) {
        console.error('[ADMIN] Seed products error:', error);
        res.status(500).json({
            success: false,
            error: 'Seeding mislukt',
            message: error.message || String(error),
            timestamp
        });
    }
});

// Get seed status - check if products exist in database
app.get('/api/admin/seed-status', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] GET /api/admin/seed-status`);
    
    try {
        const status = {
            bolApiConfigured: bolSyncService.isConfigured(),
            databaseConfigured: !!supabase,
            hasProducts: false,
            productCount: 0,
            availableCategories: BOL_DEFAULT_CATEGORIES,
            timestamp
        };
        
        if (supabase) {
            const { count, error } = await supabase
                .from('bol_products')
                .select('*', { count: 'exact', head: true });
            
            if (!error) {
                status.hasProducts = count > 0;
                status.productCount = count || 0;
            }
        }
        
        res.json(status);
        
    } catch (error) {
        console.error('[ADMIN] Seed status error:', error);
        res.status(500).json({ error: 'Failed to get seed status' });
    }
});

// ============================================================================
// PRODUCT DISCOVERY AUTOMATION ENDPOINTS
// ============================================================================

// Automation state (in-memory for this instance)
const automationState = {
    isRunning: false,
    currentRunId: null,
    schedulerEnabled: false,
    schedulerInterval: null, // setInterval reference
    stopRequested: false,
};

// Rate limiting: delay between API requests (in ms)
const RATE_LIMIT_DELAY = 2000;

/**
 * Helper to delay execution
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get automation status
 */
app.get('/api/automation/status', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] GET /api/automation/status`);
    
    try {
        // Get stats from database if available
        let stats = {
            totalProcessed: 0,
            successfulImports: 0,
            failedImports: 0,
            skippedProducts: 0,
        };
        let lastRun = null;
        let config = null;
        
        if (supabase) {
            // Get config
            const { data: configData } = await supabase
                .from('discovery_config')
                .select('*')
                .eq('id', 'default')
                .single();
            
            if (configData) {
                config = {
                    enabled: configData.enabled,
                    scheduleInterval: configData.schedule_interval,
                    categories: configData.categories || [],
                    filters: configData.filters || {},
                    maxProductsPerRun: configData.max_products_per_run || 10,
                    lastRunAt: configData.last_run_at,
                    nextScheduledRun: configData.next_scheduled_run,
                };
            }
            
            // Get last completed run
            const { data: lastRunData } = await supabase
                .from('automation_runs')
                .select('*')
                .neq('status', 'running')
                .order('started_at', { ascending: false })
                .limit(1);
            
            if (lastRunData && lastRunData.length > 0) {
                const run = lastRunData[0];
                lastRun = {
                    id: run.id,
                    startedAt: run.started_at,
                    completedAt: run.completed_at,
                    status: run.status,
                    runType: run.run_type,
                    productsProcessed: run.products_processed,
                    productsImported: run.products_imported,
                    productsSkipped: run.products_skipped,
                    productsFailed: run.products_failed,
                };
            }
            
            // Get aggregate stats from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { data: recentRuns } = await supabase
                .from('automation_runs')
                .select('products_processed, products_imported, products_skipped, products_failed')
                .gte('started_at', thirtyDaysAgo.toISOString());
            
            if (recentRuns) {
                for (const run of recentRuns) {
                    stats.totalProcessed += run.products_processed || 0;
                    stats.successfulImports += run.products_imported || 0;
                    stats.failedImports += run.products_failed || 0;
                    stats.skippedProducts += run.products_skipped || 0;
                }
            }
        }
        
        res.json({
            isRunning: automationState.isRunning,
            currentRunId: automationState.currentRunId,
            schedulerEnabled: automationState.schedulerEnabled,
            lastRun,
            config,
            stats,
            bolSyncConfigured: bolSyncService.isConfigured(),
            timestamp,
        });
    } catch (error) {
        console.error('[AUTOMATION] Status error:', error);
        res.status(500).json({ error: 'Failed to get automation status' });
    }
});

/**
 * Get automation history
 */
app.get('/api/automation/history', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] GET /api/automation/history`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        
        const { data, error } = await supabase
            .from('automation_runs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('[AUTOMATION] History error:', error);
            return res.status(500).json({ error: 'Failed to fetch history' });
        }
        
        const runs = (data || []).map(run => ({
            id: run.id,
            startedAt: run.started_at,
            completedAt: run.completed_at,
            status: run.status,
            runType: run.run_type,
            categories: run.categories,
            filters: run.filters,
            productsProcessed: run.products_processed,
            productsImported: run.products_imported,
            productsSkipped: run.products_skipped,
            productsFailed: run.products_failed,
            errorMessage: run.error_message,
        }));
        
        res.json({ runs, timestamp });
    } catch (error) {
        console.error('[AUTOMATION] History error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/**
 * Get discovery configuration
 */
app.get('/api/automation/config', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] GET /api/automation/config`);
    
    try {
        if (!supabase) {
            // Return default config
            return res.json({
                config: {
                    enabled: false,
                    scheduleInterval: 'daily',
                    categories: ['11652', '13512', '21328'],
                    filters: { minRating: 4.0, minReviews: 10, inStockOnly: true },
                    maxProductsPerRun: 10,
                },
                availableCategories: BOL_DEFAULT_CATEGORIES,
                timestamp,
            });
        }
        
        const { data, error } = await supabase
            .from('discovery_config')
            .select('*')
            .eq('id', 'default')
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('[AUTOMATION] Config error:', error);
            return res.status(500).json({ error: 'Failed to fetch config' });
        }
        
        const config = data ? {
            enabled: data.enabled,
            scheduleInterval: data.schedule_interval,
            categories: data.categories || [],
            filters: data.filters || { minRating: 4.0, minReviews: 10, inStockOnly: true },
            maxProductsPerRun: data.max_products_per_run || 10,
            lastRunAt: data.last_run_at,
            nextScheduledRun: data.next_scheduled_run,
        } : {
            enabled: false,
            scheduleInterval: 'daily',
            categories: ['11652', '13512', '21328'],
            filters: { minRating: 4.0, minReviews: 10, inStockOnly: true },
            maxProductsPerRun: 10,
        };
        
        res.json({ config, availableCategories: BOL_DEFAULT_CATEGORIES, timestamp });
    } catch (error) {
        console.error('[AUTOMATION] Config error:', error);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

/**
 * Save discovery configuration
 */
app.post('/api/automation/config', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/config`);
    
    try {
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const { enabled, scheduleInterval, categories, filters, maxProductsPerRun } = req.body;
        
        // Validate
        if (categories && !Array.isArray(categories)) {
            return res.status(400).json({ error: 'categories must be an array' });
        }
        
        if (scheduleInterval && !['hourly', 'daily', 'weekly'].includes(scheduleInterval)) {
            return res.status(400).json({ error: 'Invalid schedule interval' });
        }
        
        const { error } = await supabase
            .from('discovery_config')
            .upsert({
                id: 'default',
                enabled: enabled ?? false,
                schedule_interval: scheduleInterval || 'daily',
                categories: categories || [],
                filters: filters || { minRating: 4.0, minReviews: 10, inStockOnly: true },
                max_products_per_run: maxProductsPerRun || 10,
                updated_at: timestamp,
            });
        
        if (error) {
            console.error('[AUTOMATION] Save config error:', error);
            return res.status(500).json({ error: 'Failed to save config' });
        }
        
        console.log('[AUTOMATION] Configuration saved');
        res.json({ success: true, message: 'Configuration saved', timestamp });
    } catch (error) {
        console.error('[AUTOMATION] Save config error:', error);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

/**
 * Start product discovery
 */
app.post('/api/automation/discover', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/discover`);
    
    try {
        if (automationState.isRunning) {
            return res.status(409).json({ 
                error: 'Automation already running',
                currentRunId: automationState.currentRunId,
            });
        }
        
        if (!bolSyncService.isConfigured()) {
            return res.status(503).json({
                error: 'Bol.com API not configured',
                message: 'Set BOL_CLIENT_ID and BOL_CLIENT_SECRET environment variables',
            });
        }
        
        if (!supabase) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const { categories, limit, filters } = req.body;
        
        // Validate input
        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({ error: 'At least one category is required' });
        }
        
        const maxProducts = Math.min(limit || 10, 50); // Max 50 products per run
        const productFilters = {
            minRating: filters?.minRating ?? 0,
            minReviews: filters?.minReviews ?? 0,
            inStockOnly: filters?.inStockOnly ?? true,
        };
        
        // Create run record
        const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        const { error: insertError } = await supabase
            .from('automation_runs')
            .insert({
                id: runId,
                started_at: timestamp,
                status: 'running',
                run_type: 'manual',
                categories: categories,
                filters: productFilters,
                config: { limit: maxProducts },
            });
        
        if (insertError) {
            console.error('[AUTOMATION] Error creating run:', insertError);
            return res.status(500).json({ error: 'Failed to create run record' });
        }
        
        // Set running state
        automationState.isRunning = true;
        automationState.currentRunId = runId;
        automationState.stopRequested = false;
        
        // Run discovery in background
        runProductDiscovery(runId, categories, maxProducts, productFilters)
            .catch(err => {
                console.error('[AUTOMATION] Discovery error:', err);
            })
            .finally(() => {
                automationState.isRunning = false;
                automationState.currentRunId = null;
            });
        
        res.json({
            success: true,
            message: 'Product discovery started',
            runId,
            categories,
            maxProducts,
            filters: productFilters,
            timestamp,
        });
    } catch (error) {
        console.error('[AUTOMATION] Discover error:', error);
        automationState.isRunning = false;
        automationState.currentRunId = null;
        res.status(500).json({ error: 'Failed to start discovery' });
    }
});

/**
 * Stop running automation
 */
app.post('/api/automation/stop', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/stop`);
    
    if (!automationState.isRunning) {
        return res.json({ success: true, message: 'No automation running' });
    }
    
    automationState.stopRequested = true;
    console.log('[AUTOMATION] Stop requested');
    
    res.json({
        success: true,
        message: 'Stop requested, current run will complete current product and stop',
        runId: automationState.currentRunId,
    });
});

/**
 * Start scheduled automation
 */
app.post('/api/automation/start-schedule', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/start-schedule`);
    
    try {
        const { interval, categories, maxProductsPerRun } = req.body;
        
        // Validate
        if (!['hourly', 'daily', 'weekly'].includes(interval)) {
            return res.status(400).json({ error: 'Invalid interval. Use hourly, daily, or weekly' });
        }
        
        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({ error: 'At least one category is required' });
        }
        
        // Stop existing scheduler if any
        if (automationState.schedulerInterval) {
            clearInterval(automationState.schedulerInterval);
        }
        
        // Calculate interval in milliseconds
        const intervalMs = {
            hourly: 60 * 60 * 1000,      // 1 hour
            daily: 24 * 60 * 60 * 1000,   // 24 hours
            weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
        }[interval];
        
        // Save config to database
        if (supabase) {
            const nextRun = new Date(Date.now() + intervalMs);
            
            await supabase
                .from('discovery_config')
                .upsert({
                    id: 'default',
                    enabled: true,
                    schedule_interval: interval,
                    categories: categories,
                    max_products_per_run: maxProductsPerRun || 10,
                    next_scheduled_run: nextRun.toISOString(),
                    updated_at: timestamp,
                });
        }
        
        // Start scheduler
        automationState.schedulerEnabled = true;
        automationState.schedulerInterval = setInterval(async () => {
            if (!automationState.isRunning && bolSyncService.isConfigured()) {
                console.log('[AUTOMATION] Scheduled run triggered');
                
                const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                
                if (supabase) {
                    await supabase.from('automation_runs').insert({
                        id: runId,
                        started_at: new Date().toISOString(),
                        status: 'running',
                        run_type: 'scheduled',
                        categories: categories,
                        filters: { minRating: 4.0, minReviews: 10, inStockOnly: true },
                        config: { maxProducts: maxProductsPerRun || 10 },
                    });
                }
                
                automationState.isRunning = true;
                automationState.currentRunId = runId;
                
                runProductDiscovery(runId, categories, maxProductsPerRun || 10, {
                    minRating: 4.0,
                    minReviews: 10,
                    inStockOnly: true,
                })
                    .finally(() => {
                        automationState.isRunning = false;
                        automationState.currentRunId = null;
                    });
            }
        }, intervalMs);
        
        console.log(`[AUTOMATION] Scheduler started: ${interval}`);
        
        res.json({
            success: true,
            message: `Scheduled automation started (${interval})`,
            interval,
            categories,
            maxProductsPerRun: maxProductsPerRun || 10,
            nextRun: new Date(Date.now() + intervalMs).toISOString(),
        });
    } catch (error) {
        console.error('[AUTOMATION] Start schedule error:', error);
        res.status(500).json({ error: 'Failed to start scheduled automation' });
    }
});

/**
 * Stop scheduled automation
 */
app.post('/api/automation/stop-schedule', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/stop-schedule`);
    
    if (automationState.schedulerInterval) {
        clearInterval(automationState.schedulerInterval);
        automationState.schedulerInterval = null;
    }
    automationState.schedulerEnabled = false;
    
    // Update config in database
    if (supabase) {
        await supabase
            .from('discovery_config')
            .update({
                enabled: false,
                next_scheduled_run: null,
                updated_at: timestamp,
            })
            .eq('id', 'default');
    }
    
    console.log('[AUTOMATION] Scheduler stopped');
    
    res.json({
        success: true,
        message: 'Scheduled automation stopped',
        timestamp,
    });
});

/**
 * Trigger a specific automation job
 */
app.post('/api/automation/trigger/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTOMATION] POST /api/automation/trigger/${jobId}`);
    
    // For now, only support product discovery
    if (jobId === 'productGeneration' || jobId === 'productDiscovery') {
        // Load config and trigger discovery
        if (!bolSyncService.isConfigured()) {
            return res.status(503).json({
                error: 'Bol.com API not configured',
            });
        }
        
        let config = {
            categories: ['11652', '13512', '21328'],
            maxProductsPerRun: 10,
            filters: { minRating: 4.0, minReviews: 10, inStockOnly: true },
        };
        
        if (supabase) {
            const { data } = await supabase
                .from('discovery_config')
                .select('*')
                .eq('id', 'default')
                .single();
            
            if (data) {
                config = {
                    categories: data.categories || config.categories,
                    maxProductsPerRun: data.max_products_per_run || 10,
                    filters: data.filters || config.filters,
                };
            }
        }
        
        // Check if already running
        if (automationState.isRunning) {
            return res.status(409).json({ 
                error: 'Automation already running',
                currentRunId: automationState.currentRunId,
            });
        }
        
        // Create run record and start discovery
        const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        if (supabase) {
            await supabase.from('automation_runs').insert({
                id: runId,
                started_at: timestamp,
                status: 'running',
                run_type: 'manual',
                categories: config.categories,
                filters: config.filters,
                config: { limit: config.maxProductsPerRun },
            });
        }
        
        // Set running state
        automationState.isRunning = true;
        automationState.currentRunId = runId;
        automationState.stopRequested = false;
        
        // Run discovery in background
        runProductDiscovery(runId, config.categories, config.maxProductsPerRun, config.filters)
            .catch(err => console.error('[AUTOMATION] Trigger discovery error:', err))
            .finally(() => {
                automationState.isRunning = false;
                automationState.currentRunId = null;
            });
        
        return res.json({
            success: true,
            message: 'Product discovery started',
            runId,
            categories: config.categories,
            maxProducts: config.maxProductsPerRun,
            filters: config.filters,
            timestamp,
        });
    }
    
    res.status(400).json({ error: `Unknown job: ${jobId}` });
});

/**
 * Background product discovery process
 */
async function runProductDiscovery(runId, categories, maxProducts, filters) {
    console.log(`[AUTOMATION] Starting discovery run ${runId}`);
    console.log(`[AUTOMATION] Categories: ${categories.join(', ')}, Max: ${maxProducts}`);
    
    let productsProcessed = 0;
    let productsImported = 0;
    let productsSkipped = 0;
    let productsFailed = 0;
    const errors = [];
    
    try {
        const productsPerCategory = Math.ceil(maxProducts / categories.length);
        
        for (const categoryId of categories) {
            if (automationState.stopRequested) {
                console.log('[AUTOMATION] Stop requested, aborting');
                break;
            }
            
            console.log(`[AUTOMATION] Processing category ${categoryId}`);
            
            try {
                // Fetch products from Bol.com
                const products = await bolSyncService.getPopularProducts(categoryId, productsPerCategory);
                console.log(`[AUTOMATION] Found ${products.length} products in category ${categoryId}`);
                
                for (const bolProduct of products) {
                    if (automationState.stopRequested) {
                        break;
                    }
                    
                    productsProcessed++;
                    
                    try {
                        // Apply filters
                        const rating = bolProduct.rating?.averageRating || 0;
                        const reviewCount = bolProduct.rating?.totalRatings || 0;
                        const inStock = bolProduct.bestOffer?.availability === 'IN_STOCK' || 
                                       bolProduct.bestOffer?.availability === 'LIMITED_STOCK';
                        
                        if (filters.minRating && rating < filters.minRating) {
                            productsSkipped++;
                            await logProductImportToDb(runId, bolProduct.ean, bolProduct.bolProductId, bolProduct.title, 'skipped', `Rating ${rating} below minimum ${filters.minRating}`);
                            continue;
                        }
                        
                        if (filters.minReviews && reviewCount < filters.minReviews) {
                            productsSkipped++;
                            await logProductImportToDb(runId, bolProduct.ean, bolProduct.bolProductId, bolProduct.title, 'skipped', `Reviews ${reviewCount} below minimum ${filters.minReviews}`);
                            continue;
                        }
                        
                        if (filters.inStockOnly && !inStock) {
                            productsSkipped++;
                            await logProductImportToDb(runId, bolProduct.ean, bolProduct.bolProductId, bolProduct.title, 'skipped', 'Out of stock');
                            continue;
                        }
                        
                        // Check if product already exists
                        if (supabase) {
                            const { data: existing } = await supabase
                                .from('bol_products')
                                .select('ean')
                                .eq('ean', bolProduct.ean)
                                .single();
                            
                            if (existing) {
                                productsSkipped++;
                                await logProductImportToDb(runId, bolProduct.ean, bolProduct.bolProductId, bolProduct.title, 'skipped', 'Already exists');
                                continue;
                            }
                        }
                        
                        // Map and insert product
                        const dbProduct = bolSyncService.mapProductToDb(bolProduct);
                        
                        if (supabase) {
                            const { error: insertError } = await supabase
                                .from('bol_products')
                                .insert({
                                    ...dbProduct,
                                    created_at: new Date().toISOString(),
                                });
                            
                            if (insertError) {
                                throw new Error(`Insert failed: ${insertError.message}`);
                            }
                        }
                        
                        productsImported++;
                        await logProductImportToDb(runId, bolProduct.ean, bolProduct.bolProductId, bolProduct.title, 'imported', null);
                        console.log(`[AUTOMATION] Imported: ${bolProduct.title?.substring(0, 50)}...`);
                        
                        // Rate limiting
                        await delay(RATE_LIMIT_DELAY);
                        
                    } catch (productError) {
                        const errorMsg = productError.message || String(productError);
                        productsFailed++;
                        errors.push(`${bolProduct.ean}: ${errorMsg}`);
                        await logProductImportToDb(runId, bolProduct.ean, bolProduct.bolProductId, bolProduct.title, 'failed', null, errorMsg);
                        console.error(`[AUTOMATION] Failed: ${bolProduct.ean}:`, errorMsg);
                    }
                }
                
            } catch (categoryError) {
                const errorMsg = categoryError.message || String(categoryError);
                errors.push(`Category ${categoryId}: ${errorMsg}`);
                console.error(`[AUTOMATION] Category ${categoryId} error:`, errorMsg);
            }
            
            // Rate limiting between categories
            await delay(RATE_LIMIT_DELAY);
        }
        
        // Update run record
        const finalStatus = automationState.stopRequested ? 'cancelled' : 'completed';
        
        if (supabase) {
            await supabase
                .from('automation_runs')
                .update({
                    status: finalStatus,
                    completed_at: new Date().toISOString(),
                    products_processed: productsProcessed,
                    products_imported: productsImported,
                    products_skipped: productsSkipped,
                    products_failed: productsFailed,
                    error_message: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
                })
                .eq('id', runId);
        }
        
        console.log(`[AUTOMATION] Run ${runId} ${finalStatus}: processed=${productsProcessed}, imported=${productsImported}, skipped=${productsSkipped}, failed=${productsFailed}`);
        
    } catch (error) {
        const errorMsg = error.message || String(error);
        console.error(`[AUTOMATION] Run ${runId} failed:`, errorMsg);
        
        if (supabase) {
            await supabase
                .from('automation_runs')
                .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    products_processed: productsProcessed,
                    products_imported: productsImported,
                    products_skipped: productsSkipped,
                    products_failed: productsFailed,
                    error_message: errorMsg,
                })
                .eq('id', runId);
        }
    }
}

/**
 * Log product import to database
 */
async function logProductImportToDb(runId, ean, bolProductId, title, status, skipReason, errorMessage) {
    if (!supabase) return;
    
    try {
        await supabase
            .from('product_import_logs')
            .insert({
                run_id: runId,
                ean: ean,
                bol_product_id: bolProductId,
                product_title: title?.substring(0, 500),
                status: status,
                skip_reason: skipReason,
                error_message: errorMessage,
            });
    } catch (error) {
        console.error('[AUTOMATION] Failed to log import:', error);
    }
}

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
