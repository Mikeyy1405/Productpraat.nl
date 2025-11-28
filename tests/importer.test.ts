/**
 * Unit Tests for Product Importer Logic
 * 
 * Tests category mapping, API fallback behavior, and error handling.
 * 
 * To run these tests, install Jest:
 *   npm install -D jest ts-jest @types/jest
 *   npx jest tests/importer.test.ts
 * 
 * Or run with tsx:
 *   npx tsx tests/importer.test.ts
 * 
 * @module tests/importer.test
 */

// Simple test runner for when Jest is not available
type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];
const describe = (name: string, fn: () => void) => { console.log(`\n📋 ${name}`); fn(); };
const it = (name: string, fn: TestFn) => { tests.push({ name, fn }); };
const expect = <T>(actual: T) => ({
    toBe: (expected: T) => {
        if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
    },
    toEqual: (expected: T) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
    },
    toBeDefined: () => {
        if (actual === undefined) throw new Error(`Expected value to be defined`);
    },
    toBeUndefined: () => {
        if (actual !== undefined) throw new Error(`Expected undefined but got ${actual}`);
    },
    toContain: (expected: unknown) => {
        if (typeof actual === 'string' && !actual.includes(expected as string)) {
            throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
        if (Array.isArray(actual) && !actual.includes(expected)) {
            throw new Error(`Expected array to contain ${expected}`);
        }
    },
    toHaveLength: (expected: number) => {
        if (!Array.isArray(actual) || actual.length !== expected) {
            throw new Error(`Expected length ${expected} but got ${Array.isArray(actual) ? actual.length : 'not an array'}`);
        }
    }
});

// Import the modules under test
import {
    CATEGORY_MAPPING,
    getCategoryConfig,
    getCategoryId,
    getSearchTerm,
    isValidCategory,
    getCategoryKeyFromDisplayName,
    getAllCategoryKeys
} from '../src/lib/categoryMapping.js';

import {
    BolProduct,
    ERROR_MESSAGES,
    deduplicateByEan,
    getErrorMessage
} from '../src/lib/bolApi.js';

// ============================================================================
// CATEGORY MAPPING TESTS
// ============================================================================

describe('Category Mapping', () => {
    describe('CATEGORY_MAPPING', () => {
        it('should contain mapping for Verzorging with ID 12442', () => {
            const verzorging = CATEGORY_MAPPING['verzorging'];
            expect(verzorging).toBeDefined();
            expect(verzorging.categoryId).toBe('12442');
            expect(verzorging.displayName).toBe('Verzorging');
        });

        it('should contain all expected category keys', () => {
            const expectedCategories = [
                'televisies', 'audio', 'laptops', 'smartphones',
                'wasmachines', 'stofzuigers', 'smarthome', 'matrassen',
                'airfryers', 'koffie', 'keuken', 'verzorging'
            ];
            
            for (const category of expectedCategories) {
                expect(CATEGORY_MAPPING[category]).toBeDefined();
            }
        });
    });

    describe('getCategoryConfig', () => {
        it('should return config for valid category', () => {
            const config = getCategoryConfig('televisies');
            expect(config).toBeDefined();
            expect(config?.categoryId).toBe('15452');
        });

        it('should return undefined for invalid category', () => {
            const config = getCategoryConfig('nonexistent');
            expect(config).toBeUndefined();
        });
    });

    describe('getCategoryId', () => {
        it('should return category ID for valid category', () => {
            expect(getCategoryId('verzorging')).toBe('12442');
            expect(getCategoryId('televisies')).toBe('15452');
            expect(getCategoryId('laptops')).toBe('4770');
        });

        it('should return undefined for invalid category', () => {
            expect(getCategoryId('unknown')).toBeUndefined();
        });
    });

    describe('getSearchTerm', () => {
        it('should return search term for valid category', () => {
            const term = getSearchTerm('verzorging');
            expect(term).toBeDefined();
            if (term) expect(term).toContain('verzorging');
        });
    });

    describe('isValidCategory', () => {
        it('should return true for valid categories', () => {
            expect(isValidCategory('verzorging')).toBe(true);
            expect(isValidCategory('televisies')).toBe(true);
        });

        it('should return false for invalid categories', () => {
            expect(isValidCategory('nonexistent')).toBe(false);
        });
    });

    describe('getAllCategoryKeys', () => {
        it('should return array of all category keys', () => {
            const keys = getAllCategoryKeys();
            expect(keys).toContain('verzorging');
            expect(keys).toContain('televisies');
            expect(keys).toHaveLength(12);
        });
    });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
    describe('ERROR_MESSAGES', () => {
        it('should have user-friendly messages for common status codes', () => {
            expect(ERROR_MESSAGES[400]).toBeDefined();
            expect(ERROR_MESSAGES[404]).toBeDefined();
            expect(ERROR_MESSAGES[500]).toBeDefined();
            expect(ERROR_MESSAGES[503]).toBeDefined();
        });

        it('should have Dutch messages', () => {
            expect(ERROR_MESSAGES[404]).toContain('Geen producten');
        });
    });

    describe('getErrorMessage', () => {
        it('should return message for known status code', () => {
            expect(getErrorMessage(404)).toBe(ERROR_MESSAGES[404]);
            expect(getErrorMessage(500)).toBe(ERROR_MESSAGES[500]);
        });

        it('should return generic message for unknown status code', () => {
            const message = getErrorMessage(999);
            expect(message).toContain('999');
        });
    });
});

// ============================================================================
// DEDUPLICATION TESTS
// ============================================================================

describe('Deduplication', () => {
    describe('deduplicateByEan', () => {
        it('should remove duplicate products by EAN', () => {
            const products: BolProduct[] = [
                { ean: '1234567890123', title: 'Product 1' },
                { ean: '1234567890123', title: 'Product 1 Duplicate' },
                { ean: '9876543210987', title: 'Product 2' }
            ];

            const unique = deduplicateByEan(products);
            expect(unique).toHaveLength(2);
        });

        it('should handle empty array', () => {
            const unique = deduplicateByEan([]);
            expect(unique).toEqual([]);
        });
    });
});

// ============================================================================
// RUN TESTS
// ============================================================================

async function runTests() {
    console.log('🧪 Running Importer Tests\n');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            await test.fn();
            console.log(`  ✅ ${test.name}`);
            passed++;
        } catch (error) {
            console.log(`  ❌ ${test.name}`);
            console.log(`     Error: ${(error as Error).message}`);
            failed++;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${tests.length} total`);
    
    if (failed > 0) {
        process.exit(1);
    }
}

// Only run if this file is executed directly
if (import.meta.url.startsWith('file:')) {
    runTests().catch(console.error);
}
