/**
 * Affiliate Service
 * 
 * Handles affiliate link generation, network detection, and click tracking
 * for both physical product networks (Bol.com, TradeTracker, Daisycon, Awin)
 * and digital product platforms (PayPro, Plug&Pay).
 * 
 * @module services/affiliateService
 */

import { getSupabase } from './supabaseClient';
import { 
    AffiliateNetwork, 
    AffiliateLink, 
    AffiliateNetworkId, 
    DigitalProduct,
    AffiliateClick 
} from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Environment variable keys for affiliate network credentials
 */
const ENV_KEYS = {
    BOL_PARTNER_ID: 'BOL_PARTNER_ID',
    TRADETRACKER_SITE_ID: 'TRADETRACKER_SITE_ID',
    TRADETRACKER_CAMPAIGN_ID: 'TRADETRACKER_CAMPAIGN_ID',
    DAISYCON_PUBLISHER_ID: 'DAISYCON_PUBLISHER_ID',
    DAISYCON_MEDIA_ID: 'DAISYCON_MEDIA_ID',
    AWIN_PUBLISHER_ID: 'AWIN_PUBLISHER_ID',
    PAYPRO_AFFILIATE_ID: 'PAYPRO_AFFILIATE_ID',
    PAYPRO_API_KEY: 'PAYPRO_API_KEY',
    PLUGPAY_AFFILIATE_ID: 'PLUGPAY_AFFILIATE_ID',
} as const;

/**
 * Advertiser IDs for affiliate networks
 * These map shop domains to their advertiser/merchant IDs in each network
 */
const TRADETRACKER_ADVERTISERS: Record<string, string> = {
    'coolblue.nl': '24589',
    'coolblue.be': '24589',
    'fonq.nl': '22067',
    'bol.com': '24827',
    'wehkamp.nl': '10980',
    'otto.nl': '29044',
};

const DAISYCON_ADVERTISERS: Record<string, string> = {
    'mediamarkt.nl': '14695',
    'mediamarkt.be': '14695',
    'bol.com': '12820',
    'expert.nl': '12345',
    'bcc.nl': '11234',
    'alternate.nl': '10567',
};

const AWIN_ADVERTISERS: Record<string, string> = {
    'zalando.nl': '10783',
    'zalando.be': '10783',
    'amazon.nl': '71364',
    'bol.com': '28770',
    'conrad.nl': '16421',
    'alternate.nl': '15995',
};

/**
 * Network URL patterns for detection
 */
const NETWORK_PATTERNS: Record<AffiliateNetworkId, RegExp[]> = {
    bol: [
        /^https?:\/\/(www\.)?bol\.com/i,
        /^https?:\/\/partner\.bol\.com/i,
    ],
    tradetracker: [
        /^https?:\/\/(www\.)?tradetracker\.(com|nl)/i,
        /tc\.tradetracker\./i,
    ],
    daisycon: [
        /^https?:\/\/(www\.)?daisycon\.(com|nl)/i,
        /ds1\.nl/i,
    ],
    awin: [
        /^https?:\/\/(www\.)?awin1?\.(com|nl)/i,
        /^https?:\/\/.*\.awin\.com/i,
    ],
    paypro: [
        /^https?:\/\/(www\.)?paypro\.nl/i,
        /^https?:\/\/.*\.paypro\.nl/i,
    ],
    plugpay: [
        /^https?:\/\/(www\.)?plug(and)?pay\.nl/i,
        /^https?:\/\/.*\.plugpay\.nl/i,
    ],
};

/**
 * Common shop domain patterns for physical product networks
 * Maps shop domains to their preferred affiliate network
 */
