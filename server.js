import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIG ---
// Bol.com Marketing API credentials - MUST be set via environment variables in production
const BOL_CLIENT_ID = process.env.BOL_CLIENT_ID;
const BOL_CLIENT_SECRET = process.env.BOL_CLIENT_SECRET;
const SITE_ID = process.env.BOL_SITE_ID;
const PLACEHOLDER_IMG = 'https://placehold.co/400x400/f1f5f9/94a3b8?text=Geen+Afbeelding';

// Rate limiting for AI API calls (in milliseconds)
const AI_RATE_LIMIT_DELAY_MS = 2000;

// Check and log Bol.com API configuration status
const isBolConfigured = !!(BOL_CLIENT_ID && BOL_CLIENT_SECRET && SITE_ID);
if (!isBolConfigured) {
    console.warn('[BOL] Warning: Bol.com API credentials not fully configured.');
    console.warn('[BOL] Required environment variables: BOL_CLIENT_ID, BOL_CLIENT_SECRET, BOL_SITE_ID');
    console.warn('[BOL] Product import features will not work until credentials are provided.');
    if (!SITE_ID) {
        console.warn('[BOL] Warning: BOL_SITE_ID is not set - affiliate URLs will not generate correctly');
    }
} else {
    console.log('[BOL] Bol.com Marketing API configured successfully');
    console.log(`[BOL] Affiliate Site ID: ${SITE_ID}`);
}

// AI API Configuration (Server-side only)
const AIML_API_KEY = process.env.VITE_API_KEY;
const AIML_BASE_URL = 'https://api.aimlapi.com/v1';
const AI_MODEL = 'google/gemini-3-pro-preview';

// Initialize OpenAI-compatible client for AIML API
let openai = null;
if (AIML_API_KEY) {
    openai = new OpenAI({
        apiKey: AIML_API_KEY,
        baseURL: AIML_BASE_URL
    });
    console.log('[AI] AIML API configured successfully');
} else {
    console.warn('[AI] Warning: VITE_API_KEY not set - AI features will be disabled');
}

// Supabase Public Vars to inject
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Category mappings - Maps our app categories to Bol.com search terms
// These are optimized search terms for the best product results
const CATEGORY_SEARCH_TERMS = {
    'televisies': 'smart tv 4k',
    'audio': 'bluetooth speaker',
    'laptops': 'laptop',
    'smartphones': 'smartphone',
    'wasmachines': 'wasmachine',
    'stofzuigers': 'stofzuiger',
    'smarthome': 'smart home',
    'matrassen': 'matras',
    'airfryers': 'airfryer',
    'koffie': 'koffiemachine',
    'keuken': 'keukenmachine',
    'verzorging': 'scheerapparaat'
};

app.use(express.json());
// We serve static files manually to intercept index.html
app.use(express.static('dist', { index: false }));

let cachedToken = null;
let tokenExpiry = 0;

// --- AUTH ---
async function getBolToken() {
    // Check if credentials are configured
    if (!BOL_CLIENT_ID || !BOL_CLIENT_SECRET) {
        console.error("[BOL] Error: Bol.com API credentials not configured");
        throw new Error("Bol.com API credentials niet geconfigureerd. Stel BOL_CLIENT_ID en BOL_CLIENT_SECRET in.");
    }
    
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) return cachedToken;

    try {
        console.log("[BOL] Fetching new Bol.com Access Token...");
        const credentials = Buffer.from(`${BOL_CLIENT_ID}:${BOL_CLIENT_SECRET}`).toString('base64');
        const response = await axios.post('https://login.bol.com/token?grant_type=client_credentials', null, {
            headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
        });
        cachedToken = response.data.access_token;
        tokenExpiry = now + (response.data.expires_in * 1000) - 60000;
        console.log("[BOL] Access token obtained successfully");
        return cachedToken;
    } catch (error) {
        console.error("[BOL] Auth Error:", error.response?.data || error.message);
        throw new Error(`Kon niet inloggen bij Bol.com: ${extractErrorMessage(error, 'Authenticatie fout')}`);
    }
}

// --- HELPER: Standard headers for Bol.com Marketing API ---
const getBolHeaders = (token) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Accept-Language': 'nl'
});

// --- HELPER: Clean Bol.com URL (remove tracking params) ---
const cleanBolUrl = (url) => {
    try {
        const urlObj = new URL(url);
        // Keep only essential path and domain, remove all query parameters
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch (e) {
        console.error('Error cleaning URL:', e);
        return url;
    }
};

// --- HELPER: Generate affiliate URL with correct Partner Platform structure ---
const generateAffiliateUrl = (productUrl, title, ean) => {
    // Clean URL first
    const cleanUrl = cleanBolUrl(productUrl);
    
    // Use correct Partner Platform structure
    return `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(cleanUrl)}&name=${encodeURIComponent(title)}`;
};

// --- HELPER: Generate SEO-friendly slug ---
const generateSlug = (brand, model) => {
    const brandStr = brand || '';
    const modelStr = model || '';
    const text = `${brandStr} ${modelStr}`.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')          // Replace spaces with -
        .replace(/-+/g, '-')           // Replace multiple - with single -
        .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
    return text || 'product';
};

// --- HELPER: Extract error message from various error formats ---
const extractErrorMessage = (error, defaultMessage = 'Er is een fout opgetreden') => {
    return error.response?.data?.error_description || 
           error.response?.data?.error || 
           error.message || 
           defaultMessage;
};

// --- HELPER: Get detailed error info for debugging ---
const getDetailedErrorInfo = (error) => {
    return {
        message: error.message || 'Unknown error',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        isTimeout: error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
    };
};

// --- HELPER: Retry logic with exponential backoff ---
const API_TIMEOUT_MS = 30000; // 30 second timeout
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Retry wrapper with exponential backoff
 * Automatically retries failed operations with increasing delays
 * 
 * @param {Function} operation - Async function to execute
 * @param {string} operationName - Name for logging purposes
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<any>} - Result of the operation
 * @throws {Error} - Last error if all retries fail
 * 
 * Retry behavior:
 * - Attempt 1: immediate
 * - Attempt 2: after 1 second
 * - Attempt 3: after 2 seconds
 * - Does NOT retry on 4xx errors (except 429 rate limit)
 */
async function withRetry(operation, operationName, maxRetries = MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const errorInfo = getDetailedErrorInfo(error);
            
            // Don't retry on client errors (4xx) except 429 (rate limit)
            if (errorInfo.status && errorInfo.status >= 400 && errorInfo.status < 500 && errorInfo.status !== 429) {
                console.error(`[RETRY] ${operationName} failed with client error (${errorInfo.status}), not retrying`);
                throw error;
            }
            
            // Log retry attempt
            const isLastAttempt = attempt === maxRetries;
            if (!isLastAttempt) {
                const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
                console.warn(`[RETRY] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${errorInfo.message}. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                console.error(`[RETRY] ${operationName} failed after ${maxRetries} attempts: ${errorInfo.message}`);
            }
        }
    }
    
    throw lastError;
}

// --- HELPER: Make API call with timeout ---
const axiosWithTimeout = axios.create({
    timeout: API_TIMEOUT_MS
});

// --- HELPER: Extract price from Bol.com offer with fallbacks ---
const extractPrice = (offer) => {
    if (!offer) return 0;
    return offer.price || offer.listPrice || 0;
};

// --- HELPER: Fetch images from Bol.com media endpoint ---
async function fetchBolImages(ean, token, fallbackImage) {
    try {
        const response = await axios.get(
            `https://api.bol.com/marketing/catalog/v1/products/${ean}/media`,
            { headers: getBolHeaders(token) }
        );
        
        const mediaData = response.data;
        let allImages = [];
        let mainImage = fallbackImage;
        
        if (mediaData.images && mediaData.images.length > 0) {
            // Extract all image URLs and ensure HTTPS
            allImages = mediaData.images
                .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))
                .map(img => {
                    let url = img?.url || '';
                    if (url) url = url.replace(/^http:/, 'https:');
                    return url;
                })
                .filter(url => url)
                .slice(0, 5); // Max 5 images
            
            // Use first image as main image
            if (allImages.length > 0) {
                mainImage = allImages[0];
            }
        }
        
        console.log(`[BOL] Fetched ${allImages.length} images for EAN ${ean}`);
        
        if (allImages.length === 0) {
            console.warn(`[BOL] Warning: No images found for ${ean}`);
            return { images: [fallbackImage], mainImage: fallbackImage };
        }
        
        return { images: allImages, mainImage };
    } catch (error) {
        console.error(`[BOL] Error fetching images for ${ean}:`, error.message);
        return { images: [fallbackImage], mainImage: fallbackImage };
    }
}

