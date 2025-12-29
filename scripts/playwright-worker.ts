/**
 * Playwright Automation Worker
 *
 * Background worker that handles Playwright-based automation tasks:
 * - Periodic login refresh to keep sessions alive
 * - Batch affiliate link generation
 * - Scheduled media downloads
 *
 * Run with: npm run playwright:worker
 *
 * @module scripts/playwright-worker
 */

import { getBolPlaywrightService, isPlaywrightConfigured } from '../services/bolcom/playwright-service';
import { getUnifiedBolService } from '../services/bolcom/unified-service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // How often to refresh the login session (in ms)
    sessionRefreshInterval: 4 * 60 * 60 * 1000, // 4 hours

    // How often to check for pending tasks (in ms)
    taskCheckInterval: 60 * 1000, // 1 minute

    // Maximum retries for failed operations
    maxRetries: 3,

    // Delay between retries (in ms)
    retryDelay: 5000,
};

// ============================================================================
// WORKER STATE
// ============================================================================

let isRunning = false;
let lastSessionRefresh: Date | null = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message: string): void {
    console.log(`[${new Date().toISOString()}] [PlaywrightWorker] ${message}`);
}

function error(message: string, err?: unknown): void {
    console.error(`[${new Date().toISOString()}] [PlaywrightWorker] ERROR: ${message}`, err || '');
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TASK HANDLERS
// ============================================================================

/**
 * Refresh the Bol.com Partner Plaza session
 */
async function refreshSession(): Promise<boolean> {
    log('Refreshing Partner Plaza session...');

    try {
        const service = getBolPlaywrightService();
        await service.initialize();

        const isLoggedIn = await service.isLoggedIn();

        if (!isLoggedIn) {
            log('Session expired, logging in...');
            const success = await service.login();

            if (success) {
                log('Login successful');
                lastSessionRefresh = new Date();
                return true;
            } else {
                error('Login failed');
                return false;
            }
        }

        log('Session still valid');
        lastSessionRefresh = new Date();
        return true;
    } catch (err) {
        error('Session refresh failed', err);
        return false;
    }
}

/**
 * Process pending affiliate link generation tasks
 * (This would connect to a task queue in production)
 */
async function processPendingTasks(): Promise<void> {
    // In a production environment, this would:
    // 1. Check a database/queue for pending affiliate link requests
    // 2. Process them using the unified service
    // 3. Update the database with results
    //
    // For now, this is a placeholder that can be extended

    log('Checking for pending tasks...');

    // Example: Process any queued affiliate link requests
    // const pendingLinks = await getPendingAffiliateLinks();
    // for (const link of pendingLinks) {
    //     const result = await getUnifiedBolService().getAffiliateLink(link.url);
    //     await updateAffiliateLink(link.id, result);
    // }
}

/**
 * Health check - verify services are working
 */
async function healthCheck(): Promise<boolean> {
    try {
        const unified = getUnifiedBolService();
        const status = await unified.getStatus();

        log(`Health check - API: ${status.api.available ? 'OK' : 'FAIL'}, Playwright: ${status.playwright.loggedIn ? 'OK' : 'NOT LOGGED IN'}`);

        return status.api.available;
    } catch (err) {
        error('Health check failed', err);
        return false;
    }
}

// ============================================================================
// MAIN WORKER LOOP
// ============================================================================

async function runWorker(): Promise<void> {
    if (!isPlaywrightConfigured()) {
        error('Playwright not configured. Set BOL_PARTNER_EMAIL and BOL_PARTNER_PASSWORD environment variables.');
        process.exit(1);
    }

    log('Starting Playwright automation worker...');
    isRunning = true;

    // Initial session setup
    let retries = 0;
    while (retries < CONFIG.maxRetries) {
        if (await refreshSession()) {
            break;
        }
        retries++;
        log(`Retrying session setup (${retries}/${CONFIG.maxRetries})...`);
        await sleep(CONFIG.retryDelay);
    }

    if (retries >= CONFIG.maxRetries) {
        error('Failed to establish initial session after maximum retries');
        process.exit(1);
    }

    // Main worker loop
    let lastSessionCheck = Date.now();
    let lastTaskCheck = Date.now();

    while (isRunning) {
        try {
            const now = Date.now();

            // Refresh session periodically
            if (now - lastSessionCheck >= CONFIG.sessionRefreshInterval) {
                await refreshSession();
                lastSessionCheck = now;
            }

            // Check for pending tasks
            if (now - lastTaskCheck >= CONFIG.taskCheckInterval) {
                await processPendingTasks();
                lastTaskCheck = now;
            }

            // Small sleep to prevent tight loop
            await sleep(1000);
        } catch (err) {
            error('Worker loop error', err);
            await sleep(5000);
        }
    }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown(): Promise<void> {
    log('Shutting down worker...');
    isRunning = false;

    try {
        const service = getBolPlaywrightService();
        await service.close();
        log('Browser closed');
    } catch (err) {
        error('Error during shutdown', err);
    }

    process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    error('Uncaught exception', err);
    shutdown();
});

process.on('unhandledRejection', (reason) => {
    error('Unhandled rejection', reason);
});

// ============================================================================
// START WORKER
// ============================================================================

runWorker().catch((err) => {
    error('Worker failed to start', err);
    process.exit(1);
});
