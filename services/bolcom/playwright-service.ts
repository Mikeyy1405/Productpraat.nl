/**
 * Bol.com Playwright Automation Service
 *
 * Provides browser automation for Bol.com Partner Plaza operations:
 * - Login & session management
 * - Affiliate deeplink generation
 * - High-resolution media downloading
 *
 * @module services/bolcom/playwright-service
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface BolCredentials {
    email: string;
    password: string;
}

export interface DeeplinkResult {
    originalUrl: string;
    affiliateUrl: string;
    shortUrl?: string;
    generatedAt: string;
    success: boolean;
    error?: string;
}

export interface MediaItem {
    type: 'image' | 'video' | '360';
    url: string;
    highResUrl?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    filename?: string;
}

export interface MediaDownloadResult {
    ean: string;
    media: MediaItem[];
    downloadedFiles?: string[];
    success: boolean;
    error?: string;
}

export interface SessionState {
    isLoggedIn: boolean;
    lastLoginAt?: string;
    expiresAt?: string;
    cookies?: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
    }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Bol.com URLs
    urls: {
        login: 'https://login.bol.com/login',
        partnerPlaza: 'https://partner.bol.com',
        deeplinkGenerator: 'https://partner.bol.com/click/deeplink-generator',
        productPage: 'https://www.bol.com/nl/p/',
    },
    // Session storage path
    sessionPath: path.join(process.cwd(), '.bol-session'),
    // Timeouts
    timeouts: {
        navigation: 30000,
        action: 10000,
        login: 60000,
    },
    // Browser settings
    browser: {
        headless: true,
        slowMo: 50, // Slow down actions slightly to avoid detection
    },
};

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

const getEnvVar = (key: string): string => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] || '';
    }
    return '';
};

const getCredentials = (): BolCredentials | null => {
    const email = getEnvVar('BOL_PARTNER_EMAIL');
    const password = getEnvVar('BOL_PARTNER_PASSWORD');

    if (!email || !password) {
        return null;
    }

    return { email, password };
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Save session state to disk
 */
async function saveSession(context: BrowserContext): Promise<void> {
    try {
        const cookies = await context.cookies();
        const state: SessionState = {
            isLoggedIn: true,
            lastLoginAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            cookies: cookies.map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
            })),
        };

        // Ensure directory exists
        if (!fs.existsSync(CONFIG.sessionPath)) {
            fs.mkdirSync(CONFIG.sessionPath, { recursive: true });
        }

        fs.writeFileSync(
            path.join(CONFIG.sessionPath, 'session.json'),
            JSON.stringify(state, null, 2)
        );

        // Also save Playwright storage state
        await context.storageState({ path: path.join(CONFIG.sessionPath, 'storage.json') });

        console.log('[BolPlaywright] Session saved');
    } catch (error) {
        console.error('[BolPlaywright] Failed to save session:', error);
    }
}

/**
 * Load session state from disk
 */
function loadSession(): SessionState | null {
    try {
        const sessionFile = path.join(CONFIG.sessionPath, 'session.json');

        if (!fs.existsSync(sessionFile)) {
            return null;
        }

        const state = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as SessionState;

        // Check if session is expired
        if (state.expiresAt && new Date(state.expiresAt) < new Date()) {
            console.log('[BolPlaywright] Session expired');
            return null;
        }

        return state;
    } catch (error) {
        console.error('[BolPlaywright] Failed to load session:', error);
        return null;
    }
}

/**
 * Check if storage state exists
 */
function hasStorageState(): boolean {
    return fs.existsSync(path.join(CONFIG.sessionPath, 'storage.json'));
}

// ============================================================================
// PLAYWRIGHT SERVICE CLASS
// ============================================================================

