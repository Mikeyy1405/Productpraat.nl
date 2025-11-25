import { Product, Article, ArticleType } from '../types';

interface BolData {
    title: string;
    price: number;
    image: string;
    ean: string;
    url: string;
    rawDescription: string;
    specs: Record<string, string>;
}

interface ProductCandidate {
    bolData: BolData;
    aiData: Partial<Product>;
}

/**
 * AI Service - Server-side wrapper
 * All AI API calls are routed through the server to protect API keys
 */
export const aiService = {
    /**
     * Generate product review data using server-side AI
     */
    generateProduct: async (bolData: BolData): Promise<Partial<Product>> => {
        try {
            const response = await fetch('/api/admin/product/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bolData, rawDescription: bolData.rawDescription })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'AI product generatie mislukt');
            }

            return await response.json();
        } catch (error) {
            console.error('AI Product Generation Error:', error);
            throw error;
        }
    },

    /**
     * Generate article content using server-side AI
     */
    generateArticle: async (type: ArticleType, topic: string, category: string): Promise<Partial<Article>> => {
        try {
            const response = await fetch('/api/admin/article/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, topic, category })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'AI artikel generatie mislukt');
            }

            return await response.json();
        } catch (error) {
            console.error('AI Article Generation Error:', error);
            throw error;
        }
    },

    /**
     * Bulk search and add products with AI enrichment
     */
    bulkSearchAndAdd: async (category: string, limit: number): Promise<ProductCandidate[]> => {
        try {
            const response = await fetch('/api/admin/bulk/search-and-add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, limit })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Bulk import mislukt');
            }

            return await response.json();
        } catch (error) {
            console.error('Bulk Search Error:', error);
            throw error;
        }
    },

    /**
     * Import single product from URL with AI enrichment
     */
    importFromUrl: async (url: string): Promise<{ bolData: BolData; aiData: Partial<Product> }> => {
        try {
            const response = await fetch('/api/admin/import/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Product import mislukt');
            }

            return await response.json();
        } catch (error) {
            console.error('Import URL Error:', error);
            throw error;
        }
    }
};
