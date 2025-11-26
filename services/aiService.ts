import { Product, Article, ArticleType } from '../types';

interface BolData {
    title: string;
    price: number;
    image: string;
    images?: string[];
    ean: string;
    url: string;
    rawDescription: string;
    specs: Record<string, string>;
    slug?: string;
    bolReviews?: {
        averageRating: number;
        totalReviews: number;
        distribution: { rating: number; count: number; }[];
    } | null;
}

interface ProductCandidate {
    bolData: BolData;
    aiData: Partial<Product>;
}

interface CategoryImportResult {
    products: ProductCandidate[];
    category: string;
    count: number;
}

interface CategoryInfo {
    id: string;
    name: string;
    searchTerm: string;
}

interface BulkImportProgress {
    phase: 'searching' | 'processing' | 'complete' | 'error';
    current: number;
    total: number;
    percentage: number;
    message: string;
    candidate?: ProductCandidate;
    error?: string;
}

type ProgressCallback = (progress: BulkImportProgress) => void;

// Error response interface for better error handling
interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: string;
    troubleshooting?: string[];
    partialData?: { bolData: BolData };
}

// Connection test result interface
interface ConnectionTestResult {
    success: boolean;
    message: string;
    timestamp: string;
    bol: {
        status: 'connected' | 'not_configured' | 'error' | 'unknown';
        message: string;
        troubleshooting?: string[];
    };
    ai: {
        status: 'configured' | 'not_configured' | 'unknown';
        message: string;
    };
}

/**
 * Parse API error response and return user-friendly message
 */
const parseApiError = (response: Response, data: ApiErrorResponse | null): string => {
    if (data?.troubleshooting && data.troubleshooting.length > 0) {
        return `${data.error}\n\nTips:\n• ${data.troubleshooting.join('\n• ')}`;
    }
    if (data?.error) {
        return data.error;
    }
    return `Fout ${response.status}: ${response.statusText}`;
};

/**
 * AI Service - Server-side wrapper
 * All AI API calls are routed through the server to protect API keys
 */