// --- HELPER: Fetch ratings from Bol.com ratings endpoint ---
async function fetchBolRatings(ean, token) {
    try {
        const response = await axios.get(
            `https://api.bol.com/marketing/catalog/v1/products/${ean}/ratings`,
            { headers: getBolHeaders(token) }
        );
        
        return {
            averageRating: response.data.averageRating || 0,
            totalReviews: response.data.ratings?.reduce((sum, r) => sum + r.count, 0) || 0,
            distribution: response.data.ratings || []
        };
    } catch (error) {
        console.error(`[BOL] Error fetching ratings for ${ean}:`, error.message);
        return null;
    }
}

// --- ROUTES ---

app.post('/api/bol/search-list', async (req, res) => {
    const { term, limit, categoryId } = req.body;
    try {
        const token = await getBolToken();
        
        // Build search params - using 'search-term' for query
        const searchParams = { 
            'search-term': term,
            'country-code': 'NL',
            'page': 1,
            'include-image': true,
            'include-offer': true
        };
        
        // Add category filter if provided
        if (categoryId) {
            searchParams['category-id'] = categoryId;
        }
        
        console.log(`[BOL] Searching for: "${term}"${categoryId ? ` in category ${categoryId}` : ''}`);
        
        const response = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: searchParams,
            headers: getBolHeaders(token)
        });

        const results = response.data.results || [];
        console.log(`[BOL] Search '${term}' found ${results.length} items`);

        const products = results.slice(0, limit || 5).map(p => {
            let img = p.image?.url || PLACEHOLDER_IMG;
            if (img.startsWith('http:')) img = img.replace('http:', 'https:');
            
            // Generate affiliate URL for each product
            let productUrl = p.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${p.ean}/`;
            productUrl = cleanBolUrl(productUrl); // Strip tracking params!
            const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(p.title)}`;
            
            return {
                id: p.ean,
                ean: p.ean,
                title: p.title,
                image: img,
                url: affiliateUrl,
                rawUrl: productUrl,
                price: extractPrice(p.offer)
            };
        });
        res.json({ products });
    } catch (error) {
        console.error("[BOL] Search List Error:", error.response?.data || error.message);
        res.status(200).json({ products: [], error: error.message });
    }
});

// Manual product search endpoint - returns detailed product info for selection
app.post('/api/bol/search-products', async (req, res) => {
    const { searchTerm, limit = 50, page = 1, maxPages = 2 } = req.body;
    const timestamp = new Date().toISOString();
    
    if (!searchTerm || !searchTerm.trim()) {
        return res.status(400).json({ error: 'Zoekterm is verplicht', products: [] });
    }
    
    console.log(`[${timestamp}] [BOL] Manual product search: "${searchTerm}" (limit: ${limit}, page: ${page}, maxPages: ${maxPages})`);
    
    try {
        // Check if Bol.com API is configured
        if (!isBolConfigured) {
            console.error(`[${timestamp}] [BOL] API not configured`);
            return res.status(503).json({ 
                error: 'Bol.com API niet geconfigureerd. Stel BOL_CLIENT_ID, BOL_CLIENT_SECRET en BOL_SITE_ID in.',
                products: [] 
            });
        }
        
        const token = await getBolToken();
        
        // Fetch multiple pages and combine results
        const allResults = [];
        for (let currentPage = page; currentPage < page + maxPages; currentPage++) {
            const searchParams = { 
                'search-term': searchTerm.trim(),
                'country-code': 'NL',
                'page': currentPage,
                'include-image': true,
                'include-offer': true,
                'include-specifications': true
            };
            
            const response = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
                params: searchParams,
                headers: getBolHeaders(token)
            });
            
            const results = response.data.results || [];
            if (results.length === 0) break; // Stop if no more results
            allResults.push(...results);
            console.log(`[${timestamp}] [BOL] Page ${currentPage}: found ${results.length} products`);
        }
        
        console.log(`[${timestamp}] [BOL] Total search found ${allResults.length} products across pages`);
        
        if (allResults.length === 0) {
            return res.json({ products: [], message: 'Geen producten gevonden' });
        }
        
        // Filter products without price or image, then map to detailed product objects
        const products = allResults
            .filter(p => {
                // Filter products WITHOUT price or image using extractPrice for consistency
                const hasPrice = extractPrice(p.offer) > 0;
                const hasImage = p.image && p.image.url;
                return hasPrice && hasImage; // Only products with BOTH
            })
            .slice(0, limit)
            .map(p => {
                let img = p.image?.url || PLACEHOLDER_IMG;
                if (img.startsWith('http:')) img = img.replace('http:', 'https:');
                
                // Generate affiliate URL
                let productUrl = p.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${p.ean}/`;
                productUrl = cleanBolUrl(productUrl);
                const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(p.title)}`;
                
                // Extract price
                const price = extractPrice(p.offer);
                
                // Extract brand from title or specs
                let brand = '';
                if (p.specificationGroups) {
                    for (const group of p.specificationGroups) {
                        const brandSpec = group.specifications?.find(s => 
                            s.name.toLowerCase() === 'merk' || s.name.toLowerCase() === 'brand'
                        );
                        if (brandSpec) {
                            brand = brandSpec.value;
                            break;
                        }
                    }
                }
                // Note: We don't use fallback extraction from title as it's unreliable
                // The AI will determine the brand during product enrichment
                
                // Extract description
                const description = p.shortDescription || p.description || '';
                
                return {
                    id: p.ean,
                    ean: p.ean,
                    title: p.title,
                    brand,
                    image: img,
                    price,
                    url: affiliateUrl,
                    rawUrl: productUrl,
                    description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
                    available: !!(p.offer && p.offer.price)
                };
            });
        
        // Log how many products were filtered
        const filteredCount = allResults.length - products.length;
        console.log(`[${timestamp}] [BOL] Filtered ${allResults.length} -> ${products.length} products (removed ${filteredCount} products without price/image)`);
        
        res.json({ products, total: allResults.length, filtered: filteredCount });
        
    } catch (error) {
        console.error(`[${timestamp}] [BOL] Search Products Error:`, error.response?.data || error.message);
        
        // Return error with details
        const errorMessage = extractErrorMessage(error, 'Zoeken mislukt');
        res.status(500).json({ 
            error: errorMessage,
            products: [],
            troubleshooting: [
                'Controleer of de Bol.com API correct is geconfigureerd',
                'Probeer een andere zoekterm',
                'Probeer het later opnieuw'
            ]
        });
    }
});

