
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
const BOL_CLIENT_ID = process.env.BOL_CLIENT_ID || '4ee5165d-f9de-49c1-847b-98d269eb8e72';
const BOL_CLIENT_SECRET = process.env.BOL_CLIENT_SECRET || 'Jy?mGryYVZr@Vqwv!56NV7!n+pdCq@B8OsvKwqoO5crKpQq6kcrR?Hgwj015tTIR';
const SITE_ID = process.env.BOL_SITE_ID || '1296565'; 
const PLACEHOLDER_IMG = 'https://placehold.co/400x400/f1f5f9/94a3b8?text=Geen+Afbeelding';

// AI API Configuration (Server-side only)
const AIML_API_KEY = process.env.VITE_API_KEY || '';
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

app.use(express.json());
// We serve static files manually to intercept index.html
app.use(express.static('dist', { index: false }));

let cachedToken = null;
let tokenExpiry = 0;

// --- AUTH ---
async function getBolToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) return cachedToken;

    try {
        console.log("Fetching new Bol.com Access Token...");
        const credentials = Buffer.from(`${BOL_CLIENT_ID}:${BOL_CLIENT_SECRET}`).toString('base64');
        const response = await axios.post('https://login.bol.com/token?grant_type=client_credentials', null, {
            headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
        });
        cachedToken = response.data.access_token;
        tokenExpiry = now + (response.data.expires_in * 1000) - 60000;
        return cachedToken;
    } catch (error) {
        console.error("Bol Auth Error:", error.response?.data || error.message);
        throw new Error("Kon niet inloggen bij Bol.com");
    }
}

// --- ROUTES ---

app.post('/api/bol/search-list', async (req, res) => {
    const { term, limit } = req.body;
    try {
        const token = await getBolToken();
        const response = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': term,
                'country-code': 'NL',
                'page': 1,
                'include-image': true,
                'sort': 'POPULARITY' 
            },
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const results = response.data.results || [];
        console.log(`Search '${term}' found ${results.length} items`);

        const products = results.slice(0, limit || 5).map(p => {
            let img = p.image?.url || PLACEHOLDER_IMG;
            if (img.startsWith('http:')) img = img.replace('http:', 'https:');
            return {
                id: p.ean,
                ean: p.ean,
                title: p.title,
                image: img,
                url: p.urls?.[0]?.value || `https://www.bol.com/nl/p/${p.ean}/`
            };
        });
        res.json({ products });
    } catch (error) {
        console.error("Search List Error:", error.message);
        res.status(200).json({ products: [] });
    }
});

app.post('/api/bol/import', async (req, res) => {
    const { input } = req.body;
    try {
        const token = await getBolToken();
        
        let searchTerm = input;
        const matches = input.match(/(\d{13})|(\d{10,})/);
        if (matches) searchTerm = matches[0];

        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': searchTerm,
                'country-code': 'NL',
                'limit': 1,
                'include-image': true,
                'include-offer': true,
                'include-specifications': true
            },
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const results = searchResponse.data.results;
        if (!results || results.length === 0) return res.status(404).json({ error: "Geen product gevonden" });

        const product = results[0];
        const ean = product.ean;

        let imageUrl = product.image?.url || PLACEHOLDER_IMG;
        try {
            const mediaResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/${ean}/media`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const images = mediaResponse.data.images;
            if (images && images.length > 0) {
                const best = images.find(i => i.key === 'XXL') || images.find(i => i.key === 'XL') || images[0];
                if (best && best.url) imageUrl = best.url;
            }
        } catch (e) { /* ignore media error */ }
        
        if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:');

        let price = 0;
        if (product.offer?.price) price = product.offer.price;

        const productUrl = product.urls?.[0]?.value || `https://www.bol.com/nl/p/${ean}/`;
        const affiliateUrl = `https://partner.bol.com/click/click?p=2&t=url&s=${SITE_ID}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(product.title)}`;

        const specs = {};
        if (product.specificationGroups) {
            product.specificationGroups.forEach(g => {
                g.specifications?.forEach(s => { specs[s.name] = s.value; });
            });
        }

        res.json({
            title: product.title,
            price,
            image: imageUrl,
            ean,
            url: affiliateUrl,
            rawDescription: product.shortDescription || product.description || "",
            specs
        });

    } catch (error) {
        console.error("Import Error:", error.message);
        res.status(500).json({ error: "Fout bij Bol.com API" });
    }
});

