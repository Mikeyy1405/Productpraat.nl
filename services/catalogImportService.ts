/**
 * Catalog Import Service
 *
 * Handles bulk product imports from Bol.com across all categories
 * Uses AI to generate unique content for each product
 */

import { Product } from '../types';
import { CATEGORY_ID_MAPPING, CATEGORY_SEARCH_FALLBACK, CATEGORY_DISPLAY_NAMES } from '../src/lib/categoryMapping';

// Types
export interface ImportProgress {
    category: string;
    categoryDisplayName: string;
    totalProducts: number;
    importedProducts: number;
    failedProducts: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    error?: string;
}

export interface CatalogImportConfig {
    productsPerCategory: number;
    categories?: string[];
    generateAIContent: boolean;
    saveToDatabase: boolean;
    onProgress?: (progress: ImportProgress[]) => void;
}

export interface CatalogImportResult {
    success: boolean;
    totalCategories: number;
    totalProductsImported: number;
    totalProductsFailed: number;
    categoryResults: ImportProgress[];
    duration: number;
}

// Constants
const DEFAULT_PRODUCTS_PER_CATEGORY = 20;
const API_BASE_URL = '/api';

/**
 * Get all available categories for import
 */
export const getAvailableCategories = (): Array<{
    key: string;
    displayName: string;
    bolCategoryId: string;
}> => {
    return Object.entries(CATEGORY_ID_MAPPING).map(([key, bolCategoryId]) => ({
        key,
        displayName: CATEGORY_DISPLAY_NAMES[key] || key,
        bolCategoryId,
    }));
};

/**
 * Get category groups for organized display
 */
export const getCategoryGroups = (): Record<string, string[]> => {
    return {
        'Elektronica': ['televisies', 'audio', 'laptops', 'smartphones', 'tablets', 'gaming', 'computers', 'monitoren', 'camera', 'wearables'],
        'Huishouden': ['wasmachines', 'drogers', 'stofzuigers', 'koelkasten', 'vaatwassers', 'magnetrons', 'ovens'],
        'Smart Home': ['smarthome', 'verlichting', 'beveiliging'],
        'Slaapkamer': ['matrassen', 'bedden', 'dekbedden'],
        'Keuken': ['airfryers', 'koffie', 'keuken', 'blenders', 'waterkokers', 'broodroosters'],
        'Verzorging': ['verzorging', 'scheerapparaten', 'haarverzorging', 'mondverzorging'],
        'Tuin & Klussen': ['tuin', 'gereedschap', 'grasmaaiers'],
        'Sport & Vrije Tijd': ['sport', 'fietsen', 'fitness'],
        'Baby & Kind': ['baby', 'speelgoed'],
        'Beauty & Gezondheid': ['beauty', 'gezondheid'],
    };
};

/**
 * Import products for a single category
 */
export const importCategoryProducts = async (
    categoryKey: string,
    limit: number = DEFAULT_PRODUCTS_PER_CATEGORY,
    generateAIContent: boolean = true
): Promise<{
    products: Product[];
    failed: number;
    error?: string;
}> => {
    const categoryId = CATEGORY_ID_MAPPING[categoryKey];
    const searchFallback = CATEGORY_SEARCH_FALLBACK[categoryKey];

    if (!categoryId) {
        return {
            products: [],
            failed: 0,
            error: `Unknown category: ${categoryKey}`,
        };
    }

    try {
        // Call the server API to fetch and process products
        const response = await fetch(`${API_BASE_URL}/catalog/import-category`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                categoryKey,
                categoryId,
                searchFallback,
                limit,
                generateAIContent,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Import failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return {
            products: result.products || [],
            failed: result.failed || 0,
            error: result.error,
        };
    } catch (error) {
        console.error(`[CatalogImport] Failed to import category ${categoryKey}:`, error);
        return {
            products: [],
            failed: limit,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

/**
 * Import products across all (or specified) categories
 */
export const importFullCatalog = async (
    config: CatalogImportConfig
): Promise<CatalogImportResult> => {
    const startTime = Date.now();

    // Determine which categories to import
    const categoriesToImport = config.categories || Object.keys(CATEGORY_ID_MAPPING);

    // Initialize progress tracking
    const progress: ImportProgress[] = categoriesToImport.map(cat => ({
        category: cat,
        categoryDisplayName: CATEGORY_DISPLAY_NAMES[cat] || cat,
        totalProducts: config.productsPerCategory,
        importedProducts: 0,
        failedProducts: 0,
        status: 'pending',
    }));

    // Report initial progress
    config.onProgress?.(progress);

    // Process categories sequentially to avoid rate limiting
    for (let i = 0; i < categoriesToImport.length; i++) {
        const categoryKey = categoriesToImport[i];

        // Update status to in_progress
        progress[i].status = 'in_progress';
        config.onProgress?.(progress);

        try {
            const result = await importCategoryProducts(
                categoryKey,
                config.productsPerCategory,
                config.generateAIContent
            );

            progress[i].importedProducts = result.products.length;
            progress[i].failedProducts = result.failed;
            progress[i].status = result.error ? 'failed' : 'completed';
            progress[i].error = result.error;
        } catch (error) {
            progress[i].status = 'failed';
            progress[i].failedProducts = config.productsPerCategory;
            progress[i].error = error instanceof Error ? error.message : 'Unknown error';
        }

        // Report progress after each category
        config.onProgress?.(progress);

        // Small delay between categories to avoid rate limiting
        if (i < categoriesToImport.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Calculate totals
    const totalProductsImported = progress.reduce((sum, p) => sum + p.importedProducts, 0);
    const totalProductsFailed = progress.reduce((sum, p) => sum + p.failedProducts, 0);

    return {
        success: totalProductsFailed === 0,
        totalCategories: categoriesToImport.length,
        totalProductsImported,
        totalProductsFailed,
        categoryResults: progress,
        duration: Date.now() - startTime,
    };
};

/**
 * Quick import: Import a small number of products from each category
 * Useful for initial setup or testing
 */
export const quickImport = async (
    productsPerCategory: number = 5,
    onProgress?: (progress: ImportProgress[]) => void
): Promise<CatalogImportResult> => {
    return importFullCatalog({
        productsPerCategory,
        generateAIContent: true,
        saveToDatabase: true,
        onProgress,
    });
};

/**
 * Full import: Import many products from each category
 * Use for comprehensive catalog building
 */
export const fullImport = async (
    productsPerCategory: number = 50,
    onProgress?: (progress: ImportProgress[]) => void
): Promise<CatalogImportResult> => {
    return importFullCatalog({
        productsPerCategory,
        generateAIContent: true,
        saveToDatabase: true,
        onProgress,
    });
};

/**
 * Selective import: Import products from specific categories only
 */
export const selectiveImport = async (
    categories: string[],
    productsPerCategory: number = 20,
    onProgress?: (progress: ImportProgress[]) => void
): Promise<CatalogImportResult> => {
    return importFullCatalog({
        categories,
        productsPerCategory,
        generateAIContent: true,
        saveToDatabase: true,
        onProgress,
    });
};

export default {
    getAvailableCategories,
    getCategoryGroups,
    importCategoryProducts,
    importFullCatalog,
    quickImport,
    fullImport,
    selectiveImport,
};