const SHOP_PATTERNS: Record<string, AffiliateNetworkId> = {
    // Bol.com - Direct partner program
    'bol.com': 'bol',

    // TradeTracker shops
    'coolblue.nl': 'tradetracker',
    'coolblue.be': 'tradetracker',
    'fonq.nl': 'tradetracker',
    'wehkamp.nl': 'tradetracker',
    'otto.nl': 'tradetracker',
    'ikea.nl': 'tradetracker',
    'blokker.nl': 'tradetracker',

    // Daisycon shops
    'mediamarkt.nl': 'daisycon',
    'mediamarkt.be': 'daisycon',
    'expert.nl': 'daisycon',
    'bcc.nl': 'daisycon',
    'gamma.nl': 'daisycon',
    'praxis.nl': 'daisycon',
    'action.nl': 'daisycon',

    // Awin shops
    'zalando.nl': 'awin',
    'zalando.be': 'awin',
    'amazon.nl': 'awin',
    'amazon.de': 'awin',
    'conrad.nl': 'awin',
    'alternate.nl': 'awin',
    'hema.nl': 'awin',
    'bijenkorf.nl': 'awin',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get environment variable value
 * Works in both browser (Vite) and Node.js environments
 * 
 * Note: This is intentionally separate from supabaseClient.ts as it handles
 * additional Node.js/server-side cases that supabaseClient doesn't support.
 * The affiliate service runs in both browser and server contexts.
 * 
 * @param key - Environment variable key
 * @returns Environment variable value or empty string
 */
const getEnvVar = (key: string): string => {
    // Check Vite environment (browser)
    if (typeof window !== 'undefined' && (import.meta as { env?: Record<string, string> }).env) {
        const viteEnv = (import.meta as { env: Record<string, string> }).env;
        if (viteEnv[key]) return viteEnv[key];
        if (viteEnv[`VITE_${key}`]) return viteEnv[`VITE_${key}`];
    }
    
    // Check Node.js environment
    if (typeof process !== 'undefined' && process.env) {
        if (process.env[key]) return process.env[key] || '';
        if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`] || '';
    }
    
    return '';
};

/**
 * Check if a hostname matches a domain (including subdomains)
 * 
 * @param hostname - The hostname to check
 * @param domain - The domain to match against
 * @returns True if hostname matches domain
 */
const matchesDomain = (hostname: string, domain: string): boolean => {
    const normalizedHostname = hostname.toLowerCase();
    const normalizedDomain = domain.toLowerCase();
    return normalizedHostname === normalizedDomain || 
           normalizedHostname.endsWith('.' + normalizedDomain);
};

/**
 * Generate a unique ID for affiliate links
 * 
 * @returns UUID-like string
 */
const generateId = (): string => {
    return `aff-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Simple SHA-256 hash for IP addresses (browser-compatible)
 * 
 * @param text - Text to hash
 * @returns Hashed string
 */
const hashIp = async (text: string): Promise<string> => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    }
    // Fallback: simple hash for Node.js or if crypto not available
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
};

// ============================================================================
// NETWORK DETECTION
// ============================================================================

/**
 * Detect which affiliate network a URL belongs to
 * 
 * @param url - The URL to analyze
 * @returns The detected network ID, or null if not recognized
 * 
 * @example
 * ```typescript
 * const network = detectNetwork('https://www.bol.com/nl/p/product/123');
 * console.log(network); // 'bol'
 * 
 * const unknown = detectNetwork('https://example.com');
 * console.log(unknown); // null
 * ```
 */
export const detectNetwork = (url: string): AffiliateNetworkId | null => {
    if (!url) return null;
    
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        
        // Check against network patterns
        for (const [networkId, patterns] of Object.entries(NETWORK_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(url)) {
                    return networkId as AffiliateNetworkId;
                }
            }
        }
        
        // Check against known shop domains
        for (const [domain, networkId] of Object.entries(SHOP_PATTERNS)) {
            if (matchesDomain(hostname, domain)) {
                return networkId;
            }
        }
        
        return null;
    } catch (error) {
        console.error('[AffiliateService] Error detecting network:', error);
        return null;
    }
};

/**
 * Detect if a URL is from a digital product platform
 * 
 * @param url - The URL to check
 * @returns True if URL is from PayPro or Plug&Pay
 */
export const isDigitalProductUrl = (url: string): boolean => {
    const network = detectNetwork(url);
    return network === 'paypro' || network === 'plugpay';
};

