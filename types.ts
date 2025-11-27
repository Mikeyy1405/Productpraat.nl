// ============================================================================
// AFFILIATE INFRASTRUCTURE TYPES
// ============================================================================

/**
 * Supported affiliate network identifiers
 */
export type AffiliateNetworkId = 'bol' | 'tradetracker' | 'daisycon' | 'awin' | 'paypro' | 'plugpay';

/**
 * Type of affiliate network (physical goods vs digital products)
 */
export type AffiliateNetworkType = 'physical' | 'digital';

/**
 * Affiliate network configuration and metadata
 */
export interface AffiliateNetwork {
    /** Unique network identifier */
    id: AffiliateNetworkId;
    /** Display name of the network */
    name: string;
    /** Type: 'physical' for product marketplaces, 'digital' for digital products */
    type: AffiliateNetworkType;
    /** Network's website URL */
    website?: string;
    /** Commission range description (e.g., "5-10%") */
    commissionRange?: string;
    /** Cookie duration in days */
    cookieDurationDays?: number;
    /** Types of products available on this network */
    productTypes?: string[];
    /** Whether the network has an API available */
    apiAvailable?: boolean;
    /** Additional notes about the network */
    notes?: string;
    /** Timestamps */
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Affiliate link for a product
 * Links a product to an affiliate network with tracking information
 */
export interface AffiliateLink {
    /** Unique identifier */
    id: string;
    /** Reference to the product this link belongs to */
    productId: string;
    /** Reference to the affiliate network */
    networkId: AffiliateNetworkId;
    /** Shop/merchant name */
    shopName?: string;
    /** Full affiliate URL with tracking parameters */
    url: string;
    /** Current price at this shop (if available) */
    price?: number;
    /** Whether the product is in stock */
    inStock?: boolean;
    /** When this link was last checked/verified */
    lastChecked?: string;
    /** Whether this is the primary/default affiliate link for the product */
    isPrimary?: boolean;
    /** Timestamps */
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Digital product from PayPro or Plug&Pay
 */
export interface DigitalProduct {
    /** Unique identifier */
    id: string;
    /** Reference to the affiliate network (paypro or plugpay) */
    networkId: 'paypro' | 'plugpay';
    /** Campaign ID from the network */
    campaignId?: string;
    /** URL-friendly slug */
    slug: string;
    /** Product name */
    name: string;
    /** Product description */
    description?: string;
    /** Price in EUR */
    price?: number;
    /** Commission percentage for affiliates */
    commissionPercentage?: number;
    /** Vendor/creator name */
    vendorName?: string;
    /** Product category */
    category?: string;
    /** Product image URL */
    imageUrl?: string;
    /** Full affiliate URL */
    affiliateUrl?: string;
    /** Timestamps */
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Affiliate click tracking record
 */
export interface AffiliateClick {
    /** Unique identifier */
    id: string;
    /** Reference to the affiliate link that was clicked */
    linkId: string;
    /** When the click occurred */
    clickedAt: string;
    /** Hashed IP address for fraud prevention (never store raw IPs) */
    ipHash?: string;
    /** User ID if authenticated */
    userId?: string;
    /** Whether this click resulted in a conversion */
    converted?: boolean;
    /** Commission amount if converted */
    commissionAmount?: number;
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

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
    
    // === AFFILIATE INFRASTRUCTURE FIELDS ===
    /** Array of affiliate links for this product across different networks */
    affiliateLinks?: AffiliateLink[];
    /** The primary/default affiliate link for this product */
    primaryAffiliateLink?: AffiliateLink;
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
 * Result of a bulk import operation.
 * 
 * Used by ProductGenerator component to display import results to the user.
 * 
 * A product is considered 'successful' when:
 * - URL was successfully scraped
 * - AI analysis generated a valid product
 * - Product was saved to the database
 * 
 * A product is considered 'failed' when:
 * - URL is invalid or unreachable
 * - Scraping failed (CORS issues, blocked by site, etc.)
 * - AI analysis failed or returned invalid data
 * - Database save failed
 */
export interface BulkImportResult {
    /** Products that were successfully scraped, analyzed, and saved */
    successful: Product[];
    /** URLs that failed with their error messages */
    failed: Array<{ url: string; error: string }>;
}

/**
 * Progress tracking for bulk import operations.
 * Updated during each step of the import process.
 */
export interface BulkImportProgress {
    /** Current product being processed (1-indexed) */
    current: number;
    /** Total number of products to import */
    total: number;
    /** Current processing status */
    status: 'idle' | 'scraping' | 'analyzing' | 'saving' | 'complete' | 'error';
    /** URL currently being processed */
    currentUrl?: string;
    /** Human-readable status message */
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
