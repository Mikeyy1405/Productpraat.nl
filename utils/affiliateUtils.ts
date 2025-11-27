/**
 * Affiliate Utilities
 * 
 * Functions for managing affiliate network configurations, generating affiliate links,
 * and tracking clicks and conversions.
 * 
 * This module allows admins to configure affiliate IDs for different networks
 * (Bol.com, TradeTracker, Daisycon, Awin, PayPro, Plug&Pay) through the admin interface.
 * 
 * @module utils/affiliateUtils
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Storage key for affiliate network configurations */
const AFFILIATE_CONFIG_KEY = 'writgo_affiliate_config';

/** Storage key for affiliate tracking data */
const AFFILIATE_TRACKING_KEY = 'writgo_affiliate_tracking';

/** Number of days before tracking data expires */
const TRACKING_EXPIRY_DAYS = 90;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Supported affiliate network identifiers
 */
export type AffiliateNetworkId = 'bol' | 'tradetracker' | 'daisycon' | 'awin' | 'paypro' | 'plugpay';

/**
 * Configuration for a single affiliate network
 */
export interface AffiliateNetworkConfig {
    /** Unique network identifier */
    networkId: AffiliateNetworkId;
    /** Display name of the network */
    name: string;
    /** The affiliate/partner ID for this network */
    affiliateId: string;
    /** Whether this network is enabled */
    enabled: boolean;
    /** Additional notes or description */
    notes?: string;
    /** When this config was last updated */
    updatedAt?: string;
}

/**
 * Complete affiliate configuration for all networks
 */
export interface AffiliateConfig {
    networks: AffiliateNetworkConfig[];
    /** Global tracking stats */
    stats: {
        totalClicks: number;
        totalConversions: number;
        totalEarnings: number;
    };
    /** Last updated timestamp */
    updatedAt: string;
}

/**
 * Represents a single click event
 */
export interface AffiliateClickRecord {
    id: string;
    networkId: AffiliateNetworkId;
    productId: string;
    productName?: string;
    timestamp: string;
}

/**
 * Represents a conversion event
 */
export interface AffiliateConversionRecord {
    id: string;
    networkId: AffiliateNetworkId;
    productId: string;
    productName?: string;
    amount: number;
    timestamp: string;
}

/**
 * Complete tracking data structure
 */
export interface AffiliateTrackingData {
    clicks: AffiliateClickRecord[];
    conversions: AffiliateConversionRecord[];
}

// ============================================================================
// DEFAULT NETWORK CONFIGURATIONS
// ============================================================================

/**
 * Default network configurations
 */
const DEFAULT_NETWORKS: AffiliateNetworkConfig[] = [
    {
        networkId: 'bol',
        name: 'Bol.com Partner',
        affiliateId: '',
        enabled: false,
        notes: 'Grootste Nederlandse marketplace. Partner ID is je unieke identificatie.',
    },
    {
        networkId: 'tradetracker',
        name: 'TradeTracker',
        affiliateId: '',
        enabled: false,
        notes: 'Europees affiliate netwerk met veel Nederlandse merchants.',
    },
    {
        networkId: 'daisycon',
        name: 'Daisycon',
        affiliateId: '',
        enabled: false,
        notes: 'Nederlands affiliate netwerk met sterke lokale aanwezigheid.',
    },
    {
        networkId: 'awin',
        name: 'Awin',
        affiliateId: '',
        enabled: false,
        notes: 'Globaal affiliate netwerk met grote merken.',
    },
    {
        networkId: 'paypro',
        name: 'PayPro',
        affiliateId: '',
        enabled: false,
        notes: 'Nederlands platform voor digitale producten. Hoge commissies.',
    },
    {
        networkId: 'plugpay',
        name: 'Plug&Pay',
        affiliateId: '',
        enabled: false,
        notes: 'Nederlands platform voor cursussen en coaching.',
    },
];

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Load affiliate configuration from localStorage
 * 
 * @returns The stored configuration or default configuration
 */
