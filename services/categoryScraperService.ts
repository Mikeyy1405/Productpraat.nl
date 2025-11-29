/**
 * Category Scraper Service
 * 
 * Scrapes products from external category URLs (e.g., bol.com category pages)
 * and extracts product information including price, pros, cons, description, and specifications.
 * 
 * @module services/categoryScraperService
 */

import { scrapeURL, extractMetadata, detectShop } from './scraper';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A scraped product from a category page
 */
export interface ScrapedProduct {
    /** EAN or product ID if available */
    ean?: string;
    /** Product ID from the source */
    productId?: string;
    /** Product title/name */
    title: string;
    /** Brand name if detected */
    brand?: string;
    /** Current price */
    price?: number;
    /** Price as displayed (e.g., "€299,-") */
    priceLabel?: string;
    /** Original price if on sale */
    originalPrice?: number;
    /** Discount percentage */
    discountPercentage?: number;
    /** Product URL on the source site */
    url: string;
    /** Main product image URL */
    imageUrl?: string;
    /** All gallery images */
    galleryImages?: string[];
    /** Short product description */
    description?: string;
    /** Extended product description */
    longDescription?: string;
    /** Product pros/advantages */
    pros?: string[];
    /** Product cons/disadvantages */
    cons?: string[];
    /** Product specifications */
    specifications?: Record<string, string>;
    /** Average rating (0-10) */
    rating?: number;
    /** Number of reviews */
    reviewCount?: number;
    /** Whether the product is in stock */
    inStock?: boolean;
    /** Source shop name */
    source?: string;
}

/**
 * Result of scraping a category page
 */
export interface CategoryScrapeResult {
    /** Whether the scrape was successful */
    success: boolean;
    /** The scraped category URL */
    url: string;
    /** Detected shop/source */
    shop: string;
    /** Number of products found */
    productCount: number;
    /** The scraped products */
    products: ScrapedProduct[];
    /** Error message if failed */
    error?: string;
    /** Warnings during scraping */
    warnings?: string[];
    /** Category name if detected */
    categoryName?: string;
    /** Timestamp of the scrape */
    scrapedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum number of products to scrape per category page
 */
const MAX_PRODUCTS_PER_PAGE = 100;

/**
 * Request delay to avoid rate limiting (ms)
 */
const REQUEST_DELAY_MS = 1000;

// ============================================================================
// BOL.COM CATEGORY PAGE PARSER
// ============================================================================

/**
 * Parse a Bol.com category page URL to extract the category ID
 * 
 * Examples:
 * - https://www.bol.com/nl/nl/l/verzorgingsproducten/12442/
 * - https://www.bol.com/nl/nl/l/televisies/10651/
 * 
 * @param url - The Bol.com category URL
 * @returns The category ID or null if not found
 */
function extractBolCategoryId(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname;
        
        // Match pattern: /nl/nl/l/{category-name}/{category-id}/
        const match = pathname.match(/\/l\/[^/]+\/(\d+)\/?$/);
        if (match) {
            return match[1];
        }
        
        // Also try to match with query parameters
        const categoryId = parsedUrl.searchParams.get('categoryId');
        if (categoryId) {
            return categoryId;
        }
        
        return null;
    } catch {
        return null;
    }
}

/**
 * Parse Bol.com category page HTML to extract products
 * 
 * @param html - The HTML content of the category page
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns Array of scraped products
 */
