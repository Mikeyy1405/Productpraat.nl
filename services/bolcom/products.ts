/**
 * Bol.com Products Service
 * 
 * Service for interacting with Bol.com Marketing Catalog API product endpoints.
 * Handles search, product details, offers, media, ratings, and categories.
 * 
 * @module services/bolcom/products
 */

import { bolApiClient, BolApiError } from './api-client';
import {
    BolProduct,
    SearchResponse,
    SearchFilters,
    BestOffer,
    ProductMedia,
    ProductRating,
    ProductCategory,
    Category,
    PopularProductsResponse,
    ProductSpecification,
} from '../../types/bolcom';

// ============================================================================
// CONSTANTS
// ============================================================================

const API_PATH = '/marketing/catalog/v1';

/**
 * Default page size for search results
 */
const DEFAULT_PAGE_SIZE = 24;

/**
 * Maximum page size allowed by API
 */
const MAX_PAGE_SIZE = 100;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build sort parameter for API
 */
function buildSortParam(sortBy?: SearchFilters['sortBy']): string | undefined {
    switch (sortBy) {
        case 'popularity':
            return 'popularity';
        case 'price_asc':
            return 'price';
        case 'price_desc':
            return '-price';
        case 'rating':
            return '-rating';
        case 'relevance':
        default:
            return undefined;
    }
}

/**
 * Build filter parameters for search
 */
