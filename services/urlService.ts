import { Product, Article, ArticleType, CATEGORIES } from '../types';

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
    // Use window.location.origin for dynamic base URL - works in browser environment
    // Falls back to empty string for server-side or test environments
    const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : '';
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
    },
    
    /**
     * Navigate to an article page
     */
    navigateToArticle: (article: Article): void => {
        urlRouter.push(getArticleUrl(article));
    },
    
    /**
     * Navigate to articles overview
     */
    navigateToArticles: (): void => {
        urlRouter.push('/artikelen');
    }
};

/** Maximum length for article slugs */
const MAX_ARTICLE_SLUG_LENGTH = 100;

/** Mapping of article types to Dutch slug prefixes */
export const ARTICLE_TYPE_SLUG_MAPPING: Record<ArticleType, string> = {
    'comparison': 'vergelijking',
    'list': 'toplijst',
    'guide': 'koopgids',
    'informational': 'informatief'
};

/** Mapping of article types to Dutch display labels */
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
    'comparison': 'Vergelijking',
    'list': 'Toplijst',
    'guide': 'Koopgids',
    'informational': 'Informatief'
};

/** Mapping of article types to color classes for badges */
export const ARTICLE_TYPE_COLORS: Record<ArticleType, { bg: string; text: string; bgFull: string }> = {
    'guide': { bg: 'bg-blue-600/20', text: 'text-blue-400', bgFull: 'bg-blue-600' },
    'list': { bg: 'bg-purple-600/20', text: 'text-purple-400', bgFull: 'bg-purple-600' },
    'comparison': { bg: 'bg-green-600/20', text: 'text-green-400', bgFull: 'bg-green-600' },
    'informational': { bg: 'bg-yellow-600/20', text: 'text-yellow-400', bgFull: 'bg-yellow-600' }
};

/**
 * Generate an article slug from type and title
 * Format: {type-dutch}-{title-kebab-case}
 */
export const generateArticleSlug = (article: Partial<Article>): string => {
    const typePrefix = article.type ? ARTICLE_TYPE_SLUG_MAPPING[article.type] : 'artikel';
    const titleStr = article.title || 'untitled';
    
    const titleSlug = titleStr.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')          // Replace spaces with -
        .replace(/-+/g, '-')           // Replace multiple - with single -
        .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens
    
    return `${typePrefix}-${titleSlug}`.substring(0, MAX_ARTICLE_SLUG_LENGTH) || 'artikel';
};

/**
 * Get the full URL path for an article
 */
export const getArticleUrl = (article: Article): string => {
    const slug = article.slug || generateArticleSlug(article);
    return `/artikelen/${slug}`;
};

/**
 * Parse an article URL to extract the slug
 */
export const parseArticleUrl = (path: string): { slug: string } | null => {
    // Match /artikelen/{slug} pattern
    const match = path.match(/^\/artikelen\/([^\/]+)\/?$/);
    if (!match) return null;
    
    const [, slug] = match;
    return { slug: slug.toLowerCase() };
};

/**
 * Check if a path matches the article URL pattern
 */
export const isArticleUrl = (path: string): boolean => {
    return /^\/artikelen\/[^\/]+\/?$/.test(path);
};

/**
 * Check if a path matches the articles overview page
 */
export const isArticlesOverviewUrl = (path: string): boolean => {
    return path === '/artikelen' || path === '/artikelen/';
};

/**
 * Get the canonical URL for an article
 */
export const getArticleCanonicalUrl = (article: Article): string => {
    const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${baseUrl}${getArticleUrl(article)}`;
};

/**
 * Remove the first H1 element from HTML content to prevent duplicate titles
 * This is used when the article title is already displayed separately in the page header
 * 
 * @param htmlContent - The HTML content string to process
 * @returns The HTML content with the first H1 element removed, or empty string if input is falsy
 * 
 * @note The regex fallback may not handle all edge cases like nested elements or malformed HTML.
 *       For production use with untrusted content, consider using a sanitization library.
 */
export const removeFirstH1FromHtml = (htmlContent: string): string => {
    // Handle null, undefined, or empty string
    if (!htmlContent || typeof htmlContent !== 'string') {
        return '';
    }
    
    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const firstH1 = doc.querySelector('h1');
            if (firstH1) {
                firstH1.remove();
            }
            return doc.body.innerHTML;
        } catch {
            // Fall through to regex fallback
        }
    }
    // Fallback: use regex to remove first H1 tag (may not handle all edge cases)
    return htmlContent.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
};
