/**
 * Bol.com Marketing Catalog API Client
 * 
 * Provides functions for interacting with the Bol.com Marketing Catalog API.
 * Supports popular products, search, and single product retrieval.
 * 
 * Required Environment Variables:
 * - BOL_CLIENT_ID: OAuth2 client ID
 * - BOL_CLIENT_SECRET: OAuth2 client secret
 * 
 * @module src/lib/bolApi
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * API request options
 */
export interface BolApiOptions {
    /** Country code (default: 'NL') */
    countryCode?: string;
    /** Accept-Language header (default: 'nl') */
    acceptLanguage?: string;
    /** OAuth2 access token (if already obtained) */
    authToken?: string;
    /** Include product images in response */
    includeImage?: boolean;
    /** Include offer/pricing info in response */
    includeOffer?: boolean;
    /** Include ratings in response */
    includeRating?: boolean;
}

/**
 * Product from Bol.com API
 */
export interface BolProduct {
    ean: string;
    bolProductId?: string;
    title: string;
    description?: string;
    shortDescription?: string;
    url?: string;
    mainImageUrl?: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
    bestOffer?: {
        price?: { value: number; currency?: string };
        strikethroughPrice?: { value: number };
        discountPercentage?: number;
        availability?: string;
        delivery?: { deliveryDescription?: string };
    };
    rating?: {
        averageRating?: number;
        totalRatings?: number;
    };
    brand?: string;
    categories?: Array<{ id: string; name: string }>;
    specifications?: Array<{ name: string; value: string }>;
}

/**
 * Response from popular products endpoint
 */
export interface PopularProductsResponse {
    products: BolProduct[];
    categoryId?: string;
    categoryName?: string;
}

/**
 * Response from search endpoint
 */
export interface SearchProductsResponse {
    products: BolProduct[];
    totalResults?: number;
    page?: number;
    limit?: number;
    relevantCategories?: Array<{ id: string; name: string; productCount?: number }>;
}

/**
 * API error response
 */
export interface BolApiError {
    status: number;
    code: string;
    message: string;
    isRetryable: boolean;
}

/**
 * Result from category request with error info
 */
export interface CategoryResult {
    categoryKey: string;
    categoryId: string;
    success: boolean;
    products: BolProduct[];
    error?: BolApiError;
    usedFallback: boolean;
}

// ============================================================================
// ERROR CODES AND MESSAGES
// ============================================================================

/**
 * User-friendly error messages for API status codes
 */
export const ERROR_MESSAGES: Record<number, string> = {
    400: 'Ongeldige aanvraag - controleer de parameters',
    401: 'Niet geautoriseerd - controleer API credentials',
    403: 'Geen toegang - API key mist rechten',
    404: 'Geen producten gevonden in deze categorie',
    406: 'Content type niet ondersteund',
    429: 'Te veel aanvragen - probeer later opnieuw',
    500: 'Bol.com server fout - probeer later opnieuw',
    502: 'Bol.com tijdelijk onbereikbaar',
    503: 'Bol.com onderhoud - probeer later opnieuw',
    504: 'Bol.com reageerde niet op tijd'
};

/**
 * Retryable status codes
 */
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://api.bol.com';
const TOKEN_ENDPOINT = 'https://login.bol.com/token';
const API_PATH = '/marketing/catalog/v1';

/**
 * Default options for API requests
 */
const DEFAULT_OPTIONS: Required<Omit<BolApiOptions, 'authToken'>> = {
    countryCode: 'NL',
    acceptLanguage: 'nl',
    includeImage: true,
    includeOffer: true,
    includeRating: true
};

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Get OAuth2 access token from Bol.com
 * 
 * Uses client credentials flow with BOL_CLIENT_ID and BOL_CLIENT_SECRET
 */
export async function getAccessToken(): Promise<string> {
    // Check for cached token
    if (cachedToken && Date.now() < cachedToken.expiresAt - 30000) {
        return cachedToken.token;
    }

    const clientId = process.env.BOL_CLIENT_ID || '';
    const clientSecret = process.env.BOL_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
        throw createApiError(401, 'BOL_AUTH_ERROR', 'BOL_CLIENT_ID en BOL_CLIENT_SECRET zijn niet geconfigureerd');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw createApiError(response.status, 'TOKEN_ERROR', `OAuth token request failed: ${errorText}`);
    }

    const data = await response.json();
    
    // Cache the token
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 299) * 1000
    };

    return cachedToken.token;
}

/**
 * Clear the cached token
 */
