/**
 * Bol.com Services Index
 *
 * Central export point for all Bol.com related services.
 * Use the unified service for most operations - it automatically
 * combines API and Playwright capabilities.
 *
 * @module services/bolcom
 */

// API Client
export { bolApiClient, BolApiError } from './api-client';
export type { RequestOptions, ApiResponse } from './api-client';

// Product Service (API-based)
export { bolProductService } from './products';

// Affiliate Service (API-based)
export { bolAffiliateService } from './affiliate';

// Sync Service
export { bolSyncService } from './sync';

// Playwright Automation Service
export {
    BolPlaywrightService,
    getBolPlaywrightService,
    isPlaywrightConfigured,
} from './playwright-service';
export type {
    BolCredentials,
    DeeplinkResult,
    MediaItem,
    MediaDownloadResult,
    SessionState,
} from './playwright-service';

// Unified Service (recommended for most use cases)
export {
    UnifiedBolService,
    getUnifiedBolService,
    unifiedBolService,
} from './unified-service';
export type {
    UnifiedProductResult,
    UnifiedMediaResult,
    UnifiedAffiliateResult,
    ServiceStatus,
} from './unified-service';

// Default export: unified service for convenience
export { unifiedBolService as default } from './unified-service';
