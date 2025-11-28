/**
 * Bol.com Marketing Catalog API Module
 * 
 * Provides functions for interacting with the Bol.com Marketing Catalog API.
 * Supports popular products, search, and single product endpoints.
 * 
 * API Endpoints:
 * - GET /marketing/catalog/v1/products/lists/popular?category-id={categoryId}
 * - GET /marketing/catalog/v1/products/search?search-term={searchTerm}
 * - GET /marketing/catalog/v1/products/{ean}
 * 
 * @module src/lib/bolApi
 * @see https://api.bol.com/
 */

import { getCategoryId, getCategorySearchTerm } from './categoryMapping';

// ============================================================================
// TYPES
// ============================================================================

/**
 * API request options
 */
export interface BolApiOptions {
    /** Country code for the request (default: 'NL') */
    countryCode?: string;
    /** Accept-Language header value (default: 'nl') */
    acceptLanguage?: string;
    /** Bearer token for Authorization header */
    authToken?: string;
}

/**
 * Bol.com product from API response
 */
export interface BolApiProduct {
    ean: string;
    bolProductId?: string;
    title: string;
    description?: string;
    shortDescription?: string;
    brand?: string;
    url?: string;
    mainImageUrl?: string;
    images?: Array<{
        url: string;
        width?: number;
        height?: number;
        displayOrder?: number;
    }>;
    bestOffer?: {
        offerId?: string;
        price?: { value: number; currency: string };
        strikethroughPrice?: { value?: number; currency?: string };
        discountPercentage?: number;
        availability?: string;
        delivery?: { deliveryDescription?: string };
    };
    rating?: {
        averageRating?: number;
        totalRatings?: number;
        totalReviews?: number;
    };
    specifications?: Array<{
        key: string;
        name: string;
        value: string;
        groupTitle?: string;
    }>;
    categories?: Array<{
        categoryId: string;
        categoryName: string;
        isPrimary?: boolean;
    }>;
}

/**
 * API response for popular products or search
 */
export interface BolApiProductsResponse {
    products: BolApiProduct[];
    totalResults?: number;
    categoryId?: string;
    categoryName?: string;
    relevantCategories?: Array<{
        id: string;
        name: string;
        productCount?: number;
    }>;
}

/**
 * Error response from API
 */
export interface BolApiErrorResponse {
    status: number;
    title?: string;
    detail?: string;
    type?: string;
    violations?: Array<{ name: string; reason: string }>;
}

/**
 * Result of fetching products for a category
 */
export interface CategoryFetchResult {
    categoryKey: string;
    categoryId?: string;
    products: BolApiProduct[];
    error?: string;
    errorCode?: number;
    usedFallback: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE_URL = 'https://api.bol.com';
const API_PATH = '/marketing/catalog/v1';
const DEFAULT_COUNTRY_CODE = 'NL';
const DEFAULT_ACCEPT_LANGUAGE = 'nl';
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CONCURRENCY = 3;
const REQUEST_DELAY_MS = 500; // Delay between requests to avoid rate limiting

// HTTP status codes with their user-friendly messages
const ERROR_MESSAGES: Record<number, string> = {
    400: 'Ongeldige aanvraag. Controleer de categorie parameters.',
    404: 'Geen producten gevonden voor deze categorie.',
    406: 'De server kan dit verzoek niet verwerken. Probeer het later opnieuw.',
    500: 'Bol.com server fout. Probeer het later opnieuw.',
    503: 'Bol.com service is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Delay execution for rate limiting
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build request headers for Bol.com API
 */
function buildHeaders(options: BolApiOptions = {}): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Accept-Language': options.acceptLanguage || DEFAULT_ACCEPT_LANGUAGE,
        'Content-Type': 'application/json',
    };
    
    if (options.authToken) {
        headers['Authorization'] = `Bearer ${options.authToken}`;
    }
    
    return headers;
}

/**
 * Parse error response and return user-friendly message
 */
function parseErrorResponse(status: number, errorData?: BolApiErrorResponse): string {
    if (errorData?.detail) {
        return errorData.detail;
    }
    return ERROR_MESSAGES[status] || `API fout (${status}). Probeer het later opnieuw.`;
}

/**
 * Execute API request with error handling
 */
async function executeRequest<T>(
    url: string,
    options: BolApiOptions = {}
): Promise<{ data?: T; error?: string; status?: number }> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(options),
        });
        
        if (!response.ok) {
            let errorData: BolApiErrorResponse | undefined;
            try {
                errorData = await response.json();
            } catch {
                // Failed to parse error response
            }
            
            return {
                error: parseErrorResponse(response.status, errorData),
                status: response.status,
            };
        }
        
        const data = await response.json() as T;
        return { data };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Netwerkfout';
        return { error: `Verbindingsfout: ${message}`, status: 0 };
    }
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Get popular products by Bol.com category ID.
 * 
 * @param categoryId - The Bol.com numeric category ID
 * @param pageSize - Number of products to fetch (max 100)
 * @param options - API request options
 * @returns Promise with products response or error
 * 
 * @example
 * ```typescript
 * const result = await getPopularProductsByCategory('12442', 10);
 * if (result.products.length > 0) {
 *     console.log('Found products:', result.products);
 * }
 * ```
 */