export function clearTokenCache(): void {
    cachedToken = null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a structured API error
 */
function createApiError(status: number, code: string, message: string): BolApiError {
    return {
        status,
        code,
        message: ERROR_MESSAGES[status] || message,
        isRetryable: RETRYABLE_STATUS_CODES.includes(status)
    };
}

/**
 * Build query parameters for API requests
 */
function buildQueryParams(options: BolApiOptions, pageSize: number): URLSearchParams {
    const params = new URLSearchParams();
    
    params.set('country-code', options.countryCode || DEFAULT_OPTIONS.countryCode);
    params.set('page-size', String(pageSize));
    
    if (options.includeImage ?? DEFAULT_OPTIONS.includeImage) {
        params.set('include-image', 'true');
    }
    if (options.includeOffer ?? DEFAULT_OPTIONS.includeOffer) {
        params.set('include-offer', 'true');
    }
    if (options.includeRating ?? DEFAULT_OPTIONS.includeRating) {
        params.set('include-rating', 'true');
    }
    
    return params;
}

/**
 * Make authenticated API request
 */
async function makeRequest<T>(
    endpoint: string,
    options: BolApiOptions = {}
): Promise<T> {
    const token = options.authToken || await getAccessToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Accept-Language': options.acceptLanguage || DEFAULT_OPTIONS.acceptLanguage
        }
    });

    if (!response.ok) {
        // Handle 401 by clearing cache and retrying once
        if (response.status === 401 && !options.authToken) {
            clearTokenCache();
            const newToken = await getAccessToken();
            return makeRequest(endpoint, { ...options, authToken: newToken });
        }

        const errorText = await response.text();
        throw createApiError(response.status, `API_ERROR_${response.status}`, errorText);
    }

    return response.json();
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Get popular products by category ID
 * 
 * Primary endpoint: GET /marketing/catalog/v1/products/lists/popular
 * 
 * @param categoryId - Bol.com numeric category ID
 * @param pageSize - Number of products to return (default: 10, max: 100)
 * @param options - Additional API options
 * @returns Popular products response
 */
export async function getPopularProductsByCategory(
    categoryId: string,
    pageSize: number = 10,
    options: BolApiOptions = {}
): Promise<PopularProductsResponse> {
    const params = buildQueryParams(options, Math.min(pageSize, 100));
    params.set('category-id', categoryId);

    const endpoint = `${API_PATH}/products/lists/popular?${params.toString()}`;
    
    const data = await makeRequest<{
        categoryId?: string;
        categoryName?: string;
        products?: BolProduct[];
    }>(endpoint, options);

    return {
        products: data.products || [],
        categoryId: data.categoryId,
        categoryName: data.categoryName
    };
}

/**
 * Search for products
 * 
 * Endpoint: GET /marketing/catalog/v1/products/search
 * 
 * @param searchTerm - Search query
 * @param pageSize - Number of products to return (default: 10, max: 100)
 * @param options - Additional API options
 * @returns Search response with products and optional relevant categories
 */
export async function searchProducts(
    searchTerm: string,
    pageSize: number = 10,
    options: BolApiOptions & { includeRelevantCategories?: boolean } = {}
): Promise<SearchProductsResponse> {
    const params = buildQueryParams(options, Math.min(pageSize, 100));
    params.set('search-term', searchTerm);
    
    if (options.includeRelevantCategories) {
        params.set('include-relevant-categories', 'true');
    }

    const endpoint = `${API_PATH}/products/search?${params.toString()}`;
    
    const data = await makeRequest<{
        products?: BolProduct[];
        totalResults?: number;
        page?: number;
        limit?: number;
        relevantCategories?: Array<{ id: string; name: string; productCount?: number }>;
    }>(endpoint, options);

    return {
        products: data.products || [],
        totalResults: data.totalResults,
        page: data.page,
        limit: data.limit,
        relevantCategories: data.relevantCategories
    };
}

/**
 * Get single product by EAN
 * 
 * Endpoint: GET /marketing/catalog/v1/products/{ean}
 * 
 * @param ean - European Article Number
 * @param options - Additional API options
 * @returns Product details or null if not found
 */
export async function getProductByEan(
    ean: string,
    options: BolApiOptions = {}
): Promise<BolProduct | null> {
    const params = buildQueryParams(options, 1);
    
    const endpoint = `${API_PATH}/products/${ean}?${params.toString()}`;
    
    try {
        return await makeRequest<BolProduct>(endpoint, options);
    } catch (error) {
        if ((error as BolApiError).status === 404) {
            return null;
        }
        throw error;
    }
}

