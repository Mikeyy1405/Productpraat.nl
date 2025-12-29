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
    // === ELEKTRONICA ===
    'televisies': '10651',
    'audio': '14490',
    'laptops': '4770',
    'smartphones': '10852',
    'tablets': '6340',
    'gaming': '17588',
    'computers': '4769',
    'monitoren': '6345',
    'camera': '5566',
    'wearables': '21407',

    // === HUISHOUDEN ===
    'wasmachines': '11462',
    'drogers': '11464',
    'stofzuigers': '20104',
    'koelkasten': '11458',
    'vaatwassers': '11466',
    'magnetrons': '11450',
    'ovens': '11448',

    // === SMART HOME ===
    'smarthome': '20637',
    'verlichting': '13660',
    'beveiliging': '20638',

    // === SLAAPKAMER ===
    'matrassen': '10689',
    'bedden': '10687',
    'dekbedden': '15248',

    // === KEUKEN ===
    'airfryers': '43756',
    'koffie': '10550',
    'keuken': '10540',
    'blenders': '10546',
    'waterkokers': '10558',
    'broodroosters': '10548',

    // === VERZORGING ===
    'verzorging': '12442',
    'scheerapparaten': '12424',
    'haarverzorging': '12430',
    'mondverzorging': '12420',

    // === TUIN & KLUSSEN ===
    'tuin': '14932',
    'gereedschap': '14890',
    'grasmaaiers': '14938',

    // === SPORT & VRIJE TIJD ===
    'sport': '15172',
    'fietsen': '15174',
    'fitness': '15202',

    // === BABY & KIND ===
    'baby': '10314',
    'speelgoed': '10312',

    // === BEAUTY & GEZONDHEID ===
    'beauty': '12418',
    'gezondheid': '12400',
};

/**
 * Fallback search terms for categories when category ID lookup fails.
 * These terms are used with the search endpoint as a fallback.
 */
export const CATEGORY_SEARCH_FALLBACK: Record<string, string> = {
    // Elektronica
    'televisies': 'televisie smart tv',
    'audio': 'bluetooth speaker koptelefoon',
    'laptops': 'laptop notebook',
    'smartphones': 'smartphone mobiele telefoon',
    'tablets': 'tablet ipad android',
    'gaming': 'playstation xbox nintendo gaming',
    'computers': 'desktop computer pc',
    'monitoren': 'monitor beeldscherm',
    'camera': 'camera fotocamera digitaal',
    'wearables': 'smartwatch fitness tracker',

    // Huishouden
    'wasmachines': 'wasmachine',
    'drogers': 'wasdroger droger',
    'stofzuigers': 'stofzuiger robotstofzuiger',
    'koelkasten': 'koelkast koelvriescombinatie',
    'vaatwassers': 'vaatwasser afwasmachine',
    'magnetrons': 'magnetron combimagnetron',
    'ovens': 'oven inbouwoven',

    // Smart Home
    'smarthome': 'smart home domotica',
    'verlichting': 'slimme verlichting led lamp',
    'beveiliging': 'beveiligingscamera slimme deurbel',

    // Slaapkamer
    'matrassen': 'matras',
    'bedden': 'bed boxspring',
    'dekbedden': 'dekbed dekbedovertrek',

    // Keuken
    'airfryers': 'airfryer heteluchtfriteuse',
    'koffie': 'koffiezetapparaat espressomachine',
    'keuken': 'keukenmachine foodprocessor',
    'blenders': 'blender smoothie maker',
    'waterkokers': 'waterkoker',
    'broodroosters': 'broodrooster tosti ijzer',

    // Verzorging
    'verzorging': 'scheerapparaat elektrische tandenborstel',
    'scheerapparaten': 'scheerapparaat trimmer',
    'haarverzorging': 'föhn stijltang krultang',
    'mondverzorging': 'elektrische tandenborstel waterflosser',

    // Tuin & Klussen
    'tuin': 'tuingereedschap tuinmeubelen',
    'gereedschap': 'boormachine accuboormachine',
    'grasmaaiers': 'grasmaaier robotmaaier',

    // Sport & Vrije tijd
    'sport': 'sportartikelen fitness',
    'fietsen': 'fiets elektrische fiets',
    'fitness': 'fitnessapparaat hometrainer',

    // Baby & Kind
    'baby': 'kinderwagen autostoel baby',
    'speelgoed': 'speelgoed lego',

    // Beauty & Gezondheid
    'beauty': 'make-up huidverzorging',
    'gezondheid': 'bloeddrukmeter weegschaal',
};

/**
 * Human-readable category names for display in the UI.
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
    // Elektronica
    'televisies': 'Televisies',
    'audio': 'Audio & HiFi',
    'laptops': 'Laptops',
    'smartphones': 'Smartphones',
    'tablets': 'Tablets',
    'gaming': 'Gaming',
    'computers': 'Computers',
    'monitoren': 'Monitoren',
    'camera': "Camera's",
    'wearables': 'Wearables',

    // Huishouden
    'wasmachines': 'Wasmachines',
    'drogers': 'Drogers',
    'stofzuigers': 'Stofzuigers',
    'koelkasten': 'Koelkasten',
    'vaatwassers': 'Vaatwassers',
    'magnetrons': 'Magnetrons',
    'ovens': 'Ovens',

    // Smart Home
    'smarthome': 'Smart Home',
    'verlichting': 'Slimme Verlichting',
    'beveiliging': 'Beveiliging',

    // Slaapkamer
    'matrassen': 'Matrassen',
    'bedden': 'Bedden',
    'dekbedden': 'Dekbedden',

    // Keuken
    'airfryers': 'Airfryers',
    'koffie': 'Koffiemachines',
    'keuken': 'Keukenmachines',
    'blenders': 'Blenders',
    'waterkokers': 'Waterkokers',
    'broodroosters': 'Broodroosters',

    // Verzorging
    'verzorging': 'Verzorging',
    'scheerapparaten': 'Scheerapparaten',
    'haarverzorging': 'Haarverzorging',
    'mondverzorging': 'Mondverzorging',

    // Tuin & Klussen
    'tuin': 'Tuin',
    'gereedschap': 'Gereedschap',
    'grasmaaiers': 'Grasmaaiers',

    // Sport & Vrije tijd
    'sport': 'Sport',
    'fietsen': 'Fietsen',
    'fitness': 'Fitness',

    // Baby & Kind
    'baby': 'Baby',
    'speelgoed': 'Speelgoed',

    // Beauty & Gezondheid
    'beauty': 'Beauty',
    'gezondheid': 'Gezondheid',
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