// Import a specific product by EAN with AI enrichment
app.post('/api/bol/import-by-ean', async (req, res) => {
    const { ean } = req.body;
    const timestamp = new Date().toISOString();
    
    if (!ean) {
        return res.status(400).json({ error: 'EAN is verplicht' });
    }
    
    console.log(`[${timestamp}] [BOL] Importing product by EAN: ${ean}`);
    
    try {
        // Check if Bol.com API is configured
        if (!isBolConfigured) {
            console.error(`[${timestamp}] [BOL] API not configured`);
            return res.status(503).json({ 
                error: 'Bol.com API niet geconfigureerd' 
            });
        }
        
        const token = await getBolToken();
        
        // Search for the product by EAN
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': ean,
                'country-code': 'NL',
                'include-image': true,
                'include-offer': true,
                'include-specifications': true
            },
            headers: getBolHeaders(token)
        });
        
        const results = searchResponse.data.results;
        if (!results || results.length === 0) {
            console.log(`[${timestamp}] [BOL] No product found for EAN: ${ean}`);
            return res.status(404).json({ error: 'Geen product gevonden met dit EAN' });
        }
        
        // Find the exact EAN match
        const product = results.find(p => p.ean === ean) || results[0];
        const productEan = product.ean;
        console.log(`[${timestamp}] [BOL] Found product: ${product.title} (EAN: ${productEan})`);
        
        // Fetch images
        let imageUrl = product.image?.url || PLACEHOLDER_IMG;
        const { images, mainImage } = await fetchBolImages(productEan, token, imageUrl);
        imageUrl = mainImage;
        
        // Fetch ratings/reviews
        const bolReviews = await fetchBolRatings(productEan, token);
        if (bolReviews) {
            console.log(`[${timestamp}] [BOL] Fetched ${bolReviews.totalReviews} reviews`);
        }
        
        // Extract price
        const price = extractPrice(product.offer);
        
        // Generate affiliate URL
        let productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${productEan}/`;
        productUrl = cleanBolUrl(productUrl);
        const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;
        
        // Extract specifications
        const specs = {};
        if (product.specificationGroups) {
            product.specificationGroups.forEach(g => {
                g.specifications?.forEach(s => { specs[s.name] = s.value; });
            });
        }
        
        const bolData = {
            title: product.title,
            price,
            image: imageUrl,
            images,
            ean: productEan,
            url: affiliateUrl,
            rawDescription: product.shortDescription || product.description || "",
            specs,
            bolReviews
        };
        
        // Collect warnings for missing data
        const warnings = [];
        
        if (!price || price === 0) {
            warnings.push('Geen prijs beschikbaar voor dit product');
        }
        
        if (!imageUrl || imageUrl === PLACEHOLDER_IMG) {
            warnings.push('Geen productafbeelding beschikbaar');
        }
        
        if (images.length === 0) {
            warnings.push('Geen extra afbeeldingen beschikbaar');
        }
        
        if (warnings.length > 0) {
            console.warn(`[${timestamp}] [BOL] Import warnings for ${ean}:`, warnings);
        }
        
        // Generate AI content
        console.log(`[${timestamp}] [BOL] Generating AI content for: ${product.title.substring(0, 40)}...`);
        let aiData;
        try {
            aiData = await generateAIProductReview(bolData);
        } catch (aiError) {
            console.error(`[${timestamp}] [BOL] AI generation failed:`, aiError.message);
            return res.status(500).json({
                error: 'AI content generatie mislukt',
                details: aiError.message,
                partialData: { bolData },
                warnings
            });
        }
        
        // Generate SEO-friendly slug
        const slug = generateSlug(aiData.brand, aiData.model);
        
        console.log(`[${timestamp}] [BOL] Import by EAN completed: ${aiData.brand} ${aiData.model}`);
        res.json({ 
            bolData: { ...bolData, slug }, 
            aiData: { 
                ...aiData, 
                slug,
                images,
                bolReviewsRaw: bolReviews 
            },
            warnings
        });
        
    } catch (error) {
        console.error(`[${timestamp}] [BOL] Import by EAN Error:`, error.response?.data || error.message);
        res.status(500).json({ 
            error: extractErrorMessage(error, 'Import mislukt'),
            troubleshooting: [
                'Controleer of het EAN correct is',
                'Probeer het product opnieuw te zoeken',
                'Controleer de API verbinding'
            ]
        });
    }
});

app.post('/api/bol/import', async (req, res) => {
    const { input } = req.body;
    try {
        const token = await getBolToken();
        
        // Extract EAN from URL if present
        let searchTerm = input;
        const matches = input.match(/(\d{13})|(\d{10,})/);
        if (matches) searchTerm = matches[0];

        console.log(`[BOL] Importing product with search: "${searchTerm}"`);
        
        // Use the correct search endpoint
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': searchTerm,
                'country-code': 'NL',
                'include-image': true,
                'include-offer': true,
                'include-specifications': true
            },
            headers: getBolHeaders(token)
        });

        const results = searchResponse.data.results;
        if (!results || results.length === 0) {
            console.log(`[BOL] No product found for: "${searchTerm}"`);
            return res.status(404).json({ error: "Geen product gevonden" });
        }

        const product = results[0];
        const ean = product.ean;
        console.log(`[BOL] Found product: ${product.title} (EAN: ${ean})`);

        let imageUrl = product.image?.url || PLACEHOLDER_IMG;
        
        // Fetch all images from media endpoint
        const { images, mainImage } = await fetchBolImages(ean, token, imageUrl);
        imageUrl = mainImage;
        
        // Fetch ratings/reviews from Bol.com
        const bolReviews = await fetchBolRatings(ean, token);
        if (bolReviews) {
            console.log(`[BOL] Fetched ${bolReviews.totalReviews} reviews for product ${ean}`);
        }

        // Extract price using helper function
        const price = extractPrice(product.offer);
        
        if (!price) {
            console.warn(`[BOL] Warning: No price found for ${ean}`);
        }

        // Get product URL and generate affiliate link
        let productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${ean}/`;
        productUrl = cleanBolUrl(productUrl); // Strip tracking params!
        const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

        // Extract specifications
        const specs = {};
        if (product.specificationGroups) {
            product.specificationGroups.forEach(g => {
                g.specifications?.forEach(s => { specs[s.name] = s.value; });
            });
        }

        console.log(`[BOL] Import successful: ${product.title} - €${price}`);
        console.log(`[BOL] Affiliate URL: ${affiliateUrl}`);
        
        res.json({
            title: product.title,
            price,
            image: imageUrl,
            images,
            ean,
            url: affiliateUrl,
            rawDescription: product.shortDescription || product.description || "",
            specs,
            bolReviews
        });

    } catch (error) {
        console.error("[BOL] Import Error:", error.response?.data || error.message);
        res.status(500).json({ error: `Fout bij Bol.com API: ${error.message}` });
    }
});

// --- HEALTH & CONFIG ENDPOINTS ---

// Health check with API status
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.1.0',
        services: {
            bolApi: isBolConfigured,
            aiApi: !!AIML_API_KEY,
            supabase: !!(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)
        },
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