/**
 * Discover category IDs by searching with include-relevant-categories
 * 
 * Useful for finding Bol.com category IDs for new product categories.
 * 
 * @param searchTerms - Array of search terms to discover categories for
 * @param options - Additional API options
 * @returns Map of search term to discovered categories
 */
export async function discoverCategories(
    searchTerms: string[],
    options: BolApiOptions = {}
): Promise<Map<string, Array<{ id: string; name: string; productCount?: number }>>> {
    const results = new Map<string, Array<{ id: string; name: string; productCount?: number }>>();

    for (const term of searchTerms) {
        try {
            const response = await searchProducts(term, 1, {
                ...options,
                includeRelevantCategories: true
            });
            
            results.set(term, response.relevantCategories || []);
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`Error discovering categories for "${term}":`, error);
            results.set(term, []);
        }
    }

    return results;
}

/**
 * Fetch products for a category with fallback to search
 * 
 * Tries the popular products endpoint first, falls back to search if:
 * - Primary endpoint returns empty
 * - Primary endpoint returns 404
 * 
 * @param categoryId - Bol.com category ID
 * @param searchTerm - Fallback search term
 * @param pageSize - Number of products
 * @param options - API options
 * @returns Products and whether fallback was used
 */
export async function fetchCategoryProducts(
    categoryId: string,
    searchTerm: string,
    pageSize: number = 10,
    options: BolApiOptions = {}
): Promise<{ products: BolProduct[]; usedFallback: boolean; error?: BolApiError }> {
    try {
        // Try primary endpoint first
        const response = await getPopularProductsByCategory(categoryId, pageSize, options);
        
        if (response.products.length > 0) {
            return { products: response.products, usedFallback: false };
        }
        
        // Empty result - try fallback
        console.log(`[BolApi] Category ${categoryId} returned empty, trying search fallback`);
    } catch (error) {
        const apiError = error as BolApiError;
        
        // Only fallback on 404, other errors should propagate
        if (apiError.status !== 404) {
            return { products: [], usedFallback: false, error: apiError };
        }
        
        console.log(`[BolApi] Category ${categoryId} not found (404), trying search fallback`);
    }

    // Fallback to search
    try {
        const searchResponse = await searchProducts(searchTerm, pageSize, options);
        return { products: searchResponse.products, usedFallback: true };
    } catch (error) {
        return { 
            products: [], 
            usedFallback: true, 
            error: error as BolApiError 
        };
    }
}

/**
 * Fetch products for multiple categories concurrently
 * 
 * @param categories - Array of { categoryKey, categoryId, searchTerm }
 * @param pageSize - Products per category
 * @param concurrency - Maximum concurrent requests (default: 3)
 * @param options - API options
 * @returns Array of results per category
 */
export async function fetchMultipleCategories(
    categories: Array<{ categoryKey: string; categoryId: string; searchTerm: string }>,
    pageSize: number = 10,
    concurrency: number = 3,
    options: BolApiOptions = {}
): Promise<CategoryResult[]> {
    const results: CategoryResult[] = [];
    
    // Process in batches based on concurrency
    for (let i = 0; i < categories.length; i += concurrency) {
        const batch = categories.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (cat) => {
            const result = await fetchCategoryProducts(
                cat.categoryId,
                cat.searchTerm,
                pageSize,
                options
            );
            
            return {
                categoryKey: cat.categoryKey,
                categoryId: cat.categoryId,
                success: result.products.length > 0,
                products: result.products,
                error: result.error,
                usedFallback: result.usedFallback
            };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + concurrency < categories.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return results;
}

/**
 * Deduplicate products by EAN
 * 
 * @param products - Array of products (may contain duplicates)
 * @returns Deduplicated array
 */
export function deduplicateByEan(products: BolProduct[]): BolProduct[] {
    const seen = new Set<string>();
    const unique: BolProduct[] = [];
    
    for (const product of products) {
        if (product.ean && !seen.has(product.ean)) {
            seen.add(product.ean);
            unique.push(product);
        }
    }
    
    return unique;
}

/**
 * Check if the API is configured
 */
export function isApiConfigured(): boolean {
    return !!(process.env.BOL_CLIENT_ID && process.env.BOL_CLIENT_SECRET);
}

/**
 * Get user-friendly error message for a status code
 */
export function getErrorMessage(status: number): string {
    return ERROR_MESSAGES[status] || `Onbekende fout (status ${status})`;
}

export default {
    getPopularProductsByCategory,
    searchProducts,
    getProductByEan,
    fetchCategoryProducts,
    fetchMultipleCategories,
    discoverCategories,
    deduplicateByEan,
    isApiConfigured,
    getErrorMessage,
    getAccessToken,
    clearTokenCache
};