function buildFilterParams(filters: SearchFilters): Record<string, string | number | boolean | undefined> {
    const params: Record<string, string | number | boolean | undefined> = {};
    
    if (filters.categoryIds?.length) {
        params.categoryId = filters.categoryIds.join(',');
    }
    
    if (filters.priceRange) {
        params.priceMin = filters.priceRange[0];
        params.priceMax = filters.priceRange[1];
    }
    
    if (filters.minRating !== undefined) {
        params.minRating = filters.minRating;
    }
    
    if (filters.brands?.length) {
        params.brand = filters.brands.join(',');
    }
    
    if (filters.inStockOnly) {
        params.availability = 'IN_STOCK';
    }
    
    if (filters.sortBy) {
        const sort = buildSortParam(filters.sortBy);
        if (sort) {
            params.sort = sort;
        }
    }
    
    params.page = filters.page || 1;
    params.limit = Math.min(filters.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    
    return params;
}

// ============================================================================
// PRODUCT SERVICE
// ============================================================================

/**
 * Bol.com Products Service
 */
export const bolProductsService = {
    /**
     * Search for products
     * 
     * @param searchTerm - Search query
     * @param filters - Optional search filters
     * @returns Search response with products and refinements
     * 
     * @example
     * ```typescript
     * const results = await bolProductsService.searchProducts('samsung tv', {
     *     priceRange: [200, 1000],
     *     minRating: 4,
     *     sortBy: 'popularity'
     * });
     * ```
     */
    async searchProducts(searchTerm: string, filters: SearchFilters = {}): Promise<SearchResponse> {
        const params = {
            q: searchTerm,
            ...buildFilterParams(filters),
        };
        
        try {
            const response = await bolApiClient.get<{
                totalResults: number;
                page: number;
                limit: number;
                products: BolProduct[];
                refinements?: Array<{
                    id: string;
                    name: string;
                    type: string;
                    options: Array<{
                        id: string;
                        name: string;
                        count: number;
                    }>;
                }>;
                rangeRefinements?: Array<{
                    id: string;
                    name: string;
                    min: number;
                    max: number;
                    unit?: string;
                }>;
            }>(`${API_PATH}/products/search`, { params });
            
            const data = response.data;
            
            return {
                totalCount: data.totalResults || 0,
                page: data.page || 1,
                pageSize: data.limit || DEFAULT_PAGE_SIZE,
                totalPages: Math.ceil((data.totalResults || 0) / (data.limit || DEFAULT_PAGE_SIZE)),
                products: data.products || [],
                refinements: (data.refinements || []).map(r => ({
                    id: r.id,
                    name: r.name,
                    type: r.type as 'multi-select' | 'single-select' | 'range',
                    options: r.options.map(o => ({
                        id: o.id,
                        name: o.name,
                        productCount: o.count,
                    })),
                })),
                rangeRefinements: (data.rangeRefinements || []).map(r => ({
                    id: r.id,
                    name: r.name,
                    min: r.min,
                    max: r.max,
                    unit: r.unit,
                })),
            };
        } catch (error) {
            console.error('[BolProducts] Search error:', error);
            throw error;
        }
    },

    /**
     * Get product details by EAN
     * 
     * @param ean - European Article Number
     * @returns Product details or null if not found
     */
    async getProduct(ean: string): Promise<BolProduct | null> {
        try {
            const response = await bolApiClient.get<BolProduct>(`${API_PATH}/products/${ean}`);
            return response.data;
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    },

    /**
     * Get the best offer for a product
     * 
     * @param ean - European Article Number
     * @returns Best offer or null if not found
     */
    async getProductBestOffer(ean: string): Promise<BestOffer | null> {
        try {
            const response = await bolApiClient.get<{ offer: BestOffer }>(`${API_PATH}/products/${ean}/offers/best`);
            return response.data.offer;
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    },

    /**
     * Get product media (images, videos)
     * 
     * @param ean - European Article Number
     * @returns Array of product media
     */
    async getProductMedia(ean: string): Promise<ProductMedia[]> {
        try {
            const response = await bolApiClient.get<{ media: ProductMedia[] }>(`${API_PATH}/products/${ean}/media`);
            return response.data.media || [];
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return [];
            }
            throw error;
        }
    },

    /**
     * Get product ratings
     * 
     * @param ean - European Article Number
     * @returns Product rating or null if not found
     */
    async getProductRating(ean: string): Promise<ProductRating | null> {
        try {
            const response = await bolApiClient.get<ProductRating>(`${API_PATH}/products/${ean}/ratings`);
            return response.data;
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    },

    /**
     * Get product categories
     * 
     * @param ean - European Article Number
     * @returns Array of product categories
     */
    async getProductCategories(ean: string): Promise<ProductCategory[]> {
        try {
            const response = await bolApiClient.get<{ categories: ProductCategory[] }>(`${API_PATH}/products/${ean}/categories`);
            return response.data.categories || [];
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return [];
            }
            throw error;
        }
    },

    /**
     * Get product specifications
     * 
     * @param ean - European Article Number
     * @returns Array of product specifications
     */
    async getProductSpecifications(ean: string): Promise<ProductSpecification[]> {
        try {
            const response = await bolApiClient.get<{ specifications: ProductSpecification[] }>(`${API_PATH}/products/${ean}/specifications`);
            return response.data.specifications || [];
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return [];
            }
            throw error;
        }
    },

    /**
     * List popular products for a category
     * 
     * @param categoryId - Category ID
     * @param filters - Optional filters
     * @returns Popular products response
     */
    async listPopularProducts(categoryId: string, filters: SearchFilters = {}): Promise<PopularProductsResponse> {
        const params = {
            categoryId,
            ...buildFilterParams(filters),
        };
        
        try {
            const response = await bolApiClient.get<{
                categoryId: string;
                categoryName: string;
                products: BolProduct[];
            }>(`${API_PATH}/products/lists/popular`, { params });
            
            const data = response.data;
            
            return {
                categoryId: data.categoryId,
                categoryName: data.categoryName,
                products: data.products || [],
                lastUpdated: new Date().toISOString(),
            };
        } catch (error) {
            console.error('[BolProducts] Popular products error:', error);
            throw error;
        }
    },

    /**
     * Get all categories
     * 
     * @param parentId - Optional parent category ID for subcategories
     * @returns Array of categories
     */
    async getCategories(parentId?: string): Promise<Category[]> {
        const params: Record<string, string> = {};
        if (parentId) {
            params.parentId = parentId;
        }
        
        try {
            const response = await bolApiClient.get<{ categories: Category[] }>(`${API_PATH}/categories`, { params });
            return response.data.categories || [];
        } catch (error) {
            console.error('[BolProducts] Categories error:', error);
            throw error;
        }
    },

    /**
     * Get category by ID
     * 
     * @param categoryId - Category ID
     * @returns Category or null if not found
     */
    async getCategory(categoryId: string): Promise<Category | null> {
        try {
            const response = await bolApiClient.get<Category>(`${API_PATH}/categories/${categoryId}`);
            return response.data;
        } catch (error) {
            if (error instanceof BolApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    },

    /**
     * Get products with deals (large discounts)
     * 
     * @param minDiscountPercentage - Minimum discount percentage (default: 20)
     * @param filters - Optional filters
     * @returns Search response with deal products
     */
    async getDeals(minDiscountPercentage: number = 20, filters: SearchFilters = {}): Promise<SearchResponse> {
        // Search for products with significant discounts
        // This is a client-side filter since the API may not support direct deal filtering
        const searchFilters = {
            ...filters,
            pageSize: MAX_PAGE_SIZE,
        };
        
        try {
            // Get popular products and filter by discount
            const params = {
                ...buildFilterParams(searchFilters),
                hasDiscount: true,
                minDiscountPercentage,
            };
            
            const response = await bolApiClient.get<{
                totalResults: number;
                page: number;
                limit: number;
                products: BolProduct[];
            }>(`${API_PATH}/products/deals`, { params });
            
            const data = response.data;
            
            // Filter products with sufficient discount
            const dealProducts = (data.products || []).filter(product => {
                const offer = product.bestOffer;
                if (!offer?.discountPercentage) return false;
                return offer.discountPercentage >= minDiscountPercentage;
            });
            
            return {
                totalCount: dealProducts.length,
                page: 1,
                pageSize: dealProducts.length,
                totalPages: 1,
                products: dealProducts,
                refinements: [],
                rangeRefinements: [],
            };
        } catch (error) {
            // If dedicated deals endpoint doesn't exist, return empty response
            if (error instanceof BolApiError && (error.status === 404 || error.status === 400)) {
                console.warn('[BolProducts] Deals endpoint not available, returning empty response');
                return {
                    totalCount: 0,
                    page: 1,
                    pageSize: 0,
                    totalPages: 0,
                    products: [],
                    refinements: [],
                    rangeRefinements: [],
                };
            }
            throw error;
        }
    },

    /**
     * Get complete product details including all related data
     * 
     * @param ean - European Article Number
     * @returns Complete product with all details or null
     */
    async getCompleteProduct(ean: string): Promise<BolProduct | null> {
        try {
            // Fetch all product data in parallel
            const [product, media, rating, categories, specifications] = await Promise.all([
                this.getProduct(ean),
                this.getProductMedia(ean),
                this.getProductRating(ean),
                this.getProductCategories(ean),
                this.getProductSpecifications(ean),
            ]);
            
            if (!product) {
                return null;
            }
            
            // Merge all data into complete product
            return {
                ...product,
                images: media.filter(m => m.type === 'IMAGE').map((m, i) => ({
                    url: m.url,
                    width: m.width,
                    height: m.height,
                    displayOrder: m.displayOrder || i + 1,
                    mimeType: m.mimeType,
                })),
                rating: rating || undefined,
                categories,
                specifications,
            };
        } catch (error) {
            console.error('[BolProducts] Complete product error:', error);
            throw error;
        }
    },
};

export default bolProductsService;