// Test connection endpoint - verifies API connectivity
app.get('/api/admin/test-connection', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] GET /api/admin/test-connection`);
    
    const results = {
        timestamp,
        bol: { status: 'unknown', message: '' },
        ai: { status: 'unknown', message: '' }
    };
    
    // Test Bol.com API
    if (!isBolConfigured) {
        results.bol = { 
            status: 'not_configured', 
            message: 'Bol.com API credentials niet geconfigureerd. Stel BOL_CLIENT_ID, BOL_CLIENT_SECRET en BOL_SITE_ID in.',
            details: {
                hasClientId: !!BOL_CLIENT_ID,
                hasClientSecret: !!BOL_CLIENT_SECRET,
                hasSiteId: !!SITE_ID
            }
        };
    } else {
        try {
            const token = await withRetry(
                () => getBolToken(),
                'Bol.com token request'
            );
            results.bol = { 
                status: 'connected', 
                message: 'Bol.com API verbinding succesvol',
                tokenValid: !!token
            };
        } catch (error) {
            const errorInfo = getDetailedErrorInfo(error);
            results.bol = { 
                status: 'error', 
                message: extractErrorMessage(error, 'Kon geen verbinding maken met Bol.com API'),
                details: {
                    code: errorInfo.code,
                    status: errorInfo.status,
                    isTimeout: errorInfo.isTimeout
                },
                troubleshooting: [
                    'Controleer of BOL_CLIENT_ID en BOL_CLIENT_SECRET correct zijn',
                    'Controleer of je API credentials nog geldig zijn in het Bol.com Partner Platform',
                    'Probeer nieuwe API credentials aan te maken als het probleem aanhoudt'
                ]
            };
        }
    }
    
    // Test AI API
    if (!AIML_API_KEY) {
        results.ai = { 
            status: 'not_configured', 
            message: 'AI API key niet geconfigureerd. Stel VITE_API_KEY in.'
        };
    } else {
        results.ai = { 
            status: 'configured', 
            message: 'AI API key is geconfigureerd',
            note: 'AI verbinding wordt pas getest bij eerste gebruik'
        };
    }
    
    // Overall status
    const allConnected = results.bol.status === 'connected' && results.ai.status !== 'not_configured';
    
    res.json({
        success: allConnected,
        message: allConnected ? 'Alle API verbindingen werken' : 'Sommige API verbindingen hebben problemen',
        ...results
    });
});

// --- AI HELPER FUNCTIONS ---
const extractJson = (text) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
        return text.substring(start, end + 1);
    }
    return text;
};

const PRODUCT_JSON_TEMPLATE = `
{
    "brand": "string",
    "model": "string",
    "price": number,
    "score": number (0-10, 1 decimaal),
    "category": "string (kies uit: televisies, audio, laptops, smartphones, wasmachines, stofzuigers, smarthome, matrassen, airfryers, koffie, keuken, verzorging)",
    "specs": { "SpecNaam": "Waarde" },
    "pros": ["punt 1", "punt 2", "punt 3", "punt 4", "punt 5"],
    "cons": ["punt 1", "punt 2", "punt 3"],
    "description": "Korte wervende samenvatting (2-3 zinnen, 150-180 karakters)",
    "metaDescription": "SEO meta description (exact 155-160 karakters, gebruik merk + model + belangrijkste USP + koopargument)",
    "keywords": ["keyword1", "keyword2", "long-tail keyword 1", "long-tail keyword 2", "long-tail keyword 3"],
    "longDescription": "Uitgebreide introductie over het product (500+ woorden). Beschrijf design, features, voor wie het is, gebruik cases. SEO-rijk maar natuurlijk.",
    "expertOpinion": "Onze deskundige mening over de prestaties en waarde (300+ woorden).",
    "userReviewsSummary": "Volledig HERSCHREVEN samenvatting van gebruikerservaringen. Verwerk ratings en sentimenten in unieke content (250+ woorden). Noem specifieke ervaringen.",
    "scoreBreakdown": { "design": 0, "usability": 0, "performance": 0, "value": 0 },
    "suitability": { "goodFor": ["situatie 1", "situatie 2"], "badFor": ["situatie 1"] },
    "faq": [
        { "question": "Vraag 1", "answer": "Uitgebreid antwoord" },
        { "question": "Vraag 2", "answer": "Uitgebreid antwoord" },
        { "question": "Vraag 3", "answer": "Uitgebreid antwoord" }
    ],
    "predicate": "test" | "buy" | null
}
`;

async function generateAIProductReview(bolData) {
    if (!openai) {
        throw new Error('AI API niet geconfigureerd');
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AI] Starting product review generation for: ${bolData.title?.substring(0, 50)}...`);

    try {
        // Include Bol reviews in the prompt if available
        const reviewText = bolData.bolReviews 
            ? `\nBol.com Reviews (${bolData.bolReviews.totalReviews} reviews, gemiddeld ${bolData.bolReviews.averageRating}/5):\n${JSON.stringify(bolData.bolReviews.distribution)}`
            : '';
        
        const rawText = `Titel: ${bolData.title}\nPrijs: ${bolData.price}\nBeschrijving: ${bolData.rawDescription}\nSpecs: ${JSON.stringify(bolData.specs)}${reviewText}`;
        
        const completion = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: `Je bent een expert product reviewer voor ProductPraat.nl. 
                    Schrijf een eerlijke, SEO-geoptimaliseerde review in het Nederlands.
                    Context: Het is 2026.
                    
                    VERPLICHTE VEREISTEN:
                    - Genereer EXACT 3-5 voordelen (pros) gebaseerd op specs en reviews - wees specifiek en concreet
                    - Genereer EXACT 2-3 nadelen (cons) - wees kritisch en eerlijk, noem echte beperkingen
                    - metaDescription: EXACT 155-160 karakters, bevat het merk, model, belangrijkste specs en koopargument
                    - keywords: Genereer 5-8 relevante zoekwoorden inclusief long-tail keywords
                    - Gebruik Bol.com reviews als basis maar herschrijf ze VOLLEDIG uniek
                    - userReviewsSummary MOET gebaseerd zijn op echte reviews maar volledig herschreven
                    
                    SEO TIPS:
                    - Gebruik het merk en model in de description en metaDescription
                    - Voeg lange, informatieve beschrijvingen toe
                    - Genereer relevante long-tail keywords (bijv. "beste wasmachine grote gezinnen 2026")
                    
                    BELANGRIJK: Je output MOET valide JSON zijn. Geen markdown, geen introductie. Alleen JSON.
                    Structuur:
                    ${PRODUCT_JSON_TEMPLATE}`
                },
                {
                    role: "user",
                    content: `Genereer SEO-geoptimaliseerde review data voor:\n${rawText}`
                }
            ],
            max_tokens: 4000,
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("Geen data ontvangen van AI");
        
        const cleanJson = extractJson(content);
        const result = JSON.parse(cleanJson);
        
        // Ensure minimum pros and cons
        if (!result.pros || result.pros.length < 3) {
            console.warn(`[${timestamp}] [AI] Warning: Insufficient pros (${result.pros?.length || 0}), padding with defaults`);
            result.pros = result.pros || [];
            while (result.pros.length < 3) {
                result.pros.push('Goede prijs-kwaliteitverhouding');
            }
        }
        if (!result.cons || result.cons.length < 2) {
            console.warn(`[${timestamp}] [AI] Warning: Insufficient cons (${result.cons?.length || 0}), padding with defaults`);
            result.cons = result.cons || [];
            while (result.cons.length < 2) {
                result.cons.push('Prijs kan hoog zijn voor sommige gebruikers');
            }
        }
        
        // Ensure keywords exist
        if (!result.keywords || result.keywords.length < 5) {
            result.keywords = result.keywords || [];
            const brand = result.brand || 'product';
            const model = result.model || '';
            const category = result.category || 'elektronica';
            if (result.keywords.length < 5) {
                const defaultKeywords = [
                    `${brand} ${model} review`,
                    `${brand} ${model} kopen`,
                    `beste ${category} 2026`,
                    `${brand} ${model} test`,
                    `${category} vergelijken`
                ];
                result.keywords = [...result.keywords, ...defaultKeywords].slice(0, 8);
            }
        }
        
        console.log(`[${timestamp}] [AI] Product review generated successfully for: ${result.brand} ${result.model}`);
        return result;
    } catch (error) {
        console.error(`[${timestamp}] [AI] Error generating product review:`, error.message);
        throw error;
    }
}