export async function getPopularProductsByCategory(
    categoryId: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
    options: BolApiOptions = {}
): Promise<{ products: BolApiProduct[]; error?: string; status?: number }> {
    const countryCode = options.countryCode || DEFAULT_COUNTRY_CODE;
    const size = Math.min(pageSize, MAX_PAGE_SIZE);
    
    const url = `${API_BASE_URL}${API_PATH}/products/lists/popular?` + new URLSearchParams({
        'category-id': categoryId,
        'country-code': countryCode,
        'page-size': String(size),
        'include-image': 'true',
        'include-offer': 'true',
        'include-rating': 'true',
    });
    
    const result = await executeRequest<BolApiProductsResponse>(url, options);
    
    if (result.error) {
        return { products: [], error: result.error, status: result.status };
    }
    
    return { products: result.data?.products || [] };
}

/**
 * Search for products using a search term.
 * Used as fallback when category ID lookup returns no results.
 * 
 * @param searchTerm - The search term to use
 * @param pageSize - Number of products to fetch (max 100)
 * @param options - API request options
 * @param includeRelevantCategories - Whether to include relevant categories in response
 * @returns Promise with products response or error
 * 
 * @example
 * ```typescript
 * const result = await searchProducts('scheerapparaat', 10);
 * if (result.products.length > 0) {
 *     console.log('Found products:', result.products);
 * }
 * ```
 */
export async function searchProducts(
    searchTerm: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
    options: BolApiOptions = {},
    includeRelevantCategories: boolean = false
): Promise<{
    products: BolApiProduct[];
    relevantCategories?: Array<{ id: string; name: string; productCount?: number }>;
    error?: string;
    status?: number;
}> {
    const countryCode = options.countryCode || DEFAULT_COUNTRY_CODE;
    const size = Math.min(pageSize, MAX_PAGE_SIZE);
    
    const params = new URLSearchParams({
        'search-term': searchTerm,
        'country-code': countryCode,
        'page-size': String(size),
        'include-image': 'true',
        'include-offer': 'true',
        'include-rating': 'true',
    });
    
    if (includeRelevantCategories) {
        params.append('include-relevant-categories', 'true');
    }
    
    const url = `${API_BASE_URL}${API_PATH}/products/search?${params}`;
    
    const result = await executeRequest<BolApiProductsResponse>(url, options);
    
    if (result.error) {
        return { products: [], error: result.error, status: result.status };
    }
    
    return {
        products: result.data?.products || [],
        relevantCategories: result.data?.relevantCategories,
    };
}

/**
 * Get a single product by EAN.
 * 
 * @param ean - The European Article Number
 * @param options - API request options
 * @returns Promise with product or error
 * 
 * @example
 * ```typescript
 * const result = await getProductByEan('8718469564987');
 * if (result.product) {
 *     console.log('Product:', result.product.title);
 * }
 * ```
 */
export async function getProductByEan(
    ean: string,
    options: BolApiOptions = {}
): Promise<{ product?: BolApiProduct; error?: string; status?: number }> {
    const countryCode = options.countryCode || DEFAULT_COUNTRY_CODE;
    
    const url = `${API_BASE_URL}${API_PATH}/products/${ean}?` + new URLSearchParams({
        'country-code': countryCode,
        'include-image': 'true',
        'include-offer': 'true',
        'include-rating': 'true',
    });
    
    const result = await executeRequest<BolApiProduct>(url, options);
    
    if (result.error) {
        return { error: result.error, status: result.status };
    }
    
    return { product: result.data };
}

/**
 * Fetch products for a category with automatic fallback to search.
 * 
 * First attempts to fetch popular products by category ID.
 * If that fails or returns no results, falls back to search by category name.
 * 
 * @param categoryKey - The category key (e.g., 'verzorging', 'televisies')
 * @param pageSize - Number of products to fetch
 * @param options - API request options
 * @returns Promise with fetch result including products or error
 * 
 * @example
 * ```typescript
 * const result = await fetchProductsForCategory('verzorging', 5);
 * if (result.products.length > 0) {
 *     console.log(`Found ${result.products.length} products`);
 *     if (result.usedFallback) {
 *         console.log('Used search fallback');
 *     }
 * }
 * ```
 */