export class BolPlaywrightService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private sessionState: SessionState | null = null;

    /**
     * Initialize the browser instance
     */
    async initialize(): Promise<void> {
        if (this.browser) {
            return; // Already initialized
        }

        console.log('[BolPlaywright] Initializing browser...');

        this.browser = await chromium.launch({
            headless: CONFIG.browser.headless,
            slowMo: CONFIG.browser.slowMo,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        // Load existing session if available
        const storageStatePath = path.join(CONFIG.sessionPath, 'storage.json');

        if (hasStorageState()) {
            this.sessionState = loadSession();

            if (this.sessionState?.isLoggedIn) {
                console.log('[BolPlaywright] Loading existing session...');
                this.context = await this.browser.newContext({
                    storageState: storageStatePath,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport: { width: 1920, height: 1080 },
                });
            }
        }

        if (!this.context) {
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
            });
        }

        this.page = await this.context.newPage();

        // Set default timeout
        this.page.setDefaultTimeout(CONFIG.timeouts.action);

        console.log('[BolPlaywright] Browser initialized');
    }

    /**
     * Close the browser and cleanup
     */
    async close(): Promise<void> {
        if (this.context && this.sessionState?.isLoggedIn) {
            await saveSession(this.context);
        }

        if (this.page) {
            await this.page.close();
            this.page = null;
        }

        if (this.context) {
            await this.context.close();
            this.context = null;
        }

        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }

        console.log('[BolPlaywright] Browser closed');
    }

    /**
     * Check if user is logged in
     */
    async isLoggedIn(): Promise<boolean> {
        if (!this.page) {
            await this.initialize();
        }

        try {
            // Navigate to Partner Plaza
            await this.page!.goto(CONFIG.urls.partnerPlaza, {
                timeout: CONFIG.timeouts.navigation,
                waitUntil: 'networkidle',
            });

            // Check if we're on the dashboard (logged in) or login page
            const url = this.page!.url();
            const isLoggedIn = url.includes('partner.bol.com') && !url.includes('login');

            this.sessionState = {
                ...this.sessionState,
                isLoggedIn,
            };

            return isLoggedIn;
        } catch (error) {
            console.error('[BolPlaywright] Error checking login status:', error);
            return false;
        }
    }

    /**
     * Login to Bol.com Partner Plaza
     */
    async login(credentials?: BolCredentials): Promise<boolean> {
        const creds = credentials || getCredentials();

        if (!creds) {
            console.error('[BolPlaywright] No credentials provided');
            return false;
        }

        if (!this.page) {
            await this.initialize();
        }

        console.log('[BolPlaywright] Logging in to Partner Plaza...');

        try {
            // Navigate to login page
            await this.page!.goto(CONFIG.urls.login, {
                timeout: CONFIG.timeouts.navigation,
                waitUntil: 'networkidle',
            });

            // Wait for and fill email
            await this.page!.waitForSelector('input[type="email"], input[name="email"], #email', {
                timeout: CONFIG.timeouts.action,
            });

            const emailInput = await this.page!.$('input[type="email"], input[name="email"], #email');
            if (emailInput) {
                await emailInput.fill(creds.email);
            }

            // Fill password
            const passwordInput = await this.page!.$('input[type="password"], input[name="password"], #password');
            if (passwordInput) {
                await passwordInput.fill(creds.password);
            }

            // Click login button
            const loginButton = await this.page!.$('button[type="submit"], input[type="submit"], button:has-text("Inloggen"), button:has-text("Log in")');
            if (loginButton) {
                await loginButton.click();
            }

            // Wait for navigation after login
            await this.page!.waitForNavigation({
                timeout: CONFIG.timeouts.login,
                waitUntil: 'networkidle',
            });

            // Check if login was successful
            const currentUrl = this.page!.url();
            const loginSuccessful = !currentUrl.includes('login') && !currentUrl.includes('error');

            if (loginSuccessful) {
                console.log('[BolPlaywright] Login successful');

                this.sessionState = {
                    isLoggedIn: true,
                    lastLoginAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                };

                // Save session
                await saveSession(this.context!);

                return true;
            } else {
                console.error('[BolPlaywright] Login failed - still on login page');
                return false;
            }
        } catch (error) {
            console.error('[BolPlaywright] Login error:', error);
            return false;
        }
    }

    /**
     * Ensure user is logged in, login if necessary
     */
    async ensureLoggedIn(credentials?: BolCredentials): Promise<boolean> {
        if (await this.isLoggedIn()) {
            return true;
        }

        return await this.login(credentials);
    }

    /**
     * Generate affiliate deeplink via Partner Plaza
     */
    async generateDeeplink(productUrl: string): Promise<DeeplinkResult> {
        const result: DeeplinkResult = {
            originalUrl: productUrl,
            affiliateUrl: productUrl,
            generatedAt: new Date().toISOString(),
            success: false,
        };

        try {
            // Ensure logged in
            if (!await this.ensureLoggedIn()) {
                result.error = 'Not logged in and unable to login';
                return result;
            }

            console.log(`[BolPlaywright] Generating deeplink for: ${productUrl}`);

            // Navigate to deeplink generator
            await this.page!.goto(CONFIG.urls.deeplinkGenerator, {
                timeout: CONFIG.timeouts.navigation,
                waitUntil: 'networkidle',
            });

            // Find and fill the URL input
            const urlInput = await this.page!.$('input[name="url"], input[placeholder*="URL"], input[type="url"], #deeplink-input, textarea[name="url"]');

            if (!urlInput) {
                // Try alternative selectors
                const inputs = await this.page!.$$('input[type="text"], textarea');
                for (const input of inputs) {
                    const placeholder = await input.getAttribute('placeholder');
                    if (placeholder?.toLowerCase().includes('url') || placeholder?.toLowerCase().includes('link')) {
                        await input.fill(productUrl);
                        break;
                    }
                }
            } else {
                await urlInput.fill(productUrl);
            }

            // Click generate button
            const generateButton = await this.page!.$('button:has-text("Genereer"), button:has-text("Generate"), button[type="submit"], .generate-button');

            if (generateButton) {
                await generateButton.click();

                // Wait for result
                await this.page!.waitForTimeout(2000);
            }

            // Try to find the generated affiliate link
            const affiliateLinkSelectors = [
                'input[readonly]',
                '.deeplink-result input',
                '.affiliate-url',
                'input[value*="partner.bol.com"]',
                'input[value*="tracking"]',
                'textarea[readonly]',
            ];

            for (const selector of affiliateLinkSelectors) {
                const element = await this.page!.$(selector);
                if (element) {
                    const value = await element.getAttribute('value') || await element.textContent();
                    if (value && (value.includes('partner.bol.com') || value.includes('bol.com') && value.includes('Referrer'))) {
                        result.affiliateUrl = value.trim();
                        result.success = true;
                        break;
                    }
                }
            }

            // Also try to get short URL if available
            const shortUrlElement = await this.page!.$('.short-url input, input[value*="s.bbol.nl"]');
            if (shortUrlElement) {
                const shortUrl = await shortUrlElement.getAttribute('value');
                if (shortUrl) {
                    result.shortUrl = shortUrl;
                }
            }

            if (!result.success) {
                // Fallback: construct affiliate link manually
                const partnerId = getEnvVar('BOL_PARTNER_ID');
                if (partnerId) {
                    const url = new URL(productUrl);
                    url.searchParams.set('Referrer', `productpraat_${partnerId}`);
                    result.affiliateUrl = url.toString();
                    result.success = true;
                    console.log('[BolPlaywright] Using fallback affiliate link');
                }
            }

            console.log(`[BolPlaywright] Deeplink generated: ${result.affiliateUrl}`);
            return result;
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BolPlaywright] Deeplink generation error:', error);
            return result;
        }
    }

    /**
     * Bulk generate deeplinks for multiple product URLs
     */
    async bulkGenerateDeeplinks(productUrls: string[]): Promise<DeeplinkResult[]> {
        const results: DeeplinkResult[] = [];

        for (const url of productUrls) {
            const result = await this.generateDeeplink(url);
            results.push(result);

            // Small delay between requests
            await this.page!.waitForTimeout(500);
        }

        return results;
    }

    /**
     * Get high-resolution media from a product page
     */
    async getProductMedia(productUrl: string): Promise<MediaDownloadResult> {
        const result: MediaDownloadResult = {
            ean: '',
            media: [],
            success: false,
        };

        try {
            if (!this.page) {
                await this.initialize();
            }

            console.log(`[BolPlaywright] Fetching media for: ${productUrl}`);

            // Navigate to product page
            await this.page!.goto(productUrl, {
                timeout: CONFIG.timeouts.navigation,
                waitUntil: 'networkidle',
            });

            // Extract EAN from URL or page
            const eanMatch = productUrl.match(/\/(\d{13})(?:[/?]|$)/);
            if (eanMatch) {
                result.ean = eanMatch[1];
            } else {
                // Try to find EAN on page
                const eanElement = await this.page!.$('[data-ean], .ean-number, span:has-text("EAN")');
                if (eanElement) {
                    const eanText = await eanElement.textContent();
                    const ean = eanText?.match(/\d{13}/)?.[0];
                    if (ean) {
                        result.ean = ean;
                    }
                }
            }

            // Find all product images
            const imageSelectors = [
                '.product-image img',
                '.product-gallery img',
                '[data-test="product-image"] img',
                '.js-product-images img',
                'picture source',
                '.image-gallery img',
                '[class*="ProductImage"] img',
            ];

            const images: MediaItem[] = [];
            const seenUrls = new Set<string>();

            for (const selector of imageSelectors) {
                const elements = await this.page!.$$(selector);

                for (const element of elements) {
                    // Get various image URLs
                    const src = await element.getAttribute('src');
                    const srcset = await element.getAttribute('srcset');
                    const dataSrc = await element.getAttribute('data-src');
                    const dataLargeSrc = await element.getAttribute('data-large-src');
                    const dataZoomSrc = await element.getAttribute('data-zoom-src');

                    const urls = [src, dataSrc, dataLargeSrc, dataZoomSrc].filter(Boolean) as string[];

                    // Parse srcset for high-res versions
                    if (srcset) {
                        const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
                        urls.push(...srcsetUrls);
                    }

                    for (const url of urls) {
                        if (!url || seenUrls.has(url)) continue;

                        // Convert to full URL if relative
                        const fullUrl = url.startsWith('http') ? url : `https://www.bol.com${url}`;

                        // Skip tiny thumbnails
                        if (fullUrl.includes('_1_') || fullUrl.includes('_xs_') || fullUrl.includes('30x30')) {
                            continue;
                        }

                        seenUrls.add(fullUrl);

                        // Try to get highest resolution version
                        let highResUrl = fullUrl;

                        // Bol.com image URL patterns - try to get highest resolution
                        if (fullUrl.includes('media.s-bol.com')) {
                            // Replace size indicators with largest versions
                            highResUrl = fullUrl
                                .replace(/_\d+x\d+\./, '_1200x1200.')
                                .replace(/\/\d+x\d+\//, '/1200x1200/')
                                .replace(/_s_/, '_xl_')
                                .replace(/_m_/, '_xl_')
                                .replace(/_l_/, '_xl_');
                        }

                        images.push({
                            type: 'image',
                            url: fullUrl,
                            highResUrl: highResUrl !== fullUrl ? highResUrl : undefined,
                            filename: path.basename(new URL(fullUrl).pathname),
                        });
                    }
                }
            }

            // Find videos
            const videoSelectors = [
                'video source',
                '[data-video-url]',
                '.product-video',
                'iframe[src*="youtube"]',
                'iframe[src*="vimeo"]',
            ];

            for (const selector of videoSelectors) {
                const elements = await this.page!.$$(selector);

                for (const element of elements) {
                    const src = await element.getAttribute('src') || await element.getAttribute('data-video-url');

                    if (src && !seenUrls.has(src)) {
                        seenUrls.add(src);
                        images.push({
                            type: 'video',
                            url: src,
                            filename: path.basename(new URL(src).pathname),
                        });
                    }
                }
            }

            // Look for 360-degree images
            const rotateElements = await this.page!.$$('[data-360], .product-360, [class*="360"]');
            for (const element of rotateElements) {
                const dataImages = await element.getAttribute('data-images');
                if (dataImages) {
                    try {
                        const imageList = JSON.parse(dataImages);
                        if (Array.isArray(imageList)) {
                            for (const imgUrl of imageList) {
                                if (!seenUrls.has(imgUrl)) {
                                    seenUrls.add(imgUrl);
                                    images.push({
                                        type: '360',
                                        url: imgUrl,
                                    });
                                }
                            }
                        }
                    } catch {
                        // Not valid JSON, skip
                    }
                }
            }

            result.media = images;
            result.success = images.length > 0;

            console.log(`[BolPlaywright] Found ${images.length} media items`);
            return result;
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BolPlaywright] Media fetch error:', error);
            return result;
        }
    }

    /**
     * Download media files to disk
     */
    async downloadMedia(
        mediaItems: MediaItem[],
        outputDir: string
    ): Promise<string[]> {
        const downloadedFiles: string[] = [];

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const item of mediaItems) {
            try {
                const urlToDownload = item.highResUrl || item.url;
                const filename = item.filename || `media_${Date.now()}_${downloadedFiles.length}`;
                const outputPath = path.join(outputDir, filename);

                // Download using page context for proper cookies/headers
                const response = await this.page!.request.get(urlToDownload);

                if (response.ok()) {
                    const buffer = await response.body();
                    fs.writeFileSync(outputPath, buffer);
                    downloadedFiles.push(outputPath);
                    console.log(`[BolPlaywright] Downloaded: ${filename}`);
                }
            } catch (error) {
                console.error(`[BolPlaywright] Failed to download ${item.url}:`, error);
            }
        }

        return downloadedFiles;
    }

    /**
     * Get current session state
     */
    getSessionState(): SessionState | null {
        return this.sessionState;
    }

    /**
     * Clear session (logout)
     */
    async clearSession(): Promise<void> {
        // Delete session files
        if (fs.existsSync(CONFIG.sessionPath)) {
            fs.rmSync(CONFIG.sessionPath, { recursive: true, force: true });
        }

        this.sessionState = null;

        // Clear browser context
        if (this.context) {
            await this.context.clearCookies();
        }

        console.log('[BolPlaywright] Session cleared');
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: BolPlaywrightService | null = null;

/**
 * Get singleton instance of BolPlaywrightService
 */
export function getBolPlaywrightService(): BolPlaywrightService {
    if (!instance) {
        instance = new BolPlaywrightService();
    }
    return instance;
}

/**
 * Check if Playwright service is configured (credentials available)
 */
export function isPlaywrightConfigured(): boolean {
    return getCredentials() !== null;
}

export default BolPlaywrightService;
