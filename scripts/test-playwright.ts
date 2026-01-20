/**
 * Test Script for Playwright Bol.com Integration
 *
 * Run with: npm run playwright:test
 *
 * This script tests the Playwright integration without requiring credentials.
 * It demonstrates the capabilities and verifies the setup.
 */

import {
    getBolPlaywrightService,
    isPlaywrightConfigured,
} from '../services/bolcom/playwright-service';
import { getUnifiedBolService } from '../services/bolcom/unified-service';

// ============================================================================
// TEST HELPERS
// ============================================================================

function log(message: string): void {
    console.log(`\n[TEST] ${message}`);
}

function success(message: string): void {
    console.log(`  ✓ ${message}`);
}

function fail(message: string): void {
    console.log(`  ✗ ${message}`);
}

function info(message: string): void {
    console.log(`  → ${message}`);
}

// ============================================================================
// TESTS
// ============================================================================

async function testConfiguration(): Promise<boolean> {
    log('Testing configuration...');

    const isConfigured = isPlaywrightConfigured();
    info(`Playwright configured: ${isConfigured}`);

    if (isConfigured) {
        success('Credentials found in environment');
        return true;
    } else {
        info('No credentials found - some tests will be skipped');
        info('Set BOL_PARTNER_EMAIL and BOL_PARTNER_PASSWORD to enable full testing');
        return false;
    }
}

async function testBrowserInitialization(): Promise<boolean> {
    log('Testing browser initialization...');

    try {
        const service = getBolPlaywrightService();
        await service.initialize();
        success('Browser initialized successfully');

        // Check session state
        const sessionState = service.getSessionState();
        info(`Session state: ${sessionState?.isLoggedIn ? 'logged in' : 'not logged in'}`);

        return true;
    } catch (error) {
        fail(`Browser initialization failed: ${error}`);
        return false;
    }
}

async function testMediaScraping(): Promise<boolean> {
    log('Testing media scraping (no login required)...');

    try {
        const service = getBolPlaywrightService();

        // Test with a real Bol.com product URL (public page, no login needed)
        const testUrl = 'https://www.bol.com/nl/nl/p/apple-iphone-15-128-gb-zwart/9300000157912547/';

        info(`Testing URL: ${testUrl}`);

        const result = await service.getProductMedia(testUrl);

        if (result.success) {
            success(`Found ${result.media.length} media items`);
            info(`EAN: ${result.ean || 'not found'}`);

            // Show sample media
            if (result.media.length > 0) {
                const sample = result.media[0];
                info(`Sample: ${sample.type} - ${sample.url.substring(0, 60)}...`);

                if (sample.highResUrl) {
                    info(`High-res available: ${sample.highResUrl.substring(0, 60)}...`);
                }
            }

            return true;
        } else {
            fail(`Media scraping failed: ${result.error}`);
            return false;
        }
    } catch (error) {
        fail(`Media scraping error: ${error}`);
        return false;
    }
}

async function testUnifiedService(): Promise<boolean> {
    log('Testing unified service...');

    try {
        const unified = getUnifiedBolService();
        const status = await unified.getStatus();

        info(`API configured: ${status.api.configured}`);
        info(`API available: ${status.api.available}`);
        info(`Playwright configured: ${status.playwright.configured}`);
        info(`Playwright logged in: ${status.playwright.loggedIn}`);

        success('Unified service status retrieved');
        return true;
    } catch (error) {
        fail(`Unified service error: ${error}`);
        return false;
    }
}

async function testLoginFlow(skipIfNoCredentials: boolean): Promise<boolean> {
    if (skipIfNoCredentials && !isPlaywrightConfigured()) {
        log('Skipping login test (no credentials)...');
        info('Set BOL_PARTNER_EMAIL and BOL_PARTNER_PASSWORD to test login');
        return true;
    }

    log('Testing login flow...');

    try {
        const service = getBolPlaywrightService();
        const loginSuccess = await service.login();

        if (loginSuccess) {
            success('Login successful');

            // Test deeplink generation
            log('Testing deeplink generation...');
            const deeplink = await service.generateDeeplink(
                'https://www.bol.com/nl/nl/p/test-product/1234567890/'
            );

            if (deeplink.success) {
                success('Deeplink generated');
                info(`Original: ${deeplink.originalUrl}`);
                info(`Affiliate: ${deeplink.affiliateUrl}`);
                if (deeplink.shortUrl) {
                    info(`Short URL: ${deeplink.shortUrl}`);
                }
            } else {
                fail(`Deeplink generation failed: ${deeplink.error}`);
            }

            return true;
        } else {
            fail('Login failed');
            return false;
        }
    } catch (error) {
        fail(`Login error: ${error}`);
        return false;
    }
}

async function cleanup(): Promise<void> {
    log('Cleaning up...');

    try {
        const service = getBolPlaywrightService();
        await service.close();
        success('Browser closed');
    } catch (error) {
        fail(`Cleanup error: ${error}`);
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
    console.log('='.repeat(60));
    console.log('Playwright Bol.com Integration Test Suite');
    console.log('='.repeat(60));

    const results: { name: string; passed: boolean }[] = [];

    // Run tests
    const hasCredentials = await testConfiguration();
    results.push({ name: 'Configuration', passed: hasCredentials || true });

    const browserOk = await testBrowserInitialization();
    results.push({ name: 'Browser Init', passed: browserOk });

    if (browserOk) {
        const mediaOk = await testMediaScraping();
        results.push({ name: 'Media Scraping', passed: mediaOk });

        const unifiedOk = await testUnifiedService();
        results.push({ name: 'Unified Service', passed: unifiedOk });

        // Only test login if we have credentials
        const loginOk = await testLoginFlow(!hasCredentials);
        results.push({ name: 'Login Flow', passed: loginOk });
    }

    // Cleanup
    await cleanup();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));

    let allPassed = true;
    for (const result of results) {
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${status}: ${result.name}`);
        if (!result.passed) allPassed = false;
    }

    console.log('='.repeat(60));

    if (allPassed) {
        console.log('\n✓ All tests passed!\n');
        process.exit(0);
    } else {
        console.log('\n✗ Some tests failed.\n');
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Test suite error:', error);
    process.exit(1);
});
