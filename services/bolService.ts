/**
 * @deprecated This service is deprecated.
 * 
 * The Bol.com API integration has been fully removed from ProductPraat.
 * All products are now added via URL scraping + AI generation.
 * 
 * For affiliate link generation, use the new affiliateService.ts instead:
 * - detectNetwork(url) - Detect affiliate network from URL
 * - generateAffiliateLink(url) - Generate tracked affiliate links
 * - trackClick(productId, url) - Track affiliate clicks
 * 
 * @see services/affiliateService.ts for the new affiliate infrastructure
 * @see components/ProductGenerator.tsx for URL-based product import
 */

import { Product } from '../types';

// Log deprecation warning
console.warn('[DEPRECATED] bolService.ts is deprecated. Use URL-based import via ProductGenerator and affiliateService.ts for affiliate tracking.');

interface BolData {
    title: string;
    price: number;
    image: string;
    ean: string;
    url: string;
    rawDescription: string;
    specs: Record<string, string>;
}

interface BolListItem {
    id: string;
    ean: string;
    title: string;
    url: string;
}

// Detailed search result item for manual product selection
export interface BolSearchProduct {
    id: string;
    ean: string;
    title: string;
    brand: string;
    image: string;
    price: number;
    url: string;
    rawUrl: string;
    description: string;
    available: boolean;
}

export interface BolSearchResult {
    products: BolSearchProduct[];
    total?: number;
    error?: string;
    message?: string;
}

const deprecationError = new Error(
    'Bol.com API is verwijderd. Gebruik URL-based import via ProductGenerator of affiliateService.ts voor affiliate tracking.'
);

/**
 * @deprecated Use URL-based import instead
 */
export const fetchBolProduct = async (_input: string): Promise<BolData> => {
    console.error('[DEPRECATED] fetchBolProduct is deprecated. Use URL-based import via ProductGenerator.');
    throw deprecationError;
};

/**
 * @deprecated Use URL-based import instead
 */
export const searchBolProducts = async (_term: string, _limit: number = 5): Promise<BolListItem[]> => {
    console.error('[DEPRECATED] searchBolProducts is deprecated. Use URL-based import via ProductGenerator.');
    return [];
};

/**
 * @deprecated Use URL-based import instead
 */
export const searchBolProductsDetailed = async (_searchTerm: string, _limit: number = 50): Promise<BolSearchResult> => {
    console.error('[DEPRECATED] searchBolProductsDetailed is deprecated. Use URL-based import via ProductGenerator.');
    return { 
        products: [], 
        error: 'Bol.com API is verwijderd. Gebruik URL-based import.'
    };
};

/**
 * @deprecated Use URL-based import instead
 */
export const importProductByEan = async (_ean: string): Promise<{ bolData: any; aiData: any; warnings?: string[] }> => {
    console.error('[DEPRECATED] importProductByEan is deprecated. Use URL-based import via ProductGenerator.');
    throw deprecationError;
};