// --- CONFIG ENDPOINT (Fallback) ---
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
    "pros": ["punt 1", "punt 2"],
    "cons": ["punt 1", "punt 2"],
    "description": "Korte wervende samenvatting (2 zinnen)",
    "longDescription": "Uitgebreide introductie over het product en voor wie het is.",
    "expertOpinion": "Onze deskundige mening over de prestaties en waarde.",
    "userReviewsSummary": "Samenvatting van wat gebruikers online zeggen.",
    "scoreBreakdown": { "design": 0, "usability": 0, "performance": 0, "value": 0 },
    "suitability": { "goodFor": ["situatie 1"], "badFor": ["situatie 2"] },
    "faq": [{ "question": "Vraag", "answer": "Antwoord" }],
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
        const rawText = `Titel: ${bolData.title}\nPrijs: ${bolData.price}\nBeschrijving: ${bolData.rawDescription}\nSpecs: ${JSON.stringify(bolData.specs)}`;
        
        const completion = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: `Je bent een expert product reviewer voor ProductPraat.nl. 
                    Schrijf een eerlijke, diepgaande review in het Nederlands.
                    Context: Het is 2026.
                    
                    BELANGRIJK: Je output MOET valide JSON zijn. Geen markdown, geen introductie. Alleen JSON.
                    Structuur:
                    ${PRODUCT_JSON_TEMPLATE}`
                },
                {
                    role: "user",
                    content: `Genereer review data voor:\n${rawText}`
                }
            ],
            max_tokens: 3000,
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

// 3. Bulk Search and Add Products
app.post('/api/admin/bulk/search-and-add', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ADMIN] POST /api/admin/bulk/search-and-add`);
    
    try {
        const { category, limit = 5 } = req.body;
        
        if (!category) {
            return res.status(400).json({ error: 'Category is verplicht' });
        }

        // Step 1: Search Bol.com for products
        const token = await getBolToken();
        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': category,
                'country-code': 'NL',
                'page': 1,
                'include-image': true,
                'include-offer': true,
                'include-specifications': true,
                'sort': 'POPULARITY'
            },
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const results = searchResponse.data.results || [];
        console.log(`[${timestamp}] [ADMIN] Bulk search found ${results.length} products for: ${category}`);

        const candidates = [];
        const productsToProcess = results.slice(0, Math.min(limit, results.length));

        for (const product of productsToProcess) {
            try {
                let imageUrl = product.image?.url || PLACEHOLDER_IMG;
                if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:');

                const productUrl = product.urls?.[0]?.value || `https://www.bol.com/nl/p/${product.ean}/`;
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
                    ean: product.ean,
                    url: affiliateUrl,
                    rawDescription: product.shortDescription || product.description || "",
                    specs
                };

                // Generate AI content for each product
                console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
                const aiData = await generateAIProductReview(bolData);

                candidates.push({ bolData, aiData });

                // Rate limiting - wait 2 seconds between AI calls
                await new Promise(r => setTimeout(r, 2000));
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
        
        let searchTerm = url;
        const matches = url.match(/(\d{13})|(\d{10,})/);
        if (matches) searchTerm = matches[0];

        const searchResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/search`, {
            params: { 
                'search-term': searchTerm,
                'country-code': 'NL',
                'limit': 1,
                'include-image': true,
                'include-offer': true,
                'include-specifications': true
            },
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const results = searchResponse.data.results;
        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Geen product gevonden" });
        }

        const product = results[0];
        const ean = product.ean;

        // Get best image
        let imageUrl = product.image?.url || PLACEHOLDER_IMG;
        try {
            const mediaResponse = await axios.get(`https://api.bol.com/marketing/catalog/v1/products/${ean}/media`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const images = mediaResponse.data.images;
            if (images && images.length > 0) {
                const best = images.find(i => i.key === 'XXL') || images.find(i => i.key === 'XL') || images[0];
                if (best && best.url) imageUrl = best.url;
            }
        } catch (e) { /* ignore media error */ }
        
        if (imageUrl.startsWith('http:')) imageUrl = imageUrl.replace('http:', 'https:');

        const productUrl = product.urls?.[0]?.value || `https://www.bol.com/nl/p/${ean}/`;
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
            ean,
            url: affiliateUrl,
            rawDescription: product.shortDescription || product.description || "",
            specs
        };

        // Step 2: Generate AI content
        console.log(`[${timestamp}] [ADMIN] Generating AI content for: ${product.title.substring(0, 40)}...`);
        const aiData = await generateAIProductReview(bolData);

        console.log(`[${timestamp}] [ADMIN] Import completed: ${aiData.brand} ${aiData.model}`);
        res.json({ bolData, aiData });
    } catch (error) {
        console.error(`[${timestamp}] [ADMIN] Import URL error:`, error.message);
        res.status(500).json({ error: error.message || 'Product import mislukt' });
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