// ============================================================================
// AFFILIATE LINK GENERATION
// ============================================================================

/**
 * Options for generating affiliate links
 */
export interface GenerateAffiliateLinkOptions {
    /** Override the detected network */
    networkId?: AffiliateNetworkId;
    /** Shop/merchant name for display */
    shopName?: string;
    /** Product price */
    price?: number;
    /** Additional tracking parameters */
    trackingParams?: Record<string, string>;
}

/**
 * Result of affiliate link generation
 */
export interface GeneratedAffiliateLink {
    /** The affiliate URL (with tracking parameters if available) */
    url: string;
    /** Detected or specified network */
    networkId: AffiliateNetworkId | null;
    /** Shop name */
    shopName?: string;
    /** Whether affiliate parameters were added */
    hasAffiliateParams: boolean;
    /** Original URL before transformation */
    originalUrl: string;
}

/**
 * Generate an affiliate link from a product URL
 * 
 * Automatically detects the network and adds appropriate tracking parameters
 * based on configured environment variables.
 * 
 * @param productUrl - The original product URL
 * @param options - Optional configuration
 * @returns Generated affiliate link with metadata
 * 
 * @example
 * ```typescript
 * const result = generateAffiliateLink('https://www.bol.com/nl/p/samsung-tv/123');
 * console.log(result.url); // URL with affiliate tracking
 * console.log(result.networkId); // 'bol'
 * console.log(result.hasAffiliateParams); // true if BOL_PARTNER_ID is set
 * ```
 */
