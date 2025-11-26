import { Product, CATEGORIES } from '../types';

/**
 * URL Service for handling product URLs and slugs
 * Pattern: /shop/{category}/{product-slug}
 */

/**
 * Generate a SEO-friendly slug from brand and model
 */
export const generateSlug = (brand: string, model: string): string => {
    const brandStr = brand || '';
    const modelStr = model || '';
    const text = `${brandStr} ${modelStr}`.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')          // Replace spaces with -
        .replace(/-+/g, '-')           // Replace multiple - with single -
        .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
    return text || 'product';
};

/**
 * Generate a unique slug, appending a suffix if needed
 */
export const generateUniqueSlug = (brand: string, model: string, existingSlugs: string[]): string => {
    const baseSlug = generateSlug(brand, model);
    
    if (!existingSlugs.includes(baseSlug)) {
        return baseSlug;
    }
    
    // Find a unique slug by appending a number
    let counter = 2;
    let uniqueSlug = `${baseSlug}-${counter}`;
    while (existingSlugs.includes(uniqueSlug)) {
        counter++;
        uniqueSlug = `${baseSlug}-${counter}`;
    }
    return uniqueSlug;
};

/**
 * Generate the full product URL path
 */
export const getProductUrl = (product: Product): string => {
    const category = product.category || 'overig';
    const slug = product.slug || generateSlug(product.brand, product.model);
    return `/shop/${category}/${slug}`;
};

/**
 * Parse a product URL to extract category and slug
 */
export const parseProductUrl = (path: string): { category: string; slug: string } | null => {
    // Match /shop/{category}/{slug} pattern
    const match = path.match(/^\/shop\/([^\/]+)\/([^\/]+)\/?$/);
    if (!match) return null;
    
    const [, category, slug] = match;
    return { category: category.toLowerCase(), slug: slug.toLowerCase() };
};

/**
 * Check if a path matches the product URL pattern
 */
export const isProductUrl = (path: string): boolean => {
    return /^\/shop\/[^\/]+\/[^\/]+\/?$/.test(path);
};

/**
 * Get the canonical URL for a product
 */
export const getCanonicalUrl = (product: Product): string => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://productpraat.nl';
    return `${baseUrl}${getProductUrl(product)}`;
};

/**
 * Normalize a category string to match our category IDs
 */
export const normalizeCategory = (category: string): string => {
    const normalized = category.toLowerCase().trim();
    // Check if it exists in CATEGORIES
    if (CATEGORIES[normalized]) {
        return normalized;
    }
    return 'overig';
};

/**
 * URL router for handling browser navigation
 */
export const urlRouter = {
    /**
     * Push a new URL to browser history without page reload
     */
    push: (path: string): void => {
        if (typeof window !== 'undefined') {
            window.history.pushState({}, '', path);
        }
    },
    
    /**
     * Replace current URL in browser history without page reload
     */
    replace: (path: string): void => {
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', path);
        }
    },
    
    /**
     * Get current path from browser
     */
    getCurrentPath: (): string => {
        if (typeof window !== 'undefined') {
            return window.location.pathname;
        }
        return '/';
    },
    
    /**
     * Navigate to home
     */
    navigateHome: (): void => {
        urlRouter.push('/');
    },
    
    /**
     * Navigate to a product page
     */
    navigateToProduct: (product: Product): void => {
        urlRouter.push(getProductUrl(product));
    },
    
    /**
     * Navigate to a category page
     */
    navigateToCategory: (category: string): void => {
        urlRouter.push(`/shop/${category}`);
    }
};
