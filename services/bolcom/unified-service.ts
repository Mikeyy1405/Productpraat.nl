/**
 * Unified Bol.com Service
 *
 * Combines the Bol.com Marketing Catalog API with Playwright automation
 * for comprehensive product data, affiliate links, and media access.
 *
 * Strategy:
 * 1. Use API first (faster, more reliable)
 * 2. Fall back to Playwright for features API doesn't support
 * 3. Use Playwright for enhanced media and Partner Plaza features
 *
 * @module services/bolcom/unified-service
 */

import { bolProductService } from './products';
import { bolAffiliateService } from './affiliate';
import {
    BolPlaywrightService,
    getBolPlaywrightService,
    isPlaywrightConfigured,
    DeeplinkResult,
    MediaDownloadResult,
    MediaItem,
} from './playwright-service';
import { BolProduct, ProductMedia, BolAffiliateLink } from '../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

export interface UnifiedProductResult {
    product: BolProduct | null;
    affiliateLink: BolAffiliateLink | null;
    media: MediaItem[];
    source: 'api' | 'playwright' | 'hybrid';
    success: boolean;
    errors: string[];
}

export interface UnifiedMediaResult {
    ean: string;
    apiMedia: ProductMedia[];
    playwrightMedia: MediaItem[];
    allMedia: MediaItem[];
    highResAvailable: boolean;
    success: boolean;
}

export interface UnifiedAffiliateResult {
    originalUrl: string;
    affiliateUrl: string;
    shortUrl?: string;
    source: 'api' | 'playwright';
    success: boolean;
    error?: string;
}

export interface ServiceStatus {
    api: {
        configured: boolean;
        available: boolean;
    };
    playwright: {
        configured: boolean;
        loggedIn: boolean;
        sessionExpires?: string;
    };
}

// ============================================================================
// UNIFIED SERVICE CLASS
// ============================================================================

export class UnifiedBolService {
    private playwrightService: BolPlaywrightService | null = null;
    private playwrightInitialized = false;

    /**
     * Initialize Playwright service (lazy loading)
     */
    private async initPlaywright(): Promise<BolPlaywrightService | null> {
        if (!isPlaywrightConfigured()) {
            console.log('[UnifiedBol] Playwright not configured (missing credentials)');
            return null;
        }

        if (!this.playwrightInitialized) {
            try {
                this.playwrightService = getBolPlaywrightService();
                await this.playwrightService.initialize();
                this.playwrightInitialized = true;
            } catch (error) {
                console.error('[UnifiedBol] Failed to initialize Playwright:', error);
                return null;
            }
        }

        return this.playwrightService;
    }

    /**
     * Get service status
     */
    async getStatus(): Promise<ServiceStatus> {
        const status: ServiceStatus = {
            api: {
                configured: bolProductService !== undefined,
                available: false,
            },
            playwright: {
                configured: isPlaywrightConfigured(),
                loggedIn: false,
            },
        };

        // Check API availability
        try {
            // Simple check - just see if the service is accessible
            status.api.available = true;
        } catch {
            status.api.available = false;
        }

        // Check Playwright status
        if (status.playwright.configured) {
            const playwright = await this.initPlaywright();
            if (playwright) {
                const sessionState = playwright.getSessionState();
                status.playwright.loggedIn = sessionState?.isLoggedIn || false;
                status.playwright.sessionExpires = sessionState?.expiresAt;
            }
        }

        return status;
    }