export const generateAffiliateLink = (
    productUrl: string,
    options: GenerateAffiliateLinkOptions = {}
): GeneratedAffiliateLink => {
    const originalUrl = productUrl;
    let url = productUrl;
    let hasAffiliateParams = false;
    
    // Detect network if not provided
    const networkId = options.networkId || detectNetwork(productUrl);
    
    // Detect shop name from URL if not provided
    let shopName = options.shopName;
    if (!shopName && productUrl) {
        try {
            const hostname = new URL(productUrl).hostname.toLowerCase();
            shopName = hostname.replace('www.', '').split('.')[0];
            // Capitalize first letter
            shopName = shopName.charAt(0).toUpperCase() + shopName.slice(1);
        } catch {
            shopName = 'Onbekend';
        }
    }
    
    try {
        const parsedUrl = new URL(productUrl);
        
        // Get hostname for advertiser lookup
        const hostname = parsedUrl.hostname.toLowerCase().replace('www.', '');

        // Apply network-specific affiliate parameters
        switch (networkId) {
            case 'bol': {
                const partnerId = getEnvVar(ENV_KEYS.BOL_PARTNER_ID);
                if (partnerId) {
                    parsedUrl.searchParams.set('Referrer', `productpraat_${partnerId}`);
                    hasAffiliateParams = true;
                }
                break;
            }

            case 'tradetracker': {
                const siteId = getEnvVar(ENV_KEYS.TRADETRACKER_SITE_ID);
                const campaignId = getEnvVar(ENV_KEYS.TRADETRACKER_CAMPAIGN_ID) ||
                                   TRADETRACKER_ADVERTISERS[hostname];

                if (siteId && campaignId) {
                    // TradeTracker uses a redirect URL pattern:
                    // https://tc.tradetracker.net/?c={campaignId}&m={materialId}&a={affiliateId}&r={encodedUrl}
                    const encodedUrl = encodeURIComponent(productUrl);
                    url = `https://tc.tradetracker.net/?c=${campaignId}&m=12&a=${siteId}&r=${encodedUrl}&u=`;
                    hasAffiliateParams = true;
                } else if (siteId) {
                    // Fallback: add tracking parameter to original URL
                    parsedUrl.searchParams.set('tt', siteId);
                    url = parsedUrl.toString();
                    hasAffiliateParams = true;
                }
                break;
            }

            case 'daisycon': {
                const publisherId = getEnvVar(ENV_KEYS.DAISYCON_PUBLISHER_ID);
                const mediaId = getEnvVar(ENV_KEYS.DAISYCON_MEDIA_ID) || 'productpraat';
                const advertiserId = DAISYCON_ADVERTISERS[hostname];

                if (publisherId && advertiserId) {
                    // Daisycon uses a redirect URL pattern:
                    // https://ds1.nl/c/?si={publisherId}&li={advertiserId}&wi={mediaId}&dl={encodedUrl}
                    const encodedUrl = encodeURIComponent(productUrl);
                    url = `https://ds1.nl/c/?si=${publisherId}&li=${advertiserId}&wi=${mediaId}&dl=${encodedUrl}`;
                    hasAffiliateParams = true;
                } else if (publisherId) {
                    // Fallback: add tracking parameter
                    parsedUrl.searchParams.set('dc', publisherId);
                    url = parsedUrl.toString();
                    hasAffiliateParams = true;
                }
                break;
            }

            case 'awin': {
                const publisherId = getEnvVar(ENV_KEYS.AWIN_PUBLISHER_ID);
                const advertiserId = AWIN_ADVERTISERS[hostname];

                if (publisherId && advertiserId) {
                    // Awin uses a redirect URL pattern:
                    // https://www.awin1.com/cread.php?awinmid={advertiserId}&awinaffid={publisherId}&clickref=productpraat&p={encodedUrl}
                    const encodedUrl = encodeURIComponent(productUrl);
                    url = `https://www.awin1.com/cread.php?awinmid=${advertiserId}&awinaffid=${publisherId}&clickref=productpraat&ued=${encodedUrl}`;
                    hasAffiliateParams = true;
                } else if (publisherId) {
                    // Fallback: add tracking parameter
                    parsedUrl.searchParams.set('awc', publisherId);
                    url = parsedUrl.toString();
                    hasAffiliateParams = true;
                }
                break;
            }

            case 'paypro': {
                const affiliateId = getEnvVar(ENV_KEYS.PAYPRO_AFFILIATE_ID);
                if (affiliateId) {
                    parsedUrl.searchParams.set('aff', affiliateId);
                    hasAffiliateParams = true;
                }
                break;
            }

            case 'plugpay': {
                const affiliateId = getEnvVar(ENV_KEYS.PLUGPAY_AFFILIATE_ID);
                if (affiliateId) {
                    parsedUrl.searchParams.set('ref', affiliateId);
                    hasAffiliateParams = true;
                }
                break;
            }
        }
        
        // Add custom tracking params if provided
        if (options.trackingParams) {
            for (const [key, value] of Object.entries(options.trackingParams)) {
                parsedUrl.searchParams.set(key, value);
            }
        }
        
        url = parsedUrl.toString();
    } catch (error) {
        console.warn('[AffiliateService] Could not parse URL for affiliate params:', error);
    }
    
    return {
        url,
        networkId,
        shopName,
        hasAffiliateParams,
        originalUrl,
    };
};

// ============================================================================
// PAYPRO / PLUG&PAY SPECIFIC FUNCTIONS
// ============================================================================

/**
 * Extract PayPro campaign ID from a URL
 * 
 * @param url - PayPro URL
 * @returns Campaign ID or null
 */
export const extractPayProCampaignId = (url: string): string | null => {
    try {
        const parsedUrl = new URL(url);
        
        // PayPro URLs often have format: https://paypro.nl/producten/123/product-name
        const pathMatch = parsedUrl.pathname.match(/\/producten\/(\d+)/);
        if (pathMatch) {
            return pathMatch[1];
        }
        
        // Or campaign parameter
        const campaignId = parsedUrl.searchParams.get('campaign') || 
                          parsedUrl.searchParams.get('c');
        return campaignId;
    } catch {
        return null;
    }
};

/**
 * Convert a PayPro URL or product slug to an affiliate URL
 * 
 * @param urlOrSlug - PayPro URL or product slug
 * @returns Affiliate URL with tracking
 */
