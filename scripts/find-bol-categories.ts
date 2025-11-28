#!/usr/bin/env node

/**
 * Bol.com Category Discovery Script
 * 
 * This script discovers Bol.com category IDs by searching for terms
 * and extracting relevant categories from the API response.
 * 
 * Usage:
 *   npx ts-node scripts/find-bol-categories.ts [searchTerms...]
 *   
 * Examples:
 *   npx ts-node scripts/find-bol-categories.ts televisie laptop smartphone
 *   npx ts-node scripts/find-bol-categories.ts "smart home" "verzorging" "matrassen"
 *   
 * Environment variables:
 *   BOL_API_TOKEN    - Bearer token for API authentication (optional for discovery)
 *   ACCEPT_LANGUAGE  - Accept-Language header value (default: 'nl')
 *   COUNTRY_CODE     - Country code for API (default: 'NL')
 * 
 * Output:
 *   The script outputs discovered category mappings that can be used to update
 *   the CATEGORY_ID_MAPPING in src/lib/categoryMapping.ts
 * 
 * @module scripts/find-bol-categories
 */

// Default search terms if none provided
const DEFAULT_SEARCH_TERMS = [
    'televisie',
    'laptop',
    'smartphone',
    'audio',
    'wasmachine',
    'stofzuiger',
    'smart home',
    'matras',
    'airfryer',
    'koffiezetapparaat',
    'keukenmachine',
    'scheerapparaat',
    'verzorging',
    'tandenborstel elektrisch',
];

// API configuration
const API_BASE_URL = 'https://api.bol.com';
const API_PATH = '/marketing/catalog/v1';

interface RelevantCategory {
    id: string;
    name: string;
    productCount?: number;
}

interface SearchResponse {
    products?: unknown[];
    totalResults?: number;
    relevantCategories?: RelevantCategory[];
}

interface DiscoveryResult {
    searchTerm: string;
    categories: RelevantCategory[];
    error?: string;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search Bol.com API and get relevant categories
 */
async function searchWithCategories(
    searchTerm: string,
    authToken?: string,
    acceptLanguage = 'nl',
    countryCode = 'NL'
): Promise<DiscoveryResult> {
    const params = new URLSearchParams({
        'search-term': searchTerm,
        'country-code': countryCode,
        'page-size': '1',
        'include-relevant-categories': 'true',
    });
    
    const url = `${API_BASE_URL}${API_PATH}/products/search?${params}`;
    
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Accept-Language': acceptLanguage,
        'Content-Type': 'application/json',
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(url, { method: 'GET', headers });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                searchTerm,
                categories: [],
                error: `API error ${response.status}: ${errorText.substring(0, 200)}`,
            };
        }
        
        const data: SearchResponse = await response.json();
        
        return {
            searchTerm,
            categories: data.relevantCategories || [],
        };
    } catch (error) {
        return {
            searchTerm,
            categories: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Format output for console
 */
function formatOutput(results: DiscoveryResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('DISCOVERED BOL.COM CATEGORY MAPPINGS');
    console.log('='.repeat(80));
    
    // First, show all results in detail
    console.log('\n📋 DETAILED RESULTS:\n');
    
    for (const result of results) {
        console.log(`\n🔍 Search term: "${result.searchTerm}"`);
        
        if (result.error) {
            console.log(`   ❌ Error: ${result.error}`);
            continue;
        }
        
        if (result.categories.length === 0) {
            console.log('   ⚠️  No relevant categories found');
            continue;
        }
        
        console.log('   Found categories:');
        for (const cat of result.categories) {
            const countStr = cat.productCount ? ` (${cat.productCount} products)` : '';
            console.log(`   - ${cat.name}: ${cat.id}${countStr}`);
        }
    }
    
    // Then, generate TypeScript mapping code
    console.log('\n' + '='.repeat(80));
    console.log('📝 TYPESCRIPT MAPPING CODE (for categoryMapping.ts):');
    console.log('='.repeat(80) + '\n');
    
    console.log('export const CATEGORY_ID_MAPPING: Record<string, string> = {');
    
    const seenCategories = new Map<string, { id: string; name: string }>();
    
    for (const result of results) {
        if (result.categories.length > 0) {
            // Take the first (most relevant) category
            const cat = result.categories[0];
            
            // Create a key from the search term
            const key = result.searchTerm
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
            
            if (!seenCategories.has(cat.id)) {
                seenCategories.set(cat.id, { id: cat.id, name: cat.name });
                console.log(`    '${key}': '${cat.id}', // ${cat.name}`);
            }
        }
    }
    
    console.log('};');
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal search terms: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.categories.length > 0).length}`);
    console.log(`Failed: ${results.filter(r => r.error).length}`);
    console.log(`No categories: ${results.filter(r => !r.error && r.categories.length === 0).length}`);
    console.log(`Unique category IDs found: ${seenCategories.size}`);
    console.log('');
}

/**
 * Main function
 */
async function main(): Promise<void> {
    // Get configuration from environment
    const authToken = process.env.BOL_API_TOKEN;
    const acceptLanguage = process.env.ACCEPT_LANGUAGE || 'nl';
    const countryCode = process.env.COUNTRY_CODE || 'NL';
    
    // Get search terms from command line or use defaults
    const args = process.argv.slice(2);
    const searchTerms = args.length > 0 ? args : DEFAULT_SEARCH_TERMS;
    
    console.log('\n🔎 Bol.com Category Discovery Script');
    console.log('=====================================\n');
    console.log(`Configuration:`);
    console.log(`  - API Token: ${authToken ? 'Configured' : 'Not set (using public API)'}`);
    console.log(`  - Accept-Language: ${acceptLanguage}`);
    console.log(`  - Country Code: ${countryCode}`);
    console.log(`  - Search terms: ${searchTerms.length}`);
    
    console.log('\nSearching...\n');
    
    const results: DiscoveryResult[] = [];
    
    for (let i = 0; i < searchTerms.length; i++) {
        const term = searchTerms[i];
        process.stdout.write(`[${i + 1}/${searchTerms.length}] Searching "${term}"...`);
        
        const result = await searchWithCategories(term, authToken, acceptLanguage, countryCode);
        results.push(result);
        
        if (result.error) {
            console.log(` ❌ Error`);
        } else if (result.categories.length === 0) {
            console.log(` ⚠️ No categories`);
        } else {
            console.log(` ✅ ${result.categories.length} categories found`);
        }
        
        // Rate limiting - wait 500ms between requests
        if (i < searchTerms.length - 1) {
            await sleep(500);
        }
    }
    
    // Output results
    formatOutput(results);
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