function parseBolCategoryPage(html: string, baseUrl: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Bol.com uses various product card selectors
    const productCardSelectors = [
        '[data-test="product-card"]',
        '[data-test="product-item"]',
        '.product-item',
        '.product-card',
        'li[data-id]',
        'article[data-id]',
    ];
    
    let productCards: NodeListOf<Element> | null = null;
    
    for (const selector of productCardSelectors) {
        productCards = doc.querySelectorAll(selector);
        if (productCards && productCards.length > 0) {
            break;
        }
    }
    
    if (!productCards || productCards.length === 0) {
        // Fallback: try to find product links
        const productLinks = doc.querySelectorAll('a[href*="/p/"]');
        if (productLinks.length > 0) {
            const seenUrls = new Set<string>();
            productLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href && !seenUrls.has(href)) {
                    seenUrls.add(href);
                    const fullUrl = href.startsWith('http') ? href : `https://www.bol.com${href}`;
                    products.push({
                        title: link.textContent?.trim() || 'Unknown',
                        url: fullUrl,
                        source: 'bol.com',
                    });
                }
            });
        }
        return products.slice(0, MAX_PRODUCTS_PER_PAGE);
    }
    
    productCards.forEach((card, index) => {
        if (index >= MAX_PRODUCTS_PER_PAGE) return;
        
        try {
            // Extract product ID from data attributes
            const productId = card.getAttribute('data-id') || 
                              card.getAttribute('data-product-id') ||
                              card.getAttribute('data-ean');
            
            // Extract title
            const titleEl = card.querySelector('[data-test="product-title"], .product-title, h3 a, h2 a, a[title]');
            const title = titleEl?.textContent?.trim() || titleEl?.getAttribute('title') || '';
            
            if (!title) return; // Skip products without title
            
            // Extract URL
            const linkEl = card.querySelector('a[href*="/p/"]') || card.querySelector('a[href]');
            const href = linkEl?.getAttribute('href');
            const url = href ? (href.startsWith('http') ? href : `https://www.bol.com${href}`) : '';
            
            // Extract price
            const priceSelectors = [
                '[data-test="price"]',
                '.price',
                '.product-price',
                '.prijs-block',
                '.price-block',
            ];
            
            let priceEl: Element | null = null;
            for (const selector of priceSelectors) {
                priceEl = card.querySelector(selector);
                if (priceEl) break;
            }
            
            const priceText = priceEl?.textContent?.trim() || '';
            const priceMatch = priceText.match(/€?\s*(\d+)[,.](\d{2})/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : undefined;
            
            // Extract image
            const imgEl = card.querySelector('img[src], img[data-src]');
            const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || undefined;
            const normalizedImageUrl = imageUrl?.startsWith('//') ? `https:${imageUrl}` : imageUrl;
            
            // Extract rating
            const ratingEl = card.querySelector('[data-test="rating"], .rating, .review-stars');
            const ratingText = ratingEl?.getAttribute('title') || ratingEl?.textContent || '';
            const ratingMatch = ratingText.match(/(\d+[.,]?\d*)/);
            const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;
            
            // Extract review count
            const reviewEl = card.querySelector('[data-test="review-count"], .review-count');
            const reviewText = reviewEl?.textContent?.trim() || '';
            const reviewMatch = reviewText.match(/(\d+)/);
            const reviewCount = reviewMatch ? parseInt(reviewMatch[1], 10) : undefined;
            
            // Extract brand (often in product title or separate element)
            const brandEl = card.querySelector('[data-test="brand"], .brand, .product-brand');
            const brand = brandEl?.textContent?.trim() || undefined;
            
            // Extract stock status
            const stockEl = card.querySelector('[data-test="availability"], .availability, .stock-status');
            const stockText = stockEl?.textContent?.toLowerCase() || '';
            const inStock = !stockText.includes('uitverkocht') && !stockText.includes('niet leverbaar');
            
            products.push({
                productId: productId || undefined,
                title,
                brand,
                price,
                priceLabel: price ? `€${price.toFixed(2).replace('.', ',')}` : undefined,
                url,
                imageUrl: normalizedImageUrl,
                rating,
                reviewCount,
                inStock,
                source: 'bol.com',
            });
        } catch (err) {
            console.warn('[CategoryScraper] Error parsing product card:', err);
        }
    });
    
    return products;
}

// ============================================================================
// GENERIC CATEGORY PAGE PARSER
// ============================================================================

/**
 * Parse a generic e-commerce category page to extract products
 * Works with common e-commerce patterns
 * 
 * @param html - The HTML content
 * @param baseUrl - The base URL
 * @param shopName - The detected shop name
 * @returns Array of scraped products
 */
