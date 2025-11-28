/**
 * Bol.com Marketing Catalog API Types
 * 
 * Based on the official OpenAPI specification for the Bol.com Marketing Catalog API.
 * These types cover product search, details, offers, media, ratings, and categories.
 * 
 * @see https://api.bol.com/
 * @version 1.0.0
 */

// ============================================================================
// BASIC TYPES
// ============================================================================

/**
 * Product availability status
 */
export type AvailabilityStatus = 'IN_STOCK' | 'LIMITED_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';

/**
 * Sort options for product search
 */
export type SortOption = 'relevance' | 'popularity' | 'price_asc' | 'price_desc' | 'rating';

// ============================================================================
// PRICE & OFFER TYPES
// ============================================================================

/**
 * Price information for a product
 */
export interface Price {
    /** Price value in EUR */
    value: number;
    /** Currency code (typically EUR) */
    currency: string;
}

/**
 * Offer information for a product
 */
export interface ProductOffer {
    /** Unique offer identifier */
    offerId: string;
    /** Seller information */
    seller: {
        /** Seller ID */
        id: string;
        /** Seller display name */
        displayName: string;
        /** Seller rating (0-10) */
        rating?: number;
    };
    /** Current price */
    price: Price;
    /** Original price (before discount) */
    strikethroughPrice?: Price;
    /** Discount percentage */
    discountPercentage?: number;
    /** Delivery information */
    delivery: {
        /** Expected delivery time description */
        deliveryDescription: string;
        /** Is available for delivery */
        isAvailable: boolean;
        /** Delivery promise (e.g., "vandaag bezorgd") */
        deliveryPromise?: string;
    };
    /** Availability status */
    availability: AvailabilityStatus;
    /** Stock level (if available) */
    stockAmount?: number;
    /** Is this Bol.com's own offer */
    isBolOffer: boolean;
    /** Free shipping available */
    freeShipping?: boolean;
}

/**
 * Best offer for a product
 */
