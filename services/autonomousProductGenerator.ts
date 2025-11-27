/**
 * Autonomous Product Generator Service
 * 
 * Automatically generates products based on automation configuration.
 * Uses existing scrapeURL and generateProductReview functions.
 * Respects rate limiting between requests.
 * 
 * @module services/autonomousProductGenerator
 */

import { getSupabase } from './supabaseClient';
import { Product, CATEGORIES } from '../types';
import { AutomationConfig, AutomationResult } from '../types/automationTypes';
import { loadAutomationConfig } from './automationConfigService';
import { scrapeURL } from './scraper';
import { generateProductReview } from './claudeService';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Delay between requests in milliseconds (rate limiting) */
const RATE_LIMIT_DELAY_MS = 2000;

/** Maximum products to generate in a single run */
const MAX_PRODUCTS_PER_RUN = 10;

/** Search queries for trending products per category */
const CATEGORY_SEARCH_QUERIES: Record<string, string[]> = {
    'televisies': [
        'https://www.bol.com/nl/nl/s/?searchtext=smart+tv+4k+2024',
        'https://www.coolblue.nl/televisies'
    ],
    'audio': [
        'https://www.bol.com/nl/nl/s/?searchtext=bluetooth+speaker+2024',
        'https://www.coolblue.nl/speakers'
    ],
    'laptops': [
        'https://www.bol.com/nl/nl/s/?searchtext=laptop+2024',
        'https://www.coolblue.nl/laptops'
    ],
    'smartphones': [
        'https://www.bol.com/nl/nl/s/?searchtext=smartphone+2024',
        'https://www.coolblue.nl/smartphones'
    ],
    'wasmachines': [
        'https://www.bol.com/nl/nl/s/?searchtext=wasmachine+a+++',
        'https://www.coolblue.nl/wasmachines'
    ],
    'stofzuigers': [
        'https://www.bol.com/nl/nl/s/?searchtext=stofzuiger+draadloos',
        'https://www.coolblue.nl/stofzuigers'
    ],
    'smarthome': [
        'https://www.bol.com/nl/nl/s/?searchtext=smart+home+philips+hue',
        'https://www.coolblue.nl/smart-home'
    ],
    'matrassen': [
        'https://www.bol.com/nl/nl/s/?searchtext=matras+traagschuim',
        'https://www.coolblue.nl/matrassen'
    ],
    'airfryers': [
        'https://www.bol.com/nl/nl/s/?searchtext=airfryer+xxl',
        'https://www.coolblue.nl/airfryers'
    ],
    'koffie': [
        'https://www.bol.com/nl/nl/s/?searchtext=koffiemachine+bonen',
        'https://www.coolblue.nl/koffiemachines'
    ],
    'keuken': [
        'https://www.bol.com/nl/nl/s/?searchtext=keukenmachine+kitchenaid',
        'https://www.coolblue.nl/keukenmachines'
    ],
    'verzorging': [
        'https://www.bol.com/nl/nl/s/?searchtext=scheerapparaat+braun',
        'https://www.coolblue.nl/scheerapparaten'
    ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Delay execution for rate limiting
 */
const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate a unique product ID
 */
const generateProductId = (): string => {
    return `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Check if a product already exists in the database
 */
const productExists = async (product: Product): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
        // Check by EAN if available
        if (product.ean) {
            const { data } = await supabase
                .from('products')
                .select('id')
                .eq('ean', product.ean)
                .limit(1);
            
            if (data && data.length > 0) return true;
        }

        // Check by brand + model combination
        const { data } = await supabase
            .from('products')
            .select('id')
            .ilike('brand', product.brand)
            .ilike('model', product.model)
            .limit(1);

        return data !== null && data.length > 0;
    } catch (error) {
        console.error('[AutonomousProductGenerator] Error checking product existence:', error);
        return false;
    }
};

/**
 * Save product to database
 */
const saveProduct = async (product: Product): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[AutonomousProductGenerator] Supabase not configured');
        return false;
    }

    try {
        const { error } = await supabase
            .from('products')
            .insert(product);

        if (error) {
            console.error('[AutonomousProductGenerator] Error saving product:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[AutonomousProductGenerator] Error in saveProduct:', error);
        return false;
    }
};

// ============================================================================
// TRENDING PRODUCT DISCOVERY
// ============================================================================

/**
 * Find trending products for a category
 * This is a simplified implementation - in production, you would:
 * 1. Use affiliate network APIs to get trending products
 * 2. Analyze search trends
 * 3. Check competitor sites
 */
export const findTrendingProducts = async (category: string): Promise<string[]> => {
    console.log(`[AutonomousProductGenerator] Finding trending products for: ${category}`);
    
    const urls: string[] = [];
    
    // Get search queries for this category
    const searchQueries = CATEGORY_SEARCH_QUERIES[category] || [];
    
    if (searchQueries.length === 0) {
        console.warn(`[AutonomousProductGenerator] No search queries configured for category: ${category}`);
        return urls;
    }

    // For now, return the search URLs
    // In a full implementation, you would:
    // 1. Scrape the search results page
    // 2. Extract individual product URLs
    // 3. Return those for processing
    
    return searchQueries;
};

/**
 * Extract product URLs from a search results page
 * This is a placeholder - actual implementation depends on the target site
 */
export const extractProductUrls = async (searchUrl: string): Promise<string[]> => {
    const urls: string[] = [];
    
    try {
        const scraped = await scrapeURL(searchUrl);
        
        // Extract URLs from the scraped HTML
        // This is site-specific - example for Bol.com:
        const bolUrlPattern = /https?:\/\/www\.bol\.com\/nl\/[np]\/[^"'\s]+/g;
        const matches = scraped.html.match(bolUrlPattern);
        
        if (matches) {
            // Filter to unique product URLs (not category pages)
            const uniqueUrls = [...new Set(matches)].filter(url => 
                url.includes('/p/') || url.includes('/nl/p/')
            );
            urls.push(...uniqueUrls.slice(0, 5)); // Limit to 5 products
        }
        
    } catch (error) {
        console.error('[AutonomousProductGenerator] Error extracting product URLs:', error);
    }
    
    return urls;
};

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Run automated product generation according to configuration
 */
export const runAutomatedProductGeneration = async (
    config?: AutomationConfig
): Promise<AutomationResult> => {
    const startTime = Date.now();
    const result: AutomationResult = {
        success: 0,
        failed: 0,
        details: [],
        timestamp: new Date().toISOString(),
        durationMs: 0
    };

    console.log('[AutonomousProductGenerator] Starting automated product generation...');

    try {
        // Load config if not provided
        const automationConfig = config || await loadAutomationConfig();

        // Check if automation is enabled
        if (!automationConfig.masterEnabled) {
            console.log('[AutonomousProductGenerator] Master automation is disabled');
            result.details?.push('Automation is uitgeschakeld');
            result.durationMs = Date.now() - startTime;
            return result;
        }

        if (!automationConfig.productGeneration.enabled) {
            console.log('[AutonomousProductGenerator] Product generation is disabled');
            result.details?.push('Product generatie is uitgeschakeld');
            result.durationMs = Date.now() - startTime;
            return result;
        }

        const { productsPerDay, categories } = automationConfig.productGeneration;
        
        if (productsPerDay === 0) {
            console.log('[AutonomousProductGenerator] Products per day is set to 0');
            result.details?.push('Producten per dag is ingesteld op 0');
            result.durationMs = Date.now() - startTime;
            return result;
        }

        const maxProducts = Math.min(productsPerDay, MAX_PRODUCTS_PER_RUN);
        let productsGenerated = 0;

        // Process each selected category
        for (const category of categories) {
            if (productsGenerated >= maxProducts) break;

            const categoryConfig = CATEGORIES[category];
            if (!categoryConfig) {
                console.warn(`[AutonomousProductGenerator] Unknown category: ${category}`);
                continue;
            }

            console.log(`[AutonomousProductGenerator] Processing category: ${categoryConfig.name}`);
            result.details?.push(`Verwerken categorie: ${categoryConfig.name}`);

            // Find trending products for this category
            const searchUrls = await findTrendingProducts(category);
            
            for (const searchUrl of searchUrls) {
                if (productsGenerated >= maxProducts) break;

                try {
                    // Rate limiting
                    await delay(RATE_LIMIT_DELAY_MS);

                    // Extract product URLs from search results
                    const productUrls = await extractProductUrls(searchUrl);
                    
                    for (const productUrl of productUrls) {
                        if (productsGenerated >= maxProducts) break;

                        try {
                            console.log(`[AutonomousProductGenerator] Processing: ${productUrl}`);
                            
                            // Rate limiting
                            await delay(RATE_LIMIT_DELAY_MS);

                            // Scrape the product page
                            const scraped = await scrapeURL(productUrl);

                            // Generate product review using AI
                            const product = await generateProductReview({
                                url: productUrl,
                                scrapedContent: scraped.text,
                                title: scraped.title,
                                description: scraped.description,
                                images: scraped.images,
                                price: scraped.price
                            });

                            if (!product) {
                                console.warn('[AutonomousProductGenerator] Failed to generate product');
                                result.failed++;
                                result.details?.push(`Mislukt: ${productUrl}`);
                                continue;
                            }

                            // Set the ID and category
                            product.id = generateProductId();
                            product.category = category;

                            // Check if product already exists
                            if (await productExists(product)) {
                                console.log(`[AutonomousProductGenerator] Product already exists: ${product.brand} ${product.model}`);
                                result.details?.push(`Bestaat al: ${product.brand} ${product.model}`);
                                continue;
                            }

                            // Save to database
                            const saved = await saveProduct(product);
                            
                            if (saved) {
                                productsGenerated++;
                                result.success++;
                                result.details?.push(`Toegevoegd: ${product.brand} ${product.model}`);
                                console.log(`[AutonomousProductGenerator] Added: ${product.brand} ${product.model}`);
                            } else {
                                result.failed++;
                                result.details?.push(`Opslaan mislukt: ${product.brand} ${product.model}`);
                            }

                        } catch (productError) {
                            const errorMsg = productError instanceof Error ? productError.message : String(productError);
                            console.error(`[AutonomousProductGenerator] Error processing ${productUrl}:`, errorMsg);
                            result.failed++;
                            result.details?.push(`Fout: ${errorMsg}`);
                        }
                    }

                } catch (searchError) {
                    const errorMsg = searchError instanceof Error ? searchError.message : String(searchError);
                    console.error(`[AutonomousProductGenerator] Error processing search URL:`, errorMsg);
                    result.details?.push(`Zoek fout: ${errorMsg}`);
                }
            }
        }

        console.log(`[AutonomousProductGenerator] Completed. Success: ${result.success}, Failed: ${result.failed}`);

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[AutonomousProductGenerator] Error in runAutomatedProductGeneration:', errorMsg);
        result.details?.push(`Algemene fout: ${errorMsg}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
};

/**
 * Generate products for a specific category (manual trigger)
 */
export const generateProductsForCategory = async (
    category: string,
    maxProducts: number = 5
): Promise<AutomationResult> => {
    const startTime = Date.now();
    const result: AutomationResult = {
        success: 0,
        failed: 0,
        details: [],
        timestamp: new Date().toISOString(),
        durationMs: 0
    };

    console.log(`[AutonomousProductGenerator] Generating ${maxProducts} products for category: ${category}`);

    try {
        const categoryConfig = CATEGORIES[category];
        if (!categoryConfig) {
            result.details?.push(`Ongeldige categorie: ${category}`);
            result.durationMs = Date.now() - startTime;
            return result;
        }

        // Find trending products for this category
        const searchUrls = await findTrendingProducts(category);
        let productsGenerated = 0;

        for (const searchUrl of searchUrls) {
            if (productsGenerated >= maxProducts) break;

            try {
                await delay(RATE_LIMIT_DELAY_MS);
                
                const productUrls = await extractProductUrls(searchUrl);
                
                for (const productUrl of productUrls) {
                    if (productsGenerated >= maxProducts) break;

                    try {
                        await delay(RATE_LIMIT_DELAY_MS);

                        const scraped = await scrapeURL(productUrl);
                        const product = await generateProductReview({
                            url: productUrl,
                            scrapedContent: scraped.text,
                            title: scraped.title,
                            description: scraped.description,
                            images: scraped.images,
                            price: scraped.price
                        });

                        if (!product) {
                            result.failed++;
                            continue;
                        }

                        product.id = generateProductId();
                        product.category = category;

                        if (await productExists(product)) {
                            result.details?.push(`Bestaat al: ${product.brand} ${product.model}`);
                            continue;
                        }

                        const saved = await saveProduct(product);
                        
                        if (saved) {
                            productsGenerated++;
                            result.success++;
                            result.details?.push(`Toegevoegd: ${product.brand} ${product.model}`);
                        } else {
                            result.failed++;
                        }

                    } catch (error) {
                        result.failed++;
                    }
                }

            } catch (error) {
                console.error('[AutonomousProductGenerator] Search error:', error);
            }
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.details?.push(`Fout: ${errorMsg}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
};

/**
 * Check if it's time to run product generation based on preferred time
 */
export const shouldRunProductGeneration = (config: AutomationConfig): boolean => {
    if (!config.masterEnabled || !config.productGeneration.enabled) {
        return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    const [preferredHour, preferredMinutes] = config.productGeneration.preferredTime.split(':').map(Number);

    // Run within a 30-minute window of the preferred time
    const preferredTimeInMinutes = preferredHour * 60 + preferredMinutes;
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    return Math.abs(currentTimeInMinutes - preferredTimeInMinutes) <= 30;
};