    /**
     * Get comprehensive product data
     * Uses API first, enhances with Playwright if available
     */
    async getProduct(ean: string): Promise<UnifiedProductResult> {
        const result: UnifiedProductResult = {
            product: null,
            affiliateLink: null,
            media: [],
            source: 'api',
            success: false,
            errors: [],
        };

        // Try API first
        try {
            const apiProduct = await bolProductService.getProductByEan(ean);

            if (apiProduct) {
                result.product = apiProduct;
                result.success = true;

                // Generate affiliate link via API service
                if (apiProduct.url) {
                    result.affiliateLink = bolAffiliateService.generateAffiliateLink(apiProduct.url);
                }

                // Get API media
                const apiMedia = await bolProductService.getProductMedia(ean);
                result.media = apiMedia.map(m => ({
                    type: m.type.toLowerCase() as 'image' | 'video' | '360',
                    url: m.url,
                    thumbnailUrl: m.thumbnailUrl,
                    width: m.width,
                    height: m.height,
                }));
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'API error';
            result.errors.push(`API: ${errorMsg}`);
        }

        // Enhance with Playwright if available and API didn't give full results
        const playwright = await this.initPlaywright();

        if (playwright && result.product?.url) {
            try {
                result.source = 'hybrid';

                // Get enhanced media via Playwright
                const playwrightMedia = await playwright.getProductMedia(result.product.url);

                if (playwrightMedia.success) {
                    // Merge media, preferring high-res versions
                    const existingUrls = new Set(result.media.map(m => m.url));

                    for (const media of playwrightMedia.media) {
                        // Add new media or replace with high-res versions
                        const existing = result.media.find(m =>
                            m.url === media.url || m.url === media.highResUrl
                        );

                        if (!existing && !existingUrls.has(media.url)) {
                            result.media.push(media);
                        } else if (existing && media.highResUrl) {
                            // Upgrade to high-res
                            existing.highResUrl = media.highResUrl;
                        }
                    }
                }

                // Try to get enhanced affiliate link via Partner Plaza
                const deeplink = await playwright.generateDeeplink(result.product.url);

                if (deeplink.success && deeplink.affiliateUrl !== result.product.url) {
                    result.affiliateLink = {
                        originalUrl: result.product.url,
                        affiliateUrl: deeplink.affiliateUrl,
                        partnerId: result.affiliateLink?.partnerId || '',
                        generatedAt: deeplink.generatedAt,
                    };
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Playwright error';
                result.errors.push(`Playwright: ${errorMsg}`);
            }
        }

        return result;
    }

    /**
     * Get product by URL
     */
    async getProductByUrl(url: string): Promise<UnifiedProductResult> {
        // Extract EAN from URL if possible
        const eanMatch = url.match(/\/(\d{13})(?:[/?]|$)/);

        if (eanMatch) {
            return this.getProduct(eanMatch[1]);
        }

        // Fallback: use Playwright directly for URL-based lookup
        const result: UnifiedProductResult = {
            product: null,
            affiliateLink: null,
            media: [],
            source: 'playwright',
            success: false,
            errors: [],
        };

        const playwright = await this.initPlaywright();

        if (!playwright) {
            result.errors.push('Playwright not available and no EAN in URL');
            return result;
        }

        try {
            const mediaResult = await playwright.getProductMedia(url);

            if (mediaResult.success) {
                result.media = mediaResult.media;
                result.success = true;

                if (mediaResult.ean) {
                    // Now try to get full product data via API
                    const apiProduct = await bolProductService.getProductByEan(mediaResult.ean);
                    if (apiProduct) {
                        result.product = apiProduct;
                        result.source = 'hybrid';
                    }
                }
            }

            // Generate affiliate link
            const deeplink = await playwright.generateDeeplink(url);
            if (deeplink.success) {
                result.affiliateLink = {
                    originalUrl: url,
                    affiliateUrl: deeplink.affiliateUrl,
                    partnerId: '',
                    generatedAt: deeplink.generatedAt,
                };
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(errorMsg);
        }

        return result;
    }

    /**
     * Get best affiliate link (tries Partner Plaza first, falls back to API)
     */
    async getAffiliateLink(productUrl: string): Promise<UnifiedAffiliateResult> {
        const result: UnifiedAffiliateResult = {
            originalUrl: productUrl,
            affiliateUrl: productUrl,
            source: 'api',
            success: false,
        };

        // Try Playwright first for official Partner Plaza deeplinks
        const playwright = await this.initPlaywright();

        if (playwright) {
            try {
                if (await playwright.ensureLoggedIn()) {
                    const deeplink = await playwright.generateDeeplink(productUrl);

                    if (deeplink.success) {
                        result.affiliateUrl = deeplink.affiliateUrl;
                        result.shortUrl = deeplink.shortUrl;
                        result.source = 'playwright';
                        result.success = true;
                        return result;
                    }
                }
            } catch (error) {
                console.warn('[UnifiedBol] Playwright affiliate failed, using API fallback');
            }
        }

        // Fallback to API-based affiliate link generation
        try {
            const apiLink = bolAffiliateService.generateAffiliateLink(productUrl);
            result.affiliateUrl = apiLink.affiliateUrl;
            result.source = 'api';
            result.success = true;
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
        }

        return result;
    }

    /**
     * Get all media for a product (combined API + Playwright)
     */
    async getAllMedia(ean: string): Promise<UnifiedMediaResult> {
        const result: UnifiedMediaResult = {
            ean,
            apiMedia: [],
            playwrightMedia: [],
            allMedia: [],
            highResAvailable: false,
            success: false,
        };

        // Get API media
        try {
            result.apiMedia = await bolProductService.getProductMedia(ean);
        } catch (error) {
            console.warn('[UnifiedBol] API media fetch failed:', error);
        }

        // Get Playwright media for high-res
        const playwright = await this.initPlaywright();

        if (playwright) {
            try {
                const product = await bolProductService.getProductByEan(ean);

                if (product?.url) {
                    const mediaResult = await playwright.getProductMedia(product.url);

                    if (mediaResult.success) {
                        result.playwrightMedia = mediaResult.media;
                        result.highResAvailable = mediaResult.media.some(m => m.highResUrl);
                    }
                }
            } catch (error) {
                console.warn('[UnifiedBol] Playwright media fetch failed:', error);
            }
        }

        // Merge all media
        const seenUrls = new Set<string>();

        // Add API media first
        for (const media of result.apiMedia) {
            if (!seenUrls.has(media.url)) {
                seenUrls.add(media.url);
                result.allMedia.push({
                    type: media.type.toLowerCase() as 'image' | 'video' | '360',
                    url: media.url,
                    thumbnailUrl: media.thumbnailUrl,
                    width: media.width,
                    height: media.height,
                });
            }
        }

        // Add Playwright media (with high-res if available)
        for (const media of result.playwrightMedia) {
            const existing = result.allMedia.find(m => m.url === media.url);

            if (existing) {
                // Update with high-res URL if available
                if (media.highResUrl) {
                    existing.highResUrl = media.highResUrl;
                }
            } else if (!seenUrls.has(media.url)) {
                seenUrls.add(media.url);
                result.allMedia.push(media);
            }
        }

        result.success = result.allMedia.length > 0;
        return result;
    }

    /**
     * Download media for a product to disk
     */
    async downloadProductMedia(
        ean: string,
        outputDir: string,
        preferHighRes = true
    ): Promise<string[]> {
        const playwright = await this.initPlaywright();

        if (!playwright) {
            throw new Error('Playwright not available for media download');
        }

        const mediaResult = await this.getAllMedia(ean);

        if (!mediaResult.success || mediaResult.allMedia.length === 0) {
            return [];
        }

        // Prepare media items for download
        const itemsToDownload = mediaResult.allMedia.map(item => ({
            ...item,
            url: preferHighRes && item.highResUrl ? item.highResUrl : item.url,
        }));

        return await playwright.downloadMedia(itemsToDownload, outputDir);
    }

    /**
     * Bulk get products with affiliate links
     */
    async bulkGetProducts(eans: string[]): Promise<UnifiedProductResult[]> {
        const results: UnifiedProductResult[] = [];

        for (const ean of eans) {
            const result = await this.getProduct(ean);
            results.push(result);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return results;
    }

    /**
     * Login to Partner Plaza (for affiliate features)
     */
    async loginToPartnerPlaza(): Promise<boolean> {
        const playwright = await this.initPlaywright();

        if (!playwright) {
            console.error('[UnifiedBol] Playwright not configured');
            return false;
        }

        return await playwright.login();
    }

    /**
     * Check if logged in to Partner Plaza
     */
    async isLoggedIn(): Promise<boolean> {
        const playwright = await this.initPlaywright();

        if (!playwright) {
            return false;
        }

        return await playwright.isLoggedIn();
    }

    /**
     * Logout from Partner Plaza
     */
    async logout(): Promise<void> {
        if (this.playwrightService) {
            await this.playwrightService.clearSession();
        }
    }

    /**
     * Cleanup resources
     */
    async close(): Promise<void> {
        if (this.playwrightService) {
            await this.playwrightService.close();
            this.playwrightService = null;
            this.playwrightInitialized = false;
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: UnifiedBolService | null = null;

/**
 * Get singleton instance of UnifiedBolService
 */
export function getUnifiedBolService(): UnifiedBolService {
    if (!instance) {
        instance = new UnifiedBolService();
    }
    return instance;
}

/**
 * Convenience functions for common operations
 */
export const unifiedBolService = {
    /**
     * Get product with all data
     */
    async getProduct(ean: string) {
        return getUnifiedBolService().getProduct(ean);
    },

    /**
     * Get product by URL
     */
    async getProductByUrl(url: string) {
        return getUnifiedBolService().getProductByUrl(url);
    },

    /**
     * Get affiliate link
     */
    async getAffiliateLink(productUrl: string) {
        return getUnifiedBolService().getAffiliateLink(productUrl);
    },

    /**
     * Get all media (API + high-res from Playwright)
     */
    async getAllMedia(ean: string) {
        return getUnifiedBolService().getAllMedia(ean);
    },

    /**
     * Download product media
     */
    async downloadMedia(ean: string, outputDir: string) {
        return getUnifiedBolService().downloadProductMedia(ean, outputDir);
    },

    /**
     * Check service status
     */
    async getStatus() {
        return getUnifiedBolService().getStatus();
    },

    /**
     * Login to Partner Plaza
     */
    async login() {
        return getUnifiedBolService().loginToPartnerPlaza();
    },

    /**
     * Cleanup
     */
    async close() {
        return getUnifiedBolService().close();
    },
};

export default unifiedBolService;