export interface BestOffer extends ProductOffer {
    /** Number of available offers for this product */
    totalOffers: number;
    /** URL to view all offers */
    allOffersUrl?: string;
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

/**
 * Basic product image
 */
export interface ProductImage {
    /** Image URL */
    url: string;
    /** Image width in pixels */
    width?: number;
    /** Image height in pixels */
    height?: number;
    /** Display order (1 = primary) */
    displayOrder: number;
    /** MIME type (e.g., 'image/jpeg') */
    mimeType?: string;
}

/**
 * Product media (extended image info)
 */
export interface ProductMedia {
    /** Media type (image, video, etc.) */
    type: 'IMAGE' | 'VIDEO' | '360_IMAGE';
    /** Media URL */
    url: string;
    /** Width */
    width?: number;
    /** Height */
    height?: number;
    /** Order for display */
    displayOrder: number;
    /** MIME type */
    mimeType?: string;
    /** Alt text */
    altText?: string;
    /** Thumbnail URL */
    thumbnailUrl?: string;
}

/**
 * Product rating distribution
 */
export interface RatingDistribution {
    /** Rating value (1-5) */
    rating: number;
    /** Number of reviews with this rating */
    count: number;
}

/**
 * Product rating summary
 */
export interface ProductRating {
    /** Average rating (0-5 scale) */
    averageRating: number;
    /** Total number of ratings */
    totalRatings: number;
    /** Number of reviews with text */
    totalReviews: number;
    /** Rating distribution breakdown */
    distribution: RatingDistribution[];
}

/**
 * Product specification
 */
export interface ProductSpecification {
    /** Group title (e.g., "Algemeen", "Display") */
    groupTitle?: string;
    /** Specification key/ID */
    key: string;
    /** Human-readable specification name */
    name: string;
    /** Specification value */
    value: string;
}

/**
 * Category information
 */
export interface Category {
    /** Category ID */
    id: string;
    /** Category name */
    name: string;
    /** Parent category ID */
    parentId?: string;
    /** Category level in hierarchy (0 = root) */
    level: number;
    /** Number of products in this category */
    productCount?: number;
    /** Sub-categories */
    children?: Category[];
}

/**
 * Product category assignment
 */
export interface ProductCategory {
    /** Category ID */
    categoryId: string;
    /** Category name */
    categoryName: string;
    /** Is this the primary category */
    isPrimary: boolean;
    /** Full category path */
    path: string[];
}

/**
 * Core product type from Bol.com API
 */
export interface BolProduct {
    /** European Article Number (unique product identifier) */
    ean: string;
    /** Bol.com internal product ID */
    bolProductId: string;
    /** Product title */
    title: string;
    /** Product description (may contain HTML) */
    description?: string;
    /** Short description */
    shortDescription?: string;
    /** Brand name */
    brand?: string;
    /** Product URL on Bol.com */
    url: string;
    /** Main product image URL */
    mainImageUrl?: string;
    /** Product images */
    images: ProductImage[];
    /** Best available offer */
    bestOffer?: BestOffer;
    /** Product rating */
    rating?: ProductRating;
    /** Product specifications */
    specifications: ProductSpecification[];
    /** Product categories */
    categories: ProductCategory[];
    /** Global Trade Item Number */
    gtin?: string;
    /** Manufacturer Part Number */
    mpn?: string;
    /** Release date */
    releaseDate?: string;
    /** Is adult product */
    isAdult?: boolean;
}

// ============================================================================
// SEARCH & FILTER TYPES
// ============================================================================

/**
 * Search refinement option (for filters)
 */
export interface Refinement {
    /** Filter type ID */
    id: string;
    /** Filter display name */
    name: string;
    /** Filter type (e.g., 'multi-select', 'single-select') */
    type: 'multi-select' | 'single-select' | 'range';
    /** Available options */
    options: RefinementOption[];
}

/**
 * Refinement option value
 */
export interface RefinementOption {
    /** Option ID/value */
    id: string;
    /** Display name */
    name: string;
    /** Number of products matching this option */
    productCount: number;
    /** Is currently selected */
    isSelected?: boolean;
}

/**
 * Range refinement (e.g., price range)
 */
export interface RangeRefinement {
    /** Filter ID */
    id: string;
    /** Filter name */
    name: string;
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** Currently selected minimum */
    selectedMin?: number;
    /** Currently selected maximum */
    selectedMax?: number;
    /** Unit (e.g., '€', 'cm') */
    unit?: string;
}

/**
 * Search filters request
 */
export interface SearchFilters {
    /** Category IDs to filter by */
    categoryIds?: string[];
    /** Price range [min, max] in EUR */
    priceRange?: [number, number];
    /** Minimum rating (0-5) */
    minRating?: number;
    /** Brand names to filter by */
    brands?: string[];
    /** Only show in-stock products */
    inStockOnly?: boolean;
    /** Sort order */
    sortBy?: SortOption;
    /** Page number (1-indexed) */
    page?: number;
    /** Items per page */
    pageSize?: number;
}

/**
 * Search response from Bol.com API
 */
export interface SearchResponse {
    /** Total number of matching products */
    totalCount: number;
    /** Current page */
    page: number;
    /** Page size */
    pageSize: number;
    /** Total pages available */
    totalPages: number;
    /** Matching products */
    products: BolProduct[];
    /** Available refinements/filters */
    refinements: Refinement[];
    /** Available range filters */
    rangeRefinements: RangeRefinement[];
    /** Search took time (ms) */
    searchTime?: number;
}

/**
 * Popular products response
 */
export interface PopularProductsResponse {
    /** Category ID */
    categoryId: string;
    /** Category name */
    categoryName: string;
    /** Popular products */
    products: BolProduct[];
    /** Last updated timestamp */
    lastUpdated: string;
}

// ============================================================================
// API ERROR TYPES
// ============================================================================

/**
 * API Problem (RFC 7807 format)
 */
export interface ApiProblem {
    /** Problem type URI */
    type: string;
    /** Short title */
    title: string;
    /** HTTP status code */
    status: number;
    /** Detailed description */
    detail?: string;
    /** Instance URI */
    instance?: string;
    /** Additional violation details */
    violations?: ApiViolation[];
}

/**
 * API violation detail
 */
export interface ApiViolation {
    /** Field name */
    name: string;
    /** Violation reason */
    reason: string;
}

// ============================================================================
// DATABASE TYPES (for internal use)
// ============================================================================

/**
 * Database product record (matches Supabase schema)
 */
export interface DbProduct {
    id: string;
    ean: string;
    bol_product_id?: string;
    title: string;
    description?: string;
    url: string;
    price?: number;
    strikethrough_price?: number;
    discount_percentage?: number;
    delivery_description?: string;
    in_stock: boolean;
    is_deal: boolean;
    average_rating?: number;
    total_ratings: number;
    main_image_url?: string;
    custom_description?: string;
    custom_review_summary?: string;
    last_synced_at: string;
    created_at: string;
    updated_at: string;
}

/**
 * Database product image record
 */
export interface DbProductImage {
    id: string;
    product_id: string;
    url: string;
    width?: number;
    height?: number;
    display_order: number;
    mime_type?: string;
}

/**
 * Database category record
 */
export interface DbCategory {
    id: string;
    name: string;
    parent_id?: string;
    product_count: number;
    level: number;
}

/**
 * Database product-category junction
 */
export interface DbProductCategory {
    product_id: string;
    category_id: string;
}

/**
 * Database product specification record
 */
export interface DbProductSpecification {
    id: string;
    product_id: string;
    group_title?: string;
    spec_key: string;
    spec_name: string;
    spec_value: string;
}

/**
 * Database deal record
 */
export interface DbDeal {
    id: string;
    product_id: string;
    title: string;
    discount_percentage?: number;
    start_date?: string;
    end_date?: string;
    is_active: boolean;
    deal_type?: 'black_friday' | 'flash_deal' | 'daily_deal' | 'clearance';
}

// ============================================================================
// SYNC TYPES
// ============================================================================

/**
 * Sync job status
 */
export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Sync job record
 */
export interface SyncJob {
    id: string;
    type: 'popular_products' | 'price_update' | 'deal_detection' | 'rating_update';
    status: SyncJobStatus;
    categoryId?: string;
    startedAt?: string;
    completedAt?: string;
    itemsProcessed: number;
    itemsFailed: number;
    errorMessage?: string;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
    enabled: boolean;
    popularProductsIntervalHours: number;
    priceUpdateIntervalHours: number;
    dealDetectionIntervalMinutes: number;
    ratingUpdateIntervalHours: number;
    popularProductsLimit: number;
}

// ============================================================================
// AFFILIATE TYPES
// ============================================================================

/**
 * Bol.com affiliate link
 */
export interface BolAffiliateLink {
    /** Original product URL */
    originalUrl: string;
    /** Affiliate URL with tracking */
    affiliateUrl: string;
    /** Partner/affiliate ID */
    partnerId: string;
    /** Generated at timestamp */
    generatedAt: string;
}

/**
 * Affiliate click tracking
 */
export interface AffiliateClickEvent {
    productEan: string;
    affiliateUrl: string;
    clickedAt: string;
    sessionId?: string;
    referrer?: string;
}
