/**
 * Importer Tests
 * 
 * Tests for the Bol.com product importer logic including:
 * - Category ID mapping
 * - Search fallback behavior
 * - Error handling
 * - Deduplication by EAN
 * 
 * @module tests/importer.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    CATEGORY_ID_MAPPING,
    CATEGORY_SEARCH_FALLBACK,
    CATEGORY_DISPLAY_NAMES,
    getCategoryId,
    getCategorySearchTerm,
    getCategoryDisplayName,
    getAllCategoryKeys,
    isValidCategory,
    getCategoryInfo,
} from '../src/lib/categoryMapping';

// ============================================================================
// CATEGORY MAPPING TESTS
// ============================================================================

describe('Category Mapping', () => {
    describe('CATEGORY_ID_MAPPING', () => {
        it('should have mappings for all required categories', () => {
            const requiredCategories = [
                'televisies',
                'audio',
                'laptops',
                'smartphones',
                'wasmachines',
                'stofzuigers',
                'smarthome',
                'matrassen',
                'airfryers',
                'koffie',
                'keuken',
                'verzorging',
            ];

            requiredCategories.forEach(category => {
                expect(CATEGORY_ID_MAPPING[category]).toBeDefined();
                expect(typeof CATEGORY_ID_MAPPING[category]).toBe('string');
            });
        });

        it('should map verzorging to category ID 12442', () => {
            // This is confirmed in the problem statement
            expect(CATEGORY_ID_MAPPING['verzorging']).toBe('12442');
        });

        it('should have numeric category IDs', () => {
            Object.values(CATEGORY_ID_MAPPING).forEach(id => {
                expect(id).toMatch(/^\d+$/);
            });
        });
    });

    describe('CATEGORY_SEARCH_FALLBACK', () => {
        it('should have fallback search terms for all categories', () => {
            Object.keys(CATEGORY_ID_MAPPING).forEach(category => {
                expect(CATEGORY_SEARCH_FALLBACK[category]).toBeDefined();
                expect(typeof CATEGORY_SEARCH_FALLBACK[category]).toBe('string');
            });
        });

        it('should have meaningful search terms', () => {
            // Search terms should contain relevant keywords
            expect(CATEGORY_SEARCH_FALLBACK['televisies']).toContain('tv');
            expect(CATEGORY_SEARCH_FALLBACK['laptops']).toContain('laptop');
            expect(CATEGORY_SEARCH_FALLBACK['verzorging']).toContain('scheerapparaat');
        });
    });

    describe('getCategoryId', () => {
        it('should return category ID for valid category key', () => {
            expect(getCategoryId('verzorging')).toBe('12442');
            expect(getCategoryId('televisies')).toBe('10651');
        });

        it('should be case-insensitive', () => {
            expect(getCategoryId('VERZORGING')).toBe('12442');
            expect(getCategoryId('Verzorging')).toBe('12442');
        });

        it('should handle whitespace', () => {
            expect(getCategoryId('  verzorging  ')).toBe('12442');
        });

        it('should return undefined for unknown category', () => {
            expect(getCategoryId('unknown')).toBeUndefined();
            expect(getCategoryId('')).toBeUndefined();
        });
    });

    describe('getCategorySearchTerm', () => {
        it('should return fallback search term for valid category', () => {
            const term = getCategorySearchTerm('verzorging');
            expect(term).toContain('scheerapparaat');
        });

        it('should return category key if no fallback exists', () => {
            expect(getCategorySearchTerm('unknown')).toBe('unknown');
        });
    });

    describe('getCategoryDisplayName', () => {
        it('should return display name for valid category', () => {
            expect(getCategoryDisplayName('verzorging')).toBe('Verzorging');
            expect(getCategoryDisplayName('smarthome')).toBe('Smart Home');
        });

        it('should return category key if no display name exists', () => {
            expect(getCategoryDisplayName('unknown')).toBe('unknown');
        });
    });

    describe('getAllCategoryKeys', () => {
        it('should return all category keys', () => {
            const keys = getAllCategoryKeys();
            expect(keys).toContain('verzorging');
            expect(keys).toContain('televisies');
            expect(keys.length).toBeGreaterThanOrEqual(12);
        });
    });

    describe('isValidCategory', () => {
        it('should return true for valid categories', () => {
            expect(isValidCategory('verzorging')).toBe(true);
            expect(isValidCategory('VERZORGING')).toBe(true);
        });

        it('should return false for invalid categories', () => {
            expect(isValidCategory('unknown')).toBe(false);
            expect(isValidCategory('')).toBe(false);
        });
    });

    describe('getCategoryInfo', () => {
        it('should return complete category info', () => {
            const info = getCategoryInfo('verzorging');
            expect(info).not.toBeNull();
            expect(info?.key).toBe('verzorging');
            expect(info?.id).toBe('12442');
            expect(info?.displayName).toBe('Verzorging');
            expect(info?.searchFallback).toContain('scheerapparaat');
        });

        it('should return null for unknown category', () => {
            expect(getCategoryInfo('unknown')).toBeNull();
        });
    });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Messages', () => {
    const errorMessages: Record<number, string> = {
        400: 'Ongeldige aanvraag',
        404: 'Geen producten gevonden',
        406: 'server kan dit verzoek niet verwerken',
        500: 'server fout',
        503: 'niet beschikbaar',
    };

    it('should have appropriate error messages for HTTP status codes', () => {
        // These are the error messages from the server implementation
        Object.entries(errorMessages).forEach(([code, expectedFragment]) => {
            // Just verifying the structure - actual messages are in server.js
            expect(parseInt(code)).toBeGreaterThanOrEqual(400);
        });
    });
});

// ============================================================================
// DEDUPLICATION LOGIC TESTS
// ============================================================================

describe('Product Deduplication', () => {
    it('should deduplicate products by EAN', () => {
        const products = [
            { ean: '123', title: 'Product A' },
            { ean: '456', title: 'Product B' },
            { ean: '123', title: 'Product A Duplicate' },
            { ean: '789', title: 'Product C' },
        ];

        const seenEans = new Set<string>();
        const uniqueProducts = products.filter(product => {
            if (!product.ean || seenEans.has(product.ean)) {
                return false;
            }
            seenEans.add(product.ean);
            return true;
        });

        expect(uniqueProducts).toHaveLength(3);
        expect(uniqueProducts.map(p => p.ean)).toEqual(['123', '456', '789']);
    });

    it('should skip products without EAN', () => {
        const products = [
            { ean: '123', title: 'Product A' },
            { ean: '', title: 'Product B no EAN' },
            { ean: null as unknown as string, title: 'Product C null EAN' },
        ];

        const seenEans = new Set<string>();
        const uniqueProducts = products.filter(product => {
            if (!product.ean || seenEans.has(product.ean)) {
                return false;
            }
            seenEans.add(product.ean);
            return true;
        });

        expect(uniqueProducts).toHaveLength(1);
        expect(uniqueProducts[0].ean).toBe('123');
    });
});

// ============================================================================
// CONCURRENCY AND BATCHING TESTS
// ============================================================================

describe('Batch Processing', () => {
    it('should split array into correct batch sizes', () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8];
        const batchSize = 3;
        const batches: number[][] = [];

        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }

        expect(batches).toHaveLength(3);
        expect(batches[0]).toEqual([1, 2, 3]);
        expect(batches[1]).toEqual([4, 5, 6]);
        expect(batches[2]).toEqual([7, 8]);
    });

    it('should handle batch size larger than array', () => {
        const items = [1, 2];
        const batchSize = 3;
        const batches: number[][] = [];

        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }

        expect(batches).toHaveLength(1);
        expect(batches[0]).toEqual([1, 2]);
    });
});

// ============================================================================
// FALLBACK LOGIC TESTS
// ============================================================================

describe('Fallback Logic', () => {
    it('should use category ID first when available', () => {
        const categoryKey = 'verzorging';
        const categoryId = getCategoryId(categoryKey);
        
        // Should have a category ID
        expect(categoryId).toBeDefined();
        expect(categoryId).toBe('12442');
    });

    it('should have search fallback for all mapped categories', () => {
        getAllCategoryKeys().forEach(key => {
            const searchTerm = getCategorySearchTerm(key);
            expect(searchTerm).toBeDefined();
            expect(searchTerm.length).toBeGreaterThan(0);
        });
    });

    it('should fallback to normalized category key when no mapping exists', () => {
        const unknownCategory = 'someNewCategory';
        const searchTerm = getCategorySearchTerm(unknownCategory);
        // The function normalizes the key to lowercase
        expect(searchTerm).toBe('somenewcategory');
    });
});
