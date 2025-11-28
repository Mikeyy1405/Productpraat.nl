/**
 * Bol.com Affiliate Service
 * 
 * Generates affiliate links for Bol.com products and tracks clicks.
 * 
 * @module services/bolcom/affiliate
 */

import { BolAffiliateLink, AffiliateClickEvent } from '../../types/bolcom';
import { getSupabase } from '../supabaseClient';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Bol.com affiliate URL patterns
 */
const BOL_AFFILIATE_BASE_URL = 'https://www.bol.com';

/**
 * Partner tracking parameter name
 */
const PARTNER_PARAM = 'Referrer';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get environment variable value
 */
const getEnvVar = (key: string): string => {
    // Check window injection (Server)
    if (typeof window !== 'undefined') {
        const windowEnv = (window as unknown as { __ENV__?: Record<string, string> }).__ENV__;
        if (windowEnv && windowEnv[key]) {
            return windowEnv[key];
        }
    }
    // Check Vite env (Local Dev)
    if ((import.meta as { env?: Record<string, string> }).env) {
        const viteEnv = (import.meta as { env: Record<string, string> }).env;
        if (viteEnv[key]) return viteEnv[key];
        if (viteEnv[`VITE_${key}`]) return viteEnv[`VITE_${key}`];
    }
    // Check Node.js environment
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] || '';
    }
    return '';
};

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if URL is a Bol.com URL
 * Uses strict hostname matching to prevent subdomain bypass attacks
 */
function isBolUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        // Strict matching: must be exactly bol.com or a subdomain of bol.com
        return hostname === 'bol.com' || 
               hostname === 'www.bol.com' || 
               hostname.endsWith('.bol.com');
    } catch {
        return false;
    }
}

// ============================================================================
// AFFILIATE SERVICE
// ============================================================================

/**
 * Bol.com Affiliate Service
 */
