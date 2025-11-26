
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
} else {
    console.log('[BOL] Bol.com Marketing API configured successfully');
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
        const errorMsg = error.response?.data?.error_description || error.message || "Authenticatie fout";
        throw new Error(`Kon niet inloggen bij Bol.com: ${errorMsg}`);
    }
}

// --- HELPER: Standard headers for Bol.com Marketing API ---
const getBolHeaders = (token) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Accept-Language': 'nl'
});

// --- HELPER: Generate SEO-friendly slug ---
const generateSlug = (brand, model) => {
    const text = `${brand} ${model}`.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')          // Replace spaces with -
        .replace(/-+/g, '-')           // Replace multiple - with single -
        .trim();
    return `${text}-review`;
};

// --- HELPER: Fetch Bol.com ratings/reviews ---
const fetchBolRatings = async (ean, token) => {
    try {
        const ratingsResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/${ean}/ratings`, {
            headers: getBolHeaders(token)
        });
        const data = ratingsResponse.data;
        return {
            averageRating: data.averageRating || 0,
            totalReviews: data.ratings?.reduce((sum, r) => sum + r.count, 0) || 0,
            distribution: data.ratings || []
        };
    } catch (e) {
        console.log(`[BOL] Ratings fetch failed for ${ean}, continuing without reviews`);
        return null;
    }
};

// --- HELPER: Fetch all Bol.com images ---
const fetchBolImages = async (ean, token, defaultImage) => {
    let images = [defaultImage];
    let mainImage = defaultImage;
    
    try {
        const mediaResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/${ean}/media`, {
            headers: getBolHeaders(token)
        });
        if (mediaResponse.data.images && mediaResponse.data.images.length > 0) {
            // Get all images, prefer larger sizes
            images = mediaResponse.data.images.map(img => {
                const renditions = img.renditions || [];
                // Sort by size, get largest
                const sorted = renditions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
                return sorted[0]?.url || renditions[0]?.url || img.url;
            }).filter(Boolean).map(url => url.startsWith('http:') ? url.replace('http:', 'https:') : url);
            
            // Update main image to highest quality
            if (images.length > 0) mainImage = images[0];
            
            console.log(`[BOL] Fetched ${images.length} images for product ${ean}`);
        }
    } catch (e) {
        console.log(`[BOL] Media fetch failed for ${ean}, using default image`);
    }
    
    return { images, mainImage };
};

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
            'include': 'IMAGE,OFFER'
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
            const productUrl = p.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/p/${p.ean}/`;
            const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(p.title)}`;
            
            return {
                id: p.ean,
                ean: p.ean,
                title: p.title,
                image: img,
                url: affiliateUrl,
                rawUrl: productUrl,
                price: p.offer?.price || 0
            };
        });
        res.json({ products });
    } catch (error) {
        console.error("[BOL] Search List Error:", error.response?.data || error.message);
        res.status(200).json({ products: [], error: error.message });
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
                'include': 'IMAGE,OFFER,SPECIFICATIONS'
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

        let price = 0;
        if (product.offer?.price) price = product.offer.price;

        // Get product URL and generate affiliate link
        const productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/p/${ean}/`;
        const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

        // Extract specifications
        const specs = {};
        if (product.specificationGroups) {
            product.specificationGroups.forEach(g => {
                g.specifications?.forEach(s => { specs[s.name] = s.value; });
            });
        }

        console.log(`[BOL] Import successful: ${product.title} - €${price} - Affiliate: ${affiliateUrl.substring(0, 50)}...`);
        
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
    "pros": ["punt 1", "punt 2", "punt 3"],
    "cons": ["punt 1", "punt 2"],
    "description": "Korte wervende samenvatting (2-3 zinnen, 150-180 karakters)",
    "metaDescription": "SEO meta description (150-155 karakters, focus op waarom dit product kopen)",
    "keywords": ["keyword1", "keyword2", "long-tail keyword"],
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
                    
                    BELANGRIJK voor SEO:
                    - Gebruik Bol.com reviews als basis maar herschrijf ze VOLLEDIG uniek
                    - Voeg lange, informatieve beschrijvingen toe
                    - Genereer relevante long-tail keywords
                    - Schrijf een pakkende meta description (max 155 karakters)
                    - userReviewsSummary MOET gebaseerd zijn op echte reviews maar volledig herschreven
                    
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

    try {
        const typeInstruction = {
            'comparison': `Gebruik een HTML <table class="w-full text-left border-collapse border border-slate-700 mb-6"> voor specs. Headers met bg-slate-800.`,
            'list': `Maak een Top 5. Gebruik <h2> voor productnamen en <ul> voor pluspunten.`,
            'guide': `Schrijf een 'Ultieme Koopgids' (Long-form, 1500+ woorden). Gebruik <h2>, <h3>, <p>, <ul>.`
        }[type] || '';

        const completion = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: `Je bent de hoofdredacteur van ProductPraat.nl.
                    Schrijf een uitgebreid artikel in perfect Nederlands.
                    Gebruik HTML tags (h2, h3, p, ul, li, strong, table).
                    GEEN markdown blokken (zoals \`\`\`html), alleen de raw HTML string in de JSON.
                    
                    Output JSON:
                    {
                        "title": "Pakkende Titel",
                        "summary": "Korte samenvatting (30 woorden)",
                        "htmlContent": "De volledige HTML content...",
                        "imageUrl": ""
                    }`
                },
                {
                    role: "user",
                    content: `Onderwerp: ${topic}\nType: ${type}\nCategorie: ${category}\n${typeInstruction}`
                }
            ],
            max_tokens: 6000
        });

        const content = completion.choices[0].message.content || "{}";
        const cleanJson = extractJson(content);
        const data = JSON.parse(cleanJson);
        
        if (!data.imageUrl) {
            data.imageUrl = `https://placehold.co/800x400/1e293b/ffffff?text=${encodeURIComponent(topic.substring(0, 20))}`;
        }

        console.log(`[${timestamp}] [AI] Article generated successfully: ${data.title}`);
        return data;
    } catch (error) {
        console.error(`[${timestamp}] [AI] Error generating article:`, error.message);
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

        // Step 1: Search Bol.com for products using the correct endpoint
        const token = await getBolToken();
        
        const searchParams = { 
            'search-term': category,
            'country-code': 'NL',
            'include': 'IMAGE,OFFER,SPECIFICATIONS'
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
                const productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/p/${product.ean}/`;
                const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

                const specs = {};
                if (product.specificationGroups) {
                    product.specificationGroups.forEach(g => {
                        g.specifications?.forEach(s => { specs[s.name] = s.value; });
                    });
                }

                const bolData = {
                    title: product.title,
                    price: product.offer?.price || 0,
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

// 4. Import Single Product from URL
app.post('/api/admin/import/url', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/import/url`);
    
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is verplicht' });
        }

        // Step 1: Fetch product data from Bol.com
        const token = await getBolToken();
        
        // Extract EAN from URL if present
        let searchTerm = url;
        const matches = url.match(/(\d{13})|(\d{10,})/);
        if (matches) searchTerm = matches[0];
        
        console.log(`[${timestamp}] [ADMIN] Searching for product: "${searchTerm}"`);

        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': searchTerm,
                'country-code': 'NL',
                'include': 'IMAGE,OFFER,SPECIFICATIONS'
            },
            headers: getBolHeaders(token)
        });

        const results = searchResponse.data.results;
        if (!results || results.length === 0) {
            console.log(`[${timestamp}] [ADMIN] No product found for: "${searchTerm}"`);
            return res.status(404).json({ error: "Geen product gevonden" });
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
        const productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/p/${ean}/`;
        const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

        const specs = {};
        if (product.specificationGroups) {
            product.specificationGroups.forEach(g => {
                g.specifications?.forEach(s => { specs[s.name] = s.value; });
            });
        }

        const bolData = {
            title: product.title,
            price: product.offer?.price || 0,
            image: imageUrl,
            images,
            ean,
            url: affiliateUrl,
            rawDescription: product.shortDescription || product.description || "",
            specs,
            bolReviews
        };

        // Step 2: Generate AI content
        console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
        const aiData = await generateAIProductReview(bolData);
        
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
        console.error(`[${timestamp}] [ADMIN] Import URL error:`, error.response?.data || error.message);
        res.status(500).json({ error: error.message || 'Product import mislukt' });
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
        
        // Get the optimized search term for this category
        const searchTerm = CATEGORY_SEARCH_TERMS[category] || category;
        console.log(`[${timestamp}] [ADMIN] Importing from category: "${category}" using search: "${searchTerm}"`);

        // Search Bol.com for products
        const token = await getBolToken();
        
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': searchTerm,
                'country-code': 'NL',
                'include': 'IMAGE,OFFER,SPECIFICATIONS'
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
                const productUrl = product.urls?.find(u => u.key === 'productpage')?.value || `https://www.bol.com/nl/p/${product.ean}/`;
                const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

                const specs = {};
                if (product.specificationGroups) {
                    product.specificationGroups.forEach(g => {
                        g.specifications?.forEach(s => { specs[s.name] = s.value; });
                    });
                }

                const bolData = {
                    title: product.title,
                    price: product.offer?.price || 0,
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