export const convertPayProUrl = (urlOrSlug: string): string => {
    const affiliateId = getEnvVar(ENV_KEYS.PAYPRO_AFFILIATE_ID);
    
    // If it's already a URL, add affiliate parameter
    if (urlOrSlug.startsWith('http')) {
        const result = generateAffiliateLink(urlOrSlug, { networkId: 'paypro' });
        return result.url;
    }
    
    // If it's a slug, construct the full URL
    const baseUrl = `https://paypro.nl/producten/${urlOrSlug}`;
    if (affiliateId) {
        return `${baseUrl}?aff=${affiliateId}`;
    }
    return baseUrl;
};

/**
 * Convert a Plug&Pay URL or product slug to an affiliate URL
 * 
 * @param urlOrSlug - Plug&Pay URL or product slug
 * @returns Affiliate URL with tracking
 */
export const convertPlugPayUrl = (urlOrSlug: string): string => {
    const affiliateId = getEnvVar(ENV_KEYS.PLUGPAY_AFFILIATE_ID);
    
    // If it's already a URL, add affiliate parameter
    if (urlOrSlug.startsWith('http')) {
        const result = generateAffiliateLink(urlOrSlug, { networkId: 'plugpay' });
        return result.url;
    }
    
    // If it's a slug, construct the full URL
    const baseUrl = `https://plugpay.nl/checkout/${urlOrSlug}`;
    if (affiliateId) {
        return `${baseUrl}?ref=${affiliateId}`;
    }
    return baseUrl;
};

/**
 * Search for digital products on PayPro
 * 
 * This is a best-effort implementation that requires PAYPRO_API_KEY to be set.
 * Without the API key, it returns an empty array.
 * 
 * @param keyword - Search keyword
 * @returns Array of matching digital products
 */
export const searchDigitalProducts = async (keyword: string): Promise<DigitalProduct[]> => {
    const apiKey = getEnvVar(ENV_KEYS.PAYPRO_API_KEY);
    
    if (!apiKey) {
        console.warn('[AffiliateService] PAYPRO_API_KEY not set - searchDigitalProducts returns empty array');
        return [];
    }
    
    try {
        // NOTE: This is a stub implementation
        // The actual PayPro API endpoint and authentication method would need to be 
        // implemented based on their API documentation
        // Debug logging removed for production - uncomment for development:
        // console.log(`[AffiliateService] searchDigitalProducts called with keyword: "${keyword}"`);
        
        // TODO: Implement actual PayPro API call when documentation is available
        // Example structure:
        // const response = await fetch(`https://api.paypro.nl/v1/products/search?q=${encodeURIComponent(keyword)}`, {
        //     headers: {
        //         'Authorization': `Bearer ${apiKey}`,
        //         'Content-Type': 'application/json'
        //     }
        // });
        // const data = await response.json();
        // return data.products.map(mapToDigitalProduct);
        
        return [];
    } catch (error) {
        console.error('[AffiliateService] Error searching digital products:', error);
        return [];
    }
};

// ============================================================================
// CLICK TRACKING
// ============================================================================

/**
 * Request metadata for click tracking
 */
export interface TrackClickRequestMeta {
    /** IP address (will be hashed) */
    ip?: string;
    /** User agent string */
    userAgent?: string;
    /** Referrer URL */
    referrer?: string;
    /** User ID if authenticated */
    userId?: string;
}

/**
 * Result of click tracking operation
 */
export interface TrackClickResult {
    /** Whether tracking was successful */
    success: boolean;
    /** The affiliate link ID */
    linkId?: string;
    /** Click record ID */
    clickId?: string;
    /** Error message if tracking failed */
    error?: string;
}

/**
 * Track a click on an affiliate link
 * 
 * Records the click in the database for analytics and conversion tracking.
 * IP addresses are hashed before storage for privacy.
 * 
 * @param productId - The product ID
 * @param linkUrl - The affiliate link URL that was clicked
 * @param requestMeta - Optional request metadata
 * @returns Tracking result with link ID
 * 
 * @example
 * ```typescript
 * const result = await trackClick('product-123', 'https://bol.com/...', {
 *     ip: '192.168.1.1',
 *     userId: 'user-456'
 * });
 * if (result.success) {
 *     console.log('Click tracked:', result.clickId);
 * }
 * ```
 */