export const bolAffiliateService = {
    /**
     * Check if affiliate tracking is configured
     */
    isConfigured(): boolean {
        const affiliateId = getEnvVar('BOL_AFFILIATE_ID') || getEnvVar('BOL_PARTNER_ID');
        return Boolean(affiliateId);
    },

    /**
     * Get the configured affiliate/partner ID
     */
    getAffiliateId(): string | null {
        const id = getEnvVar('BOL_AFFILIATE_ID') || getEnvVar('BOL_PARTNER_ID');
        return id || null;
    },

    /**
     * Generate an affiliate link for a product URL
     * 
     * @param productUrl - Original Bol.com product URL
     * @returns Affiliate link with tracking parameters
     * 
     * @example
     * ```typescript
     * const link = bolAffiliateService.generateAffiliateLink(
     *     'https://www.bol.com/nl/p/samsung-tv/1234567890'
     * );
     * console.log(link.affiliateUrl);
     * // https://www.bol.com/nl/p/samsung-tv/1234567890?Referrer=productpraat_12345
     * ```
     */
    generateAffiliateLink(productUrl: string): BolAffiliateLink {
        const affiliateId = this.getAffiliateId();
        const now = new Date().toISOString();
        
        // If not a Bol.com URL or no affiliate ID, return original
        if (!isBolUrl(productUrl) || !affiliateId) {
            return {
                originalUrl: productUrl,
                affiliateUrl: productUrl,
                partnerId: affiliateId || '',
                generatedAt: now,
            };
        }
        
        try {
            const url = new URL(productUrl);
            
            // Add affiliate tracking parameter
            url.searchParams.set(PARTNER_PARAM, `productpraat_${affiliateId}`);
            
            return {
                originalUrl: productUrl,
                affiliateUrl: url.toString(),
                partnerId: affiliateId,
                generatedAt: now,
            };
        } catch {
            return {
                originalUrl: productUrl,
                affiliateUrl: productUrl,
                partnerId: affiliateId || '',
                generatedAt: now,
            };
        }
    },

    /**
     * Generate affiliate link for a product by EAN
     * 
     * @param ean - European Article Number
     * @returns Affiliate link
     */
    generateAffiliateLinkByEan(ean: string): BolAffiliateLink {
        const productUrl = `${BOL_AFFILIATE_BASE_URL}/nl/p/-/${ean}`;
        return this.generateAffiliateLink(productUrl);
    },

    /**
     * Track an affiliate click
     * 
     * Records the click in the database for analytics.
     * 
     * @param productEan - Product EAN
     * @param affiliateUrl - The affiliate URL that was clicked
     * @param referrer - Optional referrer URL
     * @returns Click event record
     */
    async trackClick(
        productEan: string,
        affiliateUrl: string,
        referrer?: string
    ): Promise<AffiliateClickEvent | null> {
        const clickEvent: AffiliateClickEvent = {
            productEan,
            affiliateUrl,
            clickedAt: new Date().toISOString(),
            sessionId: generateSessionId(),
            referrer,
        };
        
        try {
            const supabase = getSupabase();
            
            if (!supabase) {
                console.warn('[BolAffiliate] Database not configured, click not tracked');
                return clickEvent;
            }
            
            // Record click in database
            const { error } = await supabase
                .from('bol_affiliate_clicks')
                .insert({
                    product_ean: clickEvent.productEan,
                    affiliate_url: clickEvent.affiliateUrl,
                    clicked_at: clickEvent.clickedAt,
                    session_id: clickEvent.sessionId,
                    referrer: clickEvent.referrer,
                });
            
            if (error) {
                console.error('[BolAffiliate] Failed to track click:', error);
            } else {
                console.log(`[BolAffiliate] Click tracked for EAN ${productEan}`);
            }
            
            return clickEvent;
        } catch (error) {
            console.error('[BolAffiliate] Error tracking click:', error);
            return clickEvent;
        }
    },

    /**
     * Get click statistics for a product
     * 
     * @param productEan - Product EAN
     * @returns Click statistics
     */
    async getClickStats(productEan: string): Promise<{
        totalClicks: number;
        clicksToday: number;
        clicksThisWeek: number;
        clicksThisMonth: number;
    }> {
        const defaultStats = {
            totalClicks: 0,
            clicksToday: 0,
            clicksThisWeek: 0,
            clicksThisMonth: 0,
        };
        
        try {
            const supabase = getSupabase();
            
            if (!supabase) {
                return defaultStats;
            }
            
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            
            // Get total clicks
            const { count: totalClicks } = await supabase
                .from('bol_affiliate_clicks')
                .select('*', { count: 'exact', head: true })
                .eq('product_ean', productEan);
            
            // Get clicks today
            const { count: clicksToday } = await supabase
                .from('bol_affiliate_clicks')
                .select('*', { count: 'exact', head: true })
                .eq('product_ean', productEan)
                .gte('clicked_at', todayStart);
            
            // Get clicks this week
            const { count: clicksThisWeek } = await supabase
                .from('bol_affiliate_clicks')
                .select('*', { count: 'exact', head: true })
                .eq('product_ean', productEan)
                .gte('clicked_at', weekStart);
            
            // Get clicks this month
            const { count: clicksThisMonth } = await supabase
                .from('bol_affiliate_clicks')
                .select('*', { count: 'exact', head: true })
                .eq('product_ean', productEan)
                .gte('clicked_at', monthStart);
            
            return {
                totalClicks: totalClicks || 0,
                clicksToday: clicksToday || 0,
                clicksThisWeek: clicksThisWeek || 0,
                clicksThisMonth: clicksThisMonth || 0,
            };
        } catch (error) {
            console.error('[BolAffiliate] Error getting click stats:', error);
            return defaultStats;
        }
    },

    /**
     * Process an affiliate link click
     * 
     * Generates the affiliate link, tracks the click, and returns the URL to redirect to.
     * 
     * @param productUrl - Original product URL
     * @param productEan - Product EAN for tracking
     * @returns Affiliate URL to redirect to
     */
    async handleClick(productUrl: string, productEan: string): Promise<string> {
        const affiliateLink = this.generateAffiliateLink(productUrl);
        
        // Track the click (fire and forget)
        this.trackClick(productEan, affiliateLink.affiliateUrl).catch(() => {
            // Silently ignore tracking errors
        });
        
        return affiliateLink.affiliateUrl;
    },

    /**
     * Bulk generate affiliate links for multiple products
     * 
     * @param products - Array of { url, ean }
     * @returns Array of affiliate links
     */
    bulkGenerateLinks(products: { url: string; ean: string }[]): BolAffiliateLink[] {
        return products.map(p => this.generateAffiliateLink(p.url));
    },
};

export default bolAffiliateService;