export const loadAffiliateConfig = (): AffiliateConfig => {
    try {
        const data = localStorage.getItem(AFFILIATE_CONFIG_KEY);
        if (!data) {
            return getDefaultConfig();
        }
        const config = JSON.parse(data) as AffiliateConfig;
        // Merge with defaults to ensure all networks exist
        return mergeWithDefaults(config);
    } catch (error) {
        console.error('[AffiliateUtils] Error loading config:', error);
        return getDefaultConfig();
    }
};

/**
 * Save affiliate configuration to localStorage
 * 
 * @param config - The configuration to save
 */
export const saveAffiliateConfig = (config: AffiliateConfig): void => {
    try {
        config.updatedAt = new Date().toISOString();
        localStorage.setItem(AFFILIATE_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
        console.error('[AffiliateUtils] Error saving config:', error);
    }
};

/**
 * Get default configuration
 */
const getDefaultConfig = (): AffiliateConfig => ({
    networks: [...DEFAULT_NETWORKS],
    stats: {
        totalClicks: 0,
        totalConversions: 0,
        totalEarnings: 0,
    },
    updatedAt: new Date().toISOString(),
});

/**
 * Merge loaded config with defaults to ensure all networks exist
 */
const mergeWithDefaults = (config: AffiliateConfig): AffiliateConfig => {
    const existingIds = new Set(config.networks.map(n => n.networkId));
    const mergedNetworks = [...config.networks];
    
    for (const defaultNetwork of DEFAULT_NETWORKS) {
        if (!existingIds.has(defaultNetwork.networkId)) {
            mergedNetworks.push(defaultNetwork);
        }
    }
    
    return {
        ...config,
        networks: mergedNetworks,
    };
};

/**
 * Update a single network configuration
 * 
 * @param networkId - The network to update
 * @param updates - Partial updates to apply
 */
export const updateNetworkConfig = (
    networkId: AffiliateNetworkId,
    updates: Partial<AffiliateNetworkConfig>
): AffiliateConfig => {
    const config = loadAffiliateConfig();
    const networkIndex = config.networks.findIndex(n => n.networkId === networkId);
    
    if (networkIndex >= 0) {
        config.networks[networkIndex] = {
            ...config.networks[networkIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
    }
    
    saveAffiliateConfig(config);
    return config;
};

/**
 * Get configuration for a specific network
 * 
 * @param networkId - The network ID
 * @returns The network configuration or undefined
 */
export const getNetworkConfig = (networkId: AffiliateNetworkId): AffiliateNetworkConfig | undefined => {
    const config = loadAffiliateConfig();
    return config.networks.find(n => n.networkId === networkId);
};

/**
 * Get the affiliate ID for a specific network
 * 
 * @param networkId - The network ID
 * @returns The affiliate ID or empty string if not configured
 */
export const getAffiliateIdForNetwork = (networkId: AffiliateNetworkId): string => {
    const network = getNetworkConfig(networkId);
    return network?.enabled && network?.affiliateId ? network.affiliateId : '';
};

// ============================================================================
// URL DETECTION
// ============================================================================

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
        /^https?:\/\/(www\.)?coolblue\.(nl|be)/i,
    ],
    daisycon: [
        /^https?:\/\/(www\.)?daisycon\.(com|nl)/i,
        /ds1\.nl/i,
        /^https?:\/\/(www\.)?mediamarkt\.nl/i,
    ],
    awin: [
        /^https?:\/\/(www\.)?awin1?\.(com|nl)/i,
        /^https?:\/\/.*\.awin\.com/i,
        /^https?:\/\/(www\.)?zalando\.(nl|be)/i,
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
 * Detect which affiliate network a URL belongs to
 * 
 * @param url - The URL to analyze
 * @returns The detected network ID, or null if not recognized
 */
export const detectNetwork = (url: string): AffiliateNetworkId | null => {
    if (!url) return null;
    
    try {
        for (const [networkId, patterns] of Object.entries(NETWORK_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(url)) {
                    return networkId as AffiliateNetworkId;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('[AffiliateUtils] Error detecting network:', error);
        return null;
    }
};

// ============================================================================
// AFFILIATE LINK GENERATION
// ============================================================================

/**
 * Generate an affiliate link by adding the configured affiliate ID to a URL
 * 
 * For Bol.com links, uses the partner.bol.com format.
 * For other networks, adds appropriate tracking parameters.
 * 
 * @param baseUrl - The original product URL
 * @param networkIdOverride - Optional: force a specific network ID
 * @returns The URL with affiliate tracking, or original URL if no config
 */
export const generateAffiliateLink = (
    baseUrl: string,
    networkIdOverride?: AffiliateNetworkId
): string => {
    if (!baseUrl) return baseUrl;
    
    try {
        // Detect network from URL or use override
        const networkId = networkIdOverride || detectNetwork(baseUrl);
        if (!networkId) return baseUrl;
        
        // Get affiliate ID for this network
        const affiliateId = getAffiliateIdForNetwork(networkId);
        if (!affiliateId) return baseUrl;
        
        const parsedUrl = new URL(baseUrl);
        
        // Apply network-specific affiliate parameters
        switch (networkId) {
            case 'bol': {
                // Use the Bol.com partner click format
                const encodedUrl = encodeURIComponent(baseUrl);
                return `https://partner.bol.com/click/click?p=2&t=url&s=${affiliateId}&f=TXL&url=${encodedUrl}`;
            }
            
            case 'tradetracker': {
                // TradeTracker uses a redirect URL pattern
                parsedUrl.searchParams.set('tt', affiliateId);
                return parsedUrl.toString();
            }
            
            case 'daisycon': {
                parsedUrl.searchParams.set('dc', affiliateId);
                return parsedUrl.toString();
            }
            
            case 'awin': {
                parsedUrl.searchParams.set('awc', affiliateId);
                return parsedUrl.toString();
            }
            
            case 'paypro': {
                parsedUrl.searchParams.set('aff', affiliateId);
                return parsedUrl.toString();
            }
            
            case 'plugpay': {
                parsedUrl.searchParams.set('ref', affiliateId);
                return parsedUrl.toString();
            }
            
            default:
                return baseUrl;
        }
    } catch (error) {
        console.error('[AffiliateUtils] Error generating affiliate link:', error);
        return baseUrl;
    }
};

/**
 * Extract the affiliate ID from a URL
 * 
 * @param url - The URL to extract from
 * @returns Object with networkId and affiliateId, or null if not found
 */
export const extractAffiliateInfo = (url: string): { networkId: AffiliateNetworkId; affiliateId: string } | null => {
    if (!url) return null;
    
    try {
        const parsedUrl = new URL(url);
        
        // Check for Bol.com partner URL format
        if (parsedUrl.hostname.includes('partner.bol.com')) {
            const affiliateId = parsedUrl.searchParams.get('s');
            if (affiliateId) {
                return { networkId: 'bol', affiliateId };
            }
        }
        
        // Check common affiliate parameter names
        const paramMappings: Record<string, AffiliateNetworkId> = {
            'tt': 'tradetracker',
            'dc': 'daisycon',
            'awc': 'awin',
            'aff': 'paypro',
            'ref': 'plugpay',
        };
        
        for (const [param, networkId] of Object.entries(paramMappings)) {
            const value = parsedUrl.searchParams.get(param);
            if (value) {
                return { networkId, affiliateId: value };
            }
        }
        
        return null;
    } catch (error) {
        console.error('[AffiliateUtils] Error extracting affiliate info:', error);
        return null;
    }
};

// ============================================================================
// TRACKING DATA STORAGE
// ============================================================================

/**
 * Load tracking data from localStorage
 */
const loadTrackingData = (): AffiliateTrackingData => {
    try {
        const data = localStorage.getItem(AFFILIATE_TRACKING_KEY);
        if (!data) {
            return { clicks: [], conversions: [] };
        }
        return JSON.parse(data) as AffiliateTrackingData;
    } catch (error) {
        console.error('[AffiliateUtils] Error loading tracking data:', error);
        return { clicks: [], conversions: [] };
    }
};

/**
 * Save tracking data to localStorage
 */
const saveTrackingData = (data: AffiliateTrackingData): void => {
    try {
        localStorage.setItem(AFFILIATE_TRACKING_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('[AffiliateUtils] Error saving tracking data:', error);
    }
};

/**
 * Generate a unique ID for tracking records
 */
const generateRecordId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Clean up tracking entries older than TRACKING_EXPIRY_DAYS
 */
const cleanupOldEntries = (data: AffiliateTrackingData): void => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - TRACKING_EXPIRY_DAYS);
    const expiryTimestamp = expiryDate.toISOString();
    
    data.clicks = data.clicks.filter(c => c.timestamp >= expiryTimestamp);
    data.conversions = data.conversions.filter(c => c.timestamp >= expiryTimestamp);
};

// ============================================================================
// CLICK TRACKING
// ============================================================================

/**
 * Track a click on an affiliate link
 * 
 * @param networkId - The affiliate network ID
 * @param productId - The product ID that was clicked
 * @param productName - Optional product name for display
 */
export const trackAffiliateClick = (
    networkId: AffiliateNetworkId,
    productId: string,
    productName?: string
): void => {
    if (!networkId || !productId) {
        console.warn('[AffiliateUtils] Missing networkId or productId for click tracking');
        return;
    }
    
    const data = loadTrackingData();
    
    const clickRecord: AffiliateClickRecord = {
        id: generateRecordId(),
        networkId,
        productId,
        productName,
        timestamp: new Date().toISOString()
    };
    
    data.clicks.push(clickRecord);
    
    // Update global stats
    const config = loadAffiliateConfig();
    config.stats.totalClicks++;
    saveAffiliateConfig(config);
    
    // Cleanup old entries
    cleanupOldEntries(data);
    
    saveTrackingData(data);
    
    console.log('[AffiliateUtils] Click tracked:', { networkId, productId });
};

/**
 * Get all clicks, optionally filtered by network
 * 
 * @param networkId - Optional network ID to filter by
 * @returns Array of click records
 */
export const getClicks = (networkId?: AffiliateNetworkId): AffiliateClickRecord[] => {
    const data = loadTrackingData();
    cleanupOldEntries(data);
    saveTrackingData(data);
    
    if (networkId) {
        return data.clicks.filter(c => c.networkId === networkId);
    }
    return data.clicks;
};

// ============================================================================
// CONVERSION TRACKING
// ============================================================================

/**
 * Track a conversion through an affiliate link
 * 
 * @param networkId - The affiliate network ID
 * @param productId - The product ID that was purchased
 * @param amount - The conversion value in EUR
 * @param productName - Optional product name for display
 */
export const trackAffiliateConversion = (
    networkId: AffiliateNetworkId,
    productId: string,
    amount: number,
    productName?: string
): void => {
    if (!networkId || !productId) {
        console.warn('[AffiliateUtils] Missing networkId or productId for conversion tracking');
        return;
    }
    
    const data = loadTrackingData();
    
    const conversionRecord: AffiliateConversionRecord = {
        id: generateRecordId(),
        networkId,
        productId,
        productName,
        amount,
        timestamp: new Date().toISOString()
    };
    
    data.conversions.push(conversionRecord);
    
    // Update global stats
    const config = loadAffiliateConfig();
    config.stats.totalConversions++;
    config.stats.totalEarnings += amount;
    saveAffiliateConfig(config);
    
    // Cleanup old entries
    cleanupOldEntries(data);
    
    saveTrackingData(data);
    
    console.log('[AffiliateUtils] Conversion tracked:', { networkId, productId, amount });
};

/**
 * Get all conversions, optionally filtered by network
 * 
 * @param networkId - Optional network ID to filter by
 * @returns Array of conversion records
 */
export const getConversions = (networkId?: AffiliateNetworkId): AffiliateConversionRecord[] => {
    const data = loadTrackingData();
    cleanupOldEntries(data);
    saveTrackingData(data);
    
    if (networkId) {
        return data.conversions.filter(c => c.networkId === networkId);
    }
    return data.conversions;
};

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get statistics per network
 */
export const getNetworkStats = (): Record<AffiliateNetworkId, { clicks: number; conversions: number; earnings: number }> => {
    const data = loadTrackingData();
    cleanupOldEntries(data);
    
    const stats: Record<string, { clicks: number; conversions: number; earnings: number }> = {};
    
    // Initialize all networks
    for (const networkId of Object.keys(NETWORK_PATTERNS)) {
        stats[networkId] = { clicks: 0, conversions: 0, earnings: 0 };
    }
    
    // Count clicks
    for (const click of data.clicks) {
        if (stats[click.networkId]) {
            stats[click.networkId].clicks++;
        }
    }
    
    // Count conversions and earnings
    for (const conversion of data.conversions) {
        if (stats[conversion.networkId]) {
            stats[conversion.networkId].conversions++;
            stats[conversion.networkId].earnings += conversion.amount;
        }
    }
    
    return stats as Record<AffiliateNetworkId, { clicks: number; conversions: number; earnings: number }>;
};

/**
 * Get total statistics
 */
export const getTotalStats = (): { clicks: number; conversions: number; earnings: number } => {
    const config = loadAffiliateConfig();
    return {
        clicks: config.stats.totalClicks,
        conversions: config.stats.totalConversions,
        earnings: config.stats.totalEarnings
    };
};

/**
 * Get top performing products by clicks
 */
export const getTopProducts = (
    limit: number = 10
): Array<{ productId: string; productName?: string; clicks: number }> => {
    const data = loadTrackingData();
    const productClicks: Record<string, { name?: string; clicks: number }> = {};
    
    for (const click of data.clicks) {
        if (!productClicks[click.productId]) {
            productClicks[click.productId] = { name: click.productName, clicks: 0 };
        }
        productClicks[click.productId].clicks++;
    }
    
    return Object.entries(productClicks)
        .map(([productId, data]) => ({ productId, productName: data.name, clicks: data.clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, limit);
};

/**
 * Get clicks and conversions grouped by day for charting
 */
export const getDailyStats = (
    days: number = 30
): Array<{ date: string; clicks: number; conversions: number }> => {
    const data = loadTrackingData();
    const dailyStats: Record<string, { clicks: number; conversions: number }> = {};
    
    // Initialize all days
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyStats[dateStr] = { clicks: 0, conversions: 0 };
    }
    
    // Count clicks
    for (const click of data.clicks) {
        const dateStr = click.timestamp.split('T')[0];
        if (dailyStats[dateStr]) {
            dailyStats[dateStr].clicks++;
        }
    }
    
    // Count conversions
    for (const conversion of data.conversions) {
        const dateStr = conversion.timestamp.split('T')[0];
        if (dailyStats[dateStr]) {
            dailyStats[dateStr].conversions++;
        }
    }
    
    return Object.entries(dailyStats)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Get recent clicks for display
 */
export const getRecentClicks = (limit: number = 10): AffiliateClickRecord[] => {
    const data = loadTrackingData();
    return data.clicks
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);
};

/**
 * Get recent conversions for display
 */
export const getRecentConversions = (limit: number = 10): AffiliateConversionRecord[] => {
    const data = loadTrackingData();
    return data.conversions
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit);
};

// ============================================================================
// DATA MANAGEMENT
// ============================================================================

/**
 * Clear all tracking data
 */
export const clearTrackingData = (): void => {
    localStorage.removeItem(AFFILIATE_TRACKING_KEY);
    
    // Reset stats in config
    const config = loadAffiliateConfig();
    config.stats = { totalClicks: 0, totalConversions: 0, totalEarnings: 0 };
    saveAffiliateConfig(config);
    
    console.log('[AffiliateUtils] Tracking data cleared');
};

/**
 * Export all data as JSON
 */
export const exportAllData = (): string => {
    const config = loadAffiliateConfig();
    const tracking = loadTrackingData();
    return JSON.stringify({ config, tracking }, null, 2);
};