async function generateAIArticle(type, topic, category) {
    if (!openai) {
        throw new Error('AI API niet geconfigureerd');
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AI] Starting article generation: ${type} - ${topic}`);

    let content;
    try {
        const typeInstruction = {
            'comparison': `Vergelijk 2-3 producten. Gebruik <h1> voor titel, <h2> voor productnames, <h3> voor secties (specs, prijs, conclusie). Voeg een HTML <table class="w-full text-left border-collapse border border-slate-700 mb-6"><thead class="bg-slate-800"><tr><th class="border border-slate-700 px-4 py-2">Feature</th><th class="border border-slate-700 px-4 py-2">Product A</th><th class="border border-slate-700 px-4 py-2">Product B</th></tr></thead><tbody>...</tbody></table> toe voor specs. Gebruik <blockquote> voor expert quotes. Voeg 2-3 inline afbeeldingen toe met <figure> tags.`,
            
            'list': `Maak een Top 5/Top 10 lijst. Gebruik <h1> voor hoofdtitel, <h2> voor elk product (#1, #2, etc), <h3> voor subsecties (Voordelen, Nadelen, Specs). Gebruik <ul> voor pluspunten en <ol> voor genummerde features. Voeg <blockquote> toe met expert mening per product. Voeg per product een inline afbeelding toe.`,
            
            'guide': `Schrijf een 'Ultieme Koopgids' (1500+ woorden). Gebruik <h1> voor hoofdtitel, <h2> voor hoofdsecties (Inleiding, Waar op letten, Top Features, Kooptips, FAQ, Conclusie), <h3> voor subsecties. Gebruik zowel <ul> als <ol> lijsten. Voeg minimaal 1 vergelijkingstabel toe. Gebruik <blockquote> voor expert tips. Voeg 3-4 relevante inline afbeeldingen toe.`,
            
            'informational': `Schrijf een informatief artikel (800-1200 woorden). Gebruik <h1> voor hoofdtitel, <h2> voor hoofdsecties (minimaal 4), <h3> voor subsecties (minimaal 2 per h2). Gebruik <ul> en <ol> lijsten. Voeg indien relevant een tabel toe. Gebruik <blockquote> voor belangrijke inzichten. Voeg 2-3 relevante inline afbeeldingen toe.`
        }[type] || '';

        const completion = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: `Je bent de hoofdredacteur van ProductPraat.nl.
Schrijf een uitgebreid, professioneel artikel in perfect Nederlands.

KRITISCH VOOR JSON: Gebruik in HTML ALLEEN enkele quotes (') voor attributen, NOOIT dubbele quotes (")
Voorbeelden:
- Correct: <p class='mb-4'>Tekst</p>
- Correct: <blockquote class='border-l-4 border-blue-500 pl-4 italic'>Quote</blockquote>
- Fout: <p class="mb-4">Tekst</p>

VERPLICHTE HTML STRUCTUUR:
- Begin met <h1> voor de hoofdtitel
- Gebruik <h2> voor hoofdsecties (minimaal 4-5)
- Gebruik <h3> voor subsecties (minimaal 2-3 per hoofdsectie)
- Gebruik <p class='mb-4'> voor paragrafen
- Gebruik <strong> voor belangrijke termen
- Gebruik <ul> en <ol> lijsten met <li> items
- Gebruik <blockquote class='border-l-4 border-blue-500 pl-4 italic text-slate-300 my-6'> voor quotes/tips
- Gebruik tabellen: <table class='w-full border-collapse border border-slate-700 mb-6'><thead class='bg-slate-800'><tr><th class='border border-slate-700 px-4 py-2'>Header</th></tr></thead><tbody><tr><td class='border border-slate-700 px-4 py-2'>Data</td></tr></tbody></table>

VERPLICHT: INLINE AFBEELDINGEN (2-3 per artikel)
<figure class='my-6'><img src='https://placehold.co/800x400/1e293b/64748b?text=Beschrijving' alt='Alt text' class='w-full rounded-lg shadow-lg'><figcaption class='text-sm text-slate-400 mt-2 text-center'>Onderschrift</figcaption></figure>

STIJL:
- Professioneel Nederlands
- Concrete voorbeelden
- Minimum 800 woorden voor informational, 1500+ voor guide

GEEN markdown blokken (zoals \`\`\`html), alleen raw HTML in JSON.

Output JSON (PURE JSON, geen markdown):
{
    "title": "Pakkende Titel",
    "summary": "Korte samenvatting 30-40 woorden",
    "htmlContent": "<h1>Titel</h1><p class='mb-4'>Tekst...</p>",
    "imageUrl": "https://placehold.co/1200x630/1e293b/ffffff?text=Hero"
}`
                },
                {
                    role: "user",
                    content: `Onderwerp: ${topic}\nType: ${type}\nCategorie: ${category}\n${typeInstruction}`
                }
            ],
            max_tokens: 8000
        });

        content = completion.choices[0].message.content || "{}";
        const cleanJson = extractJson(content);
        const data = JSON.parse(cleanJson);
        
        if (!data.imageUrl) {
            data.imageUrl = `https://placehold.co/1200x630/1e293b/ffffff?text=${encodeURIComponent(topic.substring(0, 20))}`;
        }

        console.log(`[${timestamp}] [AI] Article generated successfully: ${data.title}`);
        return data;
    } catch (error) {
        console.error(`[${timestamp}] [AI] Error generating article:`, error.message);
        // Log first 1000 chars for debugging
        if (content) {
            console.error(`[${timestamp}] [AI] Response preview:`, content.substring(0, 1000));
        }
        throw error;
    }
}

// --- ADMIN API ROUTES ---

// 1. Generate AI Product Review
app.post('/api/admin/product/generate', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/product/generate`);
    
    try {
        const { bolData } = req.body;
        
        if (!bolData || !bolData.title) {
            return res.status(400).json({ error: 'Bol data is verplicht' });
        }
        
        const aiResult = await generateAIProductReview(bolData);
        res.json(aiResult);
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Product generate error:`, error.message);
        res.status(500).json({ error: error.message || 'AI generatie mislukt' });
    }
});

// 2. Generate AI Article
app.post('/api/admin/article/generate', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/article/generate`);
    
    try {
        const { type, topic, category } = req.body;
        
        if (!type || !topic || !category) {
            return res.status(400).json({ error: 'Type, topic en category zijn verplicht' });
        }

        const article = await generateAIArticle(type, topic, category);
        res.json(article);
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Article generate error:`, error.message);
        res.status(500).json({ error: error.message || 'Artikel generatie mislukt' });
    }
});

