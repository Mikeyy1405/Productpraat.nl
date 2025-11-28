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

// Bol.com API Configuration
const BOL_API_KEY = process.env.BOL_API_KEY || '';
const BOL_AFFILIATE_ID = process.env.BOL_AFFILIATE_ID || '';

console.log('[CONFIG] Server starting with configuration:');
console.log(`[CONFIG] Supabase URL: ${VITE_SUPABASE_URL ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Supabase Key: ${VITE_SUPABASE_ANON_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] AIML API Key: ${VITE_ANTHROPIC_API_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Bol.com API Key: ${BOL_API_KEY ? 'Configured' : 'Not set'}`);
console.log(`[CONFIG] Bol.com Affiliate ID: ${BOL_AFFILIATE_ID ? 'Configured' : 'Not set'}`);

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

/**
 * Bol.com Sync Service for server-side product synchronization
 * Implements the Marketing Catalog API to fetch and sync products to Supabase
 */
const bolSyncService = {
    apiBaseUrl: 'https://api.bol.com',
    
    /**
     * Check if the Bol.com API is configured
     */
    isConfigured() {
        return Boolean(BOL_API_KEY);
    },
    
    /**
     * Make an authenticated API request to Bol.com
     */
    async apiRequest(path, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('Bol.com API not configured. Set BOL_API_KEY environment variable.');
        }
        
        const url = `${this.apiBaseUrl}${path}`;
        const headers = {
            'Authorization': `Bearer ${BOL_API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        
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
            apiKeySet: Boolean(BOL_API_KEY),
            affiliateIdSet: Boolean(BOL_AFFILIATE_ID),
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
                message: 'Set BOL_API_KEY environment variable to enable product sync',
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