export const trackClick = async (
    productId: string,
    linkUrl: string,
    requestMeta: TrackClickRequestMeta = {}
): Promise<TrackClickResult> => {
    try {
        const supabase = getSupabase();
        
        if (!supabase) {
            console.warn('[AffiliateService] Supabase not configured - click not tracked');
            return {
                success: false,
                error: 'Database not configured'
            };
        }
        
        // Hash the IP address if provided
        let ipHash: string | undefined;
        if (requestMeta.ip) {
            ipHash = await hashIp(requestMeta.ip);
        }
        
        // First, try to find an existing affiliate link for this product and URL
        const { data: existingLink, error: linkError } = await supabase
            .from('affiliate_links')
            .select('id')
            .eq('product_id', productId)
            .eq('url', linkUrl)
            .single();
        
        let linkId: string;
        
        if (existingLink) {
            linkId = existingLink.id;
        } else {
            // Create a new affiliate link record
            const networkId = detectNetwork(linkUrl);
            const generatedLink = generateAffiliateLink(linkUrl);
            
            const newLink: Partial<AffiliateLink> = {
                id: generateId(),
                productId,
                networkId: networkId || 'bol' as AffiliateNetworkId, // Default to bol if unknown
                shopName: generatedLink.shopName,
                url: linkUrl,
                lastChecked: new Date().toISOString(),
            };
            
            const { data: insertedLink, error: insertError } = await supabase
                .from('affiliate_links')
                .insert(newLink)
                .select('id')
                .single();
            
            if (insertError || !insertedLink) {
                console.error('[AffiliateService] Error creating affiliate link:', insertError);
                return {
                    success: false,
                    error: 'Failed to create affiliate link'
                };
            }
            
            linkId = insertedLink.id;
        }
        
        // Record the click
        const clickRecord: Partial<AffiliateClick> = {
            id: generateId(),
            linkId,
            clickedAt: new Date().toISOString(),
            ipHash,
            userId: requestMeta.userId,
            converted: false,
        };
        
        const { data: insertedClick, error: clickError } = await supabase
            .from('affiliate_clicks')
            .insert(clickRecord)
            .select('id')
            .single();
        
        if (clickError) {
            console.error('[AffiliateService] Error recording click:', clickError);
            return {
                success: false,
                linkId,
                error: 'Failed to record click'
            };
        }
        
        console.log(`[AffiliateService] Click tracked: product=${productId}, linkId=${linkId}, clickId=${insertedClick?.id}`);
        
        return {
            success: true,
            linkId,
            clickId: insertedClick?.id,
        };
    } catch (error) {
        console.error('[AffiliateService] Error in trackClick:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Get all affiliate networks from the database
 * 
 * @returns Array of affiliate networks
 */
export const getAffiliateNetworks = async (): Promise<AffiliateNetwork[]> => {
    try {
        const supabase = getSupabase();
        
        if (!supabase) {
            console.warn('[AffiliateService] Supabase not configured - returning default networks');
            return getDefaultNetworks();
        }
        
        const { data, error } = await supabase
            .from('affiliate_networks')
            .select('*')
            .order('name');
        
        if (error) {
            console.error('[AffiliateService] Error fetching networks:', error);
            return getDefaultNetworks();
        }
        
        return (data || []).map(mapDbNetworkToAffiliateNetwork);
    } catch (error) {
        console.error('[AffiliateService] Error in getAffiliateNetworks:', error);
        return getDefaultNetworks();
    }
};

/**
 * Get affiliate links for a product
 * 
 * @param productId - The product ID
 * @returns Array of affiliate links
 */
export const getAffiliateLinksForProduct = async (productId: string): Promise<AffiliateLink[]> => {
    try {
        const supabase = getSupabase();
        
        if (!supabase) {
            return [];
        }
        
        const { data, error } = await supabase
            .from('affiliate_links')
            .select('*')
            .eq('product_id', productId)
            .order('is_primary', { ascending: false });
        
        if (error) {
            console.error('[AffiliateService] Error fetching affiliate links:', error);
            return [];
        }
        
        return (data || []).map(mapDbLinkToAffiliateLink);
    } catch (error) {
        console.error('[AffiliateService] Error in getAffiliateLinksForProduct:', error);
        return [];
    }
};

/**
 * Save an affiliate link for a product
 * 
 * @param link - The affiliate link to save
 * @returns Saved affiliate link or null
 */
export const saveAffiliateLink = async (link: Omit<AffiliateLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<AffiliateLink | null> => {
    try {
        const supabase = getSupabase();
        
        if (!supabase) {
            console.warn('[AffiliateService] Supabase not configured - link not saved');
            return null;
        }
        
        const dbLink = {
            id: generateId(),
            product_id: link.productId,
            network_id: link.networkId,
            shop_name: link.shopName,
            url: link.url,
            price: link.price,
            in_stock: link.inStock ?? true,
            last_checked: link.lastChecked || new Date().toISOString(),
            is_primary: link.isPrimary ?? false,
        };
        
        const { data, error } = await supabase
            .from('affiliate_links')
            .insert(dbLink)
            .select()
            .single();
        
        if (error) {
            console.error('[AffiliateService] Error saving affiliate link:', error);
            return null;
        }
        
        return mapDbLinkToAffiliateLink(data);
    } catch (error) {
        console.error('[AffiliateService] Error in saveAffiliateLink:', error);
        return null;
    }
};

/**
 * Save a digital product to the database
 * 
 * @param product - The digital product to save
 * @returns Saved product or null
 */
export const saveDigitalProduct = async (product: Omit<DigitalProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<DigitalProduct | null> => {
    try {
        const supabase = getSupabase();
        
        if (!supabase) {
            console.warn('[AffiliateService] Supabase not configured - digital product not saved');
            return null;
        }
        
        const dbProduct = {
            id: generateId(),
            network_id: product.networkId,
            campaign_id: product.campaignId,
            slug: product.slug,
            name: product.name,
            description: product.description,
            price: product.price,
            commission_percentage: product.commissionPercentage,
            vendor_name: product.vendorName,
            category: product.category,
            image_url: product.imageUrl,
            affiliate_url: product.affiliateUrl,
        };
        
        const { data, error } = await supabase
            .from('digital_products')
            .upsert(dbProduct, { onConflict: 'slug' })
            .select()
            .single();
        
        if (error) {
            console.error('[AffiliateService] Error saving digital product:', error);
            return null;
        }
        
        return mapDbProductToDigitalProduct(data);
    } catch (error) {
        console.error('[AffiliateService] Error in saveDigitalProduct:', error);
        return null;
    }
};

// ============================================================================
// HELPER MAPPERS
// ============================================================================

/**
 * Map database network record to AffiliateNetwork interface
 */
const mapDbNetworkToAffiliateNetwork = (dbRecord: Record<string, unknown>): AffiliateNetwork => ({
    id: dbRecord.id as AffiliateNetworkId,
    name: dbRecord.name as string,
    type: dbRecord.type as 'physical' | 'digital',
    website: dbRecord.website as string | undefined,
    commissionRange: dbRecord.commission_range as string | undefined,
    cookieDurationDays: dbRecord.cookie_duration_days as number | undefined,
    productTypes: dbRecord.product_types as string[] | undefined,
    apiAvailable: dbRecord.api_available as boolean | undefined,
    notes: dbRecord.notes as string | undefined,
    createdAt: dbRecord.created_at as string | undefined,
    updatedAt: dbRecord.updated_at as string | undefined,
});

/**
 * Map database link record to AffiliateLink interface
 */
const mapDbLinkToAffiliateLink = (dbRecord: Record<string, unknown>): AffiliateLink => ({
    id: dbRecord.id as string,
    productId: dbRecord.product_id as string,
    networkId: dbRecord.network_id as AffiliateNetworkId,
    shopName: dbRecord.shop_name as string | undefined,
    url: dbRecord.url as string,
    price: dbRecord.price as number | undefined,
    inStock: dbRecord.in_stock as boolean | undefined,
    lastChecked: dbRecord.last_checked as string | undefined,
    isPrimary: dbRecord.is_primary as boolean | undefined,
    createdAt: dbRecord.created_at as string | undefined,
    updatedAt: dbRecord.updated_at as string | undefined,
});

/**
 * Map database product record to DigitalProduct interface
 */
const mapDbProductToDigitalProduct = (dbRecord: Record<string, unknown>): DigitalProduct => ({
    id: dbRecord.id as string,
    networkId: dbRecord.network_id as 'paypro' | 'plugpay',
    campaignId: dbRecord.campaign_id as string | undefined,
    slug: dbRecord.slug as string,
    name: dbRecord.name as string,
    description: dbRecord.description as string | undefined,
    price: dbRecord.price as number | undefined,
    commissionPercentage: dbRecord.commission_percentage as number | undefined,
    vendorName: dbRecord.vendor_name as string | undefined,
    category: dbRecord.category as string | undefined,
    imageUrl: dbRecord.image_url as string | undefined,
    affiliateUrl: dbRecord.affiliate_url as string | undefined,
    createdAt: dbRecord.created_at as string | undefined,
    updatedAt: dbRecord.updated_at as string | undefined,
});

/**
 * Get default affiliate networks (fallback when database is not available)
 */
const getDefaultNetworks = (): AffiliateNetwork[] => [
    {
        id: 'bol',
        name: 'Bol.com Partner',
        type: 'physical',
        website: 'https://partnerprogramma.bol.com',
        commissionRange: '5-10%',
        cookieDurationDays: 30,
        productTypes: ['electronics', 'books', 'toys', 'home', 'fashion'],
        apiAvailable: true,
        notes: 'Largest Dutch marketplace. Requires partner account and approval.',
    },
    {
        id: 'tradetracker',
        name: 'TradeTracker',
        type: 'physical',
        website: 'https://www.tradetracker.com',
        commissionRange: '2-15%',
        cookieDurationDays: 30,
        productTypes: ['electronics', 'fashion', 'travel', 'finance', 'telecom'],
        apiAvailable: true,
        notes: 'European affiliate network with many Dutch merchants.',
    },
    {
        id: 'daisycon',
        name: 'Daisycon',
        type: 'physical',
        website: 'https://www.daisycon.com',
        commissionRange: '2-12%',
        cookieDurationDays: 30,
        productTypes: ['electronics', 'fashion', 'travel', 'finance', 'utilities'],
        apiAvailable: true,
        notes: 'Dutch affiliate network with strong local presence.',
    },
    {
        id: 'awin',
        name: 'Awin',
        type: 'physical',
        website: 'https://www.awin.com',
        commissionRange: '3-15%',
        cookieDurationDays: 30,
        productTypes: ['electronics', 'fashion', 'travel', 'retail', 'finance'],
        apiAvailable: true,
        notes: 'Global affiliate network with major brands.',
    },
    {
        id: 'paypro',
        name: 'PayPro',
        type: 'digital',
        website: 'https://paypro.nl/affiliates',
        commissionRange: '10-75%',
        cookieDurationDays: 365,
        productTypes: ['courses', 'ebooks', 'software', 'memberships', 'digital'],
        apiAvailable: true,
        notes: 'Dutch digital product platform. High commissions for digital products.',
    },
    {
        id: 'plugpay',
        name: 'Plug&Pay',
        type: 'digital',
        website: 'https://www.plugpay.nl/affiliate',
        commissionRange: '10-50%',
        cookieDurationDays: 365,
        productTypes: ['courses', 'coaching', 'memberships', 'digital'],
        apiAvailable: false,
        notes: 'Dutch digital product and course platform.',
    },
];
