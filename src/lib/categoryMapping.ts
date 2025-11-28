/**
 * Category Mapping Module
 * 
 * Maps UI category button names to Bol.com numeric category IDs.
 * Based on Bol.com Marketing Catalog API requirements.
 * 
 * @module src/lib/categoryMapping
 */

/**
 * Category mapping configuration
 * Maps internal category keys to Bol.com category IDs and search terms
 */
export interface CategoryConfig {
    /** Bol.com numeric category ID */
    categoryId: string;
    /** Display name in Dutch */
    displayName: string;
    /** Fallback search term if category ID returns empty results */
    searchTerm: string;
}

/**
 * Mapping of UI category names/keys to Bol.com category IDs
 * 
 * Category IDs are obtained from Bol.com's Marketing Catalog API.
 * Use the discovery script (scripts/find-bol-categories.ts) to find new IDs.
 * 
 * Note: 'Verzorging' -> '12442' is confirmed from the issue screenshots.
 */
export const CATEGORY_MAPPING: Record<string, CategoryConfig> = {
    // Electronics & Entertainment
    'televisies': {
        categoryId: '15452',
        displayName: 'Televisies',
        searchTerm: 'televisie tv'
    },
    'audio': {
        categoryId: '3137',
        displayName: 'Audio & HiFi',
        searchTerm: 'audio koptelefoon speakers'
    },
    'laptops': {
        categoryId: '4770',
        displayName: 'Laptops',
        searchTerm: 'laptop notebook'
    },
    'smartphones': {
        categoryId: '21328',
        displayName: 'Smartphones',
        searchTerm: 'smartphone mobiele telefoon'
    },
    
    // Home Appliances
    'wasmachines': {
        categoryId: '15457',
        displayName: 'Wasmachines',
        searchTerm: 'wasmachine'
    },
    'stofzuigers': {
        categoryId: '13138',
        displayName: 'Stofzuigers',
        searchTerm: 'stofzuiger'
    },
    'smarthome': {
        categoryId: '23868',
        displayName: 'Smart Home',
        searchTerm: 'smart home domotica'
    },
    'matrassen': {
        categoryId: '13640',
        displayName: 'Matrassen',
        searchTerm: 'matras'
    },
    
    // Kitchen & Personal Care
    'airfryers': {
        categoryId: '21671',
        displayName: 'Airfryers',
        searchTerm: 'airfryer hetelucht friteuse'
    },
    'koffie': {
        categoryId: '19298',
        displayName: 'Koffie',
        searchTerm: 'koffiezetapparaat espressomachine'
    },
    'keuken': {
        categoryId: '12694',
        displayName: 'Keukenmachines',
        searchTerm: 'keukenmachine blender'
    },
    // Confirmed from issue: 'Verzorging' -> '12442'
    'verzorging': {
        categoryId: '12442',
        displayName: 'Verzorging',
        searchTerm: 'persoonlijke verzorging scheerapparaat'
    }
};

/**
 * Get category configuration by key
 * 
 * @param categoryKey - The internal category key (e.g., 'televisies', 'verzorging')
 * @returns Category configuration or undefined if not found
 */
export function getCategoryConfig(categoryKey: string): CategoryConfig | undefined {
    return CATEGORY_MAPPING[categoryKey.toLowerCase()];
}

/**
 * Get Bol.com category ID from category key
 * 
 * @param categoryKey - The internal category key
 * @returns Bol.com category ID or undefined if not found
 */
export function getCategoryId(categoryKey: string): string | undefined {
    return getCategoryConfig(categoryKey)?.categoryId;
}

/**
 * Get search term fallback for a category
 * 
 * @param categoryKey - The internal category key
 * @returns Search term to use as fallback
 */
export function getSearchTerm(categoryKey: string): string | undefined {
    return getCategoryConfig(categoryKey)?.searchTerm;
}

/**
 * Get all available category keys
 * 
 * @returns Array of category keys
 */
export function getAllCategoryKeys(): string[] {
    return Object.keys(CATEGORY_MAPPING);
}

/**
 * Get display name for a category
 * 
 * @param categoryKey - The internal category key
 * @returns Display name in Dutch
 */
export function getCategoryDisplayName(categoryKey: string): string {
    return getCategoryConfig(categoryKey)?.displayName ?? categoryKey;
}

/**
 * Check if a category key is valid
 * 
 * @param categoryKey - The category key to check
 * @returns True if the category exists in mapping
 */
export function isValidCategory(categoryKey: string): boolean {
    return categoryKey.toLowerCase() in CATEGORY_MAPPING;
}

/**
 * Get category key from display name
 * 
 * @param displayName - The display name to look up (case-insensitive)
 * @returns Category key or undefined if not found
 */
export function getCategoryKeyFromDisplayName(displayName: string): string | undefined {
    const normalizedName = displayName.toLowerCase();
    
    for (const [key, config] of Object.entries(CATEGORY_MAPPING)) {
        if (config.displayName.toLowerCase() === normalizedName) {
            return key;
        }
    }
    
    return undefined;
}

export default CATEGORY_MAPPING;
