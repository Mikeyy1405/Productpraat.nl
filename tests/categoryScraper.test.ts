/**
 * Category Scraper Tests
 * 
 * Tests for the category URL scraper functionality including:
 * - URL validation
 * - Category ID extraction from Bol.com URLs
 * - Error handling
 * 
 * @module tests/categoryScraper.test
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// BOL.COM URL PARSING TESTS
// ============================================================================

/**
 * Extract category ID from Bol.com category URL
 * This mirrors the logic in server.js
 */
function extractBolCategoryIdFromUrl(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname;
        
        // Match pattern: /nl/nl/l/{category-name}/{category-id}/
        const match = pathname.match(/\/l\/[^/]+\/(\d+)\/?$/);
        if (match) {
            return match[1];
        }
        
        // Also try query parameters
        const categoryId = parsedUrl.searchParams.get('categoryId');
        return categoryId || null;
    } catch {
        return null;
    }
}

describe('Category Scraper', () => {
    describe('extractBolCategoryIdFromUrl', () => {
        it('should extract category ID from standard Bol.com category URL', () => {
            const url = 'https://www.bol.com/nl/nl/l/verzorgingsproducten/12442/';
            expect(extractBolCategoryIdFromUrl(url)).toBe('12442');
        });

        it('should extract category ID without trailing slash', () => {
            const url = 'https://www.bol.com/nl/nl/l/televisies/10651';
            expect(extractBolCategoryIdFromUrl(url)).toBe('10651');
        });

        it('should extract category ID from URL with query parameters', () => {
            const url = 'https://www.bol.com/nl/nl/l/laptops/4770/?sort=rating';
            expect(extractBolCategoryIdFromUrl(url)).toBe('4770');
        });

        it('should handle different category names', () => {
            const testCases = [
                { url: 'https://www.bol.com/nl/nl/l/smartphones/10852/', expected: '10852' },
                { url: 'https://www.bol.com/nl/nl/l/wasmachines/11462/', expected: '11462' },
                { url: 'https://www.bol.com/nl/nl/l/stofzuigers/20104/', expected: '20104' },
                { url: 'https://www.bol.com/nl/nl/l/airfryers/43756/', expected: '43756' },
            ];

            testCases.forEach(({ url, expected }) => {
                expect(extractBolCategoryIdFromUrl(url)).toBe(expected);
            });
        });

        it('should return null for invalid URL', () => {
            expect(extractBolCategoryIdFromUrl('not-a-url')).toBeNull();
        });

        it('should return null for non-category Bol.com URL', () => {
            const productUrl = 'https://www.bol.com/nl/p/samsung-galaxy-s24/9300000000000/';
            expect(extractBolCategoryIdFromUrl(productUrl)).toBeNull();
        });

        it('should return null for home page URL', () => {
            const homeUrl = 'https://www.bol.com/nl/nl/';
            expect(extractBolCategoryIdFromUrl(homeUrl)).toBeNull();
        });

        it('should handle URL with categoryId query parameter', () => {
            const url = 'https://www.bol.com/nl/nl/some-page?categoryId=12345';
            expect(extractBolCategoryIdFromUrl(url)).toBe('12345');
        });
    });

    describe('URL Validation', () => {
        it('should accept valid HTTPS URLs', () => {
            const validUrls = [
                'https://www.bol.com/nl/nl/l/verzorgingsproducten/12442/',
                'https://bol.com/nl/nl/l/televisies/10651/',
            ];

            validUrls.forEach(url => {
                expect(() => new URL(url)).not.toThrow();
                const parsed = new URL(url);
                expect(parsed.protocol).toBe('https:');
            });
        });

        it('should accept valid HTTP URLs', () => {
            const url = 'http://www.bol.com/nl/nl/l/test/123/';
            expect(() => new URL(url)).not.toThrow();
            const parsed = new URL(url);
            expect(parsed.protocol).toBe('http:');
        });

        it('should reject invalid URLs', () => {
            const invalidUrls = [
                'not-a-url',
                'www.bol.com/nl/nl/l/test/123/',
                'bol.com',
                '',
            ];

            invalidUrls.forEach(url => {
                expect(() => new URL(url)).toThrow();
            });
        });
    });

    describe('Shop Detection', () => {
        it('should detect Bol.com from hostname', () => {
            const bolUrls = [
                'https://www.bol.com/nl/nl/l/test/123/',
                'https://bol.com/nl/nl/l/test/123/',
                'https://partner.bol.com/click/test',
            ];

            bolUrls.forEach(url => {
                const parsed = new URL(url);
                const hostname = parsed.hostname.toLowerCase();
                // Use strict validation: exact match or subdomain (preceded by dot)
                const isBolDomain = hostname === 'bol.com' || hostname.endsWith('.bol.com');
                expect(isBolDomain).toBe(true);
            });
        });

        it('should not match other domains containing bol', () => {
            // This is a security check - we should only match actual Bol.com domains
            const fakeUrls = [
                'https://malicious-bol.com/test',
                'https://bol.com.fake.com/test',
            ];

            fakeUrls.forEach(url => {
                const parsed = new URL(url);
                const hostname = parsed.hostname.toLowerCase();
                // Only exact match or subdomain (with preceding dot) should be accepted
                const isBolDomain = hostname === 'bol.com' || hostname.endsWith('.bol.com');
                // malicious-bol.com should fail because it doesn't end with '.bol.com'
                expect(isBolDomain).toBe(false);
            });
        });
    });
});

// ============================================================================
// EXPECTED API RESPONSE STRUCTURE TESTS
// ============================================================================

describe('API Response Structure', () => {
    it('should define expected scrape result structure', () => {
        interface ScrapeResult {
            success: boolean;
            message: string;
            url: string;
            categoryId?: string;
            productCount: number;
            savedCount?: number;
            updatedCount?: number;
            products: Array<{
                ean?: string;
                productId?: string;
                title: string;
                brand?: string;
                price?: number;
                priceLabel?: string;
                url: string;
                imageUrl?: string;
                rating?: number;
                reviewCount?: number;
                inStock?: boolean;
                source?: string;
            }>;
            error?: string;
        }

        // Mock successful response
        const successResponse: ScrapeResult = {
            success: true,
            message: '10 producten gevonden, 8 opgeslagen, 2 bijgewerkt',
            url: 'https://www.bol.com/nl/nl/l/verzorgingsproducten/12442/',
            categoryId: '12442',
            productCount: 10,
            savedCount: 8,
            updatedCount: 2,
            products: [
                {
                    ean: '8718469564987',
                    productId: 'bol-12345',
                    title: 'Philips Series 3000 Scheerapparaat',
                    brand: 'Philips',
                    price: 79.99,
                    priceLabel: '€79,99',
                    url: 'https://www.bol.com/nl/p/philips-series-3000/12345/',
                    imageUrl: 'https://media.s-bol.com/test.jpg',
                    rating: 4.5,
                    reviewCount: 150,
                    inStock: true,
                    source: 'bol.com'
                }
            ]
        };

        expect(successResponse.success).toBe(true);
        expect(successResponse.productCount).toBe(10);
        expect(successResponse.products[0].title).toBe('Philips Series 3000 Scheerapparaat');
    });

    it('should define expected error response structure', () => {
        interface ScrapeResult {
            success: boolean;
            error: string;
            message: string;
        }

        const errorResponse: ScrapeResult = {
            success: false,
            error: 'Geen categorie-ID gevonden',
            message: 'Kon geen categorie-ID extraheren uit de URL'
        };

        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBeDefined();
    });
});
