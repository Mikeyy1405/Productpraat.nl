import { Product } from '../types';

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

export const fetchBolProduct = async (input: string): Promise<BolData> => {
    try {
        const response = await fetch('/api/bol/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ input })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Fout bij ophalen Bol.com data');
        }

        return await response.json();
    } catch (error) {
        console.error("Bol Service Error:", error);
        throw error;
    }
};

export const searchBolProducts = async (term: string, limit: number = 5): Promise<BolListItem[]> => {
    try {
        const response = await fetch('/api/bol/search-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term, limit })
        });
        
        if (!response.ok) return [];
        const data = await response.json();
        return data.products || [];
    } catch (e) {
        console.error("Search List Error", e);
        return [];
    }
};

/**
 * Search for Bol.com products with detailed information for manual selection
 */
export const searchBolProductsDetailed = async (searchTerm: string, limit: number = 10): Promise<BolSearchResult> => {
    try {
        const response = await fetch('/api/bol/search-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchTerm, limit })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return { 
                products: [], 
                error: data.error || 'Zoeken mislukt'
            };
        }
        
        return data;
    } catch (e) {
        console.error("Detailed Search Error", e);
        return { 
            products: [], 
            error: e instanceof Error ? e.message : 'Zoeken mislukt'
        };
    }
};

/**
 * Import a product by EAN with AI enrichment
 */
export const importProductByEan = async (ean: string): Promise<{ bolData: any; aiData: any }> => {
    try {
        const response = await fetch('/api/bol/import-by-ean', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ean })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Import mislukt');
        }
        
        return await response.json();
    } catch (error) {
        console.error("Import by EAN Error:", error);
        throw error;
    }
};