function parseGenericCategoryPage(html: string, baseUrl: string, shopName: string): ScrapedProduct[] {
    const products: ScrapedProduct[] = [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Common product card selectors for various e-commerce sites
    const productCardSelectors = [
        '[data-product]',
        '[data-product-id]',
        '.product-card',
        '.product-item',
        '.product-tile',
        '.product-grid-item',
        '.product-list-item',
        'article.product',
        'li.product',
        '.item-card',
    ];
    
    let productCards: NodeListOf<Element> | null = null;
    
    for (const selector of productCardSelectors) {
        productCards = doc.querySelectorAll(selector);
        if (productCards && productCards.length > 0) {
            break;
        }
    }
    
    if (!productCards || productCards.length === 0) {
        return [];
    }
    
    productCards.forEach((card, index) => {
        if (index >= MAX_PRODUCTS_PER_PAGE) return;
        
        try {
            // Extract title
            const titleEl = card.querySelector('h2 a, h3 a, h4 a, .product-title, .item-title, a.title, [itemprop="name"]');
            const title = titleEl?.textContent?.trim() || '';
            
            if (!title) return;
            
            // Extract URL
            const linkEl = card.querySelector('a[href]');
            const href = linkEl?.getAttribute('href');
            let url = '';
            if (href) {
                if (href.startsWith('http')) {
                    url = href;
                } else if (href.startsWith('/')) {
                    try {
                        const base = new URL(baseUrl);
                        url = `${base.origin}${href}`;
                    } catch {
                        url = href;
                    }
                } else {
                    url = href;
                }
            }
            
            // Extract price
            const priceEl = card.querySelector('[itemprop="price"], .price, .product-price, .item-price, .prijs');
            const priceText = priceEl?.textContent?.trim() || priceEl?.getAttribute('content') || '';
            const priceMatch = priceText.match(/[€$]\s*(\d+)[,.](\d{2})/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : undefined;
            
            // Extract image
            const imgEl = card.querySelector('img[src], img[data-src]');
            let imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || undefined;
            if (imageUrl?.startsWith('//')) {
                imageUrl = `https:${imageUrl}`;
            }
            
            // Extract rating
            const ratingEl = card.querySelector('[itemprop="ratingValue"], .rating, .stars');
            const ratingText = ratingEl?.getAttribute('content') || ratingEl?.textContent || '';
            const ratingMatch = ratingText.match(/(\d+[.,]?\d*)/);
            const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;
            
            products.push({
                title,
                url,
                price,
                priceLabel: price ? `€${price.toFixed(2).replace('.', ',')}` : undefined,
                imageUrl: imageUrl || undefined,
                rating,
                source: shopName,
            });
        } catch (err) {
            console.warn('[CategoryScraper] Error parsing generic product card:', err);
        }
    });
    
    return products;
}

// ============================================================================
// PRODUCT DETAIL SCRAPING
// ============================================================================

/**
 * Scrape detailed product information from a product page
 * 
 * @param productUrl - The product page URL
 * @returns The detailed product information
 */
export async function scrapeProductDetails(productUrl: string): Promise<Partial<ScrapedProduct>> {
    try {
        const content = await scrapeURL(productUrl);
        const metadata = extractMetadata(content.html);
        const doc = new DOMParser().parseFromString(content.html, 'text/html');
        
        // Extract pros
        const prosSelectors = [
            '[data-test="pros"] li',
            '.pros li',
            '.product-pros li',
            '.pluspunten li',
            '.advantages li',
        ];
        const pros: string[] = [];
        for (const selector of prosSelectors) {
            const prosEls = doc.querySelectorAll(selector);
            if (prosEls.length > 0) {
                prosEls.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text) pros.push(text);
                });
                break;
            }
        }
        
        // Extract cons
        const consSelectors = [
            '[data-test="cons"] li',
            '.cons li',
            '.product-cons li',
            '.minpunten li',
            '.disadvantages li',
        ];
        const cons: string[] = [];
        for (const selector of consSelectors) {
            const consEls = doc.querySelectorAll(selector);
            if (consEls.length > 0) {
                consEls.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text) cons.push(text);
                });
                break;
            }
        }
        
        // Extract long description
        const descSelectors = [
            '[data-test="product-description"]',
            '.product-description',
            '[itemprop="description"]',
            '.description-content',
            '#product-description',
        ];
        let longDescription = '';
        for (const selector of descSelectors) {
            const descEl = doc.querySelector(selector);
            if (descEl) {
                longDescription = descEl.textContent?.trim() || '';
                break;
            }
        }
        
        // Extract specifications
        const specs: Record<string, string> = metadata.specs || {};
        const specSelectors = [
            '[data-test="specifications"] tr',
            '.specifications tr',
            '.product-specs tr',
            'table.specs tr',
            '.spec-table tr',
        ];
        for (const selector of specSelectors) {
            const rows = doc.querySelectorAll(selector);
            if (rows.length > 0) {
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        const label = cells[0].textContent?.trim() || '';
                        const value = cells[1].textContent?.trim() || '';
                        if (label && value) {
                            specs[label] = value;
                        }
                    }
                });
                break;
            }
        }
        
        // Extract gallery images
        const galleryImages: string[] = [...metadata.images];
        const gallerySelectors = [
            '.product-gallery img',
            '.product-images img',
            '[data-test="product-images"] img',
            '.gallery img',
        ];
        for (const selector of gallerySelectors) {
            const images = doc.querySelectorAll(selector);
            images.forEach(img => {
                const src = img.getAttribute('src') || img.getAttribute('data-src');
                if (src) {
                    const normalizedSrc = src.startsWith('//') ? `https:${src}` : src;
                    if (!galleryImages.includes(normalizedSrc)) {
                        galleryImages.push(normalizedSrc);
                    }
                }
            });
        }
        
        return {
            description: metadata.description || undefined,
            longDescription: longDescription || undefined,
            pros: pros.length > 0 ? pros : undefined,
            cons: cons.length > 0 ? cons : undefined,
            specifications: Object.keys(specs).length > 0 ? specs : undefined,
            galleryImages: galleryImages.length > 0 ? galleryImages : undefined,
        };
    } catch (err) {
        console.error('[CategoryScraper] Error scraping product details:', err);
        return {};
    }
}

