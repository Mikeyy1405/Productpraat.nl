
/**
 * @deprecated This client-side service is deprecated.
 * Use services/aiService.ts instead for server-side AI generation.
 * API keys should not be exposed in client-side code.
 * 
 * For affiliate functionality, use services/affiliateService.ts:
 * - detectNetwork(url) - Detect affiliate network from URL
 * - generateAffiliateLink(url) - Generate tracked affiliate links
 * - trackClick(productId, url) - Track affiliate clicks
 * 
 * @see services/affiliateService.ts for affiliate infrastructure
 * @see services/claudeService.ts for product review generation
 */

import { Product, ContentSuggestion, Article } from '../types';

// DEPRECATED: All AI calls should now go through claudeService.ts (client-side) or server.js endpoints
// All affiliate tracking should use affiliateService.ts
// This file is kept for backwards compatibility but should not be used.

console.warn('[DEPRECATED] geminiService.ts is deprecated. Use claudeService.ts for AI calls and affiliateService.ts for affiliate tracking.');

/**
 * @deprecated Use claudeService.generateProductReview() instead
 */
export const generateProductFromInput = async (): Promise<Partial<Product>> => {
    console.error('[DEPRECATED] generateProductFromInput is deprecated. Use claudeService.generateProductReview()');
    throw new Error('This function is deprecated. Use claudeService from services/claudeService.ts');
};

/**
 * @deprecated Use claudeService.generateArticle() instead
 */
export const generateArticle = async (): Promise<Partial<Article>> => {
    console.error('[DEPRECATED] generateArticle is deprecated.');
    throw new Error('This function is deprecated.');
};

/**
 * @deprecated This function is no longer supported
 */
export const generateContentStrategy = async (): Promise<ContentSuggestion[]> => {
    console.error('[DEPRECATED] generateContentStrategy is deprecated');
    throw new Error('This function is deprecated');
};
