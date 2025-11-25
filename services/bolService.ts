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