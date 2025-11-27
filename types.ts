export interface Product {
    id: string;
    brand: string;
    model: string;
    price: number; // Keep as number for backward compatibility
    score: number;
    category: string;
    image: string;
    specs: Record<string, string>;
    pros: string[];
    cons: string[];
    predicate?: 'test' | 'buy' | null;
    description?: string; // Short summary
    longDescription?: string; // Detailed introduction
    expertOpinion?: string; // "Onze mening"
    userReviewsSummary?: string; // "Wat anderen zeggen"
    affiliateUrl?: string; // Link to the shop
    ean?: string; // Unieke code
    scoreBreakdown?: {
        design: number;
        usability: number;
        performance: number;
        value: number;
    };
    suitability?: {
        goodFor: string[];
        badFor: string[];
    };
    faq?: {
        question: string;
        answer: string;
    }[];
    slug?: string; // SEO-friendly URL slug, e.g., "samsung-galaxy-s24-review"
    bolReviewsRaw?: {
        averageRating: number;
        totalReviews: number;
        distribution: { rating: number; count: number; }[];
    };
    images?: string[]; // Multiple images from Bol.com media endpoint
    metaDescription?: string; // SEO meta description
    keywords?: string[]; // SEO keywords
    
    // === NEW FIELDS FOR URL-BASED IMPORT ===
    title?: string; // Full product title (for URL imports)
    seoDescription?: string; // SEO-optimized description (155-160 chars)
    priceLabel?: string; // Price display label (e.g., "€299,-" or "Vanaf €249,-")
    rating?: number; // Overall rating (0-10)
    imageUrl?: string; // Primary product image URL
    galleryImages?: string[]; // Array of gallery image URLs
    affiliateLink?: string; // Affiliate/tracking link to shop
    tags?: string[]; // Product tags/keywords
    features?: string[]; // Key product features
    reviewContent?: {
        whatIsIt: string;
        forWho: string;
        keyFeatures: string;
        whatToConsider: string;
        verdict: string;
    };
    specifications?: Array<{ label: string; value: string }>; // Structured specifications
    scores?: {
        quality: number;
        priceValue: number;
        usability: number;
        design: number;
    };
    targetAudience?: string[]; // Who this product is for
    alternatives?: string[]; // Alternative products to consider
    reviewAuthor?: {
        name: string;
        role: string;
        summary: string;
        avatarUrl?: string;
    };
    updatedAt?: string; // ISO timestamp of last update
    isAiGenerated?: boolean; // Whether this was generated via URL import
}

export interface UserReview {
    id: string;
    productId: string;
    userName: string;
    rating: number; // 1-5
    comment: string;
    date: string;
}

/**
 * Result of a bulk import operation
 * Tracks successful and failed imports for display to user
 */
export interface BulkImportResult {
    successful: Product[];
    failed: Array<{ url: string; error: string }>;
}

/**
 * Progress tracking for bulk import
 */
export interface BulkImportProgress {
    current: number;
    total: number;
    status: 'idle' | 'scraping' | 'analyzing' | 'saving' | 'complete' | 'error';
    currentUrl?: string;
    message?: string;
}

export type ArticleType = 'comparison' | 'list' | 'guide' | 'informational';

export interface Article {
    id: string;
    title: string;
    type: ArticleType;
    category: string; // Hoofdcategorie (backwards compatible)
    categories?: string[]; // Meerdere categorieën mogelijk
    summary: string;
    htmlContent: string; // The full article content
    author: string;
    date: string;
    imageUrl?: string;
    created_at?: string; // ISO timestamp for database storage
    slug?: string; // SEO-friendly URL slug
    metaDescription?: string; // SEO meta description
    tags?: string[]; // Extra tags voor SEO
    lastUpdated?: string; // ISO timestamp voor laatste wijziging
}

export interface ContentSuggestion {
    topic: string; // e.g. "Samsung EcoBubble Review"
    type: 'review' | 'comparison' | 'guide';
    priority: 'high' | 'medium' | 'low';
    reasoning: string; // Why this helps authority
    searchQuery: string; // Helper for Bol import
}