// ============================================================================
// MAIN SCRAPING FUNCTIONS
// ============================================================================

/**
 * Scrape products from a category URL
 * 
 * Supports:
 * - Bol.com category pages (e.g., https://www.bol.com/nl/nl/l/verzorgingsproducten/12442/)
 * - Other e-commerce sites with common product listing patterns
 * 
 * @param categoryUrl - The category page URL to scrape
 * @param options - Scraping options
 * @returns The scraping result with products
 * 
 * @example
 * ```typescript
 * const result = await scrapeCategoryUrl('https://www.bol.com/nl/nl/l/verzorgingsproducten/12442/');
 * if (result.success) {
 *     console.log(`Found ${result.productCount} products`);
 *     result.products.forEach(p => console.log(p.title, p.price));
 * }
 * ```
 */
export async function scrapeCategoryUrl(
    categoryUrl: string,
    options: {
        /** Maximum products to scrape */
        limit?: number;
        /** Whether to fetch detailed info for each product */
        includeDetails?: boolean;
    } = {}
): Promise<CategoryScrapeResult> {
    const { limit = 50, includeDetails = false } = options;
    const warnings: string[] = [];
    
    try {
        // Validate URL
        const parsedUrl = new URL(categoryUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return {
                success: false,
                url: categoryUrl,
                shop: 'Unknown',
                productCount: 0,
                products: [],
                error: 'Ongeldige URL. Gebruik een http:// of https:// URL.',
                scrapedAt: new Date().toISOString(),
            };
        }
        
        // Detect shop
        const shop = detectShop(categoryUrl);
        
        // Scrape the category page
        const content = await scrapeURL(categoryUrl);
        
        // Parse products based on detected shop
        let products: ScrapedProduct[];
        
        if (shop.toLowerCase() === 'bol.com' || parsedUrl.hostname.includes('bol.com')) {
            products = parseBolCategoryPage(content.html, categoryUrl);
        } else {
            products = parseGenericCategoryPage(content.html, categoryUrl, shop);
        }
        
        // Limit products
        products = products.slice(0, limit);
        
        if (products.length === 0) {
            warnings.push('Geen producten gevonden op deze pagina. Controleer of dit een categorie-pagina is.');
        }
        
        // Optionally fetch detailed info for each product
        if (includeDetails && products.length > 0) {
            const detailedProducts: ScrapedProduct[] = [];
            
            for (const product of products) {
                if (!product.url) continue;
                
                try {
                    // Add delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
                    
                    const details = await scrapeProductDetails(product.url);
                    detailedProducts.push({
                        ...product,
                        ...details,
                    });
                } catch (err) {
                    warnings.push(`Kon details niet ophalen voor: ${product.title}`);
                    detailedProducts.push(product);
                }
            }
            
            products = detailedProducts;
        }
        
        // Extract category name from page title or URL
        let categoryName: string | undefined;
        const titleMatch = content.title.match(/(.+?)[\s-|]+/);
        if (titleMatch) {
            categoryName = titleMatch[1].trim();
        } else if (parsedUrl.pathname) {
            const pathMatch = parsedUrl.pathname.match(/\/l\/([^/]+)\//);
            if (pathMatch) {
                categoryName = pathMatch[1].replace(/-/g, ' ');
            }
        }
        
        return {
            success: true,
            url: categoryUrl,
            shop,
            productCount: products.length,
            products,
            warnings: warnings.length > 0 ? warnings : undefined,
            categoryName,
            scrapedAt: new Date().toISOString(),
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Onbekende fout bij het scrapen';
        
        return {
            success: false,
            url: categoryUrl,
            shop: detectShop(categoryUrl),
            productCount: 0,
            products: [],
            error: errorMessage,
            scrapedAt: new Date().toISOString(),
        };
    }
}

/**
 * Extract the Bol.com category ID from a URL
 * This can be used to fetch products via the official Bol.com API instead of scraping
 * 
 * @param url - The Bol.com category URL
 * @returns The category ID or null
 */
export function getBolCategoryIdFromUrl(url: string): string | null {
    return extractBolCategoryId(url);
}

export default {
    scrapeCategoryUrl,
    scrapeProductDetails,
    getBolCategoryIdFromUrl,
};
