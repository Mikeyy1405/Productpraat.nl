/**
 * Category Mapping Module
 * 
 * Maps UI category buttons/names to Bol.com numeric category IDs.
 * Based on the Bol.com Marketing Catalog API requirements.
 * 
 * @module src/lib/categoryMapping
 */

/**
 * Mapping of UI category names to Bol.com numeric category IDs.
 * 
 * These IDs are used with the Bol.com Marketing Catalog API endpoints:
 * - GET /marketing/catalog/v1/products/lists/popular?category-id={categoryId}
 * - GET /marketing/catalog/v1/products/search?search-term={searchTerm}
 * 
 * Category IDs can be discovered using the search endpoint with include-relevant-categories=true
 * or via the scripts/find-bol-categories.ts discovery script.
 */
export const CATEGORY_ID_MAPPING: Record<string, string> = {
    // Electronics & Media
    'televisies': '10651',
    'audio': '14490',
    'laptops': '4770',
    'smartphones': '10852',
    
    // Home & Living
    'wasmachines': '11462',
    'stofzuigers': '20104',
    'smarthome': '20637',
    'matrassen': '10689',
    
    // Kitchen & Care
    'airfryers': '43756',
    'koffie': '10550',
    'keuken': '10540',
    'verzorging': '12442', // Confirmed from problem statement
};

/**
 * Fallback search terms for categories when category ID lookup fails.
 * These terms are used with the search endpoint as a fallback.
 */
export const CATEGORY_SEARCH_FALLBACK: Record<string, string> = {
    'televisies': 'televisie smart tv',
    'audio': 'bluetooth speaker koptelefoon',
    'laptops': 'laptop notebook',
    'smartphones': 'smartphone mobiele telefoon',
    'wasmachines': 'wasmachine',
    'stofzuigers': 'stofzuiger robotstofzuiger',
    'smarthome': 'smart home domotica',
    'matrassen': 'matras',
    'airfryers': 'airfryer heteluchtfriteuse',
    'koffie': 'koffiezetapparaat espressomachine',
    'keuken': 'keukenmachine blender',
    'verzorging': 'scheerapparaat elektrische tandenborstel',
};

/**
 * Human-readable category names for display in the UI.
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
    'televisies': 'Televisies',
    'audio': 'Audio & HiFi',
    'laptops': 'Laptops',
    'smartphones': 'Smartphones',
    'wasmachines': 'Wasmachines',
    'stofzuigers': 'Stofzuigers',
    'smarthome': 'Smart Home',
    'matrassen': 'Matrassen',
    'airfryers': 'Airfryers',
    'koffie': 'Koffie',
    'keuken': 'Keukenmachines',
    'verzorging': 'Verzorging',
};

/**
 * Get the Bol.com category ID for a given category key.
 * 
 * @param categoryKey - The category key (e.g., 'televisies', 'verzorging')
 * @returns The Bol.com numeric category ID or undefined if not found
 */
export function getCategoryId(categoryKey: string): string | undefined {
    const normalizedKey = categoryKey.toLowerCase().trim();
    return CATEGORY_ID_MAPPING[normalizedKey];
}

/**
 * Get the fallback search term for a given category key.
 * 
 * @param categoryKey - The category key (e.g., 'televisies', 'verzorging')
 * @returns The search term to use as fallback, or the category key if not found
 */
export function getCategorySearchTerm(categoryKey: string): string {
    const normalizedKey = categoryKey.toLowerCase().trim();
    return CATEGORY_SEARCH_FALLBACK[normalizedKey] || normalizedKey;
}

/**
 * Get the display name for a given category key.
 * 
 * @param categoryKey - The category key (e.g., 'televisies', 'verzorging')
 * @returns The human-readable display name
 */
export function getCategoryDisplayName(categoryKey: string): string {
    const normalizedKey = categoryKey.toLowerCase().trim();
    return CATEGORY_DISPLAY_NAMES[normalizedKey] || categoryKey;
}

/**
 * Get all available category keys.
 * 
 * @returns Array of all category keys
 */
export function getAllCategoryKeys(): string[] {
    return Object.keys(CATEGORY_ID_MAPPING);
}

/**
 * Check if a category key is valid.
 * 
 * @param categoryKey - The category key to check
 * @returns True if the category exists in the mapping
 */
export function isValidCategory(categoryKey: string): boolean {
    const normalizedKey = categoryKey.toLowerCase().trim();
    return normalizedKey in CATEGORY_ID_MAPPING;
}

/**
 * Get category info including ID, display name, and search fallback.
 * 
 * @param categoryKey - The category key
 * @returns Object with category information or null if not found
 */
export function getCategoryInfo(categoryKey: string): {
    key: string;
    id: string;
    displayName: string;
    searchFallback: string;
} | null {
    const normalizedKey = categoryKey.toLowerCase().trim();
    const id = CATEGORY_ID_MAPPING[normalizedKey];
    
    if (!id) {
        return null;
    }
    
    return {
        key: normalizedKey,
        id,
        displayName: getCategoryDisplayName(normalizedKey),
        searchFallback: getCategorySearchTerm(normalizedKey),
    };
}

export default {
    CATEGORY_ID_MAPPING,
    CATEGORY_SEARCH_FALLBACK,
    CATEGORY_DISPLAY_NAMES,
    getCategoryId,
    getCategorySearchTerm,
    getCategoryDisplayName,
    getAllCategoryKeys,
    isValidCategory,
    getCategoryInfo,
};