export const aiService = {
    /**
     * Test API connections (Bol.com and AI)
     */
    testConnection: async (): Promise<ConnectionTestResult> => {
        try {
            const response = await fetch('/api/admin/test-connection');
            
            if (!response.ok) {
                throw new Error('Kon verbinding niet testen');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Connection Test Error:', error);
            throw error;
        }
    },

    /**
     * Generate product review data using server-side AI
     */
    generateProduct: async (bolData: BolData): Promise<Partial<Product>> => {
        try {
            const response = await fetch('/api/admin/product/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bolData })
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
     * Bulk search and add products with AI enrichment (legacy - no progress)
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
     * Bulk search and add products with streaming progress updates (SSE)
     */
    bulkSearchWithProgress: (
        category: string, 
        limit: number, 
        onProgress: ProgressCallback
    ): { promise: Promise<ProductCandidate[]>; abort: () => void } => {
        const abortController = new AbortController();
        
        const promise = new Promise<ProductCandidate[]>((resolve, reject) => {
            const candidates: ProductCandidate[] = [];
            const params = new URLSearchParams({
                category,
                limit: String(limit)
            });
            
            const eventSource = new EventSource(`/api/admin/bulk/search-stream?${params}`);
            let serverTotal = 0; // Track the total from server init event
            
            eventSource.addEventListener('init', (e) => {
                const data = JSON.parse(e.data);
                serverTotal = data.total;
                onProgress({
                    phase: 'searching',
                    current: 0,
                    total: data.total,
                    percentage: 0,
                    message: data.message
                });
            });
            
            eventSource.addEventListener('status', (e) => {
                const data = JSON.parse(e.data);
                onProgress({
                    phase: data.phase,
                    current: 0,
                    total: serverTotal,
                    percentage: 0,
                    message: data.message
                });
            });
            
            eventSource.addEventListener('progress', (e) => {
                const data = JSON.parse(e.data);
                serverTotal = data.total; // Update total from server
                onProgress({
                    phase: 'processing',
                    current: data.current,
                    total: data.total,
                    percentage: data.percentage,
                    message: data.message
                });
            });
            
            eventSource.addEventListener('product', (e) => {
                const data = JSON.parse(e.data);
                candidates.push(data.candidate);
                const percentage = serverTotal > 0 ? Math.round(((data.index + 1) / serverTotal) * 100) : 0;
                onProgress({
                    phase: 'processing',
                    current: data.index + 1,
                    total: serverTotal,
                    percentage,
                    message: data.message,
                    candidate: data.candidate
                });
            });
            
            eventSource.addEventListener('product_error', (e) => {
                const data = JSON.parse(e.data);
                onProgress({
                    phase: 'processing',
                    current: data.index + 1,
                    total: serverTotal,
                    percentage: serverTotal > 0 ? Math.round(((data.index + 1) / serverTotal) * 100) : 0,
                    message: data.message,
                    error: data.message
                });
            });
            
            eventSource.addEventListener('complete', (e) => {
                const data = JSON.parse(e.data);
                onProgress({
                    phase: 'complete',
                    current: data.total,
                    total: data.total,
                    percentage: 100,
                    message: data.message
                });
                eventSource.close();
                resolve(candidates);
            });
            
            eventSource.addEventListener('error', (e) => {
                if (e instanceof MessageEvent) {
                    const data = JSON.parse(e.data);
                    onProgress({
                        phase: 'error',
                        current: 0,
                        total: 0,
                        percentage: 0,
                        message: data.message,
                        error: data.message
                    });
                    reject(new Error(data.message));
                } else {
                    reject(new Error('Connection lost'));
                }
                eventSource.close();
            });
            
            eventSource.onerror = () => {
                eventSource.close();
                reject(new Error('SSE connection error'));
            };
            
            // Handle abort
            abortController.signal.addEventListener('abort', () => {
                eventSource.close();
                reject(new Error('Import cancelled'));
            });
        });
        
        return {
            promise,
            abort: () => abortController.abort()
        };
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

            // Parse response body
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('Failed to parse response:', parseError);
                throw new Error('Ongeldige server response - probeer opnieuw');
            }

            if (!response.ok) {
                // Build detailed error message
                let errorMessage = data.error || 'Product import mislukt';
                
                // Add troubleshooting tips if available
                if (data.troubleshooting && data.troubleshooting.length > 0) {
                    errorMessage += '\n\nTips:\n• ' + data.troubleshooting.join('\n• ');
                }
                
                // Add error code for debugging
                if (data.code) {
                    console.error(`Import failed with code: ${data.code}`, data);
                }
                
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            console.error('Import URL Error:', error);
            
            // Handle network errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Netwerk fout - controleer je internetverbinding');
            }
            
            throw error;
        }
    },

    /**
     * Import products by app category (uses optimized Bol.com search)
     */
    importByCategory: async (category: string, limit: number = 5): Promise<CategoryImportResult> => {
        try {
            const response = await fetch('/api/admin/import/by-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, limit })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Category import mislukt');
            }

            return await response.json();
        } catch (error) {
            console.error('Category Import Error:', error);
            throw error;
        }
    },

    /**
     * Get available categories for import
     */
    getAvailableCategories: async (): Promise<CategoryInfo[]> => {
        try {
            const response = await fetch('/api/admin/categories');
            if (!response.ok) {
                throw new Error('Kon categorieën niet ophalen');
            }
            const data = await response.json();
            return data.categories || [];
        } catch (error) {
            console.error('Get Categories Error:', error);
            throw error;
        }
    },

    /**
     * Sync prices for products from Bol.com
     */
    syncPrices: async (products: Array<{ id: string; ean?: string; price: number; brand: string; model: string }>): Promise<{ 
        success: boolean; 
        updates: Array<{ id: string; ean: string; oldPrice: number; newPrice: number; brand: string; model: string }>; 
        totalChecked: number 
    }> => {
        try {
            const response = await fetch('/api/admin/sync-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Price sync mislukt');
            }

            return await response.json();
        } catch (error) {
            console.error('Price Sync Error:', error);
            throw error;
        }
    }
};