export interface CategoryConfig {
    id: string;
    name: string;
    icon: string;
    specs: string[];
    brands: string[];
}

export const CATEGORIES: Record<string, CategoryConfig> = {
    // --- KOLOM 1: BEELD, GELUID & SMART ---
    'televisies': { id: 'televisies', name: 'Televisies', icon: 'fa-tv', specs: ['Schermdiagonaal', 'Type scherm', 'Verversing (Hz)', 'HDMI 2.1'], brands: ['LG', 'Samsung', 'Sony', 'Philips', 'TCL'] },
    'audio': { id: 'audio', name: 'Audio & HiFi', icon: 'fa-headphones', specs: ['Type', 'Noise Cancelling', 'Batterijduur', 'Waterbestendig'], brands: ['Sony', 'JBL', 'Bose', 'Sonos', 'Sennheiser'] },
    'laptops': { id: 'laptops', name: 'Laptops', icon: 'fa-laptop', specs: ['Processor', 'RAM geheugen', 'Opslag', 'Scherm'], brands: ['Apple', 'HP', 'Lenovo', 'Dell', 'Asus'] },
    'smartphones': { id: 'smartphones', name: 'Smartphones', icon: 'fa-mobile-alt', specs: ['Schermgrootte', 'Camera (MP)', 'Opslag', 'Batterij'], brands: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi'] },

    // --- KOLOM 2: HUISHOUDEN & WONEN ---
    'wasmachines': { id: 'wasmachines', name: 'Wasmachines', icon: 'fa-tshirt', specs: ['Vulgewicht', 'Toerental', 'Geluidsniveau', 'Energieklasse'], brands: ['Miele', 'Bosch', 'Samsung', 'AEG', 'Haier'] },
    'stofzuigers': { id: 'stofzuigers', name: 'Stofzuigers', icon: 'fa-wind', specs: ['Type', 'Gebruiksduur', 'Geluidsniveau', 'Gewicht'], brands: ['Dyson', 'Miele', 'Philips', 'Samsung', 'Rowenta'] },
    'smarthome': { id: 'smarthome', name: 'Smart Home', icon: 'fa-wifi', specs: ['Platform', 'Protocol', 'Stroomvoorziening'], brands: ['Philips Hue', 'Google Nest', 'Ring', 'Tado', 'Eufy'] },
    'matrassen': { id: 'matrassen', name: 'Matrassen', icon: 'fa-bed', specs: ['Type kern', 'Hardheid', 'Ventilatie', 'Garantie'], brands: ['Emma', 'Auping', 'Swiss Sense', 'M Line', 'Matt Sleeps'] },

    // --- KOLOM 3: KEUKEN & VERZORGING ---
    'airfryers': { id: 'airfryers', name: 'Airfryers', icon: 'fa-utensils', specs: ['Laadvermogen (kg)', 'Programmas', 'Vaatwasserbestendig'], brands: ['Philips', 'Ninja', 'Princess', 'Tefal', 'Inventum'] },
    'koffie': { id: 'koffie', name: 'Koffie', icon: 'fa-mug-hot', specs: ['Systeem', 'Melkopschuimer', 'Bonenreservoir', 'Opwarmtijd'], brands: ['DeLonghi', 'Philips', 'Nespresso', 'Sage', 'Jura'] },
    'keuken': { id: 'keuken', name: 'Keukenmachines', icon: 'fa-blender', specs: ['Vermogen (W)', 'Inhoud kom', 'Accessoires'], brands: ['KitchenAid', 'Kenwood', 'Bosch', 'Magimix', 'Smeq'] },
    'verzorging': { id: 'verzorging', name: 'Verzorging', icon: 'fa-magic', specs: ['Type', 'Gebruiksduur', 'Opzetstukken'], brands: ['Philips', 'Braun', 'Oral-B', 'Babyliss', 'Remington'] }
};
