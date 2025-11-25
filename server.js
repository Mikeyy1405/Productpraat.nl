
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

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
  console.log(`ProductPraat Server running on port ${port} (v1.9.6)`);
});