// 3. Bulk Search and Add Products (by Category)
app.post('/api/admin/bulk/search-and-add', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/bulk/search-and-add`);
    
    try {
        const { category, limit = 5, categoryId } = req.body;
        
        if (!category) {
            return res.status(400).json({ error: 'Category is verplicht' });
        }

        // Check if Bol.com API is configured
        if (!isBolConfigured) {
            console.error(`[${timestamp}] [ADMIN] Bol.com API not configured`);
            return res.status(503).json({ 
                error: 'Bol.com API niet geconfigureerd. Stel BOL_CLIENT_ID, BOL_CLIENT_SECRET en BOL_SITE_ID in.' 
            });
        }

        // Step 1: Search Bol.com for products using the correct endpoint
        const token = await getBolToken();
        
        const searchParams = { 
            'search-term': category,
            'country-code': 'NL',
            'include-image': true,
            'include-offer': true,
            'include-specifications': true
        };
        
        // Add category ID filter if provided
        if (categoryId) {
            searchParams['category-id'] = categoryId;
        }
        
        console.log(`[${timestamp}] [ADMIN] Searching Bol.com for: "${category}"${categoryId ? ` (category: ${categoryId})` : ''}`);
        
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: searchParams,
            headers: getBolHeaders(token)
        });

        const results = searchResponse.data.results || [];
        console.log(`[${timestamp}] [ADMIN] Bulk search found ${results.length} products for: ${category}`);

        const candidates = [];
        const productsToProcess = results.slice(0, Math.min(limit, results.length));

        for (const product of productsToProcess) {
            try {
                let imageUrl = product.image?.url || PLACEHOLDER_IMG;
                if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:');

                // Fetch all images from media endpoint
                const { images, mainImage } = await fetchBolImages(product.ean, token, imageUrl);
                imageUrl = mainImage;
                
                // Fetch ratings/reviews from Bol.com
                const bolReviews = await fetchBolRatings(product.ean, token);

                // Generate proper affiliate URL
                let productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${product.ean}/`;
                productUrl = cleanBolUrl(productUrl); // Strip tracking params!
                const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;
                console.log(`[${timestamp}] [ADMIN] Generated affiliate URL for ${product.ean}: ${affiliateUrl}`);

                const specs = {};
                if (product.specificationGroups) {
                    product.specificationGroups.forEach(g => {
                        g.specifications?.forEach(s => { specs[s.name] = s.value; });
                    });
                }

                const bolData = {
                    title: product.title,
                    price: extractPrice(product.offer),
                    image: imageUrl,
                    images,
                    ean: product.ean,
                    url: affiliateUrl,
                    rawDescription: product.shortDescription || product.description || "",
                    specs,
                    bolReviews
                };

                // Generate AI content for each product
                console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
                const aiData = await generateAIProductReview(bolData);
                
                // Generate SEO-friendly slug
                const slug = generateSlug(aiData.brand, aiData.model);

                candidates.push({ 
                    bolData: { ...bolData, slug }, 
                    aiData: { 
                        ...aiData, 
                        slug, 
                        images,
                        bolReviewsRaw: bolReviews 
                    } 
                });

                // Rate limiting - wait 2 seconds between AI calls
                await new Promise(r => setTimeout(r, AI_RATE_LIMIT_DELAY_MS));
            } catch (productError) {
                console.error(`[${timestamp}] [ADMIN] Error processing product ${product.ean}:`, productError.message);
            }
        }

        console.log(`[${timestamp}] [ADMIN] Bulk search completed: ${candidates.length} products processed`);
        res.json(candidates);
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Bulk search error:`, error.message);
        res.status(500).json({ error: error.message || 'Bulk import mislukt' });
    }
});

// 3b. Bulk Search and Add Products with Streaming Progress (SSE)
app.get('/api/admin/bulk/search-stream', async (req, res) => {
    const timestamp = new Date().toISOString();
    const { category, limit = 5, categoryId } = req.query;
    
    console.log(`[${timestamp}] [ADMIN] GET /api/admin/bulk/search-stream - category: ${category}`);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type, data) => {
        res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        if (!category) {
            sendEvent('error', { message: 'Category is verplicht' });
            res.end();
            return;
        }

        // Check if Bol.com API is configured
        if (!isBolConfigured) {
            console.error(`[${timestamp}] [ADMIN] Bol.com API not configured`);
            sendEvent('error', { message: 'Bol.com API niet geconfigureerd. Stel BOL_CLIENT_ID, BOL_CLIENT_SECRET en BOL_SITE_ID in.' });
            res.end();
            return;
        }

        // Step 1: Search Bol.com for products
        sendEvent('status', { phase: 'searching', message: `Producten zoeken voor: ${category}...` });
        
        const token = await getBolToken();
        
        const searchParams = { 
            'search-term': category,
            'country-code': 'NL',
            'include-image': true,
            'include-offer': true,
            'include-specifications': true
        };
        
        if (categoryId) {
            searchParams['category-id'] = categoryId;
        }
        
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: searchParams,
            headers: getBolHeaders(token)
        });

        const results = searchResponse.data.results || [];
        const productsToProcess = results.slice(0, Math.min(Number(limit), results.length));
        const total = productsToProcess.length;
        
        sendEvent('init', { total, message: `${total} producten gevonden` });

        const candidates = [];

        for (const [index, product] of productsToProcess.entries()) {
            try {
                // Send progress update
                sendEvent('progress', { 
                    current: index + 1, 
                    total, 
                    percentage: Math.round(((index + 1) / total) * 100),
                    message: `Verwerken: ${product.title.substring(0, 40)}...`,
                    productTitle: product.title
                });

                let imageUrl = product.image?.url || PLACEHOLDER_IMG;
                if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:');

                // Fetch all images from media endpoint
                const { images, mainImage } = await fetchBolImages(product.ean, token, imageUrl);
                imageUrl = mainImage;
                
                // Fetch ratings/reviews from Bol.com
                const bolReviews = await fetchBolRatings(product.ean, token);

                // Generate proper affiliate URL
                let productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${product.ean}/`;
                productUrl = cleanBolUrl(productUrl);
                const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

                const specs = {};
                if (product.specificationGroups) {
                    product.specificationGroups.forEach(g => {
                        g.specifications?.forEach(s => { specs[s.name] = s.value; });
                    });
                }

                const bolData = {
                    title: product.title,
                    price: extractPrice(product.offer),
                    image: imageUrl,
                    images,
                    ean: product.ean,
                    url: affiliateUrl,
                    rawDescription: product.shortDescription || product.description || "",
                    specs,
                    bolReviews
                };

                // Generate AI content
                console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
                const aiData = await generateAIProductReview(bolData);
                
                const slug = generateSlug(aiData.brand, aiData.model);

                const candidate = { 
                    bolData: { ...bolData, slug }, 
                    aiData: { 
                        ...aiData, 
                        slug, 
                        images,
                        bolReviewsRaw: bolReviews 
                    } 
                };

                candidates.push(candidate);
                
                // Send product completion event
                sendEvent('product', { 
                    index, 
                    candidate, 
                    message: `✅ ${aiData.brand} ${aiData.model} verwerkt`
                });

                // Rate limiting
                await new Promise(r => setTimeout(r, AI_RATE_LIMIT_DELAY_MS));
            } catch (productError) {
                console.error(`[${timestamp}] [ADMIN] Error processing product ${product.ean}:`, productError.message);
                sendEvent('product_error', { 
                    index, 
                    ean: product.ean, 
                    message: `❌ Fout: ${productError.message}` 
                });
            }
        }

        // Send completion event
        sendEvent('complete', { 
            total: candidates.length, 
            message: `Import voltooid: ${candidates.length} producten verwerkt` 
        });
        
        res.end();
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Bulk stream error:`, error.message);
        sendEvent('error', { message: error.message || 'Bulk import mislukt' });
        res.end();
    }
});

// 4. Import Single Product from URL
app.post('/api/admin/import/url', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/import/url`);
    
    try {
        const { url } = req.body;
        
        // Input validation
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is verplicht',
                code: 'MISSING_URL',
                troubleshooting: ['Voer een geldige Bol.com URL of EAN code in']
            });
        }

        // Validate URL format if it looks like a URL
        if (url.startsWith('http')) {
            try {
                const parsedUrl = new URL(url);
                // Strictly check that the hostname ends with bol.com or is bol.com
                // This prevents bypasses like evil.com/bol.com or bol.com.evil.com
                const hostname = parsedUrl.hostname.toLowerCase();
                const isValidBolDomain = hostname === 'bol.com' || 
                                         hostname === 'www.bol.com' ||
                                         hostname.endsWith('.bol.com');
                
                if (!isValidBolDomain) {
                    return res.status(400).json({ 
                        error: 'Alleen Bol.com URLs worden ondersteund',
                        code: 'INVALID_URL',
                        troubleshooting: [
                            'Gebruik een URL van bol.com (bijv. https://www.bol.com/nl/p/...)',
                            'Of voer direct een EAN code (13 cijfers) in'
                        ]
                    });
                }
            } catch (urlParseError) {
                return res.status(400).json({ 
                    error: 'Ongeldige URL formaat',
                    code: 'INVALID_URL_FORMAT',
                    troubleshooting: [
                        'Controleer of de URL correct is gekopieerd',
                        'Of voer direct een EAN code (13 cijfers) in'
                    ]
                });
            }
        }

        // Check if Bol.com API is configured
        if (!isBolConfigured) {
            console.error(`[${timestamp}] [ADMIN] Bol.com API not configured`);
            return res.status(503).json({ 
                error: 'Bol.com API niet geconfigureerd',
                code: 'API_NOT_CONFIGURED',
                troubleshooting: [
                    'Stel BOL_CLIENT_ID in',
                    'Stel BOL_CLIENT_SECRET in',
                    'Stel BOL_SITE_ID in',
                    'Herstart de server na het instellen'
                ]
            });
        }

        // Step 1: Get token with retry logic
        console.log(`[${timestamp}] [ADMIN] Requesting Bol.com token...`);
        let token;
        try {
            token = await withRetry(
                () => getBolToken(),
                'Bol.com authentication'
            );
        } catch (authError) {
            const errorInfo = getDetailedErrorInfo(authError);
            console.error(`[${timestamp}] [ADMIN] Authentication failed:`, errorInfo);
            return res.status(401).json({
                error: 'Authenticatie bij Bol.com mislukt',
                code: 'AUTH_FAILED',
                details: errorInfo.isTimeout ? 'Timeout bij verbinden' : errorInfo.message,
                troubleshooting: [
                    'Controleer of je API credentials correct zijn',
                    'Controleer of je credentials nog geldig zijn in het Bol.com Partner Platform',
                    'Probeer opnieuw na een paar minuten'
                ]
            });
        }
        
        // Extract EAN from URL if present
        let searchTerm = url;
        const matches = url.match(/(\d{13})|(\d{10,})/);
        if (matches) searchTerm = matches[0];
        
        console.log(`[${timestamp}] [ADMIN] Searching for product: "${searchTerm}"`);

        // Step 2: Search for product with retry logic and timeout
        let searchResponse;
        try {
            searchResponse = await withRetry(async () => {
                return await axiosWithTimeout.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
                    params: { 
                        'search-term': searchTerm,
                        'country-code': 'NL',
                        'include-image': true,
                        'include-offer': true,
                        'include-specifications': true
                    },
                    headers: getBolHeaders(token)
                });
            }, 'Bol.com product search');
        } catch (searchError) {
            const errorInfo = getDetailedErrorInfo(searchError);
            console.error(`[${timestamp}] [ADMIN] Search failed:`, errorInfo);
            
            // Check for specific error types
            if (errorInfo.isTimeout) {
                return res.status(504).json({
                    error: 'Bol.com API timeout - probeer het opnieuw',
                    code: 'TIMEOUT',
                    troubleshooting: [
                        'De Bol.com API reageert traag',
                        'Probeer het over een paar seconden opnieuw',
                        'Controleer je internetverbinding'
                    ]
                });
            }
            
            if (errorInfo.status === 401) {
                // Token might be expired, clear it
                cachedToken = null;
                tokenExpiry = 0;
                return res.status(401).json({
                    error: 'Bol.com sessie verlopen - probeer opnieuw',
                    code: 'TOKEN_EXPIRED',
                    troubleshooting: ['Probeer het opnieuw - de sessie wordt automatisch vernieuwd']
                });
            }
            
            if (errorInfo.status === 429) {
                return res.status(429).json({
                    error: 'Te veel verzoeken - wacht even en probeer opnieuw',
                    code: 'RATE_LIMITED',
                    troubleshooting: [
                        'Wacht 30 seconden voor je opnieuw probeert',
                        'Verminder het aantal gelijktijdige imports'
                    ]
                });
            }
            
            throw searchError;
        }

        const results = searchResponse.data.results;
        if (!results || results.length === 0) {
            console.log(`[${timestamp}] [ADMIN] No product found for: "${searchTerm}"`);
            return res.status(404).json({ 
                error: 'Geen product gevonden',
                code: 'PRODUCT_NOT_FOUND',
                searchTerm,
                troubleshooting: [
                    'Controleer of de URL/EAN correct is',
                    'Probeer te zoeken met alleen de EAN code (13 cijfers)',
                    'Het product is mogelijk niet beschikbaar via de Bol.com API'
                ]
            });
        }

        const product = results[0];
        const ean = product.ean;
        console.log(`[${timestamp}] [ADMIN] Found product: ${product.title} (EAN: ${ean})`);

        // Fetch all images from media endpoint
        let imageUrl = product.image?.url || PLACEHOLDER_IMG;
        const { images, mainImage } = await fetchBolImages(ean, token, imageUrl);
        imageUrl = mainImage;
        
        // Fetch ratings/reviews from Bol.com
        const bolReviews = await fetchBolRatings(ean, token);
        if (bolReviews) {
            console.log(`[${timestamp}] [ADMIN] Fetched ${bolReviews.totalReviews} reviews for product ${ean}`);
        }

        // Generate proper affiliate URL
        let productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${ean}/`;
        productUrl = cleanBolUrl(productUrl); // Strip tracking params!
        const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;
        console.log(`[${timestamp}] [ADMIN] Generated affiliate URL: ${affiliateUrl}`);

        const specs = {};
        if (product.specificationGroups) {
            product.specificationGroups.forEach(g => {
                g.specifications?.forEach(s => { specs[s.name] = s.value; });
            });
        }

        const bolData = {
            title: product.title,
            price: extractPrice(product.offer),
            image: imageUrl,
            images,
            ean,
            url: affiliateUrl,
            rawDescription: product.shortDescription || product.description || "",
            specs,
            bolReviews
        };

        // Step 3: Generate AI content with error handling
        console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
        let aiData;
        try {
            aiData = await generateAIProductReview(bolData);
        } catch (aiError) {
            console.error(`[${timestamp}] [ADMIN] AI generation failed:`, aiError.message);
            return res.status(500).json({
                error: 'AI content generatie mislukt',
                code: 'AI_GENERATION_FAILED',
                details: aiError.message,
                troubleshooting: [
                    'De AI service is mogelijk tijdelijk niet beschikbaar',
                    'Probeer het opnieuw na een paar seconden',
                    'Controleer of de VITE_API_KEY correct is ingesteld'
                ],
                // Return partial data so user can still see what was fetched
                partialData: { bolData }
            });
        }
        
        // Generate SEO-friendly slug
        const slug = generateSlug(aiData.brand, aiData.model);

        console.log(`[${timestamp}] [ADMIN] Import completed: ${aiData.brand} ${aiData.model} - Slug: ${slug}`);
        res.json({ 
            bolData: { ...bolData, slug }, 
            aiData: { 
                ...aiData, 
                slug,
                images,
                bolReviewsRaw: bolReviews 
            } 
        });
    } catch (error) {
        const errorInfo = getDetailedErrorInfo(error);
        console.error(`[${timestamp}] [ADMIN] Import URL error:`, errorInfo);
        
        // Only include sanitized debug info in development mode
        // Never expose raw error objects or stack traces to client
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        res.status(500).json({ 
            error: extractErrorMessage(error, 'Product import mislukt'),
            code: 'IMPORT_FAILED',
            // Only expose safe, non-sensitive debug info
            ...(isDevelopment && { 
                debug: { 
                    errorCode: errorInfo.code,
                    isTimeout: errorInfo.isTimeout,
                    status: errorInfo.status
                } 
            }),
            troubleshooting: [
                'Controleer of de URL geldig is',
                'Probeer het opnieuw na een paar seconden',
                'Controleer de API verbinding via "Test Verbinding"'
            ]
        });
    }
});

// 5. Import Products by App Category
app.post('/api/admin/import/by-category', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/import/by-category`);
    
    try {
        const { category, limit = 5 } = req.body;
        
        if (!category) {
            return res.status(400).json({ error: 'Category is verplicht' });
        }

        // Check if Bol.com API is configured
        if (!isBolConfigured) {
            console.error(`[${timestamp}] [ADMIN] Bol.com API not configured`);
            return res.status(503).json({ 
                error: 'Bol.com API niet geconfigureerd. Stel BOL_CLIENT_ID, BOL_CLIENT_SECRET en BOL_SITE_ID in.' 
            });
        }
        
        // Get the optimized search term for this category
        const searchTerm = CATEGORY_SEARCH_TERMS[category] || category;
        console.log(`[${timestamp}] [ADMIN] Importing from category: "${category}" using search: "${searchTerm}"`);

        // Search Bol.com for products
        const token = await getBolToken();
        
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': searchTerm,
                'country-code': 'NL',
                'include-image': true,
                'include-offer': true,
                'include-specifications': true
            },
            headers: getBolHeaders(token)
        });

        const results = searchResponse.data.results || [];
        console.log(`[${timestamp}] [ADMIN] Found ${results.length} products for category: ${category}`);
        
        if (results.length === 0) {
            return res.json({ products: [], message: 'Geen producten gevonden' });
        }

        const candidates = [];
        const productsToProcess = results.slice(0, Math.min(limit, results.length));

        for (const product of productsToProcess) {
            try {
                let imageUrl = product.image?.url || PLACEHOLDER_IMG;
                if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:');

                // Fetch all images from media endpoint
                const { images, mainImage } = await fetchBolImages(product.ean, token, imageUrl);
                imageUrl = mainImage;
                
                // Fetch ratings/reviews from Bol.com
                const bolReviews = await fetchBolRatings(product.ean, token);

                // Generate proper affiliate URL
                let productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/nl/p/${product.ean}/`;
                productUrl = cleanBolUrl(productUrl); // Strip tracking params!
                const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;
                console.log(`[${timestamp}] [ADMIN] Generated affiliate URL for ${product.ean}: ${affiliateUrl}`);

                const specs = {};
                if (product.specificationGroups) {
                    product.specificationGroups.forEach(g => {
                        g.specifications?.forEach(s => { specs[s.name] = s.value; });
                    });
                }

                const bolData = {
                    title: product.title,
                    price: extractPrice(product.offer),
                    image: imageUrl,
                    images,
                    ean: product.ean,
                    url: affiliateUrl,
                    rawDescription: product.shortDescription || product.description || "",
                    specs,
                    bolReviews
                };

                // Generate AI content for each product
                console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
                const aiData = await generateAIProductReview(bolData);
                
                // Override category to match our app category
                aiData.category = category;
                
                // Generate SEO-friendly slug
                const slug = generateSlug(aiData.brand, aiData.model);

                candidates.push({ 
                    bolData: { ...bolData, slug }, 
                    aiData: { 
                        ...aiData, 
                        slug,
                        images,
                        bolReviewsRaw: bolReviews 
                    } 
                });

                // Rate limiting - wait 2 seconds between AI calls
                await new Promise(r => setTimeout(r, AI_RATE_LIMIT_DELAY_MS));
            } catch (productError) {
                console.error(`[${timestamp}] [ADMIN] Error processing product ${product.ean}:`, productError.message);
            }
        }

        console.log(`[${timestamp}] [ADMIN] Category import completed: ${candidates.length} products processed`);
        res.json({ products: candidates, category, count: candidates.length });
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Category import error:`, error.response?.data || error.message);
        res.status(500).json({ error: error.message || 'Category import mislukt' });
    }
});

