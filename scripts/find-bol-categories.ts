#!/usr/bin/env node
/**
 * Bol.com Category Discovery Script
 * 
 * Discovers Bol.com category IDs by searching with include-relevant-categories.
 * Useful for updating the category mapping when adding new product categories.
 * 
 * Usage:
 *   npx ts-node scripts/find-bol-categories.ts [search terms...]
 *   
 * Examples:
 *   npx ts-node scripts/find-bol-categories.ts "verzorging" "televisie" "laptop"
 *   npx ts-node scripts/find-bol-categories.ts
 * 
 * Environment Variables:
 *   BOL_CLIENT_ID - OAuth2 client ID
 *   BOL_CLIENT_SECRET - OAuth2 client secret
 * 
 * @module scripts/find-bol-categories
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOKEN_ENDPOINT = 'https://login.bol.com/token';
const API_BASE_URL = 'https://api.bol.com';
const API_PATH = '/marketing/catalog/v1';

/**
 * Default search terms if none provided
 */
const DEFAULT_SEARCH_TERMS = [
    'verzorging',
    'televisie',
    'laptop',
    'smartphone',
    'wasmachine',
    'stofzuiger',
    'smart home',
    'matras',
    'airfryer',
    'koffiezetapparaat',
    'keukenmachine',
    'audio koptelefoon'
];

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get OAuth2 access token
 */
async function getAccessToken(): Promise<string> {
    const clientId = process.env.BOL_CLIENT_ID || '';
    const clientSecret = process.env.BOL_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
        throw new Error(
            'BOL_CLIENT_ID and BOL_CLIENT_SECRET environment variables are required.\n' +
            'Get them from: https://partnerprogramma.bol.com'
        );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

/**
 * Search with include-relevant-categories to discover category IDs
 */
async function searchWithCategories(
    token: string,
    searchTerm: string
): Promise<{
    categories: Array<{ id: string; name: string; productCount?: number }>;
    totalProducts: number;
}> {
    const params = new URLSearchParams({
        'search-term': searchTerm,
        'country-code': 'NL',
        'page-size': '1',
        'include-relevant-categories': 'true'
    });

    const url = `${API_BASE_URL}${API_PATH}/products/search?${params.toString()}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Accept-Language': 'nl'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
        categories: data.relevantCategories || [],
        totalProducts: data.totalResults || 0
    };
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function main() {
    console.log('='.repeat(70));
    console.log('Bol.com Category Discovery Script');
    console.log('='.repeat(70));
    console.log();

    // Get search terms from command line arguments or use defaults
    const args = process.argv.slice(2);
    const searchTerms = args.length > 0 ? args : DEFAULT_SEARCH_TERMS;

    console.log(`Discovering categories for ${searchTerms.length} search terms...\n`);

    try {
        // Get access token
        console.log('🔐 Authenticating with Bol.com API...');
        const token = await getAccessToken();
        console.log('✅ Authentication successful\n');

        // Store all discovered categories
        const allCategories: Map<string, { 
            name: string; 
            productCount: number;
            foundIn: string[] 
        }> = new Map();

        // Process each search term
        for (const term of searchTerms) {
            console.log(`🔍 Searching: "${term}"`);
            
            try {
                const result = await searchWithCategories(token, term);
                
                console.log(`   Found ${result.totalProducts} products, ${result.categories.length} relevant categories:`);
                
                if (result.categories.length === 0) {
                    console.log('   (no relevant categories returned)');
                } else {
                    // Display top 5 categories
                    const topCategories = result.categories.slice(0, 5);
                    
                    for (const cat of topCategories) {
                        console.log(`   - ${cat.id}: "${cat.name}" (${cat.productCount || 'N/A'} products)`);
                        
                        // Track in all categories map
                        const existing = allCategories.get(cat.id);
                        if (existing) {
                            existing.foundIn.push(term);
                        } else {
                            allCategories.set(cat.id, {
                                name: cat.name,
                                productCount: cat.productCount || 0,
                                foundIn: [term]
                            });
                        }
                    }
                    
                    if (result.categories.length > 5) {
                        console.log(`   ... and ${result.categories.length - 5} more`);
                    }
                }
                
                console.log();
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`   ❌ Error: ${(error as Error).message}`);
                console.log();
            }
        }

        // Summary
        console.log('='.repeat(70));
        console.log('SUMMARY: All Discovered Categories');
        console.log('='.repeat(70));
        console.log();

        // Sort by product count
        const sortedCategories = [...allCategories.entries()]
            .sort((a, b) => b[1].productCount - a[1].productCount);

        console.log('Category ID | Name | Products | Found In');
        console.log('-'.repeat(70));
        
        for (const [id, info] of sortedCategories.slice(0, 30)) {
            const searchTermsStr = info.foundIn.slice(0, 3).join(', ');
            console.log(
                `${id.padEnd(12)} | ${info.name.slice(0, 30).padEnd(30)} | ` +
                `${String(info.productCount).padStart(8)} | ${searchTermsStr}`
            );
        }

        if (sortedCategories.length > 30) {
            console.log(`... and ${sortedCategories.length - 30} more categories`);
        }

        console.log();
        console.log('='.repeat(70));
        console.log('TYPESCRIPT MAPPING SUGGESTION');
        console.log('='.repeat(70));
        console.log();
        console.log('Copy this to src/lib/categoryMapping.ts:\n');

        // Generate TypeScript mapping
        console.log('export const CATEGORY_MAPPING = {');
        
        for (const term of searchTerms) {
            // Find the most relevant category for this term
            const relevantCats = sortedCategories.filter(([_, info]) => 
                info.foundIn.includes(term)
            );
            
            if (relevantCats.length > 0) {
                const [topCatId, topCatInfo] = relevantCats[0];
                const key = term.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
                
                console.log(`    '${key}': {`);
                console.log(`        categoryId: '${topCatId}',`);
                console.log(`        displayName: '${topCatInfo.name}',`);
                console.log(`        searchTerm: '${term}'`);
                console.log('    },');
            }
        }
        
        console.log('};');
        console.log();

    } catch (error) {
        console.error('❌ Fatal error:', (error as Error).message);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);
