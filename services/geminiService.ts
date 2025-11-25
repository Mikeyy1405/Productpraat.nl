
/**
 * @deprecated This client-side service is deprecated.
 * Use services/aiService.ts instead for server-side AI generation.
 * API keys should not be exposed in client-side code.
 */

import { Product, ContentSuggestion, Article, ArticleType } from '../types';

// DEPRECATED: All AI calls should now go through server.js endpoints
// This file is kept for backwards compatibility but should not be used.

console.warn('[DEPRECATED] geminiService.ts is deprecated. Use aiService.ts for server-side AI calls.');

/**
 * @deprecated Use aiService.generateProduct() instead
 */
export const generateProductFromInput = async (_rawText: string): Promise<Partial<Product>> => {
    console.error('[DEPRECATED] generateProductFromInput is deprecated. Use aiService.generateProduct()');
    throw new Error('This function is deprecated. Use aiService from services/aiService.ts');
};

/**
 * @deprecated Use aiService.generateArticle() instead
 */
export const generateArticle = async (_type: ArticleType, _topic: string, _category: string): Promise<Partial<Article>> => {
    console.error('[DEPRECATED] generateArticle is deprecated. Use aiService.generateArticle()');
    throw new Error('This function is deprecated. Use aiService from services/aiService.ts');
};

/**
 * @deprecated This function is no longer supported
 */
export const generateContentStrategy = async (_categoryName: string, _existingProducts: Product[]): Promise<ContentSuggestion[]> => {
    console.error('[DEPRECATED] generateContentStrategy is deprecated');
    throw new Error('This function is deprecated');
};