// 6. Get available categories for import
app.get('/api/admin/categories', (req, res) => {
    res.json({
        categories: Object.keys(CATEGORY_SEARCH_TERMS).map(key => ({
            id: key,
            name: key.charAt(0).toUpperCase() + key.slice(1),
            searchTerm: CATEGORY_SEARCH_TERMS[key]
        }))
    });
});

// 7. Sync prices for products (called from admin panel)
app.post('/api/admin/sync-prices', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/sync-prices`);
    
    try {
        const token = await getBolToken();
        const { productIds, products } = req.body; // Array of product IDs or full products to sync
        
        if (!productIds && !products) {
            return res.status(400).json({ error: 'productIds of products is verplicht' });
        }

        const updates = [];
        const productsToSync = products || [];
        
        for (const product of productsToSync) {
            if (!product || !product.ean) continue;
            
            try {
                console.log(`[${timestamp}] [SYNC] Fetching price for EAN: ${product.ean}`);
                
                const offerResponse = await axios.get(
                    `https://api.bol.com/marketing/catalog/v1/products/${product.ean}/offers/best`,
                    {
                        params: { 'country-code': 'NL' },
                        headers: getBolHeaders(token)
                    }
                );
                
                const newPrice = offerResponse.data.price;
                if (newPrice && newPrice !== product.price) {
                    updates.push({ 
                        id: product.id, 
                        ean: product.ean,
                        oldPrice: product.price, 
                        newPrice,
                        brand: product.brand,
                        model: product.model
                    });
                    console.log(`[${timestamp}] [SYNC] Price updated for ${product.brand} ${product.model}: €${product.price} -> €${newPrice}`);
                } else {
                    console.log(`[${timestamp}] [SYNC] Price unchanged for ${product.brand} ${product.model}: €${product.price}`);
                }
            } catch (error) {
                console.error(`[${timestamp}] [SYNC] Error syncing price for ${product.id}:`, error.message);
            }
            
            // Small delay to prevent rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
        
        console.log(`[${timestamp}] [SYNC] Price sync completed: ${updates.length} prices updated`);
        res.json({ success: true, updates, totalChecked: productsToSync.length });
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Sync prices error:`, error.response?.data || error.message);
        res.status(500).json({ error: error.message || 'Price sync mislukt' });
    }
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
  console.log(`ProductPraat Server running on port ${port} (v2.0.0)`);
});