export async function fetchProductsForCategory(
    categoryKey: string,
    pageSize: number = DEFAULT_PAGE_SIZE,
    options: BolApiOptions = {}
): Promise<CategoryFetchResult> {
    const categoryId = getCategoryId(categoryKey);
    
    // Try category ID lookup first
    if (categoryId) {
        const result = await getPopularProductsByCategory(categoryId, pageSize, options);
        
        // If we got products, return them
        if (result.products.length > 0) {
            return {
                categoryKey,
                categoryId,
                products: result.products,
                usedFallback: false,
            };
        }
        
        // If 404 or empty, try fallback
        if (!result.error || result.status === 404) {
            console.log(`[BolApi] Category ${categoryKey} (ID: ${categoryId}) returned no products, trying search fallback`);
        } else {
            // For other errors, still try fallback but log the error
            console.warn(`[BolApi] Category ${categoryKey} (ID: ${categoryId}) error: ${result.error}`);
        }
    } else {
        console.log(`[BolApi] No category ID for ${categoryKey}, using search fallback`);
    }
    
    // Fallback to search
    const searchTerm = getCategorySearchTerm(categoryKey);
    const searchResult = await searchProducts(searchTerm, pageSize, options);
    
    if (searchResult.error && searchResult.products.length === 0) {
        return {
            categoryKey,
            categoryId,
            products: [],
            error: searchResult.error,
            errorCode: searchResult.status,
            usedFallback: true,
        };
    }
    
    return {
        categoryKey,
        categoryId,
        products: searchResult.products,
        usedFallback: true,
    };
}

/**
 * Fetch products for multiple categories concurrently.
 * Handles deduplication by EAN and respects rate limiting.
 * 
 * @param categoryKeys - Array of category keys to fetch
 * @param productsPerCategory - Number of products per category
 * @param options - API request options
 * @param concurrency - Maximum concurrent requests (default: 3)
 * @returns Promise with all products and per-category results
 * 
 * @example
 * ```typescript
 * const result = await fetchProductsForCategories(
 *     ['televisies', 'verzorging', 'laptops'],
 *     5
 * );
 * console.log(`Total unique products: ${result.products.length}`);
 * result.categoryResults.forEach(r => {
 *     console.log(`${r.categoryKey}: ${r.products.length} products`);
 * });
 * ```
 */
export async function fetchProductsForCategories(
    categoryKeys: string[],
    productsPerCategory: number = DEFAULT_PAGE_SIZE,
    options: BolApiOptions = {},
    concurrency: number = DEFAULT_CONCURRENCY
): Promise<{
    products: BolApiProduct[];
    categoryResults: CategoryFetchResult[];
    totalRequested: number;
    totalFetched: number;
    errors: Array<{ category: string; error: string }>;
}> {
    const categoryResults: CategoryFetchResult[] = [];
    const errors: Array<{ category: string; error: string }> = [];
    const seenEans = new Set<string>();
    const allProducts: BolApiProduct[] = [];
    
    // Process categories in batches based on concurrency limit
    for (let i = 0; i < categoryKeys.length; i += concurrency) {
        const batch = categoryKeys.slice(i, i + concurrency);
        
        // Execute batch concurrently
        const batchResults = await Promise.all(
            batch.map(categoryKey => fetchProductsForCategory(categoryKey, productsPerCategory, options))
        );
        
        // Process results
        for (const result of batchResults) {
            categoryResults.push(result);
            
            if (result.error) {
                errors.push({ category: result.categoryKey, error: result.error });
            }
            
            // Deduplicate by EAN
            for (const product of result.products) {
                if (!seenEans.has(product.ean)) {
                    seenEans.add(product.ean);
                    allProducts.push(product);
                }
            }
        }
        
        // Rate limiting delay between batches (not after last batch)
        if (i + concurrency < categoryKeys.length) {
            await delay(REQUEST_DELAY_MS);
        }
    }
    
    return {
        products: allProducts,
        categoryResults,
        totalRequested: categoryKeys.length * productsPerCategory,
        totalFetched: allProducts.length,
        errors,
    };
}

/**
 * Discover category IDs by searching with terms and getting relevant categories.
 * This is useful for finding Bol.com category IDs for new categories.
 * 
 * @param searchTerms - Array of search terms to try
 * @param options - API request options
 * @returns Promise with discovered category mappings
 * 
 * @example
 * ```typescript
 * const categories = await discoverCategoryIds(['televisie', 'laptop', 'smartphone']);
 * categories.forEach(cat => {
 *     console.log(`${cat.searchTerm}: ${cat.categories.map(c => `${c.name} (${c.id})`).join(', ')}`);
 * });
 * ```
 */
export async function discoverCategoryIds(
    searchTerms: string[],
    options: BolApiOptions = {}
): Promise<Array<{
    searchTerm: string;
    categories: Array<{ id: string; name: string; productCount?: number }>;
    error?: string;
}>> {
    const results: Array<{
        searchTerm: string;
        categories: Array<{ id: string; name: string; productCount?: number }>;
        error?: string;
    }> = [];
    
    for (const searchTerm of searchTerms) {
        const result = await searchProducts(searchTerm, 1, options, true);
        
        if (result.error) {
            results.push({
                searchTerm,
                categories: [],
                error: result.error,
            });
        } else {
            results.push({
                searchTerm,
                categories: result.relevantCategories || [],
            });
        }
        
        // Rate limiting
        await delay(REQUEST_DELAY_MS);
    }
    
    return results;
}

export default {
    getPopularProductsByCategory,
    searchProducts,
    getProductByEan,
    fetchProductsForCategory,
    fetchProductsForCategories,
    discoverCategoryIds,
    // Constants for external use
    DEFAULT_COUNTRY_CODE,
    DEFAULT_ACCEPT_LANGUAGE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    DEFAULT_CONCURRENCY,
